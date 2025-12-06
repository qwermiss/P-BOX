package system

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler 系统管理 API 处理器
type Handler struct {
	service *Service
}

// NewHandler 创建处理器
func NewHandler(dataDir string) *Handler {
	return &Handler{
		service: NewService(dataDir),
	}
}

// RegisterRoutes 注册路由
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/config", h.GetConfig)
	r.PUT("/autostart", h.SetAutoStart)
	r.PUT("/ipforward", h.SetIPForward)
	r.PUT("/bbr", h.SetBBR)
	r.PUT("/tunoptimize", h.SetTUNOptimize)
	r.POST("/optimize-all", h.OptimizeAll)
}

// GetConfig 获取系统配置
func (h *Handler) GetConfig(c *gin.Context) {
	config := h.service.GetConfig()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    config,
	})
}

// SetAutoStart 设置开机自启
func (h *Handler) SetAutoStart(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	if err := h.service.SetAutoStart(req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	msg := "开机自启已关闭"
	if req.Enabled {
		msg = "开机自启已开启"
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": msg})
}

// SetIPForward 设置 IP 转发
func (h *Handler) SetIPForward(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	if err := h.service.SetIPForward(req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	msg := "IP 转发已关闭"
	if req.Enabled {
		msg = "IP 转发已开启"
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": msg})
}

// SetBBR 设置 BBR
func (h *Handler) SetBBR(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	if err := h.service.SetBBR(req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	msg := "BBR 拥塞控制已关闭"
	if req.Enabled {
		msg = "BBR 拥塞控制已开启"
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": msg})
}

// SetTUNOptimize 设置 TUN 优化
func (h *Handler) SetTUNOptimize(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	if err := h.service.SetTUNOptimize(req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	msg := "TUN 优化已关闭"
	if req.Enabled {
		msg = "TUN 网络优化已开启"
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": msg})
}

// OptimizeAll 一键优化
func (h *Handler) OptimizeAll(c *gin.Context) {
	if err := h.service.ApplyAllOptimizations(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "已开启所有优化：IP转发、BBR、TUN优化",
	})
}
