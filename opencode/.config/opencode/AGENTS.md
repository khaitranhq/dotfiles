# Global Rules

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
