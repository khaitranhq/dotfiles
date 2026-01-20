# CI/CD Integration Patterns

Guide to integrating Pulumi with various CI/CD platforms.

## General CI/CD Principles

### Environment Variables

Required environment variables for Pulumi in CI/CD:
- `PULUMI_ACCESS_TOKEN`: Pulumi Cloud access token (for state management)
- Cloud provider credentials (AWS, Azure, GCP)
- `PULUMI_STACK`: Target stack name (optional, can be specified in commands)

### Basic Workflow

1. Checkout code
2. Install dependencies
3. Configure cloud provider credentials
4. Run `pulumi preview` to see changes
5. Run `pulumi up --yes` to deploy (optional approval gate)
6. Export outputs for downstream jobs

## GitHub Actions

### Basic Workflow

```yaml
# .github/workflows/pulumi.yml
name: Pulumi Infrastructure

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  preview:
    name: Preview Changes
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Pulumi Preview
        uses: pulumi/actions@v4
        with:
          command: preview
          stack-name: dev
          comment-on-pr: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}

  deploy:
    name: Deploy Infrastructure
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Pulumi Up
        uses: pulumi/actions@v4
        with:
          command: up
          stack-name: production
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### Multi-Stack Workflow

```yaml
name: Multi-Environment Deployment

on:
  push:
    branches:
      - main
      - develop

