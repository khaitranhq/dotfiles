# Pi agent configs

## MCP

- [ ] [ID: 01] Move Jira MCP to another agent
- [ ] [ID: 02] Set up Github MCP

## Tool approval

pi/.pi/agent/extensions/permission-request

- [x] [ID: 03] use AST to parse bash commands then compare with settings
  - Solution: tree-sitter and tree-sitter-bash
- [x] [ID: 04] whitelist subcommand (e.g git diff, git log)

## Search web & fetch web

- [ ] [ID: 05] research how Opencode works => design document

## Todo tool

- [ ] [ID: 06] research how Opencode implements todo tool => design document

## General

- [x] [ID: 07] change config file format to yaml
- [x] [ID: 08] always use rg for find files and content, fallback to find and grep if rg is not available
- [ ] [ID: 09] refactor tools
