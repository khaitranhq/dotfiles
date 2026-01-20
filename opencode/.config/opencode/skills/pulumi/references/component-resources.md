# Component Resources

Guide to creating reusable component resources in Pulumi.

## What is a Component Resource?

A component resource is a logical grouping of resources that you can treat as a single unit. Component resources help you:
- Encapsulate complexity
- Promote reusability
- Enforce best practices
- Create higher-level abstractions

## TypeScript Component Example

### Basic Component Structure

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface StaticWebsiteArgs {
    /**
     * The path to the website content directory
     */
    contentPath: string;

    /**
     * The index document for the website
     */
    indexDocument?: string;

    /**
     * The error document for the website
     */
    errorDocument?: string;

    /**
     * Custom domain name for the website
     */
    domainName?: string;
}

export class StaticWebsite extends pulumi.ComponentResource {
    public readonly bucketName: pulumi.Output<string>;
    public readonly websiteUrl: pulumi.Output<string>;
    public readonly bucket: aws.s3.Bucket;

    constructor(name: string, args: StaticWebsiteArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:aws:StaticWebsite", name, {}, opts);

        // Create S3 bucket
        this.bucket = new aws.s3.Bucket(`${name}-bucket`, {
            website: {
                indexDocument: args.indexDocument || "index.html",
                errorDocument: args.errorDocument || "error.html",
            },
            tags: {
                Name: name,
            },
        }, { parent: this });

        // Disable block public access
        const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(`${name}-public-access`, {
            bucket: this.bucket.id,
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
        }, { parent: this });

        // Create bucket policy
        const bucketPolicy = new aws.s3.BucketPolicy(`${name}-policy`, {
            bucket: this.bucket.id,
            policy: this.bucket.arn.apply(arn => JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Principal: "*",
                    Action: ["s3:GetObject"],
                    Resource: [`${arn}/*`],
                }],
            })),
        }, { parent: this, dependsOn: [publicAccessBlock] });

        // Sync website content
        const contentDir = args.contentPath;
        const files = /* your file sync logic */;

        // Export outputs
        this.bucketName = this.bucket.id;
        this.websiteUrl = this.bucket.websiteEndpoint;

        this.registerOutputs({
            bucketName: this.bucketName,
            websiteUrl: this.websiteUrl,
        });
    }
}
```

### Using the Component

```typescript
import { StaticWebsite } from "./staticWebsite";

const website = new StaticWebsite("my-website", {
    contentPath: "./dist",
    indexDocument: "index.html",
});

export const url = website.websiteUrl;
```

## Python Component Example

```python
from pulumi import ComponentResource, ResourceOptions, Output
import pulumi_aws as aws

class StaticWebsite(ComponentResource):
    """
    A component resource for creating a static website on S3
    """

    def __init__(self, name: str, content_path: str,
                 index_document: str = "index.html",
                 error_document: str = "error.html",
                 opts: ResourceOptions = None):
        super().__init__("custom:aws:StaticWebsite", name, None, opts)

        # Child resources should specify this component as their parent
        child_opts = ResourceOptions(parent=self)

        # Create S3 bucket
        self.bucket = aws.s3.Bucket(
            f"{name}-bucket",
            website=aws.s3.BucketWebsiteArgs(
                index_document=index_document,
                error_document=error_document,
            ),
            tags={"Name": name},
            opts=child_opts,
        )

        # Bucket policy
        bucket_policy = aws.s3.BucketPolicy(
            f"{name}-policy",
            bucket=self.bucket.id,
            policy=self.bucket.arn.apply(
                lambda arn: f"""{{
                    "Version": "2012-10-17",
                    "Statement": [{{
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": ["s3:GetObject"],
                        "Resource": ["{arn}/*"]
                    }}]
                }}"""
            ),
            opts=child_opts,
        )

        # Export outputs
        self.bucket_name = self.bucket.id
        self.website_url = self.bucket.website_endpoint

        self.register_outputs({
            "bucket_name": self.bucket_name,
            "website_url": self.website_url,
        })
```

## Advanced Component Patterns

### Component with Configuration

```typescript
interface DatabaseComponentArgs {
    instanceClass?: string;
    allocatedStorage?: number;
    engine?: string;
    engineVersion?: string;
    subnetIds: pulumi.Input<string>[];
    vpcId: pulumi.Input<string>;
    allowedCidrBlocks?: pulumi.Input<string>[];
}

export class Database extends pulumi.ComponentResource {
    public readonly endpoint: pulumi.Output<string>;
    public readonly securityGroupId: pulumi.Output<string>;

