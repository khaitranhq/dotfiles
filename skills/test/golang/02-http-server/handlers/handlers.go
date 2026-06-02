package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// HandlerFunc is an HTTP handler that returns an error.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// ServeHTTP implements http.Handler.
func (h HandlerFunc) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := h(w, r); err != nil {
		log.Printf("handler error: %v", err)
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}

// WrapHandlerFunc wraps a HandlerFunc as an http.Handler.
func WrapHandlerFunc(fn func(w http.ResponseWriter, r *http.Request) error) http.Handler {
	return HandlerFunc(fn)
}

// NewRouter creates a new http.Handler with all routes registered.
func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/health", HandlerFunc(Health))
	mux.Handle("/hello", HandlerFunc(Hello))

	return mux
}

// Health responds with the server health status.
//
//nolint:varnamelen // w and r are idiomatic HTTP handler parameter names
func Health(w http.ResponseWriter, r *http.Request) error {
	if err := r.Context().Err(); err != nil {
		return fmt.Errorf("health check: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	return json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Hello responds with a greeting message.
//
//nolint:varnamelen // w and r are idiomatic HTTP handler parameter names
func Hello(w http.ResponseWriter, r *http.Request) error {
	if err := r.Context().Err(); err != nil {
		return fmt.Errorf("hello: %w", err)
	}

	name := r.URL.Query().Get("name")
	if name == "" {
		name = "World"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(map[string]string{"message": fmt.Sprintf("Hello, %s!", name)})
}
