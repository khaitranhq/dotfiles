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

Provide best practices GitHub Action workflows implementation.

## Logging and Messaging

- Use the `::debug::` command early in a workflow step to emit detailed context for rare failures.
- Emit `::notice::` for informational issues that warrant attention without failing the run.
- Use `::warning::` (with `title=` when helpful) when a non-fatal condition needs highlighting.
- Emit `::error::` when a step should fail because of missing requirements or invalid output; provide `file=` and range metadata for precise diagnostics.

### Example Commands

```bash
echo "::debug::Set the Octocat variable"
echo "::notice file=app.js,line=1,col=5,endColumn=7::Missing semicolon"
echo "::warning file=app.js,line=1,col=5,endColumn=7,title=YOUR-TITLE::Missing semicolon"
echo "::error file=app.js,line=1,col=5,endColumn=7,title=YOUR-TITLE::Missing semicolon"
```

## Security Best Practices

### Action Pinning

Pin all GitHub Actions to specific commit SHAs to prevent supply-chain attacks. Always include the version tag as a comment for reference.

**Good — Pin to commit SHA:**

```yaml
uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
```

**Bad — Do not use floating tags:**

```yaml
uses: actions/checkout@v4
uses: actions/checkout@main
```

To find the commit SHA for a specific tag:

```bash
# Step 1. Get the latest release information
curl -s https://api.github.com/repos/{owner}/{repo}/releases/latest | yq '.tag_name'

# Step 2. Get the commit SHA for a specific tag
curl -s https://api.github.com/repos/{owner}/{repo}/git/ref/tags/{tag_name} | yq '.object.sha'
```

### Least-Privilege Permissions

Define minimal required permissions at both workflow and job levels. Only grant necessary scopes.

```yaml
jobs:
  build:
    permissions:
      contents: read
      id-token: write # only if using OIDC for cloud auth
```

### OIDC for Cloud Authentication

Use OpenID Connect (OIDC) for cloud provider authentication instead of long-lived credentials or personal access tokens. This provides short-lived tokens with fine-grained control.

### Script Injection Prevention

Never use user-controlled values directly in shell commands. Always assign to environment variables first so they're treated as data, not code.

**Bad — Vulnerable to injection:**

```yaml
- run: echo "${{ github.event.pull_request.title }}"
```

**Good — Safe approach:**

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "$PR_TITLE"
```

### Credential Persistence

Disable credential persistence on checkout actions to prevent credentials from being persisted to disk.

```yaml
- uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
  with:
    persist-credentials: false
```

### Secret Masking

Mask sensitive values before use to prevent accidental exposure in logs.

```yaml
- run: |
    echo "::add-mask::${{ secrets.SENSITIVE_VALUE }}"
    echo "Using masked value: ${{ secrets.SENSITIVE_VALUE }}"
```

## Constraints

### Must do

- Pin all action references to specific commit SHAs (with version tags as comments)
- Define explicit least-privilege permissions for all jobs
- Prevent script injection by assigning user-controlled values to environment variables
- Disable credential persistence on checkout actions when not needed
- Run workflow validations with `actionlint` and `zizmor` after touching any GitHub Actions files
- Use OIDC for cloud authentication instead of long-lived credentials
- Mask secrets before use in workflow steps
