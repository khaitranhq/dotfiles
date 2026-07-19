---
name: docker
description: Docker image design rules with enforcement for Dockerfile best practices. Use when writing, reviewing, or modifying Dockerfiles, image builds, container configurations, Docker security, secrets management, container privileges, or Dockerfile linting.
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
  - docker security
  - container security
  - secrets
  - credentials
  - token
  - .dockerignore
  - hadolint
  - dockle
  - trivy
role: specialist
scope: implementation
output-format: code
required-references:
  - REFERENCE.md
---

# Docker — Image Design Rules

## Hard Constraints (Always Enforced)

### 1. Pin Base Images by SHA Digest

Every `FROM` referencing a remote registry **must** use a SHA256 digest. Local-only base images (built in same project) are exempt.

### 2. No Root in Final Stage

Final stage **must not** run as root. Create an unprivileged user per distro (see REFERENCE). Bind to high ports (≥1024); map to 80/443 externally.

Executables owned by root, not world-writable — even when run by non-root user.

### 3. No Secrets in Image

Never put secrets in `ENV`, `ARG`, or `COPY` instructions. Use `RUN --mount=type=secret` (BuildKit) for build-time secrets. `.dockerignore` must exclude `.env`, `.git`, credentials, and backups. Secrets in intermediate layers persist even after `rm`.

### 4. COPY over ADD; Exec Form CMD

Use `COPY`, not `ADD` (except remote URL with checksum or tar auto-extract). Use `CMD ["exec", "form"]`, not shell form.

### 5. Clean Up in Same Layer

Package install + cleanup in one `RUN`. Never split across layers.

```dockerfile
# ✅ Single layer
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-a pkg-b \
    && rm -rf /var/lib/apt/lists/*
```

## Structural Rules

### 6. Mandatory Multi-Stage Builds

Separate build and runtime. Final image must not contain build toolchain, dev deps, or source artifacts. Secret-consuming steps stay in intermediate stages.

### 7. Copy Only Essential Files

Dependencies before application code. Copy strategy: specific paths when few files, `COPY . .` with `.dockerignore` only when copying many files in a directory. Never `COPY . .` without `.dockerignore`. In final stages, copy only built artifacts and runtime deps — not raw source.

### 8. No Unnecessary Privileges

Drop all capabilities at runtime: `--cap-drop=ALL --cap-add=NET_BIND_SERVICE`. Never mount `docker.sock` or use `--privileged`. Only `EXPOSE` required ports.

### 9. Mandatory .dockerignore

Every Dockerfile project must have `.dockerignore` excluding `.git`, `node_modules`, `target/`, `dist/`, `.env`, `.env.*`, and IDE/OS junk.

## Validation

```bash
hadolint Dockerfile              # Lint
docker buildx build .            # Dry-run build
dockle --image <image>           # Security audit
trivy image <image>              # Vuln scan (CI)
```

## Tag Strategy

- Pin to digest: `image:tag@sha256:...`
- Use specific semver tags (`:1.2.3-alpine`), never `:latest` in prod

See [REFERENCE.md](REFERENCE.md) for per-distro commands, patterns, secret mounts, capability dropping, supply chain, and cache mounts.
