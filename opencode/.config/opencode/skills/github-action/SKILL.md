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

## Constraints

### Must do

- Run workflow validations with `actionlint` and `zizmor` after touching any GitHub Actions files.
