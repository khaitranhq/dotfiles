# Testing Pulumi Infrastructure

Comprehensive guide to testing Pulumi infrastructure code.

## Testing Approaches

### 1. Unit Testing
Test individual component resources and their properties

### 2. Integration Testing
Test actual resource deployment in isolated environments

### 3. Policy Testing
Use Pulumi CrossGuard to enforce policies

### 4. Property Testing
Validate resource configurations before deployment

## Unit Testing with Pulumi Testing Framework

### TypeScript Unit Tests

Install dependencies:
```bash
npm install --save-dev @pulumi/pulumi mocha @types/mocha
```

#### Testing a Component Resource

```typescript
// staticWebsite.test.ts
import * as pulumi from "@pulumi/pulumi";
import { StaticWebsite } from "./staticWebsite";
import "mocha";

// Mock Pulumi runtime
pulumi.runtime.setMocks({
    newResource: function(args: pulumi.runtime.MockResourceArgs): {id: string, state: any} {
        return {
            id: args.inputs.name + "_id",
            state: args.inputs,
        };
    },
    call: function(args: pulumi.runtime.MockCallArgs) {
        return args.inputs;
    },
});

describe("StaticWebsite", function() {
    let website: StaticWebsite;

    before(async function() {
        // Create an instance of the component
        website = new StaticWebsite("test-website", {
            contentPath: "./dist",
            indexDocument: "index.html",
        });
    });

    it("should create a bucket", function(done) {
        pulumi.all([website.bucket.urn, website.bucket.website]).apply(([urn, websiteConfig]) => {
            if (!urn.includes("aws:s3/bucket:Bucket")) {
                done(new Error("Bucket URN is incorrect"));
            }
            if (websiteConfig?.indexDocument !== "index.html") {
                done(new Error("Index document not set correctly"));
            }
            done();
        });
    });

    it("should export website URL", function(done) {
        website.websiteUrl.apply(url => {
            if (!url) {
                done(new Error("Website URL not exported"));
            }
            done();
        });
    });

    it("should have correct bucket name output", function(done) {
        website.bucketName.apply(name => {
            if (!name) {
                done(new Error("Bucket name not exported"));
            }
            done();
        });
    });
});
```

#### Testing Resource Properties

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Database } from "./database";
import { expect } from "chai";
import "mocha";

pulumi.runtime.setMocks({
    newResource: function(args: pulumi.runtime.MockResourceArgs): {id: string, state: any} {
        switch (args.type) {
            case "aws:rds/instance:Instance":
                return {
                    id: "db-12345",
                    state: {
                        ...args.inputs,
                        endpoint: "mydb.123456789012.us-east-1.rds.amazonaws.com:3306",
                    },
                };
            default:
                return {
                    id: args.inputs.name + "_id",
                    state: args.inputs,
                };
        }
    },
    call: function(args: pulumi.runtime.MockCallArgs) {
        return args.inputs;
    },
});

describe("Database Component", function() {
    let db: Database;

    before(async function() {
        db = new Database("test-db", {
            vpcId: "vpc-12345",
            subnetIds: ["subnet-1", "subnet-2"],
            instanceClass: "db.t3.small",
            allocatedStorage: 50,
        });
    });

    it("should use specified instance class", function(done) {
        pulumi.all([db.instance.instanceClass]).apply(([instanceClass]) => {
            expect(instanceClass).to.equal("db.t3.small");
            done();
        });
    });

    it("should create security group", function(done) {
        pulumi.all([db.securityGroupId]).apply(([sgId]) => {
            expect(sgId).to.exist;
            done();
        });
    });

    it("should export endpoint", function(done) {
        pulumi.all([db.endpoint]).apply(([endpoint]) => {
            expect(endpoint).to.include("rds.amazonaws.com");
            done();
        });
    });
});
```

### Python Unit Tests

Install dependencies:
```bash
pip install pytest pulumi
```

#### Testing with pytest

```python
# test_static_website.py
import unittest
from typing import Any, Mapping, Optional
import pulumi

# Mock implementation
class MockResourceArgs:
    def __init__(self, typ: str, name: str, inputs: dict, provider: Optional[Any], opts: Optional[pulumi.ResourceOptions]):
        self.typ = typ
        self.name = name
        self.inputs = inputs
        self.provider = provider
        self.opts = opts

