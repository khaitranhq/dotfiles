# Flowchart Syntax Reference

## Direction

| Value | Orientation        |
| ----- | ------------------ |
| TB/TD | Top to Bottom      |
| BT    | Bottom to Top      |
| RL    | Right to Left      |
| LR    | Left to Right      |

```mermaid
flowchart LR
    A --> B
```

Can also use `graph` instead of `flowchart`.

## Basic Nodes

```mermaid
flowchart TD
    A                    %% default rectangle, id = label
    B[Text in box]       %% rectangle with text
    C(Round edges)       %% rounded rectangle
    D([Stadium])         %% stadium shape
    E[[Subroutine]]      %% subroutine
    F[(Database)]        %% cylinder
    G((Circle))          %% circle
    H>Asymmetric]        %% asymmetric (lean right)
    I{Rhombus}           %% diamond/decision
    J{{Hexagon}}         %% hexagon
    K[/Parallelogram/]   %% parallelogram
    L[\Parallelogram alt\] %% parallelogram alt
    M[/Trapezoid\]       %% trapezoid
    N[\Trapezoid alt/]   %% trapezoid alt
    O(((Double circle))) %% double circle
```

## Expanded Node Shapes (v11.3.0+)

Syntax: `A@{ shape: <name> }`

### Shape Quick Reference

| Shape Name    | Short Name   | Description            |
| ------------- | ------------ | ---------------------- |
| `rect`        | `proc`       | Standard process       |
| `rounded`     | `event`      | Rounded rectangle      |
| `stadium`     | `pill`       | Terminal point         |
| `fr-rect`     | `subproc`    | Subprocess             |
| `cyl`         | `db`         | Database/cylinder      |
| `circle`      | `circ`       | Start                  |
| `dbl-circ`    |              | Stop (double circle)   |
| `fr-circ`     | `stop`       | Stop (framed circle)   |
| `sm-circ`     | `start`      | Small circle start     |
| `diam`        | `decision`   | Decision (diamond)     |
| `hex`         | `prepare`    | Prepare/hexagon        |
| `lean-r`      | `in-out`     | Data input/output      |
| `lean-l`      | `out-in`     | Data output/input      |
| `trap-b`      | `priority`   | Priority action        |
| `trap-t`      | `manual`     | Manual operation       |
| `notch-rect`  | `card`       | Card                   |
| `lin-rect`    | `lin-proc`   | Lined/shaded process   |
| `fork`        | `join`       | Fork/join              |
| `hourglass`   | `collate`    | Collate                |
| `brace-l`     | `comment`    | Comment (left brace)   |
| `brace-r`     |              | Comment (right brace)  |
| `braces`      |              | Comment (both braces)  |
| `bolt`        | `com-link`   | Communication link     |
| `doc`         | `document`   | Document               |
| `delay`       |              | Delay                  |
| `h-cyl`       | `das`        | Direct access storage  |
| `lin-cyl`     | `disk`       | Disk storage           |
| `curv-trap`   | `display`    | Display                |
| `div-rect`    | `div-proc`   | Divided process        |
| `tri`         | `extract`    | Extract (triangle)     |
| `win-pane`    |              | Internal storage       |
| `f-circ`      | `junction`   | Junction               |
| `lin-doc`     |              | Lined document         |
| `notch-pent`  | `loop-limit` | Loop limit             |
| `flip-tri`    | `manual-file`| Manual file            |
| `sl-rect`     |              | Manual input           |
| `docs`        | `st-doc`     | Multi-document         |
| `st-rect`     | `processes`  | Multi-process          |
| `flag`        | `paper-tape` | Paper tape             |
| `bow-rect`    |              | Stored data            |
| `cross-circ`  | `summary`    | Summary                |
| `tag-doc`     |              | Tagged document        |
| `tag-rect`    | `tag-proc`   | Tagged process         |
| `datastore`   |              | Data store             |
| `text`        |              | Text block             |
| `bang`        |              | Bang                   |
| `odd`         |              | Odd                    |

### Icon Shape

```mermaid
flowchart TD
    A@{ icon: "fa:user", pos: "t", label: "User" }
```

Parameters: `pos` (`t`/`b`), `form` (`square`/`circle`/`rounded`), `label`, `h`, `w`.

### Image Shape

```mermaid
flowchart TD
    A@{ img: "https://example.com/logo.png", label: "Logo", pos: "t", w: 60, h: 60 }
```

Parameters: `pos` (`t`/`b`), `w`, `h`, `constraint` (`on`/`off`).

## Links (Edges)

### Basic Link Types

