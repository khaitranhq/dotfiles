# Multi-stage build to minimize final image size
# Stage 1: Builder - download and prepare tree-sitter binary
FROM ubuntu:24.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    TREE_SITTER_VERSION="0.26.8"; \
    TREE_SITTER_URL="https://github.com/tree-sitter/tree-sitter/releases/download/v${TREE_SITTER_VERSION}/tree-sitter-linux-x64.gz"; \
    \
    cd /tmp; \
    curl -fsSL -o tree-sitter.gz "${TREE_SITTER_URL}"; \
    gunzip tree-sitter.gz; \
    chmod +x tree-sitter

# Stage 2: Runtime - minimal image with only what's needed
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    build-essential \
    bash \
    file \
    && rm -rf /var/lib/apt/lists/*

# Copy tree-sitter binary from builder
COPY --from=builder /tmp/tree-sitter /usr/local/bin/tree-sitter

# Verify installation
RUN tree-sitter --version

# Copy the installation scripts
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY install.sh /usr/local/bin/install.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/install.sh

# Set the entrypoint to the entrypoint script (for direct docker run usage)
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