    constructor(name: string, args: DatabaseComponentArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:aws:Database", name, {}, opts);

        const config = new pulumi.Config();
        const dbPassword = config.requireSecret("dbPassword");

        // Security Group
        const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: args.vpcId,
            ingress: [{
                protocol: "tcp",
                fromPort: 3306,
                toPort: 3306,
                cidrBlocks: args.allowedCidrBlocks || ["10.0.0.0/16"],
            }],
        }, { parent: this });

        // Subnet Group
        const subnetGroup = new aws.rds.SubnetGroup(`${name}-subnet-group`, {
            subnetIds: args.subnetIds,
        }, { parent: this });

        // RDS Instance
        const db = new aws.rds.Instance(`${name}-db`, {
            allocatedStorage: args.allocatedStorage || 20,
            engine: args.engine || "mysql",
            engineVersion: args.engineVersion || "8.0",
            instanceClass: args.instanceClass || "db.t3.micro",
            username: "admin",
            password: dbPassword,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [sg.id],
            skipFinalSnapshot: true,
        }, { parent: this });

        this.endpoint = db.endpoint;
        this.securityGroupId = sg.id;

        this.registerOutputs({
            endpoint: this.endpoint,
            securityGroupId: this.securityGroupId,
        });
    }
}
```

### Multi-Resource Component

```typescript
interface MicroserviceArgs {
    vpcId: pulumi.Input<string>;
    subnetIds: pulumi.Input<string>[];
    containerImage: pulumi.Input<string>;
    containerPort: number;
    cpu?: string;
    memory?: string;
    desiredCount?: number;
}

export class Microservice extends pulumi.ComponentResource {
    public readonly serviceUrl: pulumi.Output<string>;
    public readonly serviceName: pulumi.Output<string>;

    constructor(name: string, args: MicroserviceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:aws:Microservice", name, {}, opts);

        // ECS Cluster
        const cluster = new aws.ecs.Cluster(`${name}-cluster`, {}, { parent: this });

        // Task Execution Role
        const taskExecRole = new aws.iam.Role(`${name}-exec-role`, {
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Action: "sts:AssumeRole",
                    Principal: { Service: "ecs-tasks.amazonaws.com" },
                    Effect: "Allow",
                }],
            }),
        }, { parent: this });

        new aws.iam.RolePolicyAttachment(`${name}-exec-policy`, {
            role: taskExecRole.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
        }, { parent: this });

        // Log Group
        const logGroup = new aws.cloudwatch.LogGroup(`${name}-logs`, {
            retentionInDays: 7,
        }, { parent: this });

        // Task Definition
        const taskDefinition = new aws.ecs.TaskDefinition(`${name}-task`, {
            family: name,
            cpu: args.cpu || "256",
            memory: args.memory || "512",
            networkMode: "awsvpc",
            requiresCompatibilities: ["FARGATE"],
            executionRoleArn: taskExecRole.arn,
            containerDefinitions: pulumi.all([args.containerImage, logGroup.name]).apply(
                ([image, logGroupName]) => JSON.stringify([{
                    name: name,
                    image: image,
                    portMappings: [{
                        containerPort: args.containerPort,
                        protocol: "tcp",
                    }],
                    logConfiguration: {
                        logDriver: "awslogs",
                        options: {
                            "awslogs-group": logGroupName,
                            "awslogs-region": aws.config.region,
                            "awslogs-stream-prefix": name,
                        },
                    },
                }])
            ),
        }, { parent: this });

        // Security Group
        const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: args.vpcId,
            ingress: [{
                protocol: "tcp",
                fromPort: args.containerPort,
                toPort: args.containerPort,
                cidrBlocks: ["0.0.0.0/0"],
            }],
            egress: [{
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ["0.0.0.0/0"],
            }],
        }, { parent: this });

        // Load Balancer
        const alb = new aws.lb.LoadBalancer(`${name}-alb`, {
            internal: false,
            loadBalancerType: "application",
            securityGroups: [sg.id],
            subnets: args.subnetIds,
        }, { parent: this });

        const targetGroup = new aws.lb.TargetGroup(`${name}-tg`, {
            port: args.containerPort,
            protocol: "HTTP",
            vpcId: args.vpcId,
            targetType: "ip",
            healthCheck: {
                enabled: true,
                path: "/health",
            },
        }, { parent: this });

        const listener = new aws.lb.Listener(`${name}-listener`, {
            loadBalancerArn: alb.arn,
            port: 80,
            defaultActions: [{
                type: "forward",
                targetGroupArn: targetGroup.arn,
            }],
        }, { parent: this });

        // ECS Service
        const service = new aws.ecs.Service(`${name}-service`, {
            cluster: cluster.arn,
            taskDefinition: taskDefinition.arn,
            desiredCount: args.desiredCount || 2,
            launchType: "FARGATE",
            networkConfiguration: {
                subnets: args.subnetIds,
                securityGroups: [sg.id],
                assignPublicIp: true,
            },
            loadBalancers: [{
                targetGroupArn: targetGroup.arn,
                containerName: name,
                containerPort: args.containerPort,
            }],
        }, { parent: this, dependsOn: [listener] });

        this.serviceUrl = alb.dnsName.apply(dns => `http://${dns}`);
        this.serviceName = service.name;

        this.registerOutputs({
            serviceUrl: this.serviceUrl,
            serviceName: this.serviceName,
        });
    }
}
```

## Best Practices

1. **Always set parent**: Pass `{ parent: this }` to child resources
2. **Register outputs**: Call `registerOutputs()` at the end of the constructor
3. **Type your args**: Use interfaces for component arguments
4. **Document your component**: Add JSDoc/docstrings for parameters
5. **Sensible defaults**: Provide defaults for optional parameters
6. **Validate inputs**: Check inputs in the constructor
7. **Export what's needed**: Only expose outputs that consumers need
8. **Use Output.all()**: When you need to combine multiple outputs
9. **Handle dependencies**: Use `dependsOn` when necessary
10. **Keep it focused**: Each component should have a single responsibility
