# Animations & Transitions

Quick reference for Slidev animations, transitions, and interactive effects.

## Click Animations

**Basic v-click:** `<div v-click>Content</div>` - appears on click
**Explicit order:** `<div v-click="3">Content</div>` - control sequence
**Wrapper:** `<v-clicks>` for multiple items at once

```markdown
<v-clicks depth="2" every="2">
- Item 1 & 2 (first click)
- Item 3 & 4 (second click)
</v-clicks>
```

**Other directives:**

- `v-after` - appears after previous click
- `v-click-hide` - hides element on click

## Slide Transitions

```markdown
---
transition: slide-left # slide-right, slide-up, slide-down, fade, zoom, view-transition, none
transitionDuration: 500
---
```

## CSS Animations

```markdown
<div v-click class="transition-all duration-500" :class="$slidev.nav.clicks >= 1 ? 'scale-150 rotate-45' : ''">
  Animates on click
</div>

<style>
@keyframes slideIn {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.animated { animation: slideIn 1s ease-out; }
</style>
```

## UnoCSS Utilities

```markdown
<!-- Transform -->
<div class="scale-150 rotate-45 translate-x-10 skew-x-12">Transformed</div>

<!-- Transition -->
<div class="transition-all duration-500 ease-in-out">Smooth change</div>
```

## Vue Transitions

```markdown
<transition name="fade">
  <div v-if="show">Content</div>
</transition>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
```

## Animation Libraries

**Animate.css:**

```bash
npm install animate.css
```

```typescript
// setup/main.ts
import "animate.css";
```

```markdown
<div v-click class="animate__animated animate__fadeInUp">Content</div>
```

**GSAP:**

```bash
npm install gsap
```

```vue
<script setup lang="ts">
import { gsap } from "gsap";
onMounted(() => gsap.from(box.value, { x: -100, opacity: 0 }));
</script>
```

## Best Practices

- **Duration:** 200-500ms UI, 500-1000ms attention
- **Easing:** `ease-out` for entrances, `ease-in` for exits
- **Performance:** Use `transform` and `opacity` only (60fps)
- **Accessibility:** Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
  }
}
```

## Common Patterns

````markdown
<!-- Progressive reveal -->

```js {1|2|3|all}
const a = 1;
const b = 2;
const result = a + b;
```
````

<!-- Highlight on click -->
<div class="transition-colors" :class="$slidev.nav.clicks >= 1 ? 'bg-yellow-200' : ''">
  Highlights on click
</div>
```
