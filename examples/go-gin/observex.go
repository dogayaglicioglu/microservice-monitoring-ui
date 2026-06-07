// Drop this file into your Go/gin service, call observex.Register(r, cfg) once.
// It exposes /health, /metrics, and /logs — the three endpoints ObserveX needs.
package observex

import (
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

// Config holds static service metadata returned by /health.
type Config struct {
	Name    string // e.g. "auth-service"
	Version string // e.g. "v1.2.3"
	Region  string // e.g. "us-east-1"
}

// LogEntry is one line in the /logs response.
type LogEntry struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Service   string `json:"service"`
	Level     string `json:"level"`
	TraceID   string `json:"traceId"`
	Message   string `json:"message"`
}

var (
	cfg       Config
	startTime = time.Now()

	totalReqs  atomic.Int64
	errorReqs  atomic.Int64

	latMu     sync.Mutex
	latencies []float64 // last 100 request durations in ms

	rpsMu      sync.Mutex
	rpsCounter int64
	currentRPS float64

	logMu  sync.RWMutex
	logBuf []LogEntry
	logSeq atomic.Int64
)

func init() {
	// Tick every second to compute RPS from the counter
	go func() {
		for range time.Tick(time.Second) {
			rpsMu.Lock()
			currentRPS = float64(rpsCounter)
			rpsCounter = 0
			rpsMu.Unlock()
		}
	}()
}

// Register wires up the three ObserveX endpoints and the request instrumentation
// middleware. Call this once after creating your gin.Engine.
func Register(r *gin.Engine, c Config) {
	cfg = c

	r.Use(instrument())

	r.GET("/health", handleHealth)
	r.GET("/metrics", handleMetrics)
	r.GET("/logs", handleLogs)
}

// AppendLog pushes a log entry into the ring buffer. Call this from your
// existing logger whenever you want a line to appear in the ObserveX Log Explorer.
func AppendLog(level, message, traceID string) {
	entry := LogEntry{
		ID:        cfg.Name + "-" + itoa(logSeq.Add(1)),
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Service:   cfg.Name,
		Level:     level,
		TraceID:   traceID,
		Message:   message,
	}
	logMu.Lock()
	logBuf = append([]LogEntry{entry}, logBuf...)
	if len(logBuf) > 200 {
		logBuf = logBuf[:200]
	}
	logMu.Unlock()
}

// instrument returns a gin middleware that counts requests, latency, and errors.
func instrument() gin.HandlerFunc {
	skip := map[string]bool{"/health": true, "/metrics": true, "/logs": true}
	return func(c *gin.Context) {
		if skip[c.Request.URL.Path] {
			c.Next()
			return
		}
		start := time.Now()
		c.Next()

		ms := float64(time.Since(start).Microseconds()) / 1000.0
		totalReqs.Add(1)
		rpsMu.Lock()
		rpsCounter++
		rpsMu.Unlock()

		if c.Writer.Status() >= 400 {
			errorReqs.Add(1)
		}

		latMu.Lock()
		latencies = append(latencies, ms)
		if len(latencies) > 100 {
			latencies = latencies[len(latencies)-100:]
		}
		latMu.Unlock()
	}
}

func handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"service": cfg.Name,
		"status":  "healthy",
		"version": cfg.Version,
		"region":  cfg.Region,
		"uptime":  uptime(),
	})
}

func handleMetrics(c *gin.Context) {
	rpsMu.Lock()
	rps := currentRPS
	rpsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"rps":       rps,
		"latency":   avgLatency(),
		"errorRate": errorRate(),
		"totalReqs": totalReqs.Load(),
	})
}

func handleLogs(c *gin.Context) {
	logMu.RLock()
	defer logMu.RUnlock()
	if logBuf == nil {
		c.JSON(http.StatusOK, []LogEntry{})
		return
	}
	c.JSON(http.StatusOK, logBuf)
}

func avgLatency() float64 {
	latMu.Lock()
	defer latMu.Unlock()
	if len(latencies) == 0 {
		return 0
	}
	sum := 0.0
	for _, l := range latencies {
		sum += l
	}
	return sum / float64(len(latencies))
}

func errorRate() float64 {
	total := totalReqs.Load()
	if total == 0 {
		return 0
	}
	return float64(errorReqs.Load()) / float64(total) * 100
}

func uptime() float64 {
	// Reports 100% minus a penalty proportional to error rate.
	// Replace with your own SLO tracking if needed.
	er := errorRate()
	u := 100.0 - er*0.1
	if u < 0 {
		return 0
	}
	return u
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	buf := [20]byte{}
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[pos:])
}
