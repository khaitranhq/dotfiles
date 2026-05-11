---
name: iac
description: Provides tool-agnostic best practices for Infrastructure as Code (Pulumi, CDK, Terraform, CloudFormation, etc.). Use when provisioning, managing, or refactoring infrastructure via code.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: platform
  triggers:
    - Infrastructure as Code
    - IaC
    - Terraform
    - CDK
    - Pulumi
    - CloudFormation
    - provisioning
    - infrastructure
  role: specialist
  scope: implementation
  output-format: code
---

# IaC Skill

## Purpose

Tool-agnostic best practices for managing infrastructure through code. Applies to Pulumi, CDK, Terraform, CloudFormation, and similar tools.

## Key Principles

### 1. Full Coverage — Manage Everything by IaC

**If a system is managed by IaC, try to manage all components by IaC.** Avoid hybrid manual/IaC setups — they drift, break reproducibility, and create blind spots.

**Exclude from IaC:**
- **Secrets** — store in dedicated secret managers (AWS Secrets Manager, Azure Key Vault, Vault). IaC configs reference them by ARN/ID, never contain values.
- **State files** — never hand-edit state; use CLI commands (`import`, `state mv`, `state rm`) only.
- **Bootstrap resources** (optional) — the initial state backend (S3 bucket, storage account) *may* live outside a stack to avoid chicken-and-egg. Prefer dedicated bootstrap stacks.
- **One-off data** — database contents, file uploads, log data.

### 2. Idempotency and Predictability

- Every `apply`/`up`/`deploy` must produce the same result from the same code + state.
- Avoid timestamp-based resource names, random suffixes without `ignore_changes`/`ignoreChanges`, or manual state edits.
- Use `preview`/`plan`/`diff` before every apply. Treat unexpected drift as a bug.

### 3. State Management

- Store state remotely (S3, Azure Storage, Terraform Cloud, Pulumi Cloud, GCS). Never commit state files.
- Enable state locking to prevent concurrent modifications.
- Back up state regularly. Test restore procedures.
- Use workspaces, stack names, or state keys to isolate environments — never share a single state file across dev/staging/prod.

### 4. Modularity and Reuse

- Split infrastructure into composable modules/components/stacks by domain (networking, compute, data, security).
- Expose minimal, stable interfaces. Export only what downstream consumers need.
- Version modules (tags, npm packages, Go modules, Terraform registry). Pin to exact versions.
- Prefer standard module registries over copy-paste.

### 5. Configuration and Environments

- Separate config from code. Use env-specific config files, not branching.
- Validate all configs early (CI or init phase). Fail fast on missing or invalid values.
- Default to safe values (least-privilege, smallest scale, locked-down network).

### 6. Secrets Handling

- Never hardcode secrets in IaC code or state. Reference secrets by ARN/ID/secret path.
- Use tool-native secret mechanisms (Pulumi Secrets, Terraform `sensitive`, CDK `SecretValue`) for values that must flow through IaC.
- Ensure secrets are masked in logs and plan/preview output.

### 7. CI/CD Integration

- Run IaC from CI/CD, not local machines. Enforce review gates for production changes.
- Plan/preview on PR, apply on merge.
- Store CI/CD credentials minimally — prefer OIDC over long-lived cloud keys.

### 8. Testing and Validation

- Lint all IaC code (`terraform validate`, `cfn-lint`, `pulumi preview`).
- Policy-as-code: enforce tagging, encryption, public-access bans (`terraform-compliance`, OPA, `pulumi policy pack`).
- Integration-test critical infrastructure changes in isolated sandbox environments.

## Constraints

### Must Do

- Manage all infrastructure through code — no manual click-ops.
- Store state remotely with locking enabled.
- Run `plan`/`preview`/`diff` before every apply.
- Separate config from code; validate configs early.
- Pin module/component versions to exact versions.
- Mask secrets in all output (logs, plans, diffs).
- Run IaC through CI/CD for production environments.
- Lint all IaC code before committing.

### Must Not Do

- Do not commit state files, plans, or secrets.
- Do not hand-edit state files.
- Do not share state across environments.
- Do not hardcode secrets, ARNs, or IDs — use references and config.
- Do not use floating tags or `latest` for modules/providers.
- Do not run production applies from local machines.

## Post-Deployment Steps

1. Verify state reflects reality: run `state list` / `export` and spot-check.
2. Confirm outputs match the expected contract.
3. Destroy test/sandbox environments after validation to avoid cost leaks.
