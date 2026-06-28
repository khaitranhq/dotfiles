# Docker — Reference

## Resolving SHA Digest for Base Images

### Docker Hub (`docker.io`)

```bash
# Single-architecture image
docker buildx imagetools inspect node:22.14.0-alpine
# Copy the Digest line, e.g.:
#   Digest: sha256:62d1ed22bb0d965a07c0bf4fe26ff4d1bd0b0e7a9d2f70d5de7a57dcec6f5cc1

# Multi-architecture resolve
docker buildx imagetools inspect node:22.14.0-alpine | grep -A1 'linux/amd64'

# Alternative: pull + inspect
docker pull node:22.14.0-alpine
docker inspect node:22.14.0-alpine | yq '.[0].RepoDigests[0]'
```

### Other Registries

```bash
# GHCR
docker buildx imagetools inspect ghcr.io/owner/repo:tag

# ECR
docker buildx imagetools inspect <account>.dkr.ecr.<region>.amazonaws.com/repo:tag
```

## No Root — Per-Distro Commands

| Base Image     | Create User Commands                                         | Notes                                  |
| -------------- | ------------------------------------------------------------ | -------------------------------------- |
| **Alpine**     | `RUN addgroup -S appgroup && adduser -S appuser -G appgroup` | BusyBox, `-S` = system user           |
| **Debian/Ubuntu** | `RUN addgroup --system appgroup && adduser --system --group appuser` | Must use `--system`               |
| **Red Hat/UBI**   | `RUN groupadd -r appgroup && useradd -r -g appgroup appuser`   | `-r` = system account               |
| **Scratch**    | `USER 65532:65532` (distroless) or nothing (no shell)        | Distroless UID/GID conventions         |

### Permission Pitfalls

When `COPY --from=builder` pulls files as root, fix ownership:

```dockerfile
COPY --from=builder --chown=appuser:appgroup /bin/app /bin/app
```

Or, if the base or `--chown` not supported:

```dockerfile
COPY --from=builder /bin/app /bin/app
RUN chown appuser:appgroup /bin/app
```

When app binds to port < 1024, use port mapping instead of `USER root`:

```dockerfile
# ✅ Correct — bind to 8080, map to 80/443 externally
CMD ["-listen", ":8080"]

# ❌ Wrong — switch back to root for low port
USER root
CMD ["-listen", ":80"]
```

## Multi-Stage Build Patterns

### Node.js

```dockerfile
FROM node:22.14.0-alpine@sha256:... AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:22.14.0-alpine@sha256:...
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app /app
USER appuser
CMD ["node", "dist/server.js"]
```

### Go

```dockerfile
FROM golang:1.24@sha256:... AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /bin/app ./cmd/app

FROM scratch
USER 65532:65532
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /bin/app /bin/app
CMD ["/bin/app"]
```

### Python

```dockerfile
FROM python:3.13-slim@sha256:... AS builder
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt --target /deps

FROM python:3.13-slim@sha256:...
RUN addgroup --system appgroup && adduser --system --group appuser
WORKDIR /app
COPY --from=builder /deps /usr/local/lib/python3.13/site-packages/
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## .dockerignore Template

```dockerignore
.git
.gitattributes
.gitignore

# Dependencies (installed in build)
node_modules/
vendor/
.pnpm-store/

# Build artifacts
dist/
target/
build/
*.jar
*.war

# Environment
.env
.env.*
*.local

# VCS/IDE
.idea/
.vscode/
*.swp
*~

# Docs/CI
README.md
.github/
.gitlab-ci.yml

# OS junk
.DS_Store
Thumbs.db
```

## Validation Tool Installation

```bash
# hadolint (Dockerfile linter)
brew install hadolint          # macOS
# or: wget -O /usr/local/bin/hadolint https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64

# dockle (image security audit)
brew install goodwithtech/r/dockle   # macOS
# or: curl -L https://github.com/goodwithtech/dockle/releases/latest/download/dockle_Linux-64bit.tar.gz | tar xz -C /usr/local/bin

# docker buildx (multi-platform builds)
docker buildx create --use    # First time setup
```

## Validation Checklist

- [ ] All `FROM` images use SHA256 digests
- [ ] Final stage has `USER` set to non-root (or `USER 65532:65532` for distroless/scratch)
- [ ] Multi-stage build: build deps stay in builder stage
- [ ] Layers ordered: deps first, code last
- [ ] `.dockerignore` present and correct
- [ ] No secrets in image (use `RUN --mount=type=secret` if needed)
- [ ] `hadolint` passes
- [ ] `dockle` passes (fatal threshold only)
- [ ] Image builds with `docker buildx build .`
