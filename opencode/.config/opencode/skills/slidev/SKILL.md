---
name: slidev
description: Create and present web-based slidedecks for developers using Slidev with Markdown, Vue components, code highlighting, animations, and interactive features. Use when building technical presentations, conference talks, code walkthroughs, teaching materials, or developer decks.
---

# Slidev - Presentation Slides for Developers

Web-based slides maker built on Vite, Vue, and Markdown.

## When to Use

- Technical presentations or slidedecks with live code examples
- Syntax-highlighted code snippets with animations
- Interactive demos (Monaco editor, runnable code)
- Mathematical equations (LaTeX) or diagrams (Mermaid, PlantUML)
- Record presentations with presenter notes
- Export to PDF, PPTX, or host as SPA
- Code walkthroughs for developer talks or workshops

## Best Practices

### Visual-First Design

- **Maximize visuals**: Prioritize emoji, diagrams, code blocks, tables, and charts over text
- **Minimize text**: Use minimal text per slide (max 2-3 bullet points or one sentence)
- **One idea per slide**: Each slide should convey a single concept or message

### Project Organization

- **Split slides into pages**: Create individual `.md` files in `./pages/` folder for each slide
- **Import in main file**: Use Slidev's importing feature in `slides.md` to compose the presentation
- **Benefits**:
  - Cleaner file structure and easier navigation
  - Simpler reuse and reorganization of slides
  - Better version control and collaboration
  - Easier to find and update specific slides

### Example Project Structure

```
project/
├── slides.md          # Main entry point (imports all page slides)
├── pages/
│   ├── 01-cover.md    # Cover/title slide
│   ├── 02-agenda.md   # Agenda with visual overview
│   ├── 03-intro.md    # Introduction with key visual
│   ├── 04-demo.md     # Live demo or code example
│   ├── 05-results.md  # Results with charts/images
│   └── 06-end.md      # Closing/thank you slide
└── assets/
    ├── images/        # Diagrams, screenshots, photos
    ├── code/          # Reusable code snippets
    └── videos/        # Embedded videos (optional)
```

## Quick Start

```bash
pnpm create slidev    # Create project
mkdir pages           # Create pages directory
pnpm run dev          # Start dev server (opens http://localhost:3030)
pnpm run build        # Build static SPA
pnpm run export       # Export to PDF (requires playwright-chromium)
```

**Verify**: After `pnpm run dev`, confirm slides load at `http://localhost:3030`. After `pnpm run export`, check the output PDF exists in the project root.

## Project Structure Workflow

### Main Slide File (slides.md)

```yaml
---
src: ./pages/01-cover.md
---

---
src: ./pages/02-agenda.md
---

---
src: ./pages/03-content.md
---
```

### Individual Page File (pages/01-cover.md)

```md
---
layout: cover
---

# My Presentation Title

**Subtitle or key message**

![Visual element](/images/hero.png)
```

### Individual Page File (pages/02-agenda.md)

```md
---
layout: center
---

## Agenda

| Topic        | Time   |
| ------------ | ------ |
| Introduction | 5 min  |
| Live Demo    | 10 min |
| Q&A          | 5 min  |

![Visual diagram](/images/agenda-visual.png)
```

- `src: ./pages/filename.md` imports slides from separate files
- Each page file has its own frontmatter configuration
- Use this approach for all presentations

## Content Best Practices

### Slide Types & Visual Patterns

| Slide Type | Purpose       | Visual Focus               | Example                      |
| ---------- | ------------- | -------------------------- | ---------------------------- |
| Cover      | Title/opening | Large hero image           | Logo + title over background |
| Agenda     | Overview      | Table or visual roadmap    | 3-4 items with icons         |
| Content    | Main topic    | Code, diagram, or image    | Single concept + visual      |
| Comparison | Side-by-side  | Table or two-column layout | Before/after with visuals    |
| Demo       | Live example  | Code with output           | Monaco editor or screenshot  |
| Results    | Data/findings | Chart, graph, or metrics   | Visual data representation   |
| Transition | Topic change  | Full-screen visual         | Section divider with image   |
| Closing    | Thank you     | Contact info + visual      | Simple, professional layout  |

### Text Guidelines

- **Bullet points**: Max 3 per slide, each 1-2 short lines
- **Headings**: Keep to 5-7 words maximum
- **Body text**: Use presenter notes instead of slide text for details
- **Code blocks**: Show only relevant lines (5-10 max), use line highlighting
- **Emphasis**: Use visuals (color, size, animation) not text decoration

