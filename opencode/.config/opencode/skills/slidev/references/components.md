# Components

Quick reference for built-in and custom Vue components in Slidev.

## Built-in Components

**Arrow** - Point at elements

```markdown
<Arrow x1="100" y1="100" x2="200" y2="200" color="red" width="2" />
```

**AutoFitText** - Auto-size text

```markdown
<AutoFitText :max="200" :min="100" modelValue="Text" />
```

**Link** - External link with icon

```markdown
<Link to="https://sli.dev">Documentation</Link>
```

**RenderWhen** - Conditional rendering by context

```markdown
<RenderWhen context="presenter">Presenter notes</RenderWhen>
<RenderWhen context="slide">Slide content</RenderWhen>
<RenderWhen context="print">PDF export</RenderWhen>
```

**SlideCurrentNo / SlidesTotal** - Slide numbers

```markdown
Slide <SlideCurrentNo /> of <SlidesTotal />
```

**Toc** - Table of contents

```markdown
<Toc maxDepth="2" columns="2" mode="onlyCurrentTree" />
```

**Transform** - CSS transforms

```markdown
<Transform :scale="1.5" :rotate="45">Content</Transform>
```

**Tweet** - Embed tweets

```markdown
<Tweet id="1390115482657726468" scale="1" />
```

**VClicks** - Click animations wrapper

```markdown
<v-clicks>
- Item 1
- Item 2
</v-clicks>
```

**YouTube** - Embed videos

```markdown
<YouTube id="dQw4w9WgXcQ" width="100%" />
```

## Custom Components

Create `components/MyComponent.vue`:

```vue
<script setup lang="ts">
interface Props {
  title: string;
  items: string[];
}
const props = defineProps<Props>();
</script>

<template>
  <div class="p-4 border-2 rounded">
    <h2>{{ title }}</h2>
    <ul>
      <li v-for="item in items">{{ item }}</li>
    </ul>
  </div>
</template>
```

**Usage:** `<MyComponent title="Title" :items="['A', 'B']" />`

## Global Registration

```typescript
// setup/main.ts
import { defineAppSetup } from "@slidev/types";
import MyComponent from "../components/MyComponent.vue";

export default defineAppSetup(({ app }) => {
  app.component("MyComponent", MyComponent);
});
```

## Composables

```typescript
// composables/useCounter.ts
import { ref } from "vue";

export const useCounter = () => {
  const count = ref(0);
  return {
    count,
    increment: () => count.value++,
    decrement: () => count.value--,
  };
};
```

**Usage:**

```vue
<script setup lang="ts">
import { useCounter } from "../composables/useCounter";
const { count, increment } = useCounter();
</script>
```

## Best Practices

**Organization:**

```
components/
├── ui/         # Reusable UI (Badge, Button)
├── code/       # Code-related (Terminal, CodeComparison)
└── slides/     # Slide-specific
```

**Performance:** Use `v-once` for static content, `v-show` for toggles
**TypeScript:** Always type props with interfaces
**Accessibility:** Add ARIA labels to interactive elements
