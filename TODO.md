# dotfiles TODO list

## Development tools

- [ ] [ID: 01] golangci-lint: `golangci-lint run .` vs `golangci-lint run . --config ~/.golangci.yaml`

## Neovim

## PI agent

### MCP

- [ ] [ID: 03] Move Jira MCP to another agent
- [ ] [ID: 04] Set up Github MCP

### Subagent

pi/.pi/agent/extensions/subagent/index.ts

- [ ] [ID: 05] Toggle tools for specific subagent and global
  - Need to test

### Tool approval

pi/.pi/agent/extensions/permission-request

- [x] [ID: 06] use AST to parse bash commands then compare with settings
  - Solution: tree-sitter and tree-sitter-bash
- [x] [ID: 07] whitelist subcommand (e.g git diff, git log)

### Measure AI system efficiency

- [ ] Implement a tool to measure the efficiency of the AI system in terms
  - token usage
  - response time
  - accuracy
  - number of calling skills time
    => This can help identify bottlenecks and optimize the system for better performance.

### Search web & fetch web

- [x] [ID: 08] research how Opencode works => design document
- [x] [ID: 09] implement search web and fetch web tools with Tavily
  - Requirements:
    - Secure:
      - Content-Type Whitelisting: Only allow safe formats like text/html, application/json, and text/plain
      - Always use HTTPS
      - CSP: Content Security Policy to restrict the sources of content and prevent XSS attacks
      - (Suggest) Input Validation: Sanitize and validate all user inputs to prevent injection attacks
      - Find more security approaches
    - Token efficient
      - Strip out <script>, <style>, <nav>, and <footer> tags immediately
      - (Suggest) Use tools like Mozilla Readability or html2text to extract only the core body text
      - Do not pass the whole webpage to the LLM. Split the cleaned text into chunks. May write to files and use tools to grep/search instead of passing all text to LLM.
      - LLM-Based Pre-Filtering: Use a small, cheap model to quickly summarize or filter the text before sending it to your expensive, primary model
      - Find more token efficient approaches
    - Timeout & Size Caps

### Todo tool

- [ ] [ID: 10] research how Opencode implements todo tool => design document

### General

- [x] [ID: 11] change config file format to yaml
- [x] [ID: 12] always use rg for find files and content, fallback to find and grep if rg is not available
- [ ] [ID: 13] refactor tools
