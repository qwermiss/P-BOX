package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// SystemConfig 系统配置
type SystemConfig struct {
	AutoStart    bool `json:"autoStart"`    // 开机自启
	IPForward    bool `json:"ipForward"`    // IP 转发
	BBREnabled   bool `json:"bbrEnabled"`   // BBR 拥塞控制
	TUNOptimized bool `json:"tunOptimized"` // TUN 优化
}

// Service 系统服务
type Service struct {
	dataDir    string
	binaryPath string
}

// NewService 创建系统服务
func NewService(dataDir string) *Service {
	// 获取当前执行文件路径
	execPath, _ := os.Executable()
	return &Service{
		dataDir:    dataDir,
		binaryPath: execPath,
	}
}

// GetConfig 获取系统配置
func (s *Service) GetConfig() *SystemConfig {
	return &SystemConfig{
		AutoStart:    s.IsAutoStartEnabled(),
		IPForward:    s.IsIPForwardEnabled(),
		BBREnabled:   s.IsBBREnabled(),
		TUNOptimized: s.IsTUNOptimized(),
	}
}

// SetAutoStart 设置开机自启
func (s *Service) SetAutoStart(enabled bool) error {
	if enabled {
		return s.enableAutoStart()
	}
	return s.disableAutoStart()
}

// IsAutoStartEnabled 检查是否已开启自启
func (s *Service) IsAutoStartEnabled() bool {
	// 检查 systemd 服务是否存在且启用
	cmd := exec.Command("systemctl", "is-enabled", "p-box")
	output, _ := cmd.Output()
	return strings.TrimSpace(string(output)) == "enabled"
}

// enableAutoStart 启用开机自启
func (s *Service) enableAutoStart() error {
	// 生成 systemd 服务文件
	serviceContent := fmt.Sprintf(`[Unit]
Description=P-BOX Proxy Gateway
After=network.target

[Service]
Type=simple
ExecStart=%s
WorkingDirectory=%s
Restart=always
RestartSec=5
LimitNOFILE=1048576

# 安全配置
NoNewPrivileges=false
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW

[Install]
WantedBy=multi-user.target
`, s.binaryPath, filepath.Dir(s.binaryPath))

	servicePath := "/etc/systemd/system/p-box.service"
	if err := os.WriteFile(servicePath, []byte(serviceContent), 0644); err != nil {
		return fmt.Errorf("写入服务文件失败: %v", err)
	}

	// 重新加载 systemd
	if err := exec.Command("systemctl", "daemon-reload").Run(); err != nil {
		return fmt.Errorf("重新加载 systemd 失败: %v", err)
	}

	// 启用服务
	if err := exec.Command("systemctl", "enable", "p-box").Run(); err != nil {
		return fmt.Errorf("启用服务失败: %v", err)
	}

	return nil
}

// disableAutoStart 禁用开机自启
func (s *Service) disableAutoStart() error {
	exec.Command("systemctl", "disable", "p-box").Run()
	exec.Command("systemctl", "stop", "p-box").Run()
	os.Remove("/etc/systemd/system/p-box.service")
	exec.Command("systemctl", "daemon-reload").Run()
	return nil
}

// SetIPForward 设置 IP 转发
func (s *Service) SetIPForward(enabled bool) error {
	value := "0"
	if enabled {
		value = "1"
	}

	// 设置 IPv4 转发
	if err := os.WriteFile("/proc/sys/net/ipv4/ip_forward", []byte(value), 0644); err != nil {
		return fmt.Errorf("设置 IPv4 转发失败: %v", err)
	}

	// 设置 IPv6 转发
	os.WriteFile("/proc/sys/net/ipv6/conf/all/forwarding", []byte(value), 0644)

	// 持久化配置
	return s.persistSysctl("net.ipv4.ip_forward", value, "net.ipv6.conf.all.forwarding", value)
}

// IsIPForwardEnabled 检查 IP 转发是否开启
func (s *Service) IsIPForwardEnabled() bool {
	data, err := os.ReadFile("/proc/sys/net/ipv4/ip_forward")
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(data)) == "1"
}

