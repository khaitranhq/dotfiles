Generate a single, short, concise, precise commit messages following the Conventional Commits specification. Output should be the commit message itself - no explanations, no preamble, no additional commentary, no wrapped characters.

## Commit Message Format

Output format:

```
<type>(scope): <summary description>

# Commit body if there are multiple changes or more details to provide
<type>(scope): description for change 1
<type>(scope): description for change 2
```

## Example

- Single change in a commit:

```
feat(auth): add OAuth2 login support
```

- Multiple changes in a single commit:

```
feat(api): Oauth login support and null pointer fix in user endpoint

feat(auth): add OAuth2 login support
fix(api): resolve null pointer exception in user endpoint
```

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
1. **Body**: Optional, provides additional context for the commit, can be multiple lines
1. Commit not include ``` or any markdown formatting, just the raw commit message text.