class Mocks(pulumi.runtime.Mocks):
    def new_resource(self, args: MockResourceArgs):
        return [args.name + '_id', args.inputs]

    def call(self, args):
        return {}

pulumi.runtime.set_mocks(Mocks())

# Import the component to test
from static_website import StaticWebsite

class TestStaticWebsite(unittest.TestCase):
    @pulumi.runtime.test
    def test_bucket_created(self):
        website = StaticWebsite("test", content_path="./dist")

        def check_bucket(args):
            urn, name = args
            self.assertIn("aws:s3/bucket:Bucket", urn)
            self.assertTrue(name)

        return pulumi.Output.all(website.bucket.urn, website.bucket_name).apply(check_bucket)

    @pulumi.runtime.test
    def test_website_url_exported(self):
        website = StaticWebsite("test", content_path="./dist")

        def check_url(url):
            self.assertIsNotNone(url)

        return website.website_url.apply(check_url)

    @pulumi.runtime.test
    def test_custom_index_document(self):
        website = StaticWebsite(
            "test",
            content_path="./dist",
            index_document="home.html"
        )

        def check_website_config(config):
            self.assertEqual(config.index_document, "home.html")

        return website.bucket.website.apply(check_website_config)
```

## Integration Testing

### Testing with Actual Deployment

```typescript
// integration.test.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { execSync } from "child_process";
import { expect } from "chai";

describe("Integration Tests", function() {
    this.timeout(300000); // 5 minutes

    let stackName = "integration-test";

    before(function() {
        // Deploy the stack
        execSync(`pulumi stack init ${stackName}`, { stdio: 'inherit' });
        execSync(`pulumi up --yes --stack ${stackName}`, { stdio: 'inherit' });
    });

    after(function() {
        // Clean up
        execSync(`pulumi destroy --yes --stack ${stackName}`, { stdio: 'inherit' });
        execSync(`pulumi stack rm ${stackName} --yes`, { stdio: 'inherit' });
    });

    it("should deploy successfully", function() {
        const output = execSync(`pulumi stack output --stack ${stackName} --json`);
        const outputs = JSON.parse(output.toString());

        expect(outputs.websiteUrl).to.exist;
        expect(outputs.bucketName).to.exist;
    });

    it("should create accessible website", async function() {
        const output = execSync(`pulumi stack output websiteUrl --stack ${stackName}`);
        const url = output.toString().trim();

        const response = await fetch(`http://${url}`);
        expect(response.status).to.equal(200);
    });
});
```

## Policy as Code with CrossGuard

### Setting Up CrossGuard

Install CrossGuard:
```bash
npm install @pulumi/policy
```

### Writing Policy Packs

```typescript
// policy-pack.ts
import * as policy from "@pulumi/policy";
import * as aws from "@pulumi/aws";

const policies = new policy.PolicyPack("aws-best-practices", {
    policies: [
        {
            name: "s3-no-public-read",
            description: "Prohibits setting public-read ACL on S3 buckets",
            enforcementLevel: "mandatory",
            validateResource: policy.validateResourceOfType(aws.s3.Bucket, (bucket, args, reportViolation) => {
                if (bucket.acl === "public-read" || bucket.acl === "public-read-write") {
                    reportViolation("S3 buckets cannot have public-read ACL");
                }
            }),
        },
        {
            name: "ec2-instance-type",
            description: "Restricts EC2 instance types to approved list",
            enforcementLevel: "advisory",
            validateResource: policy.validateResourceOfType(aws.ec2.Instance, (instance, args, reportViolation) => {
                const approvedTypes = ["t3.micro", "t3.small", "t3.medium"];
                if (instance.instanceType && !approvedTypes.includes(instance.instanceType)) {
                    reportViolation(`EC2 instance type must be one of: ${approvedTypes.join(", ")}`);
                }
            }),
        },
        {
            name: "required-tags",
            description: "Ensures all resources have required tags",
            enforcementLevel: "mandatory",
            validateResource: (args, reportViolation) => {
                const requiredTags = ["Environment", "Owner", "Project"];
                const resource = args.props as any;

                if (resource.tags) {
                    const tags = resource.tags as {[key: string]: string};
                    for (const tag of requiredTags) {
                        if (!tags[tag]) {
                            reportViolation(`Resource missing required tag: ${tag}`);
                        }
                    }
                }
            },
        },
        {
            name: "rds-backup-retention",
            description: "Ensures RDS instances have adequate backup retention",
            enforcementLevel: "mandatory",
            validateResource: policy.validateResourceOfType(aws.rds.Instance, (db, args, reportViolation) => {
                if (db.backupRetentionPeriod === undefined || db.backupRetentionPeriod < 7) {
                    reportViolation("RDS backup retention period must be at least 7 days");
                }
            }),
        },
    ],
});
```

### Running Policy Checks

```bash
# Run policy check
pulumi preview --policy-pack ./policy-pack