jobs:
  deploy:
    name: Deploy to ${{ matrix.stack }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        stack:
          - dev
          - staging
          - production
        include:
          - stack: dev
            branch: develop
          - stack: staging
            branch: develop
          - stack: production
            branch: main

    if: github.ref == format('refs/heads/{0}', matrix.branch)

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci

      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - uses: pulumi/actions@v4
        with:
          command: up
          stack-name: ${{ matrix.stack }}
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### Python Project

```yaml
name: Pulumi Python

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Pulumi Up
        uses: pulumi/actions@v4
        with:
          command: up
          stack-name: production
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

## GitLab CI/CD

```yaml
# .gitlab-ci.yml
image: pulumi/pulumi:latest

stages:
  - preview
  - deploy

variables:
  PULUMI_ACCESS_TOKEN: $PULUMI_ACCESS_TOKEN
  AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
  AWS_DEFAULT_REGION: us-east-1

before_script:
  - npm ci

preview:
  stage: preview
  script:
    - pulumi stack select dev
    - pulumi preview
  only:
    - merge_requests

deploy_dev:
  stage: deploy
  script:
    - pulumi stack select dev
    - pulumi up --yes
  only:
    - develop
  environment:
    name: development

deploy_staging:
  stage: deploy
  script:
    - pulumi stack select staging
    - pulumi up --yes
  only:
    - develop
  when: manual
  environment:
    name: staging

deploy_production:
  stage: deploy
  script:
    - pulumi stack select production
    - pulumi up --yes
  only:
    - main
  when: manual
  environment:
    name: production
```

## Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        PULUMI_ACCESS_TOKEN = credentials('pulumi-access-token')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Preview') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    pulumi stack select dev
                    pulumi preview
                '''
            }
        }

        stage('Deploy Dev') {
            when {
                branch 'develop'
            }
            steps {
                sh '''
                    pulumi stack select dev
                    pulumi up --yes
                '''
            }
        }

        stage('Deploy Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                sh '''
                    pulumi stack select production
                    pulumi up --yes
                '''
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  pulumi: pulumi/pulumi@2.1.0
  aws-cli: circleci/aws-cli@3.1

jobs:
  preview:
    docker:
      - image: pulumi/pulumi:latest
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: npm ci
      - aws-cli/setup
      - pulumi/login
      - run:
          name: Preview changes
          command: |
            pulumi stack select dev
            pulumi preview

  deploy:
    docker:
      - image: pulumi/pulumi:latest
    parameters:
      stack:
        type: string
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: npm ci
      - aws-cli/setup
      - pulumi/login
      - run:
          name: Deploy stack
          command: |
            pulumi stack select << parameters.stack >>
            pulumi up --yes

workflows:
  version: 2
  preview-and-deploy:
    jobs:
      - preview:
          context: pulumi
          filters:
            branches:
              ignore: main

      - deploy:
          name: deploy-dev
          stack: dev
          context: pulumi
          filters:
            branches:
              only: develop

      - deploy:
          name: deploy-production
          stack: production
          context: pulumi
          requires:
            - deploy-dev
          filters:
            branches:
              only: main
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: pulumi-secrets

stages:
  - stage: Preview
    condition: eq(variables['Build.Reason'], 'PullRequest')
    jobs:
      - job: PreviewChanges
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'

          - script: npm ci
            displayName: 'Install dependencies'

          - task: Pulumi@1
            inputs:
              azureSubscription: 'Azure-Connection'
              command: 'preview'
              stack: 'dev'
            env:
              PULUMI_ACCESS_TOKEN: $(PULUMI_ACCESS_TOKEN)

  - stage: DeployDev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
    jobs:
      - deployment: DeployToDev
        environment: 'development'
        strategy:
          runOnce:
            deploy:
              steps:
                - checkout: self

                - task: NodeTool@0
                  inputs:
                    versionSpec: '18.x'

                - script: npm ci
                  displayName: 'Install dependencies'

                - task: Pulumi@1
                  inputs:
                    azureSubscription: 'Azure-Connection'
                    command: 'up'
                    args: '--yes'
                    stack: 'dev'
                  env:
                    PULUMI_ACCESS_TOKEN: $(PULUMI_ACCESS_TOKEN)

  - stage: DeployProduction
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToProduction
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - checkout: self

                - task: NodeTool@0
                  inputs:
                    versionSpec: '18.x'

                - script: npm ci
                  displayName: 'Install dependencies'

                - task: Pulumi@1
                  inputs:
                    azureSubscription: 'Azure-Connection'
                    command: 'up'
                    args: '--yes'
                    stack: 'production'
                  env:
                    PULUMI_ACCESS_TOKEN: $(PULUMI_ACCESS_TOKEN)
```

## Best Practices

### 1. Secret Management

- Store `PULUMI_ACCESS_TOKEN` and cloud credentials as encrypted secrets
- Use secret managers (AWS Secrets Manager, HashiCorp Vault) for sensitive config
- Never commit credentials to version control

### 2. Stack Management

- Use separate stacks for each environment (dev, staging, production)
- Configure stack-specific settings in `Pulumi.<stack>.yaml`
- Use stack references for cross-stack dependencies

### 3. Approval Gates

- Require manual approval for production deployments
- Use protected branches for production code
- Implement peer review for infrastructure changes

### 4. Preview Before Deploy

- Always run `pulumi preview` on pull requests
- Review changes before merging
- Comment preview results on PRs for visibility

### 5. Error Handling

- Set appropriate timeouts for long-running deployments
- Implement retry logic for transient failures
- Send notifications on deployment failures

### 6. Automation

```typescript
// automation-api.ts
import * as pulumi from "@pulumi/pulumi/automation";

async function deployStack(stackName: string) {
    const stack = await pulumi.LocalWorkspace.createOrSelectStack({
        stackName,
        workDir: "./infrastructure",
    });

    console.log("Installing plugins...");
    await stack.workspace.installPlugin("aws", "v5.0.0");

    console.log("Setting config...");
    await stack.setConfig("aws:region", { value: "us-east-1" });

    console.log("Refreshing stack...");
    await stack.refresh({ onOutput: console.log });

    console.log("Updating stack...");
    const upRes = await stack.up({ onOutput: console.log });

    console.log(`Update summary: ${upRes.summary.result}`);
    console.log(`Resources changed: ${upRes.summary.resourceChanges}`);
}

deployStack("production").catch(err => {
    console.error(err);
    process.exit(1);
});
```

### 7. Notifications

```yaml
# GitHub Actions with Slack notification
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Pulumi deployment to ${{ matrix.stack }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 8. State Backend Configuration

```yaml
# Use S3 backend for state
- name: Configure Pulumi Backend
  run: |
    pulumi login s3://my-pulumi-state-bucket
```

### 9. Policy Enforcement

```yaml
- name: Run Policy Pack
  run: |
    pulumi preview --policy-pack ./policy-pack
```

### 10. Rollback Strategy

```yaml
- name: Rollback on Failure
  if: failure()
  run: |
    pulumi cancel
    pulumi stack export --file backup.json
```
