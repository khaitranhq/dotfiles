# Web Search

LLM-callable tools powered by Tavily:

- **`web_search`** — Search web via Tavily Search API
- **`web_fetch`** — Extract clean text from URLs via Tavily Extract (falls back to direct HTTP)

**Security:** HTTPS enforced, internal/private IPs blocked, Content-Type whitelist, timeout/size caps. Token-efficient: strips non-content tags, large results (>50 KB) go to temp files.

## API Key

```bash
export TAVILY_API_KEY="tvly-..."
```

Get a free key at [tavily.com](https://tavily.com).

## Settings (`web_search` in `custom-settings.yaml`)

```yaml
web_search:
  maxResults: 5
  searchTimeout: 30000
  fetchTimeout: 30000
  maxContentBytes: 50000
```
