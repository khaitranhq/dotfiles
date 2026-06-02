package server_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"httpserver/server"
)

func TestNew(t *testing.T) {
	mux := http.NewServeMux()
	srv := server.New(":0", mux)

	if srv == nil {
		t.Fatal("expected non-nil server")
	}
}

func TestRunContextCancellation(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	srv := server.New(":0", mux)

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Run(ctx)
	}()

	// Give server time to start.
	time.Sleep(50 * time.Millisecond)

	// Cancel context to trigger shutdown.
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for server to stop")
	}
}

func TestRunStartupError(t *testing.T) {
	// Use an address with no port to force a startup failure.
	srv := server.New("invalid-addr", http.NewServeMux())

	ctx := context.Background()
	err := srv.Run(ctx)
	if err == nil {
		t.Fatal("expected error from invalid address")
	}
}
