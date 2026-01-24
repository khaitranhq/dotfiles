# Code Features

Quick reference for code highlighting, Monaco editor, and interactive code in Slidev.

## Basic Code Blocks

````markdown
```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
```
````

**Supported:** 100+ languages (JavaScript, TypeScript, Python, Go, Rust, etc.)

## Line Highlighting & Numbers

````markdown
```javascript {2,4-6} {lines:true,startLine:5}
function calculate() {
  const x = 10; // Highlighted
  const y = 20;
  const sum = x + y; // Highlighted
}
```
````

## Progressive Code Reveal

````markdown
```javascript {1|2|3-5|all}
function demo() {
  console.log("Step 1"); // Click 1
  const result = compute(); // Click 2
  console.log("Step 2"); // Click 3
  return result;
}
```
````

## Monaco Editor

````markdown
```typescript {monaco}
// Editable code with IntelliSense
interface Person {
  name: string;
  age: number;
}
```

```typescript {monaco-run}
// Runnable code
console.log(factorial(5));
```

```typescript {monaco-diff}
// Before
var x = 10;
~~~
// After
const x = 10;
```
````

## Code Annotations

````markdown
```javascript
function greet(name) {
  console.log("Hello"); // [!code --]
  console.log(`Hello, ${name}!`); // [!code ++]
  // [!code focus]
  return name; // [!code warning]
}
```
````

**Markers:** `[!code --]` (removed), `[!code ++]` (added), `[!code focus]`, `[!code warning]`, `[!code error]`

## Code Groups/Tabs

````markdown
:::code-group

```js [JavaScript]
console.log("Hello");
```
````

```ts [TypeScript]
console.log("Hello");
```

:::

````

## Shiki Configuration

```typescript
// setup/shiki.ts
import { defineShikiSetup } from '@slidev/types'

export default defineShikiSetup(() => ({
  theme: { dark: 'github-dark', light: 'github-light' }
}))
````

**Popular themes:** `github-dark`, `nord`, `dracula`, `monokai`, `one-dark-pro`

## Best Practices

- **Keep under 20 lines** for readability
- **Progressive reveal** `{1|2|3|all}` for complex code
- **Use Monaco** for interactive demos
- **High-contrast themes** for projectors
- **Minimum 18px** font size
