# Sequence Diagram Syntax Reference

## Participants

```mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob, how are you?
    Bob->>Alice: Great, thanks!
```

Implicit: participants render in order of first appearance.
Explicit order with `participant` keyword.

```mermaid
sequenceDiagram
    participant Bob
    participant Alice
    Alice->>Bob: Hi
```

## Actors

Use `actor` for stick-figure symbol instead of rectangle.

```mermaid
sequenceDiagram
    actor Alice
    actor Bob
    Alice->>Bob: Hi
```

## Participant Shapes (JSON config)

```mermaid
sequenceDiagram
    participant A as Alice
    participant {"type": "boundary", "actor": "Boundary"} as B
    participant {"type": "control", "actor": "Control"} as C
    participant {"type": "entity", "actor": "Entity"} as E
    participant {"type": "database", "actor": "Database"} as D
    participant {"type": "collections", "actor": "Collections"} as CL
    participant {"type": "queue", "actor": "Queue"} as Q
```

## Aliases

**External syntax** (preferred):
```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
```

**With stereotype configs:**
```mermaid
sequenceDiagram
    participant {"type": "database", "actor": "DB"} as MyDatabase
    MyDatabase->>Alice: Query
```

**Inline alias:**
```mermaid
sequenceDiagram
    participant {"actor": "Alice", "alias": "A"} as Alice
```

**Precedence**: external `as` keyword overrides inline `"alias"`.

## Actor Creation/Destruction (v10.3.0+)

```mermaid
sequenceDiagram
    Alice->>Bob: Hello
    create participant Carl
    Alice->>Carl: Hi Carl
    destroy Carl
    Alice->>Carl: You there? (Carl destroyed)
```

## Grouping / Box

```mermaid
sequenceDiagram
    box Aqua Group Description
    participant Alice
    participant Bob
    end
    box rgb(33,66,99)
    participant Carl
    end
    box rgba(33,66,99,0.5)
    participant Diana
    end
```

Color can be a named color, `rgb()`, `rgba()`, or `transparent`.

## Messages (Arrows)

### Standard Arrow Types

| Type   | Description                          |
| ------ | ------------------------------------ |
| `->`   | Solid line without arrow             |
| `-->`  | Dotted line without arrow            |
| `->>`  | Solid line with arrowhead            |
| `-->>` | Dotted line with arrowhead           |
| `<<->>`| Solid bidirectional (v11.0.0+)      |
| `<<-->>`| Dotted bidirectional (v11.0.0+)    |
| `-x`   | Solid line with cross at end         |
| `--x`  | Dotted line with cross at end        |
| `-)`   | Solid line with open arrow (async)   |
| `--)`  | Dotted line with open arrow (async)  |

### Half-Arrows (v11.12.3+)

Add extra `-` for dotted variant.

| Type   | Description                        |
| ------ | ---------------------------------- |
| `-\|`  | Top half arrowhead                 |
| `-\|/` | Bottom half arrowhead              |
| `/\|-` | Reverse top half arrowhead         |
| `\\-`  | Reverse bottom half arrowhead      |
| `-\\`  | Top stick half arrowhead           |
| `-//`  | Bottom stick half arrowhead        |
| `//-`  | Reverse top stick half arrowhead   |
| `\\-`  | Reverse bottom stick half arrowhead|

## Central Connections (v11.12.3+)

Append `()` to arrow for central lifeline connection:

```mermaid
sequenceDiagram
    Alice->()Central: Signal
```

## Activations

```mermaid
sequenceDiagram
    Alice->>+Bob: Hello (activate Bob)
    Bob-->>-Alice: Hi (deactivate Bob)
```

Stacked:
```mermaid
sequenceDiagram
    Alice->>+Bob: Msg 1
    Alice->>+Bob: Msg 2
    Bob-->>-Alice: Reply 1
    Bob-->>-Alice: Reply 2
```

## Notes

```mermaid
sequenceDiagram
    Note left of Alice: Text
    Note right of Bob: Text
    Note over Alice: Text
    Note over Alice,Bob: Spanning both
```

## Line Breaks

Use `<br/>` in messages and notes.

```mermaid
sequenceDiagram
    Alice->>Bob: Line1<br/>Line2
    Note over Alice: Multi<br/>line note
```

Actor names with line breaks require aliases.

## Loops

```mermaid
sequenceDiagram
    loop Every minute
        Alice->>Bob: Ping
    end
```

## Alt / Opt

```mermaid
sequenceDiagram
    alt Success
        Alice->>Bob: OK
    else Failure
        Alice->>Bob: Error
    end

    opt Optional
        Alice->>Bob: Maybe
    end
```

## Parallel

```mermaid
sequenceDiagram
    par Action 1
        Alice->>Bob: Do A
    and Action 2
        Alice->>Bob: Do B
    end
```

Nestable.

## Critical Region

```mermaid
sequenceDiagram
    critical Must happen
        Alice->>Bob: Critical op
    option Circumstance A
        Alice->>Bob: Fallback A
    option Circumstance B
        Alice->>Bob: Fallback B
    end
```

No options variant also supported. Nestable like `par`.

## Break

```mermaid
sequenceDiagram
    break Something happened
        Alice->>Bob: Abort
    end
```

## Background Highlighting

```mermaid
sequenceDiagram
    rect rgb(0, 255, 0)
        Alice->>Bob: In green zone
    end
    rect rgba(0, 0, 255, .1)
        Alice->>Bob: In transparent blue zone
    end
```

## Comments

```mermaid
sequenceDiagram
    %% This is a comment, ignored by parser
    Alice->>Bob: Hello
```

## Entity Codes (Escaping)

- `#35;` for `#`
- `#59;` for `;` (semicolon in message text)
- HTML character names supported.

## Sequence Numbers

Enable via config or diagram directive:

```mermaid
sequenceDiagram
    autonumber
    Alice->>Bob: Hello
    Bob->>Alice: Hi
```

### Start and Increment (v11.15.0+)

```mermaid
sequenceDiagram
    autonumber 10 5
    Alice->>Bob: Starts at 10, increments by 5
```

## Actor Menus

```mermaid
sequenceDiagram
    participant Alice
    link Alice: Dashboard @ https://dashboard.example.com
    link Alice: Wiki @ https://wiki.example.com
    Alice->>Bob: Hello
```

**Advanced (JSON):**
```mermaid
sequenceDiagram
    participant Alice
    links Alice: {"Dashboard": "https://dashboard.example.com", "Wiki": "https://wiki.example.com"}
```

## Configuration

```js
mermaid.sequenceConfig = {
    diagramMarginX: 50,
    diagramMarginY: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
    mirrorActors: true,
};
```

| Parameter           | Default                        |
| ------------------- | ------------------------------ |
| mirrorActors        | false                          |
| bottomMarginAdj     | 1                              |
| actorFontSize       | 14                             |
| actorFontFamily     | "Open Sans", sans-serif        |
| noteFontSize        | 14                             |
| noteFontFamily      | "trebuchet ms", verdana, arial |
| noteAlign           | center                         |
| messageFontSize     | 16                             |
| messageFontFamily   | "trebuchet ms", verdana, arial |
