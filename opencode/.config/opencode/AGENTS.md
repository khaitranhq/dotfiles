# Global Agent Rules

## Go Development

When validating Go code (checking for compilation errors, type errors, etc.), always use:

```bash
go build -o /dev/null
```

This validates the code without creating output binaries in the working directory.

**Never** use `go build` without the `-o /dev/null` flag for validation purposes, as it creates unwanted binary files.
