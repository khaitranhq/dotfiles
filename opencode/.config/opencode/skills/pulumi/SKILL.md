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

### 6. Building Component Resources

Component resources are reusable abstractions that encapsulate multiple Pulumi resources into a single, configurable unit. They enable code reuse, standardize infrastructure patterns, and can be shared across projects or teams.

#### Why Build Components

- **Reusability**: Define infrastructure once, deploy many times across environments
- **Best Practices**: Encode company standards and security policies into components
- **Maintainability**: Easier to update patterns across multiple stacks
- **Multi-language**: Package as plugin packages to use from any Pulumi-supported language

#### Component Structure

A component consists of two main parts:

1. **Component Arguments** - Strongly-typed input properties that configure the component
2. **Component Resource** - The class/struct that extends `pulumi.ComponentResource` and manages child resources

#### Defining Component Arguments

Arguments must be strongly-typed, serializable, and use `pulumi.Input` types.

**Go Example:**
```go
type DatabaseComponentArgs struct {
	Engine          pulumi.StringInput `pulumi:"engine"`          // e.g., "mysql", "postgres"
	EngineVersion   pulumi.StringInput `pulumi:"engineVersion"`   // e.g., "8.0"
	AllocatedStorage pulumi.IntInput    `pulumi:"allocatedStorage"` // GB
	InstanceClass   pulumi.StringInput `pulumi:"instanceClass"`   // e.g., "db.t3.micro"
	DBName          pulumi.StringInput `pulumi:"dbName"`
	Username        pulumi.StringInput `pulumi:"username"`
	Password        pulumi.StringInput `pulumi:"password"` // Use secret in Pulumi.yaml
	Tags            pulumi.MapInput    `pulumi:"tags"`
}
```

**TypeScript Example:**
```typescript
export interface DatabaseComponentArgs {
    engine: pulumi.Input<string>;
    engineVersion: pulumi.Input<string>;
    allocatedStorage: pulumi.Input<number>;
    instanceClass: pulumi.Input<string>;
    dbName: pulumi.Input<string>;
    username: pulumi.Input<string>;
    password: pulumi.Input<string>;
    tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}
```

#### Implementing Component Resources

Components extend `pulumi.ComponentResource` and define child resources in their constructor/factory function.

**Go Example:**
```go
type DatabaseComponent struct {
	pulumi.ResourceState

	// Outputs
	Endpoint pulumi.StringOutput `pulumi:"endpoint"`
	Port     pulumi.IntOutput    `pulumi:"port"`
	DBName   pulumi.StringOutput `pulumi:"dbName"`
}

func NewDatabaseComponent(ctx *pulumi.Context, name string, args *DatabaseComponentArgs,
	opts ...pulumi.ResourceOption) (*DatabaseComponent, error) {

	comp := &DatabaseComponent{}
	err := ctx.RegisterComponentResource("company:rds:DatabaseComponent", name, comp, opts...)
	if err != nil {
		return nil, err
	}

	// Create the RDS instance
	db, err := rds.NewInstance(ctx, fmt.Sprintf("%s-db", name), &rds.InstanceArgs{
		Engine:          args.Engine,
		EngineVersion:   args.EngineVersion,
		AllocatedStorage: args.AllocatedStorage,
		InstanceClass:   args.InstanceClass,
		DBName:          args.DBName,
		Username:        args.Username,
		Password:        args.Password,
		Tags:            args.Tags,
	}, pulumi.Parent(comp))
	if err != nil {
		return nil, err
	}

	// Create security group for the database
	sg, err := ec2.NewSecurityGroup(ctx, fmt.Sprintf("%s-sg", name), &ec2.SecurityGroupArgs{
		Description: pulumi.Sprintf("Security group for %s", name),
		EgressRules: ec2.SecurityGroupEgressRuleArray{
			&ec2.SecurityGroupEgressRuleArgs{
				Protocol:   pulumi.String("-1"),
				FromPort:   pulumi.Int(0),
				ToPort:     pulumi.Int(0),
				CidrBlocks: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
			},
		},
	}, pulumi.Parent(comp))
	if err != nil {
		return nil, err
	}

	// Set outputs
	comp.Endpoint = db.Endpoint
	comp.Port = db.Port
	comp.DBName = db.DBName

	// Signal completion
	ctx.RegisterResourceOutputs(comp, pulumi.Map{
		"endpoint": db.Endpoint,
		"port":     db.Port,
		"dbName":   db.DBName,
	})

	return comp, nil
}
```

