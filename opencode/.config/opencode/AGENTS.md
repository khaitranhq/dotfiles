# Global Rules

## Git Commits

Never run `git commit`. The user will handle all git commits themselves.

## YAML and JSON Processing

When processing YAML and JSON files, use the following tools in order of preference:

1. **yq** - Preferred tool for both YAML and JSON processing (provides native parsing and manipulation for both formats)
2. **jq** - Fallback if yq is not available (for JSON files only)
3. **sed** - Last resort for simple text-based replacements when yq and jq are unavailable

This ensures proper YAML and JSON structure preservation and minimizes errors from text-based processing.

## YAML Validation

All YAML files in this project must be validated using `yamllint` before being committed or merged. This ensures consistency and correctness of YAML syntax and structure across the codebase.

### Configuration

The default yamllint configuration should be used. If a custom configuration is needed, it can be specified via a `.yamllint` or `.yamllint.yaml` file in the project root.

### When to Apply

- All YAML files (`*.yaml`, `*.yml`) must be validated
- This applies to configuration files, YAML workflows, and any other YAML content in the project

### Example Usage

```bash
yamllint filename.yaml
yamllint -d "{extends: default}" directory/
```

## Pre-Execution Analysis

Before executing any task or prompt, agents must:

1. **Analyze Requirements** - Carefully read and understand what the user is asking for
2. **Check Related Context** - Examine the codebase structure, existing implementations, and relevant files to understand the current state
3. **Load Related Skills** - Use the `skill` tool to load any specialized skills that match the task requirements (e.g., load the `golang` skill for Go tasks, `github-action` skill for GitHub Actions, etc.)
4. **Plan the Task** - Use the `TodoWrite` tool to create a structured task plan before starting work

This ensures that agents have all necessary context and specialized knowledge before executing the task, leading to better solutions and fewer mistakes.

## Summary of Work

After completing any task, agents must provide a clear, readable summary of findings, results, solutions, and changes made. The summary should use:

- **Headers** to organize information into logical sections
- **Bullet points** for lists and key details
- **Tables** for structured data comparisons or results
- **Emojis** when they enhance clarity and visual organization (e.g., ✅ for completed, ⚠️ for warnings, 📝 for notes)

### Example Summary Format

```
## Summary of Changes

### Files Modified

- `src/file.js` - Updated function logic
- `config.yaml` - Added new configuration

### Results

✅ All tests passing
⚠️ Performance impact: 2% increase in memory usage
📝 Breaking changes: None

### Key Changes

| Component | Before | After |
| --------- | ------ | ----- |
| Load Time | 1.5s   | 1.2s  |
| Memory    | 45MB   | 46MB  |

### Next steps

- Monitor performance for 1 week
- Gather user feedback on changes
```

This ensures users can quickly understand what was accomplished, what changed, and any important notes about the work completed.
