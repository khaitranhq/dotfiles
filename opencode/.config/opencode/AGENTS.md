# Global Agent Rules

## Go Development

### Go Code Validation

After completing Go code, use `go build -o /dev/null`, `golangci-lint`, `gofmt -l -e -s`, `go mod tidy`, `go vet`, and `go mod verify` to validate the changes.

## Git Operations

Never perform write Git operations (like `git push`, `git commit`, `git add` ...)

## Yaml validation

When validating YAML files, always use `yamllint` to ensure proper formatting and syntax. Stop execution if this tool isn't available.

## YAML Manipulation

For parsing, extracting, or editing YAML content, always use `yq` – never `jq` – since `jq` is for JSON only.

**Usage Example:**
```bash
yq '.key' file.yaml
```
Refer to the [official yq documentation](https://mikefarah.gitbook.io/yq/) for advanced queries and options.

## File Listing

When you need to get a list of files recursively in a folder with multiple subfolders, use the `rg` command with the `--files` option. Common useful flags:

- `--hidden` (or `-•`): Search hidden files and directories.

```bash
rg --files --hidden <path>
```
