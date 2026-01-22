Generate a single, short, concise, precise commit messages following the Conventional Commits specification. Output should be the commit message itself - no explanations, no preamble, no additional commentary, no wrapped characters.

## Commit Message Format

<type>(scope): <description>

## Commit Types

- **feat**: A new feature for the user
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semi-colons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: CI/CD configuration changes
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

## Rules

1. **Description**: Imperative mood, lowercase, no period at end, cover full diff changes, max 72 characters
1. **Scope**: represents section of codebase (e.g., api, auth, ui)
