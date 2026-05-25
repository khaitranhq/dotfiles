# dotfiles TODO list

## Neovim

- [ ] [ID: 01] simple solution for dropbar.nvim alternative

## Skills

- [ ] [ID: 02] load diagnostic skill properly
- [ ] [ID: 03] diagnostic skill: if agent's unable to solve problem, add logs and error messages to trace
- [ ] [ID: 04] diagnostic skill: following TDD, add test cases for the issue and make sure they fail before implementing the solution, then ensure they pass after the fix

## PI agent

### LLM Wiki - Knowledge base for LLMs

### Read tool with secret masking capability

### MCP

- [x] [ID: 05] MCP extension
- [ ] [ID: 06] enhance bootstrap mcp
- [ ] [ID: 07] Move Jira MCP to another agent
- [ ] [ID: 08] Set up Github MCP and a dedicated agent for it

### Subagent

pi/.pi/agent/extensions/subagent/index.ts

- [ ] [ID: 09] Toggle tools for specific subagent and global
  - Need to test

### Measure AI system efficiency

- [ ] [ID: 10] Implement a tool to measure the efficiency of the AI system in terms
  - token usage
  - response time
  - accuracy
  - number of calling skills time
    => This can help identify bottlenecks and optimize the system for better performance.

### General

- [ ] travel to find and load AGENTS.md
- [ ] [ID: 11] refactor tools
