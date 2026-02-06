# AI Agentic Workflow design

## My usage

- Work
  - Analyze requirements: clarity objectives/AC, define existing and missing resources
  - Design, planning
  - Implementation
    - IaC Pulumi + Go + Azure implementation
    - CDK + Typescript + AWS implementation
    - Estimate DevOps effort & infrastructure cost, draw diagram
    - DevOps tasks planning reviewed with Well Architected Framework
    - Documentation
  - Review
- Personal projects
  - IaC Pulumi + Go/Typescript for AWS
  - Rust, Go development (pure code, no vibe coding)
- Learning English
  - Following my learning system

## Additional requirements

- Front-loading accuracy: Analyze and clarify requirements before starting
- Clear separation of concerns: analyze requirements, design, implementation, review
- Predicting Impact & Guardrails to prevent negative outcomes, fail fast

## Workflows

### Coding/devops tasks:

```mermaid
sequenceDiagram
  participant User
  participant SupervisorAgent
  participant RequirementsAgent
  participant ArchitectAgent
  participant PlanningAgent
  participant ImplementationAgent
  participant ReviewAgent
  participant AI_Folder as Folder

  Note over User,AI_Folder: Requirements gathering and clarification
  User->>SupervisorAgent: Provide high-level requirements and hard constraints
  SupervisorAgent->>RequirementsAgent: Trigger/coordinate requirements gathering
  RequirementsAgent-->>User: Ask user to clarify ambiguities and request details
  User->>RequirementsAgent: Provide answers / sign off requirements
  RequirementsAgent->>AI_Folder: Clear existing requirements and write `requirements.md`
  RequirementsAgent-->>SupervisorAgent: Report requirements written

  Note over User,AI_Folder: Design
  SupervisorAgent-->>ArchitectAgent: Deliver clarified requirements (from `requirements.md`)
  ArchitectAgent-->>User: Present design aligned with principles and Well-Architected Framework
  User->>ArchitectAgent: Review and sign off design
  ArchitectAgent->>AI_Folder: Write `design.md` with final design
  ArchitectAgent-->>SupervisorAgent: Report design written

  Note over User,AI_Folder: Planning
  SupervisorAgent-->>PlanningAgent: Produce task plan and milestones (based on `design.md`)
  PlanningAgent-->>User: Present plan for review
  User->>PlanningAgent: Review and sign off plan
  PlanningAgent->>AI_Folder: Write `plan.md` with tasks and milestones
  PlanningAgent-->>SupervisorAgent: Report plan written

  Note over User,AI_Folder: Implementation
  loop For each implementation task
    SupervisorAgent->>ImplementationAgent: Coordinate start of implementation tasks
    ImplementationAgent-->>ImplementationAgent: Execute implementation tasks (based on requirements from supervisor)
    ImplementationAgent-->>SupervisorAgent: Report implementation task completed
    SupervisorAgent-->>ReviewAgent: Submit changes for review
    ReviewAgent-->>SupervisorAgent: Present review results and compliance checks
    SupervisorAgent->>ImplementationAgent: Request rework if needed
  end
  SupervisorAgent-->>SupervisorAgent: Review changes again to ensure requirements met
  SupervisorAgent->>AI_Folder: Write implementation summary and documentation
  SupervisorAgent-->>User: Present final aggregated status and process log
```

#### Requirements for each agent

- RequirementsAgent:
  - Outcome-oriented: ensure clear, complete, and testable requirements, following the user's objectives and acceptance criteria.
  - Should only ask user to clarify important ambiguities or missing details that block progress.
- ArchitectAgent:
  - Break down the system into components/modules with clear responsibilities.
  - Output design includes diagrams, data flow, and technology choices aligned with best practices.
- PlanningAgent:
  - Create a detailed task list with
    - Task description
    - Resources needed (tools, information, files,...)
    - Subtasks as detailed steps
    - AC
  - Split to phases if the task scope is large.
- ImplementationAgent:
  - Follow best coding practices, ensure code quality, maintainability, and security.
  - Write comment only where necessary to explain complex logic.
  - Should run tools to check code quality, security, and compliance before reporting task completion.
- ReviewAgent:
  - Perform thorough code reviews, checking for adherence to requirements, design, and coding standards.
  - Provide constructive feedback and suggest improvements.
  - Ensure all acceptance criteria are met before approving changes.
- SupervisorAgent:
  - Coordinate the workflow, ensuring smooth transitions between phases.
  - Monitor progress, handle issues, and ensure deadlines are met.
  - Aggregate reports from all agents and present a comprehensive status to the user.
  - Stop immediately if negative impact/guardrail issues are detected

### English learning system

Just use default opencode agent with defined `AGENTS.md` file about the system.
