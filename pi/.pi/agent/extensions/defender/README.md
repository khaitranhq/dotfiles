# Defender

Blocks dangerous bash commands and prevents reading/writing files outside `$HOME`.

Protected: `rm` outside `$HOME` (except `/tmp`), `sudo`, `chmod`, `chown`, `dd`, `mkfs`, `shutdown`, `reboot`, workaround patterns (`find -delete`, `xargs rm`), any `.env` file.

## Settings

None. Allowed prefixes are hardcoded in `shared/path-guard.ts`:

```typescript
export const DEFAULT_ALLOWED_PREFIXES = [HOME_DIR, "/tmp"];
```
