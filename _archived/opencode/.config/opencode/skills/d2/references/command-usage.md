# D2 Command Usage Reference

This reference summarizes the `d2` CLI commands and the most useful flags for day-to-day diagram authoring.

## Core Command Pattern

```bash
d2 [flags] input.d2 [output.svg|output.png|output.pdf|output.pptx|output.gif|output.txt]
```

If you omit the output path, D2 defaults to `.svg`.

```bash
d2 architecture.d2
```

This renders `architecture.svg`.

## Everyday Commands

### Render A Diagram

```bash
d2 architecture.d2 architecture.svg
```

### Validate Syntax

```bash
d2 validate architecture.d2
```

Use this before rendering when a diagram is failing or after large edits.

### Format D2 Files

```bash
d2 fmt architecture.d2
```

Format multiple files at once:

```bash
d2 fmt diagrams/*.d2
```

### Open In Playground

```bash
d2 play architecture.d2
```

### Watch For Changes

```bash
d2 --watch architecture.d2 architecture.svg
```

Useful flags with watch mode:

- `--host`
- `--port`
- `--browser`
- `--img-cache`

## Helpful Output Flags

### Choose Layout Engine

```bash
d2 --layout dagre architecture.d2
```

Inspect available layout engines:

```bash
d2 layout
```

Show help for one engine:

```bash
d2 layout dagre
```

### Themes

```bash
d2 --theme 0 architecture.d2
```

List themes:

```bash
d2 themes
```

Support light/dark variation:

```bash
d2 --theme 0 --dark-theme 200 architecture.d2
```

### Sketch Rendering

```bash
d2 --sketch architecture.d2
```

### Padding And Scale

```bash
d2 --pad 40 --scale 1 architecture.d2
```

### Center SVG Output

```bash
d2 --center architecture.d2
```

### Bundle Assets In SVG

```bash
d2 --bundle architecture.d2 architecture.svg
```

This is useful when icons or layers need to stay embedded in one distributable SVG.

## Export Formats

D2 can render to:

- `svg`
- `png`
- `pdf`
- `pptx`
- `gif`
- `txt`

Examples:

```bash
d2 architecture.d2 architecture.png
d2 architecture.d2 architecture.pdf
d2 architecture.d2 architecture.pptx
```

## Stdin And Stdout

Use `-` to read from stdin or write to stdout.

```bash
printf 'x -> y' | d2 - out.svg
```

Or emit to stdout in a chosen format:

```bash
d2 architecture.d2 --stdout-format svg - > architecture.svg
```

Supported stdout formats include `svg`, `png`, `ascii`, `txt`, `pdf`, `pptx`, and `gif`.

## ASCII And Text Output

For terminal-friendly output:

```bash
d2 architecture.d2 architecture.txt
```

Control ASCII mode:

```bash
d2 --stdout-format ascii --ascii-mode standard architecture.d2 -
```

Modes:

- `standard`
- `extended`

## Multi-Board Rendering

Use `--target` when diagrams define boards, layers, scenarios, or steps.

```bash
d2 --target='' architecture.d2
d2 --target='layers.network.*' architecture.d2
```

- `--target=''` renders only the root board.
- A target ending in `*` renders that board and all of its children.

## Reliability And Troubleshooting Flags

### Timeout

Increase timeout for very large diagrams:

```bash
d2 --timeout 300 huge-system.d2
```

### Debug Logs

```bash
d2 --debug architecture.d2
```

### Format Checking In CI

```bash
d2 --check architecture.d2
```

Use this to fail CI when a diagram is not properly formatted.

## Fonts

Override default fonts with custom `.ttf` files:

```bash
d2 \
  --font-regular ./fonts/SourceSansPro-Regular.ttf \
  --font-bold ./fonts/SourceSansPro-Bold.ttf \
  architecture.d2
```

Monospace variants are also supported:

- `--font-mono`
- `--font-mono-bold`
- `--font-mono-italic`
- `--font-mono-semibold`

## Recommended Workflow

1. Author `diagram.d2`.
2. Run `d2 fmt diagram.d2`.
3. Run `d2 validate diagram.d2`.
4. Render with `d2 diagram.d2 diagram.svg`.
5. Use `--watch` during iterative editing.

## Source Material

- `d2 --help`
- `man d2`
- Official D2 CLI manual
