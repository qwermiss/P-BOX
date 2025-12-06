package core

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

type CoreType string

const (
	CoreTypeMihomo  CoreType = "mihomo"
	CoreTypeSingbox CoreType = "singbox"
)

type CoreStatus struct {
	CurrentCore CoreType         `json:"currentCore"`
	Cores       map[string]*Core `json:"cores"`
}

type Core struct {
	Name          string `json:"name"`
	Version       string `json:"version"`
	LatestVersion string `json:"latestVersion"`
	Installed     bool   `json:"installed"`
	Path          string `json:"path"`
}

type DownloadProgress struct {
	Downloading bool    `json:"downloading"`
	Progress    float64 `json:"progress"`
	Speed       int64   `json:"speed"`
	Error       string  `json:"error,omitempty"`
}

type Service struct {
	dataDir          string
	currentCore      CoreType
	cores            map[string]*Core
	downloadProgress map[string]*DownloadProgress
	mu               sync.RWMutex
}

// 持久化状态
type SavedCoreStatus struct {
	CurrentCore string            `json:"currentCore"`
	Versions    map[string]string `json:"versions"`
}

func NewService(dataDir string) *Service {
	s := &Service{
		dataDir:          dataDir,
		currentCore:      CoreTypeMihomo,
		cores:            make(map[string]*Core),
		downloadProgress: make(map[string]*DownloadProgress),
	}

	s.cores["mihomo"] = &Core{
		Name:      "Mihomo",
		Installed: false,
		Path:      filepath.Join(dataDir, "cores", "mihomo"),
	}
	s.cores["singbox"] = &Core{
		Name:      "sing-box",
		Installed: false,
		Path:      filepath.Join(dataDir, "cores", "sing-box"),
	}

	s.loadSavedStatus()
	s.checkInstalledCores()
	return s
}

func (s *Service) loadSavedStatus() {
	filePath := filepath.Join(s.dataDir, "core_status.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return
	}

	var saved SavedCoreStatus
	if err := json.Unmarshal(data, &saved); err != nil {
		return
	}

	if saved.CurrentCore != "" {
		s.currentCore = CoreType(saved.CurrentCore)
	}

	for name, version := range saved.Versions {
		if core, ok := s.cores[name]; ok {
			core.Version = version
			if version != "" {
				core.Installed = true
			}
		}
	}
}

func (s *Service) saveStatus() error {
	s.mu.RLock()
	saved := SavedCoreStatus{
		CurrentCore: string(s.currentCore),
		Versions:    make(map[string]string),
	}
	for name, core := range s.cores {
		if core.Installed {
			saved.Versions[name] = core.Version
		}
	}
	s.mu.RUnlock()

	data, err := json.MarshalIndent(saved, "", "  ")
	if err != nil {
		return err
	}

	filePath := filepath.Join(s.dataDir, "core_status.json")
	return os.WriteFile(filePath, data, 0644)
}

func (s *Service) checkInstalledCores() {
	for name, core := range s.cores {
		binPath := s.getCoreBinaryPath(name)
		if _, err := os.Stat(binPath); err == nil {
			core.Installed = true
			core.Version = s.getCoreVersion(name)
		}
	}
}

func (s *Service) getCoreBinaryPath(coreType string) string {
	arch := runtime.GOARCH
	goos := runtime.GOOS

	var binName string
	switch coreType {
	case "mihomo":
		binName = fmt.Sprintf("mihomo-%s-%s", goos, arch)
	case "singbox":
		binName = fmt.Sprintf("sing-box-%s-%s", goos, arch)
	}

	return filepath.Join(s.dataDir, "cores", binName)
}

