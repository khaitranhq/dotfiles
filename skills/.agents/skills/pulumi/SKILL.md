---
name: pulumi
description: Pulumi infrastructure-as-code rules with enforcement for config management and project structure. Use when working with Pulumi, .ts/.py/.go Pulumi projects, Pulumi.yaml, stack configs, or when user mentions pulumi, pulumi up, pulumi preview, pulumi config, or Pulumi CLI.
---

# Pulumi

## Enforcement Rule: Single Config Source

**All configuration must be loaded in a single file — never scattered per-file on demand.**

One file owns every config read. Every other file consumes config through explicit parameters passed from that single owner. No file may call `pulumi.config` / `config.require()` / `config.get()` directly except the designated config file.
