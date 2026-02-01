# Global Agent Rules

## Go Development

When validating Go code (checking for compilation errors, type errors, etc.), always use `-o /dev/null` with `go build` to avoid creating output binaries in the working directory:
