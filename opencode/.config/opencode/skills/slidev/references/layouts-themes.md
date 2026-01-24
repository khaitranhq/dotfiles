# Layouts & Themes

Quick reference for Slidev layouts, themes, and customization.

## Built-in Layouts

### Cover Layout

```markdown
---
layout: cover
background: https://source.unsplash.com/collection/94734566/1920x1080
---

# Presentation Title

Subtitle or tagline

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    Press Space for next page <carbon:arrow-right class="inline"/>
  </span>
</div>
```

### Section Layout

```markdown
---
layout: section
---

# Section Title

Use for topic transitions
```

### Two Columns Layout

```markdown
---
layout: two-cols
---

# Left Column

Content for left side

::right::

# Right Column

Content for right side
```

### Image-Right Layout

```markdown
---
layout: image-right
image: "./path/to/image.png"
---

# Content on Left

- Point 1
- Point 2
- Point 3

Image appears on right side
```

### Image Layout

```markdown
---
layout: image
image: "./path/to/image.png"
---

<!-- Full screen image background -->
```

### Center Layout

```markdown
---
layout: center
---

# Centered Content

Everything is centered vertically and horizontally
```

### Quote Layout

```markdown
---
layout: quote
---

# "Quote text here"

— Author Name
```

## Official Themes

### Installing Themes

```bash
npm install @slidev/theme-seriph
npm install @slidev/theme-default
npm install @slidev/theme-apple-basic
npm install @slidev/theme-shibainu
npm install @slidev/theme-bricks
```

### Applying Themes

```yaml
---
theme: seriph
# or
theme: default
# or
theme: apple-basic
---
```

### Popular Themes

| Theme         | Style               | Best For              |
| ------------- | ------------------- | --------------------- |
| `seriph`      | Clean, minimal      | Technical talks       |
| `default`     | Simple, classic     | General presentations |
| `apple-basic` | Apple keynote style | Product launches      |
| `shibainu`    | Playful, colorful   | Creative talks        |
| `bricks`      | Modern, geometric   | Design presentations  |

## Custom Theme Configuration

### Theme Customization in Frontmatter

```yaml
---
theme: seriph
background: https://source.unsplash.com/collection/94734566/1920x1080
class: text-center
highlighter: shiki
lineNumbers: false
info: |
  ## Slidev Presentation
  Learn more at [Sli.dev](https://sli.dev)
drawings:
  persist: false
transition: slide-left
title: Welcome to Slidev
mdc: true
---
```

### Custom CSS

Create `style.css` or `styles/index.css`:

```css
/* Global styles */
.slidev-layout {
  @apply font-sans;
}

/* Custom heading styles */
h1 {
  @apply text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent;
}

/* Code block customization */
.slidev-code {
  @apply rounded-xl shadow-lg;
}

/* Custom class for important points */
.important {
  @apply text-red-500 font-bold text-2xl;
}
```

### UnoCSS Configuration

Create `uno.config.ts`:

```typescript
import { defineConfig } from "unocss";

export default defineConfig({
  shortcuts: {
    btn: "px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600",
    badge: "px-2 py-1 rounded-full bg-gray-200 text-sm",
  },
  theme: {
    colors: {
      primary: "#3b82f6",
      secondary: "#8b5cf6",
    },
  },
});
```

## Creating Custom Layouts

### Custom Layout File

Create `layouts/custom.vue`:

```vue
<template>
  <div class="slidev-layout custom-layout">
    <div class="header">
      <h1 v-if="$slidev.nav.currentPage > 1">
        <slot name="title" />
      </h1>
    </div>
    <div class="content">
      <slot />
    </div>
    <div class="footer">
      Page {{ $slidev.nav.currentPage }} / {{ $slidev.nav.total }}
    </div>
  </div>
</template>

<style scoped>
.custom-layout {
  @apply h-full grid grid-rows-[auto_1fr_auto] p-8;
}

.header {
  @apply mb-4;
}

.content {
  @apply overflow-auto;
}

.footer {
  @apply text-sm text-gray-500 mt-4;
}
</style>
```

### Using Custom Layout

```markdown
---
layout: custom
---

::title::

# Custom Layout Title

Main content goes here
```

## Background Configuration

### Image Background

```markdown
---
background: /images/hero.jpg
---
```

### Gradient Background

```markdown
---
background: linear-gradient(to right, #667eea 0%, #764ba2 100%)
---
```

### Video Background

```markdown
---
layout: cover
background: /video/background.mp4
---
```

## Per-Slide Styling

### Inline Styles

```markdown
---
class: text-center bg-blue-500 text-white
---

# White Text on Blue Background
```

### Custom Classes

```markdown
---
class: my-custom-class
---

# Styled Content

<style>
.my-custom-class {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.my-custom-class h1 {
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}
</style>
```

## Theme Structure

### Creating a Full Custom Theme

```
mytheme/
├── components/         # Custom components
├── layouts/           # Custom layouts
│   ├── cover.vue
│   ├── default.vue
│   └── section.vue
├── setup/             # Setup files
│   └── shiki.ts
├── styles/            # Styles
│   ├── index.ts
│   └── layouts.css
├── package.json
└── README.md
```

### Package.json for Theme

```json
{
  "name": "@slidev/theme-mytheme",
  "version": "1.0.0",
  "keywords": ["slidev-theme", "slidev"],
  "engines": {
    "slidev": ">=0.42.0"
  }
}
```

## Best Practices

### Layout Selection

- **Cover**: First slide only
- **Section**: Topic transitions (every 5-10 slides)
- **Two-cols**: Code vs output, before/after comparisons
- **Image-right**: Feature explanations with screenshots
- **Center**: Key takeaways, quotes

### Theme Consistency

- Stick to one theme per presentation
- Use consistent color scheme (2-3 primary colors)
- Maintain typography hierarchy (h1 > h2 > body)
- Keep backgrounds subtle (low contrast with text)

### Responsive Design

```css
/* Mobile-friendly sizing */
@media (max-width: 640px) {
  .slidev-layout {
    @apply p-4;
  }

  h1 {
    @apply text-3xl;
  }
}
```

## Common Patterns

### Dark Mode Support

```yaml
---
colorSchema: dark
---
```

Or auto-detect:

```yaml
---
colorSchema: auto
---
```

### Custom Fonts

```css
@import url("https://fonts.googleapis.com/css2?family=Fira+Code&family=Inter:wght@400;700&display=swap");

.slidev-layout {
  font-family: "Inter", sans-serif;
}

code {
  font-family: "Fira Code", monospace;
}
```

## Resources

- [Official Themes Gallery](https://sli.dev/themes/gallery.html)
- [Theme Writing Guide](https://sli.dev/custom/theme.html)
- [UnoCSS Documentation](https://unocss.dev/)
