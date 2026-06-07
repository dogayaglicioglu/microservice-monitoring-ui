package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	sdkresource "go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

const svcName = "aggregator"

// -- OTel setup --

func initTracer(ctx context.Context) func(context.Context) error {
	var exporter sdktrace.SpanExporter
	var err error

	if endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); endpoint != "" {
		exporter, err = otlptracehttp.New(ctx,
			otlptracehttp.WithEndpoint(endpoint),
			otlptracehttp.WithInsecure(),
		)
	} else {
		exporter, err = stdouttrace.New(stdouttrace.WithWriter(io.Discard))
	}
	if err != nil {
		panic(fmt.Sprintf("tracer init: %v", err))
	}

	res, _ := sdkresource.New(ctx,
		sdkresource.WithAttributes(
			semconv.ServiceName(svcName),
			semconv.ServiceVersion("v1.0.0"),
		),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	return tp.Shutdown
}

// -- HTTP client with OTel trace propagation --

var httpClient = &http.Client{
	Transport: otelhttp.NewTransport(http.DefaultTransport),
	Timeout:   5 * time.Second,
}

// -- Service registry --

type ServiceEntry struct {
	Name    string
	BaseURL string
}

// loadRegistry reads SERVICES=name=url,name=url,... with a built-in fallback.
func loadRegistry() []ServiceEntry {
	raw := os.Getenv("SERVICES")
	if raw == "" {
		raw = "auth-service=http://localhost:3001,order-service=http://localhost:3002"
	}
	var entries []ServiceEntry
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		idx := strings.Index(part, "=")
		if idx < 0 {
			continue
		}
		name := strings.TrimSpace(part[:idx])
		url := strings.TrimSpace(part[idx+1:])
		if name != "" && url != "" {
			entries = append(entries, ServiceEntry{Name: name, BaseURL: url})
		}
	}
	return entries
}

var registry []ServiceEntry

// -- HTTP helper --

func getJSON(ctx context.Context, url string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, target)
}

// -- Metrics history (sliding window of 30 snapshots) --

var (
	histMu     sync.RWMutex
	rpsHistory []map[string]any
	latHistory []map[string]any
)

func runCollect() {
	ctx := context.Background()

	type result struct {
		name string
		rps  float64
		lat  float64
	}

	results := make([]result, len(registry))
	var wg sync.WaitGroup
	for i, svc := range registry {
		wg.Add(1)
		go func(i int, svc ServiceEntry) {
			defer wg.Done()
			var m map[string]any
			getJSON(ctx, svc.BaseURL+"/metrics", &m)
			results[i].name = svc.Name
			if m != nil {
				results[i].rps, _ = m["rps"].(float64)
				results[i].lat, _ = m["latency"].(float64)
			}
		}(i, svc)
	}
	wg.Wait()

	label := time.Now().Format("15:04:05")
	rpsPoint := map[string]any{"time": label}
	latPoint := map[string]any{"time": label}
	for _, r := range results {
		rpsPoint[r.name] = r.rps
		latPoint[r.name] = r.lat
	}

	histMu.Lock()
	rpsHistory = append(rpsHistory, rpsPoint)
	if len(rpsHistory) > 30 {
		rpsHistory = rpsHistory[len(rpsHistory)-30:]
	}
	latHistory = append(latHistory, latPoint)
	if len(latHistory) > 30 {
		latHistory = latHistory[len(latHistory)-30:]
	}
	histMu.Unlock()
}

// -- CORS middleware --

func cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// -- Service info builder --

type ServiceInfo struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Latency   float64 `json:"latency"`
	Uptime    float64 `json:"uptime"`
	RPS       float64 `json:"rps"`
	ErrorRate float64 `json:"errorRate"`
	Instances int     `json:"instances"`
	Version   string  `json:"version"`
	Region    string  `json:"region"`
}