### Visual Elements to Prioritize

- Screenshots of actual tools/interfaces
- Diagrams and flowcharts (Mermaid, PlantUML)
- Code snippets with syntax highlighting
- Charts and graphs for data
- Icons and illustrations
- Photos or branded imagery
- Live code demos and Monaco editor

## Core References

| Topic           | Description                                       | Reference                                                |
| --------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Markdown Syntax | Slide separators, frontmatter, notes, code blocks | [core-syntax](references/core-syntax.md)                 |
| Animations      | v-click, v-clicks, motion, transitions            | [core-animations](references/core-animations.md)         |
| Headmatter      | Deck-wide configuration options                   | [core-headmatter](references/core-headmatter.md)         |
| Frontmatter     | Per-slide configuration options                   | [core-frontmatter](references/core-frontmatter.md)       |
| CLI Commands    | Dev, build, export, theme commands                | [core-cli](references/core-cli.md)                       |
| Components      | Built-in Vue components                           | [core-components](references/core-components.md)         |
| Layouts         | Built-in slide layouts                            | [core-layouts](references/core-layouts.md)               |
| Exporting       | PDF, PPTX, PNG export options                     | [core-exporting](references/core-exporting.md)           |
| Hosting         | Build and deploy to various platforms             | [core-hosting](references/core-hosting.md)               |
| Global Context  | $nav, $slidev, composables API                    | [core-global-context](references/core-global-context.md) |

## Feature Reference

### Code & Editor

| Feature                  | Usage                                    | Reference                                                      |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| Line highlighting        | ` ```ts {2,3} `                          | [code-line-highlighting](references/code-line-highlighting.md) |
| Click-based highlighting | ` ```ts {1\|2-3\|all} `                  | [code-line-highlighting](references/code-line-highlighting.md) |
| Line numbers             | `lineNumbers: true` or `{lines:true}`    | [code-line-numbers](references/code-line-numbers.md)           |
| Scrollable code          | `{maxHeight:'100px'}`                    | [code-max-height](references/code-max-height.md)               |
| Code tabs                | `::code-group` (requires `comark: true`) | [code-groups](references/code-groups.md)                       |
| Monaco editor            | ` ```ts {monaco} `                       | [editor-monaco](references/editor-monaco.md)                   |
| Run code                 | ` ```ts {monaco-run} `                   | [editor-monaco-run](references/editor-monaco-run.md)           |
| Edit files               | `<<< ./file.ts {monaco-write}`           | [editor-monaco-write](references/editor-monaco-write.md)       |
| Code animations          | ` ````md magic-move `                    | [code-magic-move](references/code-magic-move.md)               |
| TypeScript types         | ` ```ts twoslash `                       | [code-twoslash](references/code-twoslash.md)                   |
| Import code              | `<<< @/snippets/file.js`                 | [code-import-snippet](references/code-import-snippet.md)       |

### Diagrams & Math

| Feature           | Usage                     | Reference                                          |
| ----------------- | ------------------------- | -------------------------------------------------- |
| Mermaid diagrams  | ` ```mermaid `            | [diagram-mermaid](references/diagram-mermaid.md)   |
| PlantUML diagrams | ` ```plantuml `           | [diagram-plantuml](references/diagram-plantuml.md) |
| LaTeX math        | `$inline$` or `$$block$$` | [diagram-latex](references/diagram-latex.md)       |

### Layout & Styling

| Feature            | Usage                                 | Reference                                                  |
| ------------------ | ------------------------------------- | ---------------------------------------------------------- |
| Canvas size        | `canvasWidth`, `aspectRatio`          | [layout-canvas-size](references/layout-canvas-size.md)     |
| Zoom slide         | `zoom: 0.8`                           | [layout-zoom](references/layout-zoom.md)                   |
| Scale elements     | `<Transform :scale="0.5">`            | [layout-transform](references/layout-transform.md)         |
| Layout slots       | `::right::`, `::default::`            | [layout-slots](references/layout-slots.md)                 |
| Scoped CSS         | `<style>` in slide                    | [style-scoped](references/style-scoped.md)                 |
| Global layers      | `global-top.vue`, `global-bottom.vue` | [layout-global-layers](references/layout-global-layers.md) |
| Draggable elements | `v-drag`, `<v-drag>`                  | [layout-draggable](references/layout-draggable.md)         |
| Icons              | `<mdi-icon-name />`                   | [style-icons](references/style-icons.md)                   |

### Animation & Interaction

| Feature           | Usage                               | Reference                                                      |
| ----------------- | ----------------------------------- | -------------------------------------------------------------- |
| Click animations  | `v-click`, `<v-clicks>`             | [core-animations](references/core-animations.md)               |
| Rough markers     | `v-mark.underline`, `v-mark.circle` | [animation-rough-marker](references/animation-rough-marker.md) |
| Drawing mode      | Press `C` or config `drawings:`     | [animation-drawing](references/animation-drawing.md)           |
| Direction styles  | `forward:delay-300`                 | [style-direction](references/style-direction.md)               |
| Note highlighting | `[click]` in notes                  | [animation-click-marker](references/animation-click-marker.md) |

### Syntax Extensions

| Feature           | Usage                                  | Reference                                                              |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Comark syntax     | `comark: true` + `{style="color:red"}` | [syntax-comark](references/syntax-comark.md)                           |
| Block frontmatter | ` ```yaml ` instead of `---`           | [syntax-block-frontmatter](references/syntax-block-frontmatter.md)     |
| Import slides     | `src: ./other.md`                      | [syntax-importing-slides](references/syntax-importing-slides.md)       |
| Merge frontmatter | Main entry wins                        | [syntax-frontmatter-merging](references/syntax-frontmatter-merging.md) |

