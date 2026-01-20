# Advanced Patterns and Best Practices

Advanced Pulumi patterns for production infrastructure.

## Stack References

### Cross-Stack Dependencies

```typescript
import * as pulumi from "@pulumi/pulumi";

// In the networking stack
export const vpcId = vpc.id;
export const publicSubnetIds = publicSubnets.map(s => s.id);
export const privateSubnetIds = privateSubnets.map(s => s.id);

// In the application stack
const networkingStack = new pulumi.StackReference("networking", {
    name: "organization/networking/production",
});

const vpcId = networkingStack.requireOutput("vpcId");
const publicSubnetIds = networkingStack.requireOutput("publicSubnetIds");
const privateSubnetIds = networkingStack.requireOutput("privateSubnetIds");

const alb = new aws.lb.LoadBalancer("app-lb", {
    subnets: publicSubnetIds,
    // ... other config
});
```

## Dynamic Providers

### Custom Resource Provider

```typescript
import * as pulumi from "@pulumi/pulumi";
import axios from "axios";

interface WebhookArgs {
    url: string;
    payload: any;
}

class WebhookProvider implements pulumi.dynamic.ResourceProvider {
    async create(inputs: WebhookArgs): Promise<pulumi.dynamic.CreateResult> {
        const response = await axios.post(inputs.url, inputs.payload);
        return {
            id: response.data.id,
            outs: {
                url: inputs.url,
                response: response.data,
            },
        };
    }

    async update(id: string, olds: WebhookArgs, news: WebhookArgs): Promise<pulumi.dynamic.UpdateResult> {
        const response = await axios.put(`${news.url}/${id}`, news.payload);
        return {
            outs: {
                url: news.url,
                response: response.data,
            },
        };
    }

    async delete(id: string, props: WebhookArgs): Promise<void> {
        await axios.delete(`${props.url}/${id}`);
    }
}

class Webhook extends pulumi.dynamic.Resource {
    public readonly response!: pulumi.Output<any>;

    constructor(name: string, args: WebhookArgs, opts?: pulumi.CustomResourceOptions) {
        super(new WebhookProvider(), name, { response: undefined, ...args }, opts);
    }
}

// Usage
const webhook = new Webhook("deployment-webhook", {
    url: "https://api.example.com/webhooks",
    payload: {
        event: "deployment",
        stack: pulumi.getStack(),
    },
});
```

## Transformation Functions

### Apply Transformations to Resources

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Add tags to all resources
pulumi.runtime.registerStackTransformation((args) => {
    if (args.type.startsWith("aws:")) {
        args.props["tags"] = {
            ...args.props["tags"],
            ManagedBy: "Pulumi",
            Stack: pulumi.getStack(),
            Project: pulumi.getProject(),
        };
    }
    return { props: args.props, opts: args.opts };
});

// Enforce encryption
pulumi.runtime.registerStackTransformation((args) => {
    if (args.type === "aws:s3/bucket:Bucket") {
        args.props["serverSideEncryptionConfiguration"] = {
            rule: {
                applyServerSideEncryptionByDefault: {
                    sseAlgorithm: "AES256",
                },
            },
        };
    }
    return { props: args.props, opts: args.opts };
});
```

## Resource Options Patterns

### Protect Critical Resources

```typescript
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const database = new aws.rds.Instance("production-db", {
    // ... config
}, {
    protect: true, // Prevent accidental deletion
    retainOnDelete: true, // Keep resource after stack deletion
});
```

### Ignore Changes to Specific Properties

```typescript
const deployment = new k8s.apps.v1.Deployment("app", {
    spec: {
        replicas: 3,
        // ... other config
    },
}, {
    ignoreChanges: ["spec.replicas"], // Let HPA manage replicas
});
```

### Explicit Dependencies

```typescript
const database = new aws.rds.Instance("db", {
    // ... config
});

const app = new aws.ecs.Service("app", {
    // ... config
}, {
    dependsOn: [database], // Ensure DB is created first
});
```

### Replace Resources

```typescript
const instance = new aws.ec2.Instance("web", {
    // ... config
}, {
    replaceOnChanges: ["userData"], // Replace instance if userData changes
});
```

## Multi-Cloud Abstractions

### Abstract Storage Across Providers

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as azure from "@pulumi/azure-native";
import * as gcp from "@pulumi/gcp";

interface StorageBucketArgs {
    provider: "aws" | "azure" | "gcp";
}

class StorageBucket extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;

    constructor(name: string, args: StorageBucketArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:storage:Bucket", name, {}, opts);

        switch (args.provider) {
            case "aws":
                const s3Bucket = new aws.s3.Bucket(name, {}, { parent: this });
                this.url = s3Bucket.bucketDomainName.apply(d => `https://${d}`);
                break;

            case "azure":
                const storageAccount = new azure.storage.StorageAccount(name, {
                    resourceGroupName: "my-rg",
                    sku: { name: "Standard_LRS" },
                    kind: "StorageV2",
                }, { parent: this });
                this.url = storageAccount.primaryEndpoints.blob;
                break;

            case "gcp":
                const gcsBucket = new gcp.storage.Bucket(name, {
                    location: "US",
                }, { parent: this });
                this.url = pulumi.interpolate`https://storage.googleapis.com/${gcsBucket.name}`;
                break;
        }

        this.registerOutputs({ url: this.url });
    }
}
```

## Output Manipulation

### Complex Output Transformations

```typescript
import * as pulumi from "@pulumi/pulumi";