func (s *Service) getCoreVersion(coreType string) string {
	binPath := s.getCoreBinaryPath(coreType)

	// 执行核心获取版本
	var cmd *exec.Cmd
	switch coreType {
	case "mihomo":
		cmd = exec.Command(binPath, "-v")
	case "singbox":
		cmd = exec.Command(binPath, "version")
	default:
		return "unknown"
	}

	output, err := cmd.Output()
	if err != nil {
		// 如果有保存的版本，使用保存的
		if core, ok := s.cores[coreType]; ok && core.Version != "" {
			return core.Version
		}
		return "unknown"
	}

	// 解析版本号
	outputStr := string(output)
	version := s.parseVersionFromOutput(coreType, outputStr)
	if version != "" {
		return version
	}

	return "unknown"
}

// parseVersionFromOutput 从输出中解析版本号
func (s *Service) parseVersionFromOutput(coreType, output string) string {
	lines := strings.Split(output, "\n")

	switch coreType {
	case "mihomo":
		// Mihomo v1.18.10 darwin arm64 with go1.23.2
		for _, line := range lines {
			if strings.Contains(line, "Mihomo") || strings.Contains(line, "mihomo") {
				parts := strings.Fields(line)
				for _, part := range parts {
					if strings.HasPrefix(part, "v") || strings.HasPrefix(part, "V") {
						return strings.TrimPrefix(strings.TrimPrefix(part, "v"), "V")
					}
				}
			}
		}
	case "singbox":
		// sing-box version 1.10.5
		for _, line := range lines {
			if strings.Contains(line, "version") {
				parts := strings.Fields(line)
				if len(parts) >= 3 {
					return parts[len(parts)-1]
				}
			}
			// 或者直接输出版本号
			line = strings.TrimSpace(line)
			if line != "" && !strings.Contains(line, " ") {
				return line
			}
		}
	}

	return ""
}

func (s *Service) GetStatus() *CoreStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &CoreStatus{
		CurrentCore: s.currentCore,
		Cores:       s.cores,
	}
}

func (s *Service) GetLatestVersions() (map[string]string, error) {
	versions := make(map[string]string)

	mihomoVersion, err := s.fetchMihomoLatestVersion()
	if err == nil {
		versions["mihomo"] = mihomoVersion
		s.mu.Lock()
		s.cores["mihomo"].LatestVersion = mihomoVersion
		s.mu.Unlock()
	}

	singboxVersion, err := s.fetchSingboxLatestVersion()
	if err == nil {
		versions["singbox"] = singboxVersion
		s.mu.Lock()
		s.cores["singbox"].LatestVersion = singboxVersion
		s.mu.Unlock()
	}

	return versions, nil
}

func (s *Service) fetchMihomoLatestVersion() (string, error) {
	resp, err := http.Get("https://api.github.com/repos/MetaCubeX/mihomo/releases/latest")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var release struct {
		TagName string `json:"tag_name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", err
	}

	// 去掉版本号前的 v 前缀
	version := release.TagName
	if len(version) > 0 && version[0] == 'v' {
		version = version[1:]
	}
	return version, nil
}

func (s *Service) fetchSingboxLatestVersion() (string, error) {
	resp, err := http.Get("https://api.github.com/repos/SagerNet/sing-box/releases/latest")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var release struct {
		TagName string `json:"tag_name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", err
	}

	// 去掉版本号前的 v 前缀
	version := release.TagName
	if len(version) > 0 && version[0] == 'v' {
		version = version[1:]
	}
	return version, nil
}

func (s *Service) SwitchCore(coreType string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	core, ok := s.cores[coreType]
	if !ok {
		return fmt.Errorf("unknown core type: %s", coreType)
	}

	if !core.Installed {
		return fmt.Errorf("core %s is not installed", coreType)
	}

	s.currentCore = CoreType(coreType)

	// 持久化保存
	go s.saveStatus()

	return nil
}

