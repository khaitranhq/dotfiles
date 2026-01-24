# Mermaid CLI (mmdc) Reference

Render Mermaid diagrams to SVG, PNG, or PDF.

## Installation

```bash
npm install -g @mermaid-js/mermaid-cli  # Global
npx -p @mermaid-js/mermaid-cli mmdc -h  # No install
docker pull minlag/mermaid-cli           # Docker
```

## Basic Usage

```bash
mmdc -i input.mmd -o output.svg    # SVG
mmdc -i input.mmd -o output.png    # PNG
mmdc -i input.mmd -o output.pdf    # PDF
```

## Common Options

| Option                  | Description  | Example                           |
| ----------------------- | ------------ | --------------------------------- |
| `-i, --input`           | Input file   | `-i diagram.mmd`                  |
| `-o, --output`          | Output file  | `-o diagram.svg`                  |
| `-t, --theme`           | Theme        | `-t dark`                         |
| `-b, --backgroundColor` | Background   | `-b transparent`                  |
| `-w, --width`           | Width        | `-w 1920`                         |
| `-H, --height`          | Height       | `-H 1080`                         |
| `--cssFile`             | Custom CSS   | `--cssFile styles.css`            |
| `--configFile`          | JSON config  | `--configFile config.json`        |
| `--iconPacks`           | Icon packs   | `--iconPacks @iconify-json/logos` |
| `-s, --scale`           | Scale factor | `-s 2`                            |

## Advanced Usage

**Dark theme + transparent**:

```bash
mmdc -i input.mmd -o output.png -t dark -b transparent
```

**Custom CSS** (for animations, custom styles):

```bash
mmdc -i diagram.mmd --cssFile custom.css -o output.svg
```

**Cloud icons** (AWS, Azure, GCP logos):

```bash
mmdc -i arch.mmd -o output.svg --iconPacks @iconify-json/logos
```

**Transform Markdown** (convert embedded diagrams):

```bash
mmdc -i readme.template.md -o readme.md
```

**Pipe from stdin**:

```bash
echo "graph LR; A-->B" | mmdc -i - -o output.svg
```

**Config file**:

```json
{
  "theme": "dark",
  "flowchart": { "curve": "basis" },
  "sequence": { "showSequenceNumbers": true }
}
```

```bash
mmdc -i diagram.mmd --configFile config.json -o output.svg
```

## Docker Usage

```bash
docker run --rm -u `id -u`:`id -g` \
  -v /path/to/diagrams:/data \
  minlag/mermaid-cli -i diagram.mmd
```

**Podman**:

```bash
podman run --userns keep-id --user ${UID} --rm \
  -v /path/to/diagrams:/data:z \
  ghcr.io/mermaid-js/mermaid-cli/mermaid-cli -i diagram.mmd
```

## Node.js API

```javascript
import { run } from "@mermaid-js/mermaid-cli";

await run("input.mmd", "output.svg", {
  theme: "dark",
  backgroundColor: "transparent",
});
```

**Warning**: API not covered by semver.

## Troubleshooting

**Linux sandbox issue**:

```bash
export PUPPETEER_ARGS="--no-sandbox"
# or create puppeteer-config.json:
# { "args": ["--no-sandbox"] }
mmdc -i diagram.mmd --puppeteerConfigFile puppeteer-config.json
```

**Use system Chromium**:

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**Batch processing**:

```bash
for file in *.mmd; do
  mmdc -i "$file" -o "${file%.mmd}.svg"
done
```

**High DPI/Retina**:

```bash
mmdc -i diagram.mmd -o output.png -s 2
```

**Themes**: `default`, `dark`, `forest`, `neutral`  
**Formats**: SVG (web), PNG (presentations), PDF (print)

**Resources**:

- GitHub: https://github.com/mermaid-js/mermaid-cli
- NPM: https://www.npmjs.com/package/@mermaid-js/mermaid-cli
