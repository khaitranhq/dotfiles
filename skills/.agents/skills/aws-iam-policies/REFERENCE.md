# AWS IAM Policy Templates — Reference

## 1. S3 Sync

Permissions for the `aws s3 sync` command. Covers read, write, delete, and list bucket location.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Sync",
      "Effect": "Allow",
      "Action": [
        "s3:DeleteObject",
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

**Notes:**
- Replace `YOUR_BUCKET_NAME` with the actual bucket name.
- The `/*` suffix is required for object-level actions.
- `s3:DeleteObject` is only needed if sync should delete destination objects not present in source.

---

## 2. ECR Push (Docker Build & Push)

Minimum permissions for building and pushing Docker images to Amazon ECR. Includes a GitHub Actions OIDC example.

### IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:<region>:<account-id>:repository/<repository-name>"
    },
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    }
  ]
}
```

### GitHub Actions Workflow (OIDC)

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: <role-arn>
    role-session-name: build
    aws-region: us-east-2

- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v2

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    file: Dockerfile
    push: true
    tags: ${{ env.IMAGE_URL }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Notes:**
- `ecr:GetAuthorizationToken` requires `"Resource": "*"` (AWS design — the authorization token endpoint does not accept resource-level restrictions).
- For GitHub Actions, configure an OIDC trust relationship instead of long-lived access keys.

---

## 3. AWS Batch Execution Role

Role policy for AWS Batch jobs that need Secrets Manager, ECR image pull, and CloudWatch logging.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:<region>:<account-id>:secret:<secret-name>"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:<region>:<account-id>:log-group:<log-group-name>:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "arn:aws:ecr:<region>:<account-id>:repository/<ecr-repo-name>"
    },
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    }
  ]
}
```

**Notes:**
- Replace `<secret-name>` with the specific secret the job needs (not wildcard).
- Log group resource must end with `:*` to cover all log streams within the group.

---

## 4. Step Functions Chaining

Allow one Step Function execution to start, describe, and stop other Step Function executions.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "events:PutTargets",
        "events:PutRule",
        "events:DescribeRule"
      ],
      "Resource": [
        "arn:aws:events:<region>:<account-id>:rule/StepFunctionsGetEventsForBatchJobsRule",
        "arn:aws:events:<region>:<account-id>:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "batch:SubmitJob",
        "batch:DescribeJobs",
        "batch:TerminateJob",
        "sns:Publish"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "states:StartExecution",
      "Resource": [
        "<sfn-execution-arns>"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "states:DescribeExecution",
        "states:StopExecution"
      ],
      "Resource": "*"
    }
  ]
}
```

**Notes:**
- Replace `<sfn-execution-arns>` with the ARNs of the target Step Functions.
- EventBridge rule ARNs are needed for Step Functions that use EventBridge integration with Batch.
- Batch and SNS actions with `"Resource": "*"` should be tightened if possible.

---

## 5. Fleet Manager (SSM EC2 Access)

Grant access to a specific EC2 instance via AWS Systems Manager Fleet Manager (web-based terminal).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:GetPasswordData"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSM",
      "Effect": "Allow",
      "Action": [
        "ssm:DescribeInstanceProperties",
        "ssm:GetCommandInvocation",
        "ssm:GetInventorySchema"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TerminateSession",
      "Effect": "Allow",
      "Action": "ssm:TerminateSession",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "ssm:resourceTag/aws:ssmmessages:session-id": ["${aws:userid}"]
        }
      }
    },
    {
      "Sid": "SSMStartSession",
      "Effect": "Allow",
      "Action": "ssm:StartSession",
      "Resource": [
        "arn:aws:ec2:<region>:<account-id>:instance/<instance-id>",
        "arn:aws:ssm:<region>:<account-id>:managed-instance/<instance-id>",
        "arn:aws:ssm:<region>::document/AWS-StartPortForwardingSession"
      ],
      "Condition": {
        "ForAnyValue:StringEquals": {
          "aws:CalledVia": "ssm-guiconnect.amazonaws.com"
        }
      }
    },
    {
      "Sid": "GuiConnect",
      "Effect": "Allow",
      "Action": [
        "ssm-guiconnect:CancelConnection",
        "ssm-guiconnect:GetConnection",
        "ssm-guiconnect:StartConnection",
        "ssm-guiconnect:ListConnections"
      ],
      "Resource": "*"
    }
  ]
}
```

