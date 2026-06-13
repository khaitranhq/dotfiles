# IaC Module Patterns — Reference

## Terraform

### Directory Structure

```
modules/
└── <service>/
    ├── main.tf          # resources
    ├── variables.tf     # inputs
    └── outputs.tf       # exposed values
```

### Rules

- Every module **must** have `variables.tf` and `outputs.tf`.
- Output only what other modules consume — never `output "*"`.
- Pin module source: local path in dev, versioned remote in prod.

### Example: API Module

```hcl
# modules/api/variables.tf
variable "vpc_id"        { type = string }
variable "subnet_ids"    { type = list(string) }
variable "instance_type" { type = string; default = "t3.medium" }

# modules/api/outputs.tf
output "instance_id"       { value = aws_instance.main.id }
output "security_group_id" { value = aws_security_group.main.id }
output "role_arn"          { value = aws_iam_role.main.arn }

# modules/api/main.tf
resource "aws_security_group" "main" {
  name   = "${var.name}-api-sg"
  vpc_id = var.vpc_id
}

resource "aws_security_group_rule" "ingress" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  security_group_id = aws_security_group.main.id
}

resource "aws_iam_role" "main" {
  name = "${var.name}-api-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_instance" "main" {
  ami             = data.aws_ami.ubuntu.id
  instance_type   = var.instance_type
  subnet_id       = var.subnet_ids[0]
  security_groups = [aws_security_group.main.id]
  iam_instance_profile = aws_iam_instance_profile.main.name
}
```

### Root Wiring

```hcl
module "network" { source = "./modules/network" }
module "api" {
  source     = "./modules/api"
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.public_subnet_ids
}
module "database" {
  source    = "./modules/database"
  vpc_id    = module.network.vpc_id
  api_sg_id = module.api.security_group_id
}
```

---

## Pulumi (ComponentResource)

### Rules

- Every service group → a `pulumi.ComponentResource` subclass.
- Register only necessary outputs via `registerOutputs`.
- Root `index.ts` wires components; never defines resources directly.

### Example: API ComponentResource

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface ApiArgs {
  vpcId: pulumi.Input<string>;
  subnetId: pulumi.Input<string>;
  instanceType?: pulumi.Input<string>;
}

export class Api extends pulumi.ComponentResource {
  readonly instanceId: pulumi.Output<string>;
  readonly securityGroupId: pulumi.Output<string>;
  readonly roleArn: pulumi.Output<string>;

  constructor(name: string, args: ApiArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:stack:Api", name, {}, opts);

    const defaultOpts = { parent: this };

    const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
      name: `${name}-api-sg`,
      vpcId: args.vpcId,
    }, defaultOpts);

    const role = new aws.iam.Role(`${name}-role`, {
      name: `${name}-api-role`,
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal(
        { Service: "ec2.amazonaws.com" }
      ),
    }, defaultOpts);

    const instance = new aws.ec2.Instance(`${name}-instance`, {
      instanceType: args.instanceType ?? "t3.medium",
      ami: "ami-0c55b159cbfafe1f0",
      subnetId: args.subnetId,
      vpcSecurityGroupIds: [sg.id],
      iamInstanceProfile: instanceProfile.name,
    }, defaultOpts);

    this.instanceId = instance.id;
    this.securityGroupId = sg.id;
    this.roleArn = role.arn;

    this.registerOutputs({
      instanceId: this.instanceId,
      securityGroupId: this.securityGroupId,
      roleArn: this.roleArn,
    });
  }
}
```

### Root Wiring

```typescript
import { Network } from "./network";
import { Api } from "./api";
import { Database } from "./database";

const network = new Network("net");

const api = new Api("api", {
  vpcId: network.vpcId,
  subnetId: network.publicSubnetId,
});

const db = new Database("db", {
  vpcId: network.vpcId,
  apiSecurityGroupId: api.securityGroupId,
});
```

---

## AWS CDK (Construct)

### Rules

- Every service group → a custom `Construct`.
- Stacks are thin wiring; resources live in constructs.
- Expose dependencies via public readonly properties.

### Example: API Construct

```typescript
import { Construct } from "constructs";
import { aws_ec2 as ec2, aws_iam as iam } from "aws-cdk-lib";

interface ApiProps {
  vpc: ec2.IVpc;
  instanceType?: string;
}

export class Api extends Construct {
  readonly securityGroup: ec2.SecurityGroup;
  readonly instance: ec2.Instance;
  readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, "SG", {
      vpc: props.vpc,
      description: "API security group",
    });

    this.role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    this.instance = new ec2.Instance(this, "Instance", {
      vpc: props.vpc,
      instanceType: new ec2.InstanceType(props.instanceType ?? "t3.medium"),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: this.securityGroup,
      role: this.role,
    });
  }
}
```

### Root Stack

```typescript
const api = new Api(this, "Api", { vpc });
const db  = new Database(this, "Database", {
  vpc,
  apiSecurityGroup: api.securityGroup,
});
```
