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
	"strconv"
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

// -- Metrics source (scraping vs Prometheus) --

type metricsSource interface {
	fetch(ctx context.Context, svc ServiceEntry) (rps, lat, errRate float64)
}

type scrapingSource struct{}

func (s *scrapingSource) fetch(ctx context.Context, svc ServiceEntry) (float64, float64, float64) {
	var m map[string]any
	getJSON(ctx, svc.BaseURL+"/metrics", &m)
	if m == nil {
		return 0, 0, 0
	}
	rps, _ := m["rps"].(float64)
	lat, _ := m["latency"].(float64)
	err, _ := m["errorRate"].(float64)
	return rps, lat, err
}

type prometheusSource struct {
	baseURL      string
	serviceLabel string
}

func (p *prometheusSource) fetch(ctx context.Context, svc ServiceEntry) (float64, float64, float64) {
	rps := p.query(ctx, fmt.Sprintf(`rate(http_requests_total{%s="%s"}[1m])`, p.serviceLabel, svc.Name))
	lat := p.query(ctx, fmt.Sprintf(`histogram_quantile(0.5,rate(http_request_duration_seconds_bucket{%s="%s"}[1m]))*1000`, p.serviceLabel, svc.Name))
	errRate := p.query(ctx, fmt.Sprintf(`rate(http_requests_total{%s="%s",status=~"5.."}[1m])/rate(http_requests_total{%s="%s"}[1m])*100`, p.serviceLabel, svc.Name, p.serviceLabel, svc.Name))
	return rps, lat, errRate
}

func (p *prometheusSource) query(ctx context.Context, promql string) float64 {
	type promResult struct {
		Data struct {
			Result []struct {
				Value [2]any `json:"value"`
			} `json:"result"`
		} `json:"data"`
	}
	var out promResult
	url := p.baseURL + "/api/v1/query?query=" + strings.ReplaceAll(promql, " ", "%20")
	if err := getJSON(ctx, url, &out); err != nil || len(out.Data.Result) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(fmt.Sprint(out.Data.Result[0].Value[1]), 64)
	return v
}

var mSource metricsSource = &scrapingSource{}

// -- Topology --

type topologyEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type topologyResponse struct {
	Nodes []string       `json:"nodes"`
	Edges []topologyEdge `json:"edges"`
}

func loadTopology() topologyResponse {
	raw := os.Getenv("TOPOLOGY")
	if raw == "" {
		return topologyResponse{Nodes: []string{}, Edges: []topologyEdge{}}
	}
	var edges []topologyEdge
	nodeSet := map[string]struct{}{}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		sep := "→"
		if !strings.Contains(part, sep) {
			sep = "->"
		}
		halves := strings.SplitN(part, sep, 2)
		if len(halves) != 2 {
			continue
		}
		src, tgt := strings.TrimSpace(halves[0]), strings.TrimSpace(halves[1])
		if src == "" || tgt == "" {
			continue
		}
		edges = append(edges, topologyEdge{src, tgt})
		nodeSet[src] = struct{}{}
		nodeSet[tgt] = struct{}{}
	}
	nodes := make([]string, 0, len(nodeSet))
	for n := range nodeSet {
		nodes = append(nodes, n)
	}
	sort.Strings(nodes)
	return topologyResponse{Nodes: nodes, Edges: edges}
}

var topology topologyResponse

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

// -- SSE broker --

type sseBroker struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
}

func (b *sseBroker) subscribe() chan []byte {
	ch := make(chan []byte, 4)
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *sseBroker) unsubscribe(ch chan []byte) {
	b.mu.Lock()
	delete(b.clients, ch)
	b.mu.Unlock()
	close(ch)
}

func (b *sseBroker) broadcast(data []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.clients {
		select {
		case ch <- data:
		default:
		}
	}
}

var broker = &sseBroker{clients: make(map[chan []byte]struct{})}

// -- Alerting webhooks --

var (
	webhookURL     = os.Getenv("WEBHOOK_URL")
	latWarn        = envFloat("THRESHOLD_LATENCY_WARN", 300)
	latCrit        = envFloat("THRESHOLD_LATENCY_CRIT", 500)
	errWarn        = envFloat("THRESHOLD_ERROR_WARN", 2)
	errCrit        = envFloat("THRESHOLD_ERROR_CRIT", 5)
	uptimeThr      = envFloat("THRESHOLD_UPTIME", 99)
	debounceWindow = 5 * time.Minute
	debounceMap    sync.Map // key "svc:metric:severity" → time.Time
)

func envFloat(key string, def float64) float64 {
	if v, err := strconv.ParseFloat(os.Getenv(key), 64); err == nil {
		return v
	}
	return def
}

func fireWebhook(service, metric, severity, message string, value, threshold float64) {
	if webhookURL == "" {
		return
	}
	key := service + ":" + metric + ":" + severity
	now := time.Now()
	if last, ok := debounceMap.Load(key); ok {
		if now.Sub(last.(time.Time)) < debounceWindow {
			return
		}
	}
	debounceMap.Store(key, now)

	payload, _ := json.Marshal(map[string]any{
		"service":   service,
		"metric":    metric,
		"severity":  severity,
		"message":   message,
		"value":     value,
		"threshold": threshold,
		"timestamp": now.UTC().Format(time.RFC3339),
	})
	go func() {
		resp, err := httpClient.Post(webhookURL, "application/json", strings.NewReader(string(payload)))
		if err == nil {
			resp.Body.Close()
		}
	}()
}

