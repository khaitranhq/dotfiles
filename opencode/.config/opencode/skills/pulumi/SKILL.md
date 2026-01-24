---
name: Pulumi Infrastructure as Code
description: Expert in Pulumi infrastructure as code using TypeScript, Python, Go, and C#. Specializes in multi-cloud deployments, component resources, and IaC best practices.
triggers:
  - Pulumi
  - infrastructure as code
  - IaC
  - cloud infrastructure
  - Pulumi stack
  - component resource
  - Pulumi config
  - CrossGuard
  - stack reference
role: specialist
scope: implementation
output-format: code
---

# Pulumi Infrastructure as Code Skill

This skill provides guidance for working with Pulumi infrastructure as code projects.

## Overview

Pulumi is a modern infrastructure as code platform that allows you to define cloud infrastructure using familiar programming languages like TypeScript, Python, Go, and C#.

## Core Principles

When working with Pulumi projects, follow these principles:

1. **Use Strong Typing**: Leverage your programming language's type system to catch errors at development time
2. **Component Resources**: Encapsulate related infrastructure into reusable component resources
3. **Stack Configuration**: Use stack-specific configuration for environment differences
4. **Output Management**: Properly export outputs that other stacks or systems need to reference
5. **Secret Management**: Always use Pulumi's secret management for sensitive data
6. **State Management**: Understand and properly configure your state backend

## Common Tasks

### Project Structure

A typical Pulumi project structure:

```
.
├── Pulumi.yaml           # Project definition
├── Pulumi.dev.yaml       # Dev stack configuration
├── Pulumi.prod.yaml      # Prod stack configuration
├── index.ts              # Main program entry point
├── components/           # Reusable component resources
├── config/              # Configuration helpers
└── package.json         # Dependencies (for TypeScript/Node.js)
```

### Creating Resources

**Key Guidelines:**

- Always provide meaningful resource names
- Use consistent naming conventions
- Tag resources appropriately for cost tracking and organization
- Set explicit dependencies when Pulumi can't infer them
- Use `dependsOn` when needed to control resource creation order

### Working with Stacks

**Stack Best Practices:**

- Use separate stacks for different environments (dev, staging, prod)
- Store stack configuration in version control (except secrets)
- Use `pulumi config` to manage configuration values
- Reference stack outputs using `StackReference` for cross-stack dependencies

### Component Resources

**When to Create Components:**

- You're repeating the same set of resources multiple times
- You want to encapsulate infrastructure patterns
- You need to share infrastructure definitions across projects
- You want to provide sensible defaults with customization options

### Secret Management

**Security Guidelines:**

- Always use `pulumi.secret()` for sensitive values
- Never hardcode credentials or API keys
- Use cloud provider secret managers (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate secrets regularly and update Pulumi configuration

### Testing

**Testing Strategies:**

- Unit test component resources using Pulumi's testing framework
- Use policy as code with Pulumi CrossGuard
- Validate infrastructure with integration tests
- Preview changes before applying (`pulumi preview`)

## TypeScript-Specific Guidance

### Async/Await Pattern

Pulumi outputs are asynchronous. Use `apply()` to work with output values:

```typescript
const bucket = new aws.s3.Bucket("my-bucket");
const bucketUrl = bucket.id.apply((id) => `https://${id}.s3.amazonaws.com`);
```

### Importing Resources

```typescript
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
```

### Exporting Outputs

```typescript
export const bucketName = bucket.id;
export const endpointUrl = pulumi.interpolate`https://${bucket.bucketDomainName}`;
```

## Python-Specific Guidance

### Resource Naming

Use snake_case for Python variables but provide meaningful resource names:

```python
my_bucket = aws.s3.Bucket("my-bucket")
```

### Working with Outputs

```python
bucket_url = my_bucket.id.apply(lambda id: f"https://{id}.s3.amazonaws.com")
```

### Exporting Outputs

```python
pulumi.export("bucket_name", my_bucket.id)
pulumi.export("endpoint_url", my_bucket.bucket_domain_name.apply(
    lambda domain: f"https://{domain}"
))
```

## Common Commands

- `pulumi new` - Create a new project
- `pulumi stack init` - Create a new stack
- `pulumi config set` - Set configuration value
- `pulumi config set --secret` - Set secret configuration
- `pulumi preview` - Preview infrastructure changes
- `pulumi up` - Deploy infrastructure changes
- `pulumi destroy` - Destroy infrastructure
- `pulumi stack output` - View stack outputs
- `pulumi refresh` - Sync state with actual infrastructure

## Error Handling

### Common Issues and Solutions

1. **Conflicting Resources**: Resource already exists
   - Solution: Import the existing resource or use a different name

2. **Dependency Issues**: Resources created in wrong order
   - Solution: Use explicit `dependsOn` or restructure code

3. **State Issues**: State file out of sync
   - Solution: Run `pulumi refresh` to sync state

4. **Configuration Missing**: Required config not set
   - Solution: Set required configuration with `pulumi config set`

## Best Practices

1. **Version Control**: Always commit `Pulumi.yaml` and stack configs (except secrets)
2. **CI/CD Integration**: Automate deployments using Pulumi in CI/CD pipelines
3. **Preview Before Deploy**: Always run `pulumi preview` before `pulumi up`
4. **Resource Organization**: Group related resources in component resources
5. **Documentation**: Document complex infrastructure decisions in code comments
6. **Tagging Strategy**: Implement consistent tagging across all resources
7. **Cost Management**: Use tags and resource organization to track costs
8. **State Backend**: Use a reliable backend (Pulumi Cloud, S3, Azure Blob, etc.)

## Multi-Cloud Considerations

When working with multiple cloud providers:

- Keep provider-specific code in separate modules
- Use abstraction layers for common patterns
- Be aware of provider-specific limitations
- Test cross-cloud dependencies carefully

## References

See the `references/` directory for detailed documentation on:

- Component resource examples
- Testing strategies
- CI/CD integration patterns
- Advanced patterns and best practices

## Resources

- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Pulumi Examples](https://github.com/pulumi/examples)
- [Pulumi Registry](https://www.pulumi.com/registry/)
- [Pulumi Blog](https://www.pulumi.com/blog/)
