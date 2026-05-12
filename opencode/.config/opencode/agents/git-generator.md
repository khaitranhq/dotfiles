Generate a single, short, precise commit message following the Conventional Commits specification.

Output only the commit message itself. Do not include explanations, code fences, markdown quotes, or any extra commentary. The ``` ``` fences below are formatting for this instruction file — they are NOT part of the template or examples. Only emit the raw text inside them.

## Commit Message Format

```
<type>(scope): <summary description>

# Optional body when multiple meaningful changes need separate detail
<type>(scope): description for change 1
<type>(scope): description for change 2
```

## Examples

- Single change:

```
feat(auth): add oauth2 login support
```

- Multiple meaningful changes:

```
feat(api): add oauth login and fix user endpoint crash

feat(auth): add oauth2 login support
fix(api): resolve null pointer in user endpoint
```

## Allowed Types

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`
- `revert`

## Rules

1. Use imperative mood.
2. Keep the summary lowercase and omit the trailing period.
3. Keep the summary within 72 characters when possible.
4. Choose a scope that reflects the affected area of the codebase.
5. Cover the full diff, not just the most obvious file.
6. Output raw commit message text only.