func (s *Service) DownloadCore(coreType string) error {
	s.mu.Lock()
	s.downloadProgress[coreType] = &DownloadProgress{Downloading: true}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.downloadProgress[coreType].Downloading = false
		s.mu.Unlock()
	}()

	downloadURL, err := s.getCoreDownloadURL(coreType)
	if err != nil {
		s.mu.Lock()
		s.downloadProgress[coreType].Error = err.Error()
		s.mu.Unlock()
		return err
	}

	fmt.Printf("Downloading %s from %s\n", coreType, downloadURL)

	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("download failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	os.MkdirAll(filepath.Join(s.dataDir, "cores"), 0755)

	// 下载到临时文件
	tmpFile := filepath.Join(s.dataDir, "cores", "download.tmp")
	out, err := os.Create(tmpFile)
	if err != nil {
		return err
	}

	totalSize := resp.ContentLength
	written := int64(0)

	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
			written += int64(n)

			s.mu.Lock()
			if totalSize > 0 {
				s.downloadProgress[coreType].Progress = float64(written) / float64(totalSize) * 100
			}
			s.mu.Unlock()
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			out.Close()
			os.Remove(tmpFile)
			return err
		}
	}
	out.Close()

	// 解压文件
	binPath := s.getCoreBinaryPath(coreType)
	if err := s.extractCore(tmpFile, binPath, coreType); err != nil {
		os.Remove(tmpFile)
		return fmt.Errorf("extract failed: %v", err)
	}
	os.Remove(tmpFile)

	// 设置执行权限
	os.Chmod(binPath, 0755)

	s.mu.Lock()
	s.cores[coreType].Installed = true
	s.cores[coreType].Version = s.cores[coreType].LatestVersion
	s.mu.Unlock()

	// 持久化保存
	s.saveStatus()

	fmt.Printf("%s downloaded and extracted to %s\n", coreType, binPath)
	return nil
}

// extractCore 解压核心文件
func (s *Service) extractCore(archivePath, destPath, coreType string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 创建 gzip reader
	gzr, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("gzip open failed: %v", err)
	}
	defer gzr.Close()

	// Mihomo 是单文件 .gz，sing-box 是 .tar.gz
	if coreType == "mihomo" {
		// 直接解压 gzip
		outFile, err := os.Create(destPath)
		if err != nil {
			return err
		}
		defer outFile.Close()

		_, err = io.Copy(outFile, gzr)
		return err
	}

	// sing-box: tar.gz 格式
	tr := tar.NewReader(gzr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		// 查找可执行文件
		if header.Typeflag == tar.TypeReg && strings.Contains(header.Name, "sing-box") {
			outFile, err := os.Create(destPath)
			if err != nil {
				return err
			}
			defer outFile.Close()

			_, err = io.Copy(outFile, tr)
			return err
		}
	}

	return fmt.Errorf("executable not found in archive")
}

func (s *Service) getCoreDownloadURL(coreType string) (string, error) {
	arch := runtime.GOARCH
	goos := runtime.GOOS

	s.mu.RLock()
	version := s.cores[coreType].LatestVersion
	s.mu.RUnlock()

	if version == "" {
		return "", fmt.Errorf("version not found, please check latest version first")
	}

	// 转换架构名称
	archName := arch
	if arch == "amd64" {
		archName = "amd64"
	} else if arch == "arm64" {
		archName = "arm64"
	}

	// 转换系统名称
	osName := goos
	if goos == "darwin" {
		osName = "darwin"
	}

	switch coreType {
	case "mihomo":
		// mihomo releases 格式: mihomo-darwin-arm64-v1.18.10.gz
		// 或 mihomo-darwin-arm64-compatible-v1.18.10.gz (兼容版)
		return fmt.Sprintf(
			"https://github.com/MetaCubeX/mihomo/releases/download/v%s/mihomo-%s-%s-v%s.gz",
			version, osName, archName, version,
		), nil

	case "singbox":
		// sing-box releases 格式: sing-box-1.10.5-darwin-arm64.tar.gz
		return fmt.Sprintf(
			"https://github.com/SagerNet/sing-box/releases/download/v%s/sing-box-%s-%s-%s.tar.gz",
			version, version, osName, archName,
		), nil
	}

	return "", fmt.Errorf("unknown core type")
}

func (s *Service) GetDownloadProgress(coreType string) *DownloadProgress {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if progress, ok := s.downloadProgress[coreType]; ok {
		return progress
	}
	return &DownloadProgress{}
}
