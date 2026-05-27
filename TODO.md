# TODO

Active tasks and improvements across the dotfiles ecosystem.

## Neovim

- [ ] [ID: 01] Simple solution for dropbar.nvim alternative

## Skills

- [ ] [ID: 02] Diagnostic skill: if agent's unable to solve problem, add logs and error messages to trace

## Pi Agent

- [ ] [ID: 03] Secret masking capability for the read tool
- [ ] [ID: 04] change layout to OpenCode style
- [ ] [ID: 05] Auto-refresh access token for MCP Atlassian
- [x] [ID: 06] Change agent config:
  - Target format of agent config in pi/.pi/agent/custom-settings.yaml

  ```yaml
  agents:
    agent_name:
      mode: subagent | primary
      description: brief description of the agent's role and capabilities
      prompt: |
        system prompt of agent here
        also support path resovling to a markdown file like:
        ${file:/path/to/prompt.md}
  ```

  - Affect: pi/.pi/agent/extensions/shared/, pi/.pi/agent/agents/, pi/.pi/agent/extensions/subagent/
  - Code design:
    - load agent config from yaml file in `shared` folder
    - `subagent` extensions handle agent-specific logic: parallel, delegate subagent, switch primary agent, set the default primary agent name is `pi`

- [ ] [ID: 07] fix subagent to just support global level, remove project level
- [ ] [ID: 09] refactor comments
- [ ] [ID: 10] simplify subagent/index.ts
- [ ] [ID: 11] Enable/disable tools for specific subagents and global (needs testing)
  - Dependencies: #06

### Measure AI System Efficiency

- [ ] [ID: 12] Implement metrics tool:
  - Token usage
  - Response time
  - Accuracy
  - Number of skill calls
    → Identify bottlenecks and optimize

### General

- [ ] [ID: 13] Refactor tools
- [ ] [ID: 14] Define layers of agent rules/instructions: global rules, agent system prompt, pi extensions, skills
