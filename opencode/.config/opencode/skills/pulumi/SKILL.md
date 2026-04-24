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

### 4. Structured Configuration

- Use **Structured Configuration** for complex, nested configuration hierarchies instead of flat key-value pairs.
- Define configuration objects as strongly-typed structs (e.g., `type DatabaseConfig struct { Host string; Port int; ... }`).
- Leverage `pulumi.Config::getObject` or language-specific equivalents to unmarshal structured config into typed objects.
- Validate configuration early in stack initialization; fail fast with clear error messages if required fields are missing or invalid.
- Document the config schema clearly so users understand the expected structure and can generate config files with `pulumi config` commands.
- Use structured config to group related settings (e.g., all database settings in one object, all network settings in another) for clarity and maintainability.

#### Example: YAML Configuration

In `Pulumi.yaml`:

```yaml
name: my-stack
runtime: go
description: A sample infrastructure stack

config:
  database:
    host: localhost
    port: 5432
    username: admin
    password:
      secure: AAABAxxxx...  # Pulumi will encrypt this
  networking:
    vpcCidr: 10.0.0.0/16
    subnetCount: 3
    enableNatGateway: true
```

#### Example: Go Code for Loading

Define strongly-typed configuration structs:

```go
package main

import (
	"fmt"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Host     string `pulumi:"host"`
	Port     int    `pulumi:"port"`
	Username string `pulumi:"username"`
	Password string `pulumi:"password"`
}

// NetworkingConfig represents networking configuration
type NetworkingConfig struct {
	VpcCidr           string `pulumi:"vpcCidr"`
	SubnetCount       int    `pulumi:"subnetCount"`
	EnableNatGateway  bool   `pulumi:"enableNatGateway"`
}

// StackConfig holds all configuration for the stack
type StackConfig struct {
	Database  DatabaseConfig  `pulumi:"database"`
	Networking NetworkingConfig `pulumi:"networking"`
}

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "")

		// Load structured configuration
		var stackConfig StackConfig
		if err := cfg.GetObject("", &stackConfig); err != nil {
			return fmt.Errorf("failed to load stack config: %w", err)
		}

		// Validate required fields
		if stackConfig.Database.Host == "" {
			return fmt.Errorf("database.host is required")
		}
		if stackConfig.Database.Port <= 0 {
			return fmt.Errorf("database.port must be greater than 0")
		}
		if stackConfig.Networking.SubnetCount <= 0 {
			return fmt.Errorf("networking.subnetCount must be greater than 0")
		}

		// Use configuration in your stack
		ctx.Log.Info(fmt.Sprintf("Configuring database: %s:%d",
			stackConfig.Database.Host, stackConfig.Database.Port), nil)
		ctx.Log.Info(fmt.Sprintf("VPC CIDR: %s", stackConfig.Networking.VpcCidr), nil)

		// Continue with resource creation...
		return nil
	})
}
```

Key patterns in this example:
- Define nested structs matching your configuration hierarchy
- Use `pulumi` struct tags to map YAML keys to struct fields
- Call `cfg.GetObject("", &stackConfig)` to unmarshal entire config
- Validate all required fields immediately after loading
- Return descriptive errors when validation fails

### 5. Type Safety and Post-Deployment Checks

- Use strongly typed inputs/outputs for components (e.g., `type NetworkArgs struct { ... }`).
- Validate expected values in previews with `pulumi.RunFunc` tests or CLI assertions before deployment.
- Run `pulumi preview` locally and `pulumi up --skip-preview` with automation scripts that enforce policy compliance, such as checking for unwanted outputs.

## Discovering Pulumi Go Types and Functions

When implementing Pulumi stacks in Go, use `go doc` commands to discover available types, functions, and their correct signatures:

### List available types and functions in a package

```bash
go doc <package>
```

Example:
```bash
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2
```

This shows all exported types and functions in the package. Look for:
- **Constructors** - functions that create resources (e.g., `NewInstance`)
- **Args structs** - e.g., `InstanceArgs` that define resource properties
- **Result types** - structs returned by constructors (e.g., `*Instance`)

### Get detailed information about a specific type or function

```bash
go doc <package> <type/func name>
```

Examples:
```bash
# Get details about a constructor function
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2 NewInstance

# Get details about an Args struct
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2 InstanceArgs

# Get details about a resource type
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2 Instance
```

This shows:
- Function/type signature
- Documentation explaining purpose
- All fields in structs with their types and field tags
- Required vs optional parameters

### Workflow when implementing Pulumi Go code

1. **Find the right package** - Determine which Pulumi provider package you need (e.g., `pulumi-aws`, `pulumi-gcp`)
2. **List available resources** - Run `go doc <package>` to see available resource constructors
3. **Choose the resource** - Identify the constructor function (e.g., `NewInstance`)
4. **Get Args struct details** - Run `go doc <package> <ResourceType>Args` to see all available properties
5. **Understand the return type** - Run `go doc <package> <ResourceType>` to see output fields and methods
6. **Implement with correct types** - Use the exact field names, types, and struct tag names from documentation

### Common patterns

- Resource constructors typically follow the pattern `New<ResourceType>(ctx, name, args, opts...)`
- Args structs use pointer types for optional fields
- Output fields use `pulumi.Output` or `pulumi.StringOutput`, etc. for lazy evaluation
- All resource IDs are automatically managed; avoid hardcoding IDs

## Constraints

- **Require `ctx` for any multi-step automation** (e.g., `pulumi.Run` or `pulumi.StackReference`) so operations can be cancelled.
- **Handle all errors explicitly**; wrap with context using `fmt.Errorf` or similar.
- **Document exported components** and stack outputs so downstream stacks know what to expect.
- **Validate YAML and Pulumi configs** with `yamllint` when changes involve YAML files.
- **Avoid panics for normal flow**; emit errors or fail the deployment explicitly.
- **Use `go doc` commands** to discover the correct types, functions, and signatures before implementing Pulumi Go code.

## Post-Implementation Steps

1. `pulumi preview` — verify resources before deployment
2. `pulumi up` — apply changes with confirmation
3. `pulumi stack output` — confirm outputs match the documented contract
4. `pulumi stack export` — keep sanitized state exports for auditing when needed

## Reference

- Go skill for related practice: See `opencode/.config/opencode/skills/golang/SKILL.md` for complementary implementation expectations.
