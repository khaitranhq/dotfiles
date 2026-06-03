---
name: github-action
description: Guides best practices when authoring GitHub Actions.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: ci
  triggers:
    - GitHub Actions
    - CI/CD
    - workflows
  role: specialist
  scope: operational
  output-format: code
---

# GitHub Actions Skill

## Purpose

Provide best practices for GitHub Actions workflow implementation, following organization-wide golden path standards for CI/CD pipeline design, security, and reusability.

## Pipeline Architecture

Follow the standard pipeline lifecycle for delivery pipelines:

```
Build → Publish Snapshot → Test → Promote to Artifact → Deploy
```

**Key Principles:**

- Deployed artifact is identical to tested artifact (confidence)
- Never rebuild in production—only deploy promoted artifacts
- Never overwrite published artifacts—create new versions
- Separate operational automation (migrations) from deploy steps
- Use `workflow_call` for workflow composition and reusability
- Pin all `uses:` references to full commit SHAs (not floating tags)
- All pipelines must be in code (`.github/workflows/`)—no manual click-to-deploy
- Set `timeout-minutes` on all jobs to prevent runaway executions
- Document GitOps boundaries—pipeline should only update fields it owns (e.g., image tag, not infrastructure)

## Security Best Practices

### Action Pinning

Pin all GitHub Actions to specific commit SHAs to prevent supply-chain attacks. Always include the version tag as a comment.

```yaml
uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
```

Never use floating tags: `@v4`, `@main`.

To find the commit SHA for a tag:

```bash
curl -s https://api.github.com/repos/{owner}/{repo}/releases/latest | yq '.tag_name'
curl -s https://api.github.com/repos/{owner}/{repo}/git/ref/tags/{tag_name} | yq '.object.sha'
```

### Least-Privilege Permissions

Define minimal required permissions at both workflow and job levels.

```yaml
jobs:
  build:
    permissions:
      contents: read
      id-token: write # only if using OIDC
```

### OIDC for Cloud Authentication

Use OpenID Connect (OIDC) for cloud authentication—short-lived tokens, fine-grained control. Never accept long-lived cloud credentials as inputs.

**Environment Isolation & Branch Protection:**

```yaml
jobs:
  deploy-prod:
    environment: production # branch restriction: main only
    permissions:
      id-token: write
      contents: read
```

Configure OIDC trust policy in cloud provider to restrict which branch/environment can assume production identity.

For high-privilege pipelines (disaster recovery, data migration), use GitHub Environments with required reviewers.

### Secret Management Hierarchy

Prefer in this order:

1. **Cloud secret stores** (Azure Key Vault, AWS Secrets Manager) — fewer rotation points, better auditing
2. **GitHub Actions secrets** — only for CI-specific values (e.g., GitHub App keys)

Use GitHub App instead of Personal Access Tokens for automation.

### Script Injection Prevention

**Always** assign user-controlled values to environment variables first—never interpolate directly in `run:`.

```yaml
- name: Process user input safely
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
    BUILD_ID: ${{ github.run_id }}
    API_TOKEN: ${{ secrets.API_TOKEN }}
  run: |
    echo "PR: $PR_TITLE"
    curl -H "Authorization: Bearer $API_TOKEN" \
      -d "build=$BUILD_ID" \
      https://api.example.com/deploy
```

**✅ Must Do:** assign context values to env vars before shell use, quote variables (`"$VAR"`), mask secrets with `::add-mask::`.

**❌ Must NOT Do:** direct interpolation (`${{ vars.FOO }}`), inline secrets in `run:`, command substitution with context values, unquoted variables.

### Credential Persistence & Secret Masking

Disable credential persistence on checkout when not needed:

```yaml
- uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
  with:
    persist-credentials: false
```

Mask sensitive values before use to prevent log exposure:

```yaml
- run: |
    echo "::add-mask::${{ secrets.SENSITIVE_VALUE }}"
```

## Validation

Run before committing changes to `.github/workflows/`:

```bash
actionlint    # Syntax/semantic validation
zizmor .      # Security static analysis
```
