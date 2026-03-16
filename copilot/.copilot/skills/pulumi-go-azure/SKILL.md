---
name: pulumi-go-azure
description: Guidance and examples for authoring Pulumi programs in Go targeting Azure, with focus on role lookups and RBAC patterns.
triggers:
  - pulumi azure go
  - pulumi go
role: specialist
scope: implementation, examples, reference
output-format: markdown, code
---

# Pulumi Go Azure

This skill provides guidance and ready-to-use examples for using Pulumi with Azure in Go, focused on common patterns and helpers you will repeatedly need when provisioning resources with role lookups and RBAC.

## When to use this skill

- When authoring Pulumi programs in Go that target Azure and you need concrete, copy-pasteable examples.
- When you need to look up Azure role definition IDs by friendly name (for assigning roles to principals) using Pulumi outputs.
- When you want recommended patterns for combining Pulumi Output helpers with the Azure SDK types in Go.

## LSP (Language Server) note — important

- Before implementing or changing code, use your language server / LSP tooling to inspect type definitions, function signatures, and existing usage of Pulumi functions/types. For Go, use the `lsp` action with `hover` operation to get definition information (e.g., `lsp` with `operation: "hover"`). Also refer to the list of Pulumi functions in the Service-specific references section below.
- Using LSP prevents type mismatches and saves time converting between Pulumi Output wrappers and plain Go types. Use the LSP lookups before you write ApplyT/ToStringOutput conversions.

## Tips

### Getting Role Definition ID by Name

To get the Role Definition ID by its name in Pulumi Go, you can use the `authorization.LookupRoleDefinitionOutput` function. Here's an example of how to do this:

```go
import (
    "github.com/pulumi/pulumi-azure-native-sdk/authorization/v3"
    "github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

//...

roleDefinition, err := authorization.LookupRoleDefinitionOutput(ctx, authorization.LookupRoleDefinitionOutputArgs{
    RoleName:       pulumi.String("Contributor"),
    Scope:          resourceGroup.ID(), // or subscription ID, etc.
})
roleDefinitionId := roleDefinition.ID()
```

Common role names:

- "Contributor"
- "Reader"
- "Owner"
- "Key Vault Contributor"

## Service-specific references

- [keyvault](./references/keyvault.md) - KeyVault and secret management
