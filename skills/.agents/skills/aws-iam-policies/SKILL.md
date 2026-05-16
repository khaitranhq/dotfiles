---
name: aws-iam-policies
description: Provides reusable AWS IAM policy templates for common scenarios including S3 sync, ECR push, Batch execution, Step Functions, Fleet Manager, ABAC, and self-service user management. Use when creating or troubleshooting AWS IAM policies, permission sets, or role definitions.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: platform
  triggers:
    - IAM policy
    - IAM role
    - AWS permissions
    - IAM
    - policy template
    - permission boundary
    - trust policy
  role: specialist
  scope: implementation
  output-format: code
---

# AWS IAM Policies Skill

## Purpose

Pre-built, battle-tested IAM policy templates for common AWS scenarios. Use these as starting points to avoid reinventing permission sets that are tricky to get right (e.g., Fleet Manager, Step Functions chaining, ABAC).

## Quick Start

1. Identify the scenario from the [Policy Index](#policy-index) below.
2. Read the full template in [REFERENCE.md](REFERENCE.md).
3. Replace placeholders (`<region>`, `<account id>`, `<resource name>`) with actual values.
4. Apply least-privilege: narrow `Resource` ARNs and remove unused `Action`s.

## Workflow

When asked to create or fix an IAM policy:

1. **Match the scenario** — check if it maps to an existing template.
2. **Copy the template** from REFERENCE.md.
3. **Replace placeholders** — region, account ID, resource names.
4. **Apply least-privilege** — restrict resources to the minimum needed; remove any actions not required.
5. **Add conditions** where appropriate (source IP, MFA, tags, `aws:RequestedRegion`).
6. **Validate** — test the policy in a sandbox environment before production.
7. **Tag the policy** — add metadata tags (`Purpose`, `Owner`, `Environment`).

## Policy Index

| # | Policy | Use Case |
|---|--------|----------|
| 1 | S3 Sync | Permissions for `aws s3 sync` (read/write/delete) |
| 2 | ECR Push | Build and push Docker images to ECR (includes GitHub Actions OIDC) |
| 3 | Batch Execution | AWS Batch job role for Secrets Manager, ECR pull, CloudWatch logs |
| 4 | Step Functions Chaining | One Step Function starts/describes/stops another |
| 5 | Fleet Manager | Access a specific EC2 instance via SSM Fleet Manager |
| 6 | ABAC | Attribute-based access control with tags |
| 7 | Self-Service User | Users manage their own password, keys, MFA |
| 8 | Revoke Temporary Credentials | Emergency revoke of all IAM role sessions |

## Key Principles

- **Least privilege is non-negotiable** — start narrow, expand only when necessary.
- **Never use `"Resource": "*"` with `"Action": "*"`** — combine broad resources only with read-only or tightly scoped actions.
- **Use conditions** (`aws:SourceIp`, `aws:RequestedRegion`, `aws:MultiFactorAuthPresent`) to add defense in depth without complicating the policy.
- **Placeholders must be replaced** — `<region>`, `<account id>`, `<resource name>` are intentional gaps.
- **Test in a sandbox account first** — IAM changes propagate quickly and mistakes can lock you out.

## Constraints

### Must Do

- Replace all placeholders before applying.
- Narrow resources to the minimum required.
- Add `Condition` blocks for IP ranges, regions, or MFA when relevant.
- Validate policies in sandbox before production.
- Use AWS managed policies when they already cover the need (e.g., `AmazonS3ReadOnlyAccess`).

### Must Not Do

- Do not commit policies with unreplaced placeholders to production IaC.
- Do not use `"Resource": "*"` with `"Action": "*"` unless intentionally revoking sessions (see policy #8).
- Do not hardcode ARNs when they can be referenced from Terraform/CDK/Pulumi outputs.
- Do not skip testing — IAM mistakes are often irreversible without intervention.

## Further Reading

Full policy templates with syntax, explanations, and usage notes: [REFERENCE.md](REFERENCE.md)