### Presenter & Recording

| Feature        | Usage                                 | Reference                                                  |
| -------------- | ------------------------------------- | ---------------------------------------------------------- |
| Recording      | Press `G` for camera                  | [presenter-recording](references/presenter-recording.md)   |
| Timer          | `duration: 30min`, `timer: countdown` | [presenter-timer](references/presenter-timer.md)           |
| Remote control | `slidev --remote`                     | [presenter-remote](references/presenter-remote.md)         |
| Ruby text      | `notesAutoRuby:`                      | [presenter-notes-ruby](references/presenter-notes-ruby.md) |

### Export & Build

| Feature        | Usage                               | Reference                                                |
| -------------- | ----------------------------------- | -------------------------------------------------------- |
| Export options | `slidev export`                     | [core-exporting](references/core-exporting.md)           |
| Build & deploy | `slidev build`                      | [core-hosting](references/core-hosting.md)               |
| Build with PDF | `download: true`                    | [build-pdf](references/build-pdf.md)                     |
| Cache images   | Automatic for remote URLs           | [build-remote-assets](references/build-remote-assets.md) |
| OG image       | `seoMeta.ogImage` or `og-image.png` | [build-og-image](references/build-og-image.md)           |
| SEO tags       | `seoMeta:`                          | [build-seo-meta](references/build-seo-meta.md)           |

**Export prerequisite**: `pnpm add -D playwright-chromium` is required for PDF/PPTX/PNG export. If export fails with a browser error, install this dependency first.

### Editor & Tools

| Feature           | Usage                    | Reference                                          |
| ----------------- | ------------------------ | -------------------------------------------------- |
| Side editor       | Click edit icon          | [editor-side](references/editor-side.md)           |
| VS Code extension | Install `antfu.slidev`   | [editor-vscode](references/editor-vscode.md)       |
| Prettier          | `prettier-plugin-slidev` | [editor-prettier](references/editor-prettier.md)   |
| Eject theme       | `slidev theme eject`     | [tool-eject-theme](references/tool-eject-theme.md) |

### Lifecycle & API

| Feature        | Usage                              | Reference                                                |
| -------------- | ---------------------------------- | -------------------------------------------------------- |
| Slide hooks    | `onSlideEnter()`, `onSlideLeave()` | [api-slide-hooks](references/api-slide-hooks.md)         |
| Navigation API | `$nav`, `useNav()`                 | [core-global-context](references/core-global-context.md) |

## Common Layouts

| Layout                                    | Purpose                       |
| ----------------------------------------- | ----------------------------- |
| `cover`                                   | Title/cover slide             |
| `center`                                  | Centered content              |
| `default`                                 | Standard slide                |
| `two-cols`                                | Two columns (use `::right::`) |
| `two-cols-header`                         | Header + two columns          |
| `image` / `image-left` / `image-right`    | Image layouts                 |
| `iframe` / `iframe-left` / `iframe-right` | Embed URLs                    |
| `quote`                                   | Quotation                     |
| `section`                                 | Section divider               |
| `fact` / `statement`                      | Data/statement display        |
| `intro` / `end`                           | Intro/end slides              |

## Resources

- Documentation: https://sli.dev
- Theme Gallery: https://sli.dev/resources/theme-gallery
- Showcases: https://sli.dev/resources/showcases
