# Pi agent configs

## MCP

- [ ] [ID: 01] Move Jira MCP to another agent
- [ ] [ID: 02] Set up Github MCP

## Subagent

pi/.pi/agent/extensions/subagent/index.ts

- [ ] [ID: 03] Toggle tools for specific subagent and global

## Tool approval

pi/.pi/agent/extensions/permission-request

- [x] [ID: 04] use AST to parse bash commands then compare with settings
  - Solution: tree-sitter and tree-sitter-bash
- [x] [ID: 05] whitelist subcommand (e.g git diff, git log)

## Search web & fetch web

- [x] [ID: 06] research how Opencode works => design document
- [ ] implement search web and fetch web tools with Tavily

## Todo tool

- [ ] [ID: 07] research how Opencode implements todo tool => design document

## General

- [x] [ID: 08] change config file format to yaml
- [x] [ID: 09] always use rg for find files and content, fallback to find and grep if rg is not available
- [ ] [ID: 10] refactor tools
