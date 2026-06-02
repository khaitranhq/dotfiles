package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"httpserver/handlers"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	err := handlers.Health(rec, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("got status %q, want %q", body["status"], "ok")
	}
}

func TestHello(t *testing.T) {
	tests := []struct {
		name       string
		queryName  string
		wantStatus int
		wantMsg    string
	}{
		{
			name:       "default greeting",
			queryName:  "",
			wantStatus: http.StatusOK,
			wantMsg:    "Hello, World!",
		},
		{
			name:       "personalized greeting",
			queryName:  "Alice",
			wantStatus: http.StatusOK,
			wantMsg:    "Hello, Alice!",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/hello"
			if tt.queryName != "" {
				url = fmt.Sprintf("/hello?name=%s", tt.queryName)
			}

			req := httptest.NewRequest(http.MethodGet, url, nil)
			rec := httptest.NewRecorder()

			err := handlers.Hello(rec, req)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("failed to decode body: %v", err)
			}

			if body["message"] != tt.wantMsg {
				t.Errorf("got message %q, want %q", body["message"], tt.wantMsg)
			}
		})
	}
}

func TestWrapHandlerFunc(t *testing.T) {
	t.Run("success handler", func(t *testing.T) {
		handler := handlers.WrapHandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
			w.WriteHeader(http.StatusCreated)
			return nil
		})

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Errorf("got status %d, want %d", rec.Code, http.StatusCreated)
		}
	})

	t.Run("error handler", func(t *testing.T) {
		handler := handlers.WrapHandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
			return fmt.Errorf("something broke")
		})

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("got status %d, want %d", rec.Code, http.StatusInternalServerError)
		}
	})
}

func TestNewRouter(t *testing.T) {
	router := handlers.NewRouter()
	ts := httptest.NewServer(router)
	defer ts.Close()

	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{
			name:       "health endpoint",
			method:     http.MethodGet,
			path:       "/health",
			wantStatus: http.StatusOK,
		},
		{
			name:       "hello endpoint",
			method:     http.MethodGet,
			path:       "/hello",
			wantStatus: http.StatusOK,
		},
		{
			name:       "not found",
			method:     http.MethodGet,
			path:       "/nonexistent",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(tt.method, ts.URL+tt.path, nil)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("failed to send request: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("got status %d, want %d", resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	req := httptest.NewRequest(http.MethodGet, "/health", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	err := handlers.Health(rec, req)
	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}
