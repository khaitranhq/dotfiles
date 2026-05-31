# TODO

Active tasks and improvements across the dotfiles ecosystem.

## Neovim

- [ ] `01` Simple solution for dropbar.nvim alternative

## Skills

- [ ] `02` Diagnostic skill: if agent's unable to solve problem, add logs and error messages to trace

## Pi Agent

- [ ] `03` Secret masking capability for tools
  - using package: https://github.com/secretlint/secretlint
  - applied for all tools result
  - implement in pi/.pi/agent/extensions/defender
- [ ] `04` Auto-refresh access token for MCP Atlassian
  - failed, still open browser again
- [ ] `05` refactor comments
- [ ] `06` subagent spawn subagent

### Measure AI System Efficiency

- [ ] `07` Implement metrics tool:
  - Token usage
  - Response time
  - Accuracy
  - Number of skill calls
    → Identify bottlenecks and optimize

### General

- [ ] `08` Refactor tools
- [ ] `09` Define layers of agent rules/instructions: global rules, agent system prompt, pi extensions, skills, wiki

## JSON language server

- lint
- format
- schema validation `$schema` property in JSON file to specify schema URL