| Syntax    | Description               |
| --------- | ------------------------- |
| `A --> B` | Arrow head                |
| `A --- B` | Open link                 |
| `A -.-> B`| Dotted arrow              |
| `A -.- B` | Dotted open               |
| `A ==> B` | Thick arrow               |
| `A === B` | Thick open                |
| `A ~~~ B` | Invisible (for layout)    |
| `A --o B` | Circle end                |
| `A --x B` | Cross end                 |
| `A <--> B`| Bidirectional             |

### Text on Links

```mermaid
flowchart LR
    A -- Text --> B
    A -->|Text| B
    A -. Text .-> B
    A == Text ==> B
```

### Chaining

```mermaid
flowchart LR
    A --> B --> C --> D
    A & B --> C & D
```

### Minimum Link Length

Extra dashes for longer links:

```mermaid
flowchart TD
    A ---> B    %% length 1 (normal)
    A ----> C   %% length 2
    A -----> D  %% length 3
```

| Length | Normal  | Arrow   | Thick   | Thick Arrow | Dotted  | Dotted Arrow |
| ------ | ------- | ------- | ------- | ----------- | ------- | ------------ |
| 1      | `---`   | `-->`   | `===`   | `==>`       | `-.-`   | `-.->`       |
| 2      | `----`  | `--->`  | `====`  | `===>`      | `-..-`  | `-..->`      |
| 3      | `-----` | `---->` | `=====` | `====>`     | `-...-` | `-...->`     |

### Edge IDs and Animation (v11.3.0+)

```mermaid
flowchart LR
    e1@A --> B
    e1@{ animate: true }
```

Animation speeds: `fast`, `slow`.

```mermaid
flowchart LR
    e1@A --> B
    e1@{ animate: fast }
```

## Subgraphs

```mermaid
flowchart TB
    subgraph Group 1
        A --> B
    end
    subgraph Group 2 [Explicit ID]
        C --> D
    end
    A --> C
```

### Direction in Subgraphs

```mermaid
flowchart LR
    subgraph Top Down
        direction TB
        A --> B --> C
    end
```

**Limitation**: if any node links outside, subgraph direction ignored — inherits parent.

## Markdown Strings

```mermaid
flowchart LR
    A["**Bold** and *italic*"]
    B["`code`"]
```

Auto-wrapping enabled by default. Disable:

```yaml
---
config:
  markdownAutoWrap: false
---
```

## Interaction (Click Events)

```mermaid
flowchart LR
    A --> B
    click A "https://www.github.com" "Tooltip text"
    click B call callback() "Tooltip"
```

Link targets: `_self`, `_blank`, `_parent`, `_top`.

```mermaid
flowchart LR
    A --> B
    click A "https://github.com" "Open in new tab" _blank
```

Note: disabled with `securityLevel='strict'`.

## Comments

```mermaid
flowchart LR
    %% This is ignored
    A --> B
```

## Styling

### Node Style

```mermaid
flowchart LR
    A --> B
    style A fill:#f9f,stroke:#333,stroke-width:4px
```

### Classes

```mermaid
flowchart LR
    classDef highlight fill:#f9f,stroke:#333,stroke-width:4px
    class A highlight
    A --> B
    B:::highlight --> C
```

Multiple classes: `class node1,node2 className`
Default class: `classDef default fill:#f9f`

### Link Style

```mermaid
flowchart LR
    A --> B
    B --> C
    linkStyle 0 stroke:#ff3,stroke-width:4px
    linkStyle 1 stroke:blue
```

Multiple: `linkStyle 0,1 color:blue;`

### Line Curves

Diagram level:
```yaml
---
config:
  flowchart:
    curve: stepBefore
---
```

Edge level (v11.10.0+):
```mermaid
flowchart LR
    e1@A --> B
    e1@{ curve: "stepBefore" }
```

Available curves: `basis`, `bumpX`, `bumpY`, `cardinal`, `catmullRom`, `linear`, `monotoneX`, `monotoneY`, `natural`, `step`, `stepAfter`, `stepBefore`.

## FontAwesome Icons

```mermaid
flowchart LR
    A[fa:fa-user User]
```

Prefixes: `fa`, `fab`, `fas`, `far`, `fal`, `fad`, `fak` (custom).

Requires FontAwesome CSS loaded or icon pack registered.

## Entity Codes

- `#35;` for `#`
- `#quot;` for `"`
- HTML character names supported.

## Configuration

```yaml
---
config:
  flowchart:
    defaultRenderer: "elk"   # alt: dagre (default)
    curve: "linear"
---
```

`elk` renderer better for large/complex diagrams (v9.4+).

Width: `mermaid.flowchartConfig = { width: 100% }`
