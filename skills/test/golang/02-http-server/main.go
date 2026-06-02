package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"httpserver/handlers"
	"httpserver/server"
)

const defaultAddr = ":8080"

func main() {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = defaultAddr
	}

	router := handlers.NewRouter()
	srv := server.New(addr, router)

	log.Printf("starting server on %s", addr)
	if err := srv.Run(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
	log.Println("server stopped gracefully")
}
