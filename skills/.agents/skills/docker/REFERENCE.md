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

| Base Image        | Create User Commands                                                 | Notes                         |
| ----------------- | -------------------------------------------------------------------- | ----------------------------- |
| **Alpine**        | `RUN addgroup -S appgroup && adduser -S appuser -G appgroup`         | BusyBox, `-S` = system user   |
| **Debian/Ubuntu** | `RUN addgroup --system appgroup && adduser --system --group appuser` | Must use `--system`           |
| **Red Hat/UBI**   | `RUN groupadd -r appgroup && useradd -r -g appgroup appuser`         | `-r` = system account         |
| **Scratch**       | `USER 65532:65532` (distroless) or nothing (no shell)                | Distroless UID/GID convention |

### Permission Pitfalls

When `COPY --from=builder` pulls files as root, fix ownership:

```dockerfile
COPY --from=builder --chown=appuser:appgroup /bin/app /bin/app
```

Or, if `--chown` not supported:

```dockerfile
COPY --from=builder /bin/app /bin/app
RUN chown appuser:appgroup /bin/app
```

### Port Binding

Bind to high ports (≥1024); map to 80/443 externally via runtime port mapping. Never switch back to `USER root` for low ports.

```dockerfile
# ✅ Correct — bind to 8080, map to 80/443 externally
CMD ["./app", "-listen", ":8080"]

# ❌ Wrong — switch back to root for low port
USER root
CMD ["./app", "-listen", ":80"]
```

### Executable Ownership

Executables must be owned by root and not world-writable, even when executed by non-root user. This enforces container immutability.

## Secrets Management

### BuildKit Secret Mounts

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

At build time:

```bash
docker buildx build --secret id=npmrc,src=$HOME/.npmrc -t app .
```

### Never in ENV/ARG/COPY

Secrets in intermediate layers persist even after `rm`. They're hidden from the final filesystem but still in the layer history.

```dockerfile
# ❌ Wrong — secret baked into layer history
ARG GITHUB_TOKEN
RUN echo $GITHUB_TOKEN > /tmp/token
# ❌ Still wrong — token copied to persistent layer
RUN --mount=type=secret,id=token \
    cp /run/secrets/token /src/.env
```

## Capability Dropping

```bash
# Drop all, add only what's needed
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myimage
```

Kubernetes equivalent:

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
```

Never mount `docker.sock` — container breakout risk. Never use `--privileged`.

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
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
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
# COPY . . ok here — many source files + .dockerignore excludes junk
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

# trivy (vulnerability scanner)
brew install trivy             # macOS
# or: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh

# docker buildx (multi-platform builds)
docker buildx create --use    # First time setup
```

## Validation Checklist

- [ ] `01` All `FROM` images use SHA256 digests
- [ ] `02` Final stage has `USER` set to non-root (or `USER 65532:65532` for distroless/scratch)
- [ ] `03` Executables owned by root, not world-writable
- [ ] `04` Multi-stage build: build deps stay in builder stage
- [ ] `05` No secrets in `ENV`/`ARG`/`COPY`; `.env` in `.dockerignore`
- [ ] `06` Layers ordered: deps first, code last; cleanup in same `RUN`
- [ ] `07` `.dockerignore` present and correct
- [ ] `08` `COPY` used over `ADD` (unless remote URL or tar); `CMD` in exec form
- [ ] `09` App binds to high port (≥1024); no `USER root` for low ports
- [ ] `10` Runtime: `--cap-drop=ALL`; no `docker.sock` mount or `--privileged`
- [ ] `11` Tag pinned to digest: `image:tag@sha256:...`
- [ ] `12` `hadolint` passes
- [ ] `13` `dockle` passes (fatal threshold only)
- [ ] `14` Image builds with `docker buildx build .`

## Supply Chain Security

### Sign and Verify Images

```bash
# Cosign
cosign sign --key cosign.key <image>
cosign verify --key cosign.pub <image>

# Docker Content Trust
export DOCKER_CONTENT_TRUST=1
```

### Provenance & SBOM

```bash
docker buildx build --provenance=true --sbom=true -t <image> --push .
```

### Tag Strategy

- Avoid `:latest` in production.
- Pin to digest: `image:tag@sha256:...`
- Use specific semver tags (`:1.2.3-alpine`) over floating ones (`:1`).

### Cache Mounts (BuildKit)

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

### Rebuild Frequently

Use `docker build --pull --no-cache` in CI. Docker Scout can auto-raise PRs to update pinned digests.