// SetBBR 设置 BBR 拥塞控制
func (s *Service) SetBBR(enabled bool) error {
	if enabled {
		// 设置 fq 队列调度
		if err := os.WriteFile("/proc/sys/net/core/default_qdisc", []byte("fq"), 0644); err != nil {
			return fmt.Errorf("设置队列调度失败: %v", err)
		}
		// 设置 BBR
		if err := os.WriteFile("/proc/sys/net/ipv4/tcp_congestion_control", []byte("bbr"), 0644); err != nil {
			return fmt.Errorf("设置 BBR 失败: %v", err)
		}
		return s.persistSysctl("net.core.default_qdisc", "fq", "net.ipv4.tcp_congestion_control", "bbr")
	} else {
		os.WriteFile("/proc/sys/net/core/default_qdisc", []byte("pfifo_fast"), 0644)
		os.WriteFile("/proc/sys/net/ipv4/tcp_congestion_control", []byte("cubic"), 0644)
		return s.persistSysctl("net.core.default_qdisc", "pfifo_fast", "net.ipv4.tcp_congestion_control", "cubic")
	}
}

// IsBBREnabled 检查 BBR 是否开启
func (s *Service) IsBBREnabled() bool {
	data, err := os.ReadFile("/proc/sys/net/ipv4/tcp_congestion_control")
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(data)) == "bbr"
}

// SetTUNOptimize 设置 TUN 模式优化
func (s *Service) SetTUNOptimize(enabled bool) error {
	if enabled {
		// 优化设置
		optimizations := map[string]string{
			"/proc/sys/net/core/rmem_max":                  "16777216",
			"/proc/sys/net/core/wmem_max":                  "16777216",
			"/proc/sys/net/ipv4/tcp_rmem":                  "4096 87380 16777216",
			"/proc/sys/net/ipv4/tcp_wmem":                  "4096 65536 16777216",
			"/proc/sys/net/ipv4/tcp_mtu_probing":           "1",
			"/proc/sys/net/ipv4/tcp_fastopen":              "3",
			"/proc/sys/net/ipv4/tcp_slow_start_after_idle": "0",
		}
		for path, value := range optimizations {
			os.WriteFile(path, []byte(value), 0644)
		}
		return s.persistSysctl(
			"net.core.rmem_max", "16777216",
			"net.core.wmem_max", "16777216",
			"net.ipv4.tcp_mtu_probing", "1",
			"net.ipv4.tcp_fastopen", "3",
			"net.ipv4.tcp_slow_start_after_idle", "0",
		)
	}
	return nil
}

// IsTUNOptimized 检查 TUN 优化是否开启
func (s *Service) IsTUNOptimized() bool {
	data, err := os.ReadFile("/proc/sys/net/ipv4/tcp_fastopen")
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(data)) == "3"
}

// persistSysctl 持久化 sysctl 配置
func (s *Service) persistSysctl(keyValues ...string) error {
	configPath := "/etc/sysctl.d/99-p-box.conf"

	// 读取现有配置
	existingContent := ""
	if data, err := os.ReadFile(configPath); err == nil {
		existingContent = string(data)
	}

	// 构建新配置
	lines := make(map[string]string)
	for _, line := range strings.Split(existingContent, "\n") {
		if strings.Contains(line, "=") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				lines[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			}
		}
	}

	// 更新配置
	for i := 0; i < len(keyValues); i += 2 {
		if i+1 < len(keyValues) {
			lines[keyValues[i]] = keyValues[i+1]
		}
	}

	// 写入文件
	var content strings.Builder
	content.WriteString("# P-BOX 系统优化配置\n")
	for key, value := range lines {
		content.WriteString(fmt.Sprintf("%s = %s\n", key, value))
	}

	if err := os.WriteFile(configPath, []byte(content.String()), 0644); err != nil {
		return err
	}

	// 应用配置
	exec.Command("sysctl", "-p", configPath).Run()
	return nil
}

// ApplyAllOptimizations 一键应用所有优化
func (s *Service) ApplyAllOptimizations() error {
	if err := s.SetIPForward(true); err != nil {
		return err
	}
	if err := s.SetBBR(true); err != nil {
		return err
	}
	if err := s.SetTUNOptimize(true); err != nil {
		return err
	}
	return nil
}