**Notes:**
- Replace `<instance-id>` with the actual EC2 instance ID.
- The `aws:CalledVia` condition ensures `StartSession` is only allowed through the Fleet Manager console, not direct SSM API calls.
- Users can only terminate their own sessions (enforced by `aws:userid` condition).

---

## 6. Attribute-Based Access Control (ABAC)

ABAC uses tags on IAM principals and resources to dynamically grant or deny access.

### Concept

- Tag IAM roles with project attributes (e.g., `access-project = Heart`).
- Tag resources with matching project attributes.
- A single policy grants access when principal and resource tags match.

### Policy Template

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeInstances"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/access-project": "${aws:PrincipalTag/access-project}"
        }
      }
    }
  ]
}
```

### Benefits Over RBAC

| Aspect | RBAC | ABAC |
|--------|------|------|
| New resources | Update policies | Tag resource; policy auto-applies |
| Team transfers | Update role assignments | Reassign IAM role |
| Number of policies | One per role | One for all roles |
| Permission changes | Update multiple policies | Update one tag condition |

**Notes:**
- Not all AWS services support resource-level tag authorization. Verify with [AWS services that work with IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_aws-services-that-work-with-iam.html).
- Combine with session tags from corporate directories (SAML/OIDC) for employee-attribute-based permissions.

---

## 7. Self-Service User Management

Allow IAM users to manage their own password, access keys, and MFA devices — without granting broader IAM write access.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadAccountSettings",
      "Effect": "Allow",
      "Action": [
        "iam:GetAccountPasswordPolicy",
        "iam:ListUsers",
        "iam:ListVirtualMFADevices"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ManageOwnPassword",
      "Effect": "Allow",
      "Action": [
        "iam:GetUser",
        "iam:ChangePassword"
      ],
      "Resource": "arn:aws:iam::*:user/${aws:username}"
    },
    {
      "Sid": "ManageOwnAccessKeys",
      "Effect": "Allow",
      "Action": [
        "iam:DeleteAccessKey",
        "iam:UpdateAccessKey",
        "iam:CreateAccessKey",
        "iam:ListAccessKeys"
      ],
      "Resource": "arn:aws:iam::*:user/${aws:username}"
    },
    {
      "Sid": "CreateVirtualMFA",
      "Effect": "Allow",
      "Action": "iam:CreateVirtualMFADevice",
      "Resource": "arn:aws:iam::*:mfa/*"
    },
    {
      "Sid": "ManageOwnMFA",
      "Effect": "Allow",
      "Action": [
        "iam:DeactivateMFADevice",
        "iam:EnableMFADevice",
        "iam:ResyncMFADevice",
        "iam:ListMFADevices"
      ],
      "Resource": "arn:aws:iam::*:user/${aws:username}"
    }
  ]
}
```

**Notes:**
- `${aws:username}` is a policy variable that resolves to the requesting user's name — this is what enforces "own" access.
- `iam:CreateVirtualMFADevice` targets `mfa/*` (not `user/*`) because MFA devices are created at account level before being associated with a user.
- `ListUsers` is read-only and scoped to account info — required for the console UI to render the user management page.

---

## 8. Revoke Temporary IAM Role Credentials

Emergency policy to immediately revoke all active sessions for an IAM role. All users with tokens issued before the policy creation time will be denied — forcing reauthentication.

### Scenario

- Temporary credentials for an IAM role are compromised.
- Session duration is long (e.g., 12 hours).
- You need to invalidate all existing sessions without deleting the role.

### Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "DateLessThan": {
          "aws:TokenIssueTime": "<policy-creation-timestamp>"
        }
      }
    }
  ]
}
```

### Procedure

1. **Create the policy** — attach the above inline policy to the compromised role. Set `<policy-creation-timestamp>` to the current UTC time (ISO 8601 format, e.g., `2024-01-15T14:30:00Z`).
2. **New sessions unaffected** — users who assume the role after the policy creation time are not affected.
3. **No need to delete the policy** — once all compromised sessions have expired, the policy can remain attached (affects only older tokens).
4. **Optional cleanup** — remove the inline policy after the compromised session duration has passed.

**Notes:**
- This is **the only case** where `"Effect": "Deny"` with `"Action": "*"` and `"Resource": "*"` is acceptable — it is an emergency revocation.
- `aws:TokenIssueTime` is a global condition key available for all temporary credentials.
- Attach as an **inline policy**, not a managed policy, for faster propagation.
