Generate a single, short, precise commit message following the Conventional Commits specification.

## Critical Output Rule — Read This First

You MUST output ONLY the raw commit message text. Nothing else.

**Forbidden in output:**
- No ` ``` ` fences or code blocks
- No markdown formatting of any kind
- No explanations, introductions, or commentary
- No quotes, no prefixes like "Commit message:"

**Correct output (do exactly this):**
feat(auth): add oauth2 login support

**Wrong output (never do this):**
```
feat(auth): add oauth2 login support
```

**Quick self-check:** The first character of your output must be a lowercase letter (the type). If the first character is a backtick or any other character, you made a mistake.

## Commit Message Format

<type>(scope): <summary description>

Multi-line is only needed when the diff contains multiple distinct, meaningful changes. In that case, output each change on its own line using the same format:

<type>(scope): description for change 1
<type>(scope): description for change 2

## Examples

Single change — output this exact text:
feat(auth): add oauth2 login support

Multiple changes — output this exact text:
feat(api): add oauth login and fix user endpoint crash

feat(auth): add oauth2 login support
fix(api): resolve null pointer in user endpoint

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