func checkThresholds(svcName string, latency, errorRate, uptime float64) {
	switch {
	case latency > latCrit:
		fireWebhook(svcName, "latency", "critical", fmt.Sprintf("Latency critical: %.0fms (threshold %.0fms)", latency, latCrit), latency, latCrit)
	case latency > latWarn:
		fireWebhook(svcName, "latency", "warning", fmt.Sprintf("High latency: %.0fms (threshold %.0fms)", latency, latWarn), latency, latWarn)
	}
	switch {
	case errorRate > errCrit:
		fireWebhook(svcName, "errorRate", "critical", fmt.Sprintf("Error rate critical: %.2f%% (threshold %.0f%%)", errorRate, errCrit), errorRate, errCrit)
	case errorRate > errWarn:
		fireWebhook(svcName, "errorRate", "warning", fmt.Sprintf("High error rate: %.2f%% (threshold %.0f%%)", errorRate, errWarn), errorRate, errWarn)
	}
	if uptime > 0 && uptime < uptimeThr {
		fireWebhook(svcName, "uptime", "warning", fmt.Sprintf("Low uptime: %.2f%%", uptime), uptime, uptimeThr)
	}
}

// -- Metrics history (sliding window of 360 snapshots) --

var (
	histMu     sync.RWMutex
	rpsHistory []map[string]any
	latHistory []map[string]any
)

func runCollect() {
	ctx := context.Background()

	type result struct {
		name    string
		rps     float64
		lat     float64
		errRate float64
		uptime  float64
	}

	results := make([]result, len(registry))
	var wg sync.WaitGroup
	for i, svc := range registry {
		wg.Add(1)
		go func(i int, svc ServiceEntry) {
			defer wg.Done()
			results[i].name = svc.Name
			results[i].rps, results[i].lat, results[i].errRate = mSource.fetch(ctx, svc)
			var h map[string]any
			getJSON(ctx, svc.BaseURL+"/health", &h)
			if h != nil {
				results[i].uptime, _ = h["uptime"].(float64)
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
	if len(rpsHistory) > 360 {
		rpsHistory = rpsHistory[len(rpsHistory)-360:]
	}
	latHistory = append(latHistory, latPoint)
	if len(latHistory) > 360 {
		latHistory = latHistory[len(latHistory)-360:]
	}
	// Snapshot for SSE broadcast (last 90 points = 15 min default)
	rpsSnap := make([]map[string]any, len(rpsHistory))
	latSnap := make([]map[string]any, len(latHistory))
	copy(rpsSnap, rpsHistory)
	copy(latSnap, latHistory)
	if len(rpsSnap) > 90 {
		rpsSnap = rpsSnap[len(rpsSnap)-90:]
	}
	if len(latSnap) > 90 {
		latSnap = latSnap[len(latSnap)-90:]
	}
	histMu.Unlock()

	// Build KPIs from collected results
	totalReqs := int64(0)
	avgLat := 0.0
	avgErr := 0.0
	active := 0
	for _, r := range results {
		if r.rps > 0 || r.lat > 0 {
			active++
			avgLat += r.lat
			avgErr += 0 // errorRate not in runCollect results; omit for SSE KPIs
		}
		totalReqs += int64(r.rps * 10) // rough estimate based on poll interval
	}
	if active > 0 {
		avgLat /= float64(active)
	}

	payload, _ := json.Marshal(map[string]any{
		"rps":       rpsSnap,
		"latency":   latSnap,
		"timestamp": label,
		"kpis": map[string]any{
			"avgLatency":     math.Round(avgLat),
			"activeServices": active,
		},
	})
	go broker.broadcast(payload)

	// Fire webhook alerts for each service
	for _, r := range results {
		if r.name != "" {
			checkThresholds(r.name, r.lat, r.errRate, r.uptime)
		}
	}
}

func parsePoints(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil || v < 1 || v > 360 {
		return def
	}
	return v
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
	topology = loadTopology()

	if promURL := os.Getenv("PROMETHEUS_URL"); promURL != "" {
		label := os.Getenv("PROMETHEUS_LABEL_SERVICE")
		if label == "" {
			label = "service"
		}
		mSource = &prometheusSource{baseURL: promURL, serviceLabel: label}
	}

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
		n := parsePoints(c.Query("points"), 90)
		histMu.RLock()
		defer histMu.RUnlock()
		slice := rpsHistory
		if len(slice) > n {
			slice = slice[len(slice)-n:]
		}
		c.JSON(http.StatusOK, slice)
	})

	r.GET("/api/metrics/latency", func(c *gin.Context) {
		n := parsePoints(c.Query("points"), 90)
		histMu.RLock()
		defer histMu.RUnlock()
		slice := latHistory
		if len(slice) > n {
			slice = slice[len(slice)-n:]
		}
		c.JSON(http.StatusOK, slice)
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

	r.GET("/api/topology", func(c *gin.Context) {
		c.JSON(http.StatusOK, topology)
	})

	r.GET("/api/stream", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("X-Accel-Buffering", "no")
		ch := broker.subscribe()
		defer broker.unsubscribe(ch)
		ctx := c.Request.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case data, ok := <-ch:
				if !ok {
					return
				}
				fmt.Fprintf(c.Writer, "data: %s\n\n", data)
				c.Writer.Flush()
			}
		}
	})

	r.Run(":4000")
}
