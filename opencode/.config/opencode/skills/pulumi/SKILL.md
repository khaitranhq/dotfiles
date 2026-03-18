---
name: pulumi
description: Provides Pulumi-specific opinions for infrastructure-as-code stacks, focusing on safe exports and stack composition.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: platform
  triggers:
    - Pulumi
    - Infrastructure as Code
    - IaC
    - Cloud engineering
  role: specialist
  scope: implementation
  output-format: code
---

# Pulumi Skill

## Purpose

This skill captures Pulumi best practices for composing stacks, managing secrets, and exporting outputs responsibly so that downstream stacks consume only what they truly need.

## Key Workflows

### 1. Stack Composition and Outputs

- Keep stack outputs minimal; **only export values consumed by other stacks**.
- Prefer `StackReference` to share data, not raw outputs, when you can scope it to a subset of needed values.
- If an output is shared, document who expects it so future contributors understand the dependency chain.
- Use environment-specific stack names and avoid exporting secrets. Use `pulumi.Config` or secrets providers instead.
- When consuming another stack, wrap access with `pulumi.StackReference` and `getOutput` to ensure the contract is explicit.

### 2. Resource Organization

- Group resources into logical modules/packages for each cloud service or domain (networking, security, compute, storage).
- Keep constructors small; if a module grows, split it into helper functions that return typed structs.
- Tag resources with metadata (`Project`, `Stack`, `Environment`) to simplify filtering and compliance.

### 3. Config and Secrets Handling

- Always read configuration through `pulumi.Config` and default to safe values when missing.
- Store secrets via `pulumi.Config::requireSecret` or the language-specific secret helpers; never log or export them.
- When passing secrets between stacks, export as `pulumi.Output.secret` and unwrap only where absolutely necessary.

### 4. Type Safety and Post-Deployment Checks

- Use strongly typed inputs/outputs for components (e.g., `type NetworkArgs struct { ... }`).
- Validate expected values in previews with `pulumi.RunFunc` tests or CLI assertions before deployment.
- Run `pulumi preview` locally and `pulumi up --skip-preview` with automation scripts that enforce policy compliance, such as checking for unwanted outputs.

## Constraints

- **Require `ctx` for any multi-step automation** (e.g., `pulumi.Run` or `pulumi.StackReference`) so operations can be cancelled.
- **Handle all errors explicitly**; wrap with context using `fmt.Errorf` or similar.
- **Document exported components** and stack outputs so downstream stacks know what to expect.
- **Validate YAML and Pulumi configs** with `yamllint` when changes involve YAML files.
- **Avoid panics for normal flow**; emit errors or fail the deployment explicitly.

## Post-Implementation Steps

1. `pulumi preview` — verify resources before deployment
2. `pulumi up` — apply changes with confirmation
3. `pulumi stack output` — confirm outputs match the documented contract
4. `pulumi stack export` — keep sanitized state exports for auditing when needed

## Reference

- Go skill for related practice: See `opencode/.config/opencode/skills/golang/SKILL.md` for complementary implementation expectations.
