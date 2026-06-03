# Defender

Blocks dangerous bash commands, prevents reading/writing files outside `$HOME`, and masks secrets in tool results.

## Protection Layers

### 1. Dangerous Command Blocking

Protected operations:

- `rm` outside `$HOME` (except `/tmp`), `sudo`, `chmod`, `chown`, `dd`, `mkfs`, `shutdown`, `reboot`
- Workaround patterns: `find -delete`, `xargs rm`, `find -exec rm`, `perl unlink`, `python os.remove`
- Path-based blocks: any bash command targeting files outside allowed prefixes

### 2. File Access Guard

- Read/write/edit: blocks access to any `.env` file and any file outside `$HOME` and `/tmp`

### 3. Secret Masking

Scans all tool results with [secretlint](https://github.com/secretlint/secretlint) and replaces detected secrets with `***`.

Detected secrets include:

- GitHub/GitLab/Stripe/Slack tokens
- AWS/GCP/NPM credentials
- OpenAI/Anthropic/Groq/HuggingFace API keys
- Private keys (RSA, etc.)
- Basic auth credentials
- Database connection strings
- SendGrid/Shopify/Notion/Linear/Figma/Cloudflare/Tailscale keys
- 1Password/Vercel/Databricks/Docker/Grafana/HashiCorp Vault secrets

## Settings

None. Allowed prefixes are hardcoded in `shared/path-guard.ts`:

```typescript
export const DEFAULT_ALLOWED_PREFIXES = [HOME_DIR, "/tmp"];
```