# Run with specific enforcement level
pulumi up --policy-pack ./policy-pack --policy-pack-config enforcement-level=advisory
```

### Python Policy Pack

```python
# __main__.py
from pulumi_policy import (
    EnforcementLevel,
    PolicyPack,
    ResourceValidationPolicy,
    ResourceValidationArgs,
)

def s3_no_public_read_validator(args: ResourceValidationArgs, report_violation):
    if args.resource_type == "aws:s3/bucket:Bucket":
        acl = args.props.get("acl")
        if acl in ["public-read", "public-read-write"]:
            report_violation("S3 buckets cannot have public-read ACL")

def required_tags_validator(args: ResourceValidationArgs, report_violation):
    required_tags = ["Environment", "Owner", "Project"]
    tags = args.props.get("tags")

    if tags:
        for tag in required_tags:
            if tag not in tags:
                report_violation(f"Resource missing required tag: {tag}")

PolicyPack(
    name="aws-best-practices",
    enforcement_level=EnforcementLevel.MANDATORY,
    policies=[
        ResourceValidationPolicy(
            name="s3-no-public-read",
            description="Prohibits setting public-read ACL on S3 buckets",
            validate=s3_no_public_read_validator,
        ),
        ResourceValidationPolicy(
            name="required-tags",
            description="Ensures all resources have required tags",
            validate=required_tags_validator,
        ),
    ],
)
```

## Property Validation

### Validate Before Deployment

```typescript
import * as pulumi from "@pulumi/pulumi";

function validateConfig() {
    const config = new pulumi.Config();
    const region = config.require("region");
    const allowedRegions = ["us-east-1", "us-west-2", "eu-west-1"];

    if (!allowedRegions.includes(region)) {
        throw new Error(`Region ${region} is not allowed. Must be one of: ${allowedRegions.join(", ")}`);
    }
}

validateConfig();
```

## Test Organization

### Directory Structure

```
.
├── src/
│   ├── index.ts
│   └── components/
│       ├── staticWebsite.ts
│       └── database.ts
├── tests/
│   ├── unit/
│   │   ├── staticWebsite.test.ts
│   │   └── database.test.ts
│   ├── integration/
│   │   └── deployment.test.ts
│   └── helpers/
│       └── mocks.ts
├── policy/
│   └── index.ts
└── package.json
```

### Running Tests

```json
{
  "scripts": {
    "test": "mocha -r ts-node/register tests/unit/**/*.test.ts",
    "test:integration": "mocha -r ts-node/register tests/integration/**/*.test.ts",
    "test:all": "npm run test && npm run test:integration",
    "policy": "pulumi preview --policy-pack ./policy"
  }
}
```

## Best Practices

1. **Test early and often**: Write tests as you develop components
2. **Mock external dependencies**: Use Pulumi's mocking framework
3. **Test different configurations**: Verify components work with various inputs
4. **Use policy as code**: Enforce organizational standards automatically
5. **CI/CD integration**: Run tests in your pipeline before deployment
6. **Separate test stacks**: Use dedicated stacks for integration testing
7. **Clean up resources**: Always destroy test infrastructure after tests
8. **Test failure scenarios**: Verify error handling works correctly
9. **Document test cases**: Explain what each test validates
10. **Monitor test coverage**: Track which code paths are tested