// Combine multiple outputs
const combinedUrl = pulumi.all([bucket.id, region]).apply(([id, region]) => {
    return `https://${id}.s3.${region}.amazonaws.com`;
});

// Conditional outputs
const endpoint = pulumi.all([useHttps, domain]).apply(([https, domain]) => {
    return https ? `https://${domain}` : `http://${domain}`;
});

// Parse and transform
const dbConfig = dbInstance.endpoint.apply(endpoint => {
    const [host, port] = endpoint.split(":");
    return {
        host,
        port: parseInt(port),
        connectionString: `postgresql://user@${endpoint}/dbname`,
    };
});
```

## Configuration Patterns

### Typed Configuration

```typescript
import * as pulumi from "@pulumi/pulumi";

interface AppConfig {
    instanceType: string;
    minSize: number;
    maxSize: number;
    environment: "dev" | "staging" | "production";
}

const config = new pulumi.Config();
const appConfig: AppConfig = {
    instanceType: config.require("instanceType"),
    minSize: config.requireNumber("minSize"),
    maxSize: config.requireNumber("maxSize"),
    environment: config.require("environment") as AppConfig["environment"],
};

// Validate configuration
if (appConfig.minSize > appConfig.maxSize) {
    throw new Error("minSize cannot be greater than maxSize");
}
```

### Environment-Specific Configuration

```typescript
import * as pulumi from "@pulumi/pulumi";

const stack = pulumi.getStack();

const config = {
    dev: {
        instanceType: "t3.micro",
        desiredCount: 1,
        enableBackups: false,
    },
    staging: {
        instanceType: "t3.small",
        desiredCount: 2,
        enableBackups: true,
    },
    production: {
        instanceType: "t3.medium",
        desiredCount: 3,
        enableBackups: true,
    },
}[stack];

if (!config) {
    throw new Error(`Unknown stack: ${stack}`);
}
```

## Error Handling

### Graceful Failure Handling

```typescript
import * as pulumi from "@pulumi/pulumi";

class SafeComponentResource extends pulumi.ComponentResource {
    constructor(name: string, args: any, opts?: pulumi.ComponentResourceOptions) {
        super("custom:component", name, {}, opts);

        try {
            // Resource creation logic
            const resource = new aws.s3.Bucket(name, args, { parent: this });

            this.registerOutputs({
                bucketName: resource.id,
            });
        } catch (error) {
            pulumi.log.error(`Failed to create ${name}: ${error}`);
            throw error;
        }
    }
}
```

## Import Existing Resources

```typescript
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Import existing VPC
const existingVpc = aws.ec2.Vpc.get("existing-vpc", "vpc-12345678");

// Import with resource options
const importedBucket = new aws.s3.Bucket("imported-bucket", {
    bucket: "my-existing-bucket",
}, {
    import: "my-existing-bucket",
});
```

## Automation API

### Programmatic Stack Management

```typescript
import * as pulumi from "@pulumi/pulumi/automation";

async function createAndDeployStack(stackName: string, config: Record<string, string>) {
    // Create or select stack
    const stack = await pulumi.LocalWorkspace.createOrSelectStack({
        stackName,
        projectName: "my-project",
        program: async () => {
            const bucket = new aws.s3.Bucket("my-bucket");
            return { bucketName: bucket.id };
        },
    });

    // Set configuration
    for (const [key, value] of Object.entries(config)) {
        await stack.setConfig(key, { value });
    }

    // Deploy
    console.log("Starting update...");
    const upResult = await stack.up({ onOutput: console.log });

    console.log(`Update summary: ${upResult.summary.result}`);
    console.log(`Outputs: ${JSON.stringify(upResult.outputs)}`);

    return upResult.outputs;
}

// Usage
createAndDeployStack("dev-stack", {
    "aws:region": "us-west-2",
    "instanceType": "t3.micro",
}).catch(console.error);
```

## Best Practices Summary

### 1. Resource Organization
- Group related resources in component resources
- Use consistent naming conventions
- Organize code by logical boundaries (networking, compute, storage)

### 2. Configuration Management
- Use stack configuration for environment differences
- Validate configuration early
- Use secrets for sensitive data

### 3. State Management
- Use remote backends for production
- Enable state locking
- Regularly backup state files

### 4. Testing
- Write unit tests for component resources
- Use policy as code for compliance
- Test in isolated environments

### 5. Security
- Use encryption by default
- Apply least privilege IAM policies
- Enable audit logging
- Rotate secrets regularly

### 6. Performance
- Use explicit dependencies only when necessary
- Minimize cross-stack references
- Consider using automation API for large-scale operations

### 7. Maintainability
- Document complex logic
- Keep stacks focused and manageable
- Use version control
- Regular refactoring

### 8. Cost Optimization
- Tag resources for cost tracking
- Use appropriate instance sizes
- Clean up unused resources
- Implement auto-scaling

### 9. Reliability
- Enable backups for stateful resources
- Use multi-AZ deployments
- Implement health checks
- Plan for disaster recovery

### 10. Observability
- Enable logging and monitoring
- Export metrics to monitoring systems
- Set up alerts for critical resources
- Track infrastructure drift