func fetchService(ctx context.Context, healthURL, metricsURL string) ServiceInfo {
	var health, metrics map[string]any
	getJSON(ctx, healthURL, &health)
	getJSON(ctx, metricsURL, &metrics)

	info := ServiceInfo{Instances: 1}
	if health != nil {
		info.ID, _ = health["service"].(string)
		info.Name = info.ID
		info.Status, _ = health["status"].(string)
		info.Version, _ = health["version"].(string)
		info.Region, _ = health["region"].(string)
		info.Uptime, _ = health["uptime"].(float64)
		if v, ok := health["instances"].(float64); ok {
			info.Instances = int(v)
		}
	}
	if metrics != nil {
		info.Latency, _ = metrics["latency"].(float64)
		info.RPS, _ = metrics["rps"].(float64)
		info.ErrorRate, _ = metrics["errorRate"].(float64)
	}
	if info.Status == "" {
		info.Status = "down"
	}
	return info
}

// -- Main --

func main() {
	ctx := context.Background()
	shutdown := initTracer(ctx)
	defer shutdown(ctx)

	registry = loadRegistry()

	go func() {
		runCollect()
		for range time.Tick(10 * time.Second) {
			runCollect()
		}
	}()

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	r.Use(cors())
	r.Use(otelgin.Middleware(svcName))

	r.GET("/api/services", func(c *gin.Context) {
		rctx := c.Request.Context()
		results := make([]ServiceInfo, len(registry))
		var wg sync.WaitGroup
		for i, svc := range registry {
			wg.Add(1)
			go func(i int, svc ServiceEntry) {
				defer wg.Done()
				results[i] = fetchService(rctx,
					svc.BaseURL+"/health",
					svc.BaseURL+"/metrics",
				)
			}(i, svc)
		}
		wg.Wait()
		c.JSON(http.StatusOK, results)
	})

	r.GET("/api/kpis", func(c *gin.Context) {
		rctx := c.Request.Context()
		allMetrics := make([]map[string]any, len(registry))
		var wg sync.WaitGroup
		for i, svc := range registry {
			wg.Add(1)
			go func(i int, svc ServiceEntry) {
				defer wg.Done()
				getJSON(rctx, svc.BaseURL+"/metrics", &allMetrics[i])
			}(i, svc)
		}
		wg.Wait()

		totalReqs := int64(0)
		avgLatency := 0.0
		avgError := 0.0
		active := 0
		for _, m := range allMetrics {
			if m == nil {
				continue
			}
			active++
			if v, ok := m["totalReqs"].(float64); ok {
				totalReqs += int64(v)
			}
			if v, ok := m["latency"].(float64); ok {
				avgLatency += v
			}
			if v, ok := m["errorRate"].(float64); ok {
				avgError += v
			}
		}
		if active > 0 {
			avgLatency /= float64(active)
			avgError /= float64(active)
		}
		c.JSON(http.StatusOK, gin.H{
			"totalRequests":  totalReqs,
			"errorRate":      math.Round(avgError*100) / 100,
			"avgLatency":     math.Round(avgLatency),
			"activeServices": active,
		})
	})

	r.GET("/api/metrics/rps", func(c *gin.Context) {
		histMu.RLock()
		defer histMu.RUnlock()
		c.JSON(http.StatusOK, rpsHistory)
	})

	r.GET("/api/metrics/latency", func(c *gin.Context) {
		histMu.RLock()
		defer histMu.RUnlock()
		c.JSON(http.StatusOK, latHistory)
	})

	r.GET("/api/logs", func(c *gin.Context) {
		rctx := c.Request.Context()
		allLogs := make([][]map[string]any, len(registry))
		var wg sync.WaitGroup
		for i, svc := range registry {
			wg.Add(1)
			go func(i int, svc ServiceEntry) {
				defer wg.Done()
				getJSON(rctx, svc.BaseURL+"/logs", &allLogs[i])
			}(i, svc)
		}
		wg.Wait()

		var merged []map[string]any
		for _, logs := range allLogs {
			merged = append(merged, logs...)
		}
		sort.Slice(merged, func(i, j int) bool {
			ti, _ := merged[i]["timestamp"].(string)
			tj, _ := merged[j]["timestamp"].(string)
			return ti > tj
		})
		if len(merged) > 200 {
			merged = merged[:200]
		}
		c.JSON(http.StatusOK, merged)
	})

	r.Run(":4000")
}
