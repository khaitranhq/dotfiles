---
name: docker
description: Docker image design rules with enforcement for Dockerfile best practices. Use when writing, reviewing, or modifying Dockerfiles, image builds, or container configurations.
triggers:
  - docker
  - Dockerfile
  - docker build
  - docker run
  - container
  - docker compose
  - compose
  - docker-compose
  - container image
  - image build
  - containerize
role: specialist
scope: implementation
output-format: code
required-references:
  - REFERENCE.md
---

# Docker — Image Design Rules

## Hard Constraints (Always Enforced)

### 1. Pin Base Images by SHA Digest

Every `FROM` referencing a remote registry **must** use a SHA256 digest.

```dockerfile
# ✅ Correct
FROM node:22.14.0-alpine@sha256:62d1ed22bb0d965a07c0bf4fe26ff4d1bd0b0e7a9d2f70d5de7a57dcec6f5cc1

# ❌ Wrong — mutable tag
FROM node:22.14.0-alpine
FROM node:latest
```

Local-only base images (built in same project) are exempt.

### 2. No Root in Final Stage

The final stage **must not** run as root. Create an unprivileged user.

```dockerfile
# ✅ Correct
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# ❌ Wrong
CMD ["node", "server.js"]
```

Build stages may run as root. Only the final stage must switch.

## Structural Rules

### 3. Mandatory Multi-Stage Builds

Separate build and runtime. Final image must not contain build toolchain, dev deps, or unused source artifacts.

### 4. Order Layers by Change Frequency

Least-frequently-changing first: dependencies before application code.

```dockerfile
# ✅ Correct
COPY go.mod go.sum ./
RUN go mod download
COPY . .
```

### 5. Mandatory .dockerignore

Every Dockerfile project must have `.dockerignore` excluding `.git`, `node_modules`, `target/`, `dist/`, and env files.

## Validation

Before committing, run:

```bash
hadolint Dockerfile              # Lint Dockerfile rules
docker buildx build .             # Dry-run build
dockle --image <image>            # Image security audit
```

See [REFERENCE.md](REFERENCE.md) for full syntax patterns, examples, and edge-case guidance.
