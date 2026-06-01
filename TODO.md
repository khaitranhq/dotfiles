# TODO

Active tasks and improvements across the dotfiles ecosystem.

## Neovim

- [ ] `01` Simple solution for dropbar.nvim alternative

## Skills

- [ ] `02` `#high` create test suites to test trigger accuracy for all skills
- [ ] `03` Diagnostic skill: if agent's unable to solve problem, add logs and error messages to trace

## Pi Agent

- [ ] `04` Secret masking capability for tools
  - using package: https://github.com/secretlint/secretlint
  - applied for all tools result
  - implement in pi/.pi/agent/extensions/defender
- [ ] `05` Auto-refresh access token for MCP Atlassian
  - failed, still open browser again
- [ ] `06` refactor comments
- [ ] `07` subagent spawn subagent

### Measure AI System Efficiency

- [ ] `08` Implement metrics tool:
  - Token usage
  - Response time
  - Accuracy
  - Number of skill calls
    → Identify bottlenecks and optimize

### General

- [ ] `09` Refactor tools
- [ ] `10` Define layers of agent rules/instructions: global rules, agent system prompt, pi extensions, skills, wiki

## JSON language server

- lint
- format
- schema validation `$schema` property in JSON file to specify schema URL
