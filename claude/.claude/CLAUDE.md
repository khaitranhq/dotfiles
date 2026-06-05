# Claude Instructions

## Code Exploration and File Search

Use **codegraph tools first** for all code exploration — architecture understanding, symbol definitions, relationships, callers/callees, and impact analysis. Codegraph provides structured, indexed access to the codebase with full source context.

Code exploration preference order:

1. **codegraph_explore** — understanding architecture, how things work, finding definitions, surveying an area (primary tool)
2. **codegraph_search** — quick symbol lookup by name (locations only)
3. **codegraph_node** — detailed symbol info including full source body
4. **codegraph_callers / codegraph_callees** — relationship queries
5. **codegraph_impact** — pre-refactor analysis
6. **rg (ripgrep)** — raw text/pattern search when codegraph tools can't answer
7. **find / grep** — last resort only

```
# Do this first:
codegraph_explore                    # understand architecture
codegraph_explore query="..."        # ask questions in natural language
codegraph_search "validateInput"     # find symbol locations
codegraph_callers "sendEmail"        # find callers

# Fallback to rg when codegraph can't:
rg 'TODO:' path/                    # text pattern search
rg -t go 'error handling'           # search by file type

# Last resort:
find . -name '*handler*'            # file search
grep -r 'func.*Handler' .           # raw text search
```
