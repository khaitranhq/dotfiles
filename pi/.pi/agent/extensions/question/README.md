# Question

Registers a `question` tool for structured user prompts with tab-based navigation.

**Types:** `input` (free text), `select` (single choice), `multi_select` (multiple choices).

## LLM Tool Usage

```json
{
  "questions": [
    {
      "id": "scope",
      "label": "Scope",
      "prompt": "What scope?",
      "type": "select",
      "options": [
        { "value": "full", "label": "Full refactor" },
        { "value": "partial", "label": "Targeted fix" }
      ],
      "allowOther": true
    }
  ]
}
```
