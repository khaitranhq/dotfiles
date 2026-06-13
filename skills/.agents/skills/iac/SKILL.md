---
name: iac
description: IaC modular-design rules for Terraform, Pulumi, CDK. Always group related resources into modules/constructs/component resources. Use when working with Terraform, Pulumi, AWS CDK, CDKTF, Bicep, or any IaC tooling.
triggers:
  - terraform
  - pulumi
  - cdk
  - cdktf
  - aws cdk
  - bicep
  - infrastructure as code
  - iac
  - module
  - construct
  - component resource
  - provisioning
  - cloudformation
role: specialist
scope: implementation
output-format: code
required-references:
  - REFERENCE.md
---

# Infrastructure as Code — Modular Design

## Core Rule

**Always group related resources into a module (Terraform), construct (CDK), or component resource (Pulumi).**

A "group" is resources that together provide a single logical service. Never scatter loose resources at the root level.

## Module Boundaries

Group by **service domain**, not by resource type:

| Stack Layer   | Module contents                                  |
| ------------- | ------------------------------------------------ |
| Application   | `api` (SG, role, SG rules, EC2/ECS)              |
| Database      | `database` (RDS, subnet group, parameter group)  |
| Network       | `network` (VPC, subnets, route tables, NAT, IGW) |
| Observability | `monitoring` (alarms, dashboards, log groups)    |

A module bundles: the primary resource + all supporting resources + outputs other modules consume.

## Anti-Patterns

❌ Root-level loose resources:

```hcl
# DON'T expose raw resources at root
resource "aws_security_group" "api" { ... }
resource "aws_iam_role" "api" { ... }
resource "aws_instance" "api" { ... }
```

✅ Module per service:

```hcl
module "api" {
  source = "./modules/api"
  vpc_id = module.network.vpc_id
}
module "database" {
  source    = "./modules/database"
  vpc_id    = module.network.vpc_id
  api_sg_id = module.api.security_group_id
}
```

## Per-Tool Patterns

See [REFERENCE.md](REFERENCE.md) for detailed patterns:

| Tool      | Pattern                             |
| --------- | ----------------------------------- |
| Terraform | `modules/<svc>/{main,vars,outputs}` |
| Pulumi    | `pulumi.ComponentResource`          |
| AWS CDK   | `Construct`                         |

## Cross-Module Wiring

Pass dependencies explicitly — never use `data` lookups across module boundaries:

```hcl
# ✅ Explicit
module "api" { db_endpoint = module.database.endpoint }

# ❌ Implicit
data "aws_db_instance" "main" { db_instance_identifier = "my-db" }
```

## Module Outputs — Export Only What’s Needed

**Rule: Every output must have a known consumer.** If you cannot name which module or external system consumes an output, delete it.

### When Outputs Are Essential

| Case                       | Example                                     | Rationale                                                    |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| **Cross-module wiring**    | `security_group_id`, `endpoint`, `role_arn` | Another module needs this to configure its own resources     |
| **Stack/provider outputs** | `load_balancer_dns`, `api_gateway_url`      | CI/CD, deployment scripts, external systems consume these    |
| **Environment injection**  | `db_connection_string`, `redis_url`         | Application config, ConfigMap, or secret managers read these |
| **Audit/compliance**       | ARNs, resource IDs                          | Tagging automation, cost allocation, compliance reporting    |

### When Outputs Are NOT Essential (Delete Them)

| Anti-pattern                    | Why it is wrong                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Debug/logging outputs           | "Just in case" — clutters module contract                                         |
| Internal implementation details | Values used only within same module — no external consumer                        |
| Redundant/derived outputs       | Exporting both `endpoint` and `connection_string` when one derives from the other |
| Terraform `output "*"`          | Nuclear anti-pattern — exports everything, leaks internals, breaks encapsulation  |

### Decision Flow

```
Does another module need this value?                          → YES → Output
Does an external system (CI/CD, config tool) need this value? → YES → Output
Is it needed for audit/compliance reporting?                  → YES → Output
```

## Validation Checklist

- [ ] Every resource belongs to a module/construct/component
- [ ] One service domain per module
- [ ] Outputs minimal — only what other modules need
- [ ] Cross-module deps are explicit
- [ ] Module name = service, not resource type