**TypeScript Example:**
```typescript
export class DatabaseComponent extends pulumi.ComponentResource {
    public readonly endpoint: pulumi.Output<string>;
    public readonly port: pulumi.Output<number>;
    public readonly dbName: pulumi.Output<string>;

    constructor(name: string, args: DatabaseComponentArgs,
                opts?: pulumi.ComponentResourceOptions) {
        super("company:rds:DatabaseComponent", name, args, opts);

        // Create RDS instance
        const db = new aws.rds.Instance(`${name}-db`, {
            engine: args.engine,
            engineVersion: args.engineVersion,
            allocatedStorage: args.allocatedStorage,
            instanceClass: args.instanceClass,
            dbName: args.dbName,
            username: args.username,
            password: args.password,
            tags: args.tags,
        }, { parent: this });

        // Create security group
        const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
            description: `Security group for ${name}`,
            egressRules: [{
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ["0.0.0.0/0"],
            }],
        }, { parent: this });

        this.endpoint = db.endpoint;
        this.port = db.port;
        this.dbName = db.dbName;

        this.registerOutputs({
            endpoint: this.endpoint,
            port: this.port,
            dbName: this.dbName,
        });
    }
}
```

#### Key Component Principles

1. **Set `parent: this`** (or `pulumi.Parent(comp)` in Go) on all child resources to establish resource hierarchy
2. **Template child resource names** with the component name (e.g., ``${name}-db``, `fmt.Sprintf("%s-db", name)`) to avoid conflicts
3. **Use `pulumi.Input<T>` and `pulumi.Output<T>`** for all arguments and outputs; never use plain types
4. **Define `pulumi.Input` struct tags** to map configuration keys (Go: ``pulumi:"keyName"``, TypeScript: interfaces)
5. **Document outputs** clearly in comments or docstrings to define the component's contract
6. **Call `registerOutputs()` or `RegisterResourceOutputs()`** at the end to signal completion
7. **Validate arguments early** to fail fast with clear error messages if required fields are missing
8. **Use dependency ordering** with `dependsOn` when one child resource must be created before another

#### Using Components in Pulumi Programs

Once defined, use components like any other resource:

**Go:**
```go
db, err := NewDatabaseComponent(ctx, "app-db", &DatabaseComponentArgs{
	Engine:          pulumi.String("postgres"),
	EngineVersion:   pulumi.String("13"),
	AllocatedStorage: pulumi.Int(100),
	InstanceClass:   pulumi.String("db.t3.small"),
	DBName:          pulumi.String("appdb"),
	Username:        pulumi.String("admin"),
	Password:        cfg.RequireSecret("db:password"),
})

ctx.Export("dbEndpoint", db.Endpoint)
ctx.Export("dbPort", db.Port)
```

**TypeScript:**
```typescript
const db = new DatabaseComponent("app-db", {
    engine: "postgres",
    engineVersion: "13",
    allocatedStorage: 100,
    instanceClass: "db.t3.small",
    dbName: "appdb",
    username: "admin",
    password: config.requireSecret("db:password"),
});

export const dbEndpoint = db.endpoint;
export const dbPort = db.port;
```

#### Sharing Components

**Native Language Packages:**
- Publish to npm (TypeScript), PyPI (Python), Maven (Java), NuGet (.NET), or Go modules
- Simplest for single-language reuse

**Plugin Packages:**
- Package as a Pulumi plugin with `PulumiPlugin.yaml`, language manifest, and provider entry file
- Enables use from any Pulumi-supported language via generated SDKs
- Recommended for broad team/organization reuse

See [Authoring a Source-Based Plugin Package](https://www.pulumi.com/docs/iac/guides/building-extending/packages/source-based-plugin/) for plugin packaging details.

## Constraints

- **Require `ctx` for any multi-step automation** (e.g., `pulumi.Run` or `pulumi.StackReference`) so operations can be cancelled.
- **Handle all errors explicitly**; wrap with context using `fmt.Errorf` or similar.
- **Document exported components** and stack outputs so downstream stacks know what to expect.
- **Validate YAML and Pulumi configs** with `yamllint` when changes involve YAML files.
- **Avoid panics for normal flow**; emit errors or fail the deployment explicitly.
- **Use `go doc` commands** to discover types and functions — See `opencode/.config/opencode/skills/golang/SKILL.md` for `go doc` workflow details.

## Post-Implementation Steps

1. `pulumi preview` — verify resources before deployment
2. `pulumi up` — apply changes with confirmation
3. `pulumi stack output` — confirm outputs match the documented contract
4. `pulumi stack export` — keep sanitized state exports for auditing when needed

## Reference

- Go skill for related practice and `go doc` workflows: See `opencode/.config/opencode/skills/golang/SKILL.md`
