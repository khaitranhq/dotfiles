# Notification

Sends desktop toast notifications when the agent finishes processing a prompt. Windows only — skipped on other platforms.

## API

```typescript
import { notifyPermissionRequired } from "../notification/index";
notifyPermissionRequired("bash: rm -rf /dangerous");
```
