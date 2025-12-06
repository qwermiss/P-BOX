package proxy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// SingboxConfig sing-box 配置结构
type SingboxConfig struct {
	Log       SingboxLog        `json:"log"`
	DNS       SingboxDNS        `json:"dns"`
	Inbounds  []SingboxInbound  `json:"inbounds"`
	Outbounds []SingboxOutbound `json:"outbounds"`
	Route     SingboxRoute      `json:"route"`
}

type SingboxLog struct {
	Level     string `json:"level"`
	Timestamp bool   `json:"timestamp"`
}

type SingboxDNS struct {
	Servers []SingboxDNSServer `json:"servers"`
	Rules   []SingboxDNSRule   `json:"rules,omitempty"`
}

type SingboxDNSServer struct {
	Tag     string `json:"tag"`
	Address string `json:"address"`
	Detour  string `json:"detour,omitempty"`
}

type SingboxDNSRule struct {
	Domain   []string `json:"domain,omitempty"`
	GeoSite  []string `json:"geosite,omitempty"`
	Server   string   `json:"server"`
	Outbound string   `json:"outbound,omitempty"`
}

type SingboxInbound struct {
	Type                     string   `json:"type"`
	Tag                      string   `json:"tag"`
	Listen                   string   `json:"listen,omitempty"`
	ListenPort               int      `json:"listen_port,omitempty"`
	Sniff                    bool     `json:"sniff,omitempty"`
	SniffOverrideDestination bool     `json:"sniff_override_destination,omitempty"`
	DomainStrategy           string   `json:"domain_strategy,omitempty"`
	InterfaceName            string   `json:"interface_name,omitempty"`
	MTU                      int      `json:"mtu,omitempty"`
	Inet4Address             []string `json:"inet4_address,omitempty"`
	AutoRoute                bool     `json:"auto_route,omitempty"`
	StrictRoute              bool     `json:"strict_route,omitempty"`
}

type SingboxOutbound struct {
	Type           string            `json:"type"`
	Tag            string            `json:"tag"`
	Server         string            `json:"server,omitempty"`
	ServerPort     int               `json:"server_port,omitempty"`
	Method         string            `json:"method,omitempty"`
	Password       string            `json:"password,omitempty"`
	UUID           string            `json:"uuid,omitempty"`
	Security       string            `json:"security,omitempty"`
	AlterId        int               `json:"alter_id,omitempty"`
	TLS            *SingboxTLS       `json:"tls,omitempty"`
	Transport      *SingboxTransport `json:"transport,omitempty"`
	Outbounds      []string          `json:"outbounds,omitempty"`
	Default        string            `json:"default,omitempty"`
	URL            string            `json:"url,omitempty"`
	Interval       string            `json:"interval,omitempty"`
	InterruptExist bool              `json:"interrupt_exist_connections,omitempty"`
}

type SingboxTLS struct {
	Enabled    bool     `json:"enabled"`
	ServerName string   `json:"server_name,omitempty"`
	Insecure   bool     `json:"insecure,omitempty"`
	ALPN       []string `json:"alpn,omitempty"`
}

type SingboxTransport struct {
	Type    string            `json:"type"`
	Path    string            `json:"path,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

type SingboxRoute struct {
	Rules               []SingboxRouteRule `json:"rules"`
	AutoDetectInterface bool               `json:"auto_detect_interface"`
	FinalOutbound       string             `json:"final,omitempty"`
}

type SingboxRouteRule struct {
	Protocol      []string `json:"protocol,omitempty"`
	Domain        []string `json:"domain,omitempty"`
	DomainSuffix  []string `json:"domain_suffix,omitempty"`
	DomainKeyword []string `json:"domain_keyword,omitempty"`
	IPCidr        []string `json:"ip_cidr,omitempty"`
	GeoIP         []string `json:"geoip,omitempty"`
	GeoSite       []string `json:"geosite,omitempty"`
	Port          []int    `json:"port,omitempty"`
	Outbound      string   `json:"outbound"`
}

// SingboxGenerator sing-box 配置生成器
type SingboxGenerator struct {
	dataDir string
}

func NewSingboxGenerator(dataDir string) *SingboxGenerator {
	return &SingboxGenerator{dataDir: dataDir}
}

// GenerateConfig 生成 sing-box 配置
func (g *SingboxGenerator) GenerateConfig(nodes []ProxyNode, options ConfigGeneratorOptions) (*SingboxConfig, error) {
	if options.MixedPort == 0 {
		options.MixedPort = 7890
	}

	config := &SingboxConfig{
		Log: SingboxLog{
			Level:     "info",
			Timestamp: true,
		},
	}

	// DNS 配置
	config.DNS = g.generateDNS(options)

	// 入站配置
	config.Inbounds = g.generateInbounds(options)

	// 出站配置
	config.Outbounds = g.generateOutbounds(nodes, options)

	// 路由配置
	config.Route = g.generateRoute(options)

	return config, nil
}

func (g *SingboxGenerator) generateDNS(options ConfigGeneratorOptions) SingboxDNS {
	dns := SingboxDNS{
		Servers: []SingboxDNSServer{
			{Tag: "dns-direct", Address: "https://dns.alidns.com/dns-query", Detour: "direct"},
			{Tag: "dns-proxy", Address: "https://dns.google/dns-query", Detour: "proxy"},
			{Tag: "dns-block", Address: "rcode://success"},
		},
		Rules: []SingboxDNSRule{
			{GeoSite: []string{"cn"}, Server: "dns-direct"},
			{GeoSite: []string{"geolocation-!cn"}, Server: "dns-proxy"},
		},
	}
	return dns
}

func (g *SingboxGenerator) generateInbounds(options ConfigGeneratorOptions) []SingboxInbound {
	inbounds := []SingboxInbound{
		{
			Type: "mixed",
			Tag:  "mixed-in",
			Listen: func() string {
				if options.AllowLan {
					return "0.0.0.0"
				}
				return "127.0.0.1"
			}(),
			ListenPort:               options.MixedPort,
			Sniff:                    true,
			SniffOverrideDestination: false,
		},
	}

	// TUN 入站
	if options.EnableTUN {
		inbounds = append(inbounds, SingboxInbound{
			Type:          "tun",
			Tag:           "tun-in",
			InterfaceName: "utun",
			MTU:           9000,
			Inet4Address:  []string{"172.19.0.1/30"},
			AutoRoute:     true,
			StrictRoute:   true,
			Sniff:         true,
		})
	}

	return inbounds
}

func (g *SingboxGenerator) generateOutbounds(nodes []ProxyNode, options ConfigGeneratorOptions) []SingboxOutbound {
	outbounds := []SingboxOutbound{}
	nodeNames := []string{}

	// 转换代理节点
	for _, node := range nodes {
		outbound := g.convertProxyNode(node)
		if outbound != nil {
			outbounds = append(outbounds, *outbound)
			nodeNames = append(nodeNames, node.Name)
		}
	}

	// 添加选择器
	if len(nodeNames) > 0 {
		outbounds = append(outbounds, SingboxOutbound{
			Type:      "selector",
			Tag:       "proxy",
			Outbounds: append([]string{"auto"}, nodeNames...),
			Default:   "auto",
		})

		outbounds = append(outbounds, SingboxOutbound{
			Type:           "urltest",
			Tag:            "auto",
			Outbounds:      nodeNames,
			URL:            "https://www.gstatic.com/generate_204",
			Interval:       "300s",
			InterruptExist: true,
		})
	}

	// 直连和阻止
	outbounds = append(outbounds,
		SingboxOutbound{Type: "direct", Tag: "direct"},
		SingboxOutbound{Type: "block", Tag: "block"},
		SingboxOutbound{Type: "dns", Tag: "dns-out"},
	)

	return outbounds
}

func (g *SingboxGenerator) convertProxyNode(node ProxyNode) *SingboxOutbound {
	outbound := &SingboxOutbound{
		Tag:        node.Name,
		Server:     node.Server,
		ServerPort: node.Port,
	}

	// 如果有完整配置，解析它
	if node.Config != "" {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(node.Config), &config); err == nil {
			return g.convertFromConfig(node.Name, config)
		}
	}

	nodeType := strings.ToLower(node.Type)

	switch nodeType {
	case "ss", "shadowsocks":
		outbound.Type = "shadowsocks"
	case "vmess":
		outbound.Type = "vmess"
	case "vless":
		outbound.Type = "vless"
	case "trojan":
		outbound.Type = "trojan"
	case "hysteria2", "hy2":
		outbound.Type = "hysteria2"
	case "socks", "socks5":
		outbound.Type = "socks"
	case "http":
		outbound.Type = "http"
	default:
		return nil
	}

	return outbound
}

func (g *SingboxGenerator) convertFromConfig(name string, config map[string]interface{}) *SingboxOutbound {
	outbound := &SingboxOutbound{Tag: name}

	nodeType, _ := config["type"].(string)
	nodeType = strings.ToLower(nodeType)

	switch nodeType {
	case "ss":
		outbound.Type = "shadowsocks"
		outbound.Server, _ = config["server"].(string)
		if port, ok := config["port"].(float64); ok {
			outbound.ServerPort = int(port)
		}
		outbound.Method, _ = config["cipher"].(string)
		outbound.Password, _ = config["password"].(string)

	case "vmess":
		outbound.Type = "vmess"
		outbound.Server, _ = config["server"].(string)
		if port, ok := config["port"].(float64); ok {
			outbound.ServerPort = int(port)
		}
		outbound.UUID, _ = config["uuid"].(string)
		if alterId, ok := config["alterId"].(float64); ok {
			outbound.AlterId = int(alterId)
		}
		outbound.Security, _ = config["cipher"].(string)
		if outbound.Security == "" {
			outbound.Security = "auto"
		}

		// TLS
		if tls, ok := config["tls"].(bool); ok && tls {
			outbound.TLS = &SingboxTLS{
				Enabled:    true,
				ServerName: getStringOr(config, "sni", outbound.Server),
				Insecure:   getBool(config, "skip-cert-verify"),
			}
		}

		// Transport
		if network, ok := config["network"].(string); ok && network != "tcp" {
			outbound.Transport = &SingboxTransport{Type: network}
			if wsOpts, ok := config["ws-opts"].(map[string]interface{}); ok {
				outbound.Transport.Path, _ = wsOpts["path"].(string)
				if headers, ok := wsOpts["headers"].(map[string]interface{}); ok {
					outbound.Transport.Headers = make(map[string]string)
					for k, v := range headers {
						outbound.Transport.Headers[k], _ = v.(string)
					}
				}
			}
		}

	case "trojan":
		outbound.Type = "trojan"
		outbound.Server, _ = config["server"].(string)
		if port, ok := config["port"].(float64); ok {
			outbound.ServerPort = int(port)
		}
		outbound.Password, _ = config["password"].(string)
		outbound.TLS = &SingboxTLS{
			Enabled:    true,
			ServerName: getStringOr(config, "sni", outbound.Server),
			Insecure:   getBool(config, "skip-cert-verify"),
		}

	case "vless":
		outbound.Type = "vless"
		outbound.Server, _ = config["server"].(string)
		if port, ok := config["port"].(float64); ok {
			outbound.ServerPort = int(port)
		}
		outbound.UUID, _ = config["uuid"].(string)

	default:
		return nil
	}

	return outbound
}

func (g *SingboxGenerator) generateRoute(options ConfigGeneratorOptions) SingboxRoute {
	route := SingboxRoute{
		AutoDetectInterface: true,
		FinalOutbound:       "proxy",
		Rules: []SingboxRouteRule{
			// DNS 劫持
			{Protocol: []string{"dns"}, Outbound: "dns-out"},
			// 私有地址直连
			{IPCidr: []string{"127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}, Outbound: "direct"},
			// 中国直连
			{GeoIP: []string{"cn"}, Outbound: "direct"},
			{GeoSite: []string{"cn"}, Outbound: "direct"},
			// 广告拦截
			{GeoSite: []string{"category-ads-all"}, Outbound: "block"},
		},
	}
	return route
}

// SaveConfig 保存配置到文件
func (g *SingboxGenerator) SaveConfig(config *SingboxConfig, filename string) (string, error) {
	configDir := filepath.Join(g.dataDir, "configs")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}

	if !strings.HasSuffix(filename, ".json") {
		filename += ".json"
	}

	filePath := filepath.Join(configDir, filename)

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", err
	}

	return filePath, nil
}

// Helper functions
func getStringOr(m map[string]interface{}, key, defaultVal string) string {
	if v, ok := m[key].(string); ok && v != "" {
		return v
	}
	return defaultVal
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}
