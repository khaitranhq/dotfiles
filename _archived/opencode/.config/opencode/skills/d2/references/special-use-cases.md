# D2 Special Use Cases Reference

This reference highlights D2 features that go beyond plain box-and-arrow diagrams: icons, images, rich text, and sequence diagrams.

## Icons And Images

Use `icon` to place an icon or image on an object.

```d2
api: API {
  icon: https://icons.terrastruct.com/dev%2Fdocker.svg
}
```

For local CLI usage, local file paths also work:

```d2
api: API {
  icon: ./assets/docker.png
}
```

### Standalone Image Shapes

If the icon itself should be the object, use `shape: image`.

```d2
github {
  shape: image
  icon: https://icons.terrastruct.com/dev%2Fgithub.svg
}
```

### Notes

- D2 places icons automatically.
- Container icons typically render near the top-left.
- Non-container icons typically render near the center.
- Use `near` when you need more control over placement.

## Markdown And Text

Standalone text is Markdown by default.

````d2
doc: |
  # Runbook
  - Deploy service
  - Verify health checks
```
````

To put Markdown on an object label, explicitly declare the object.

```d2
runbook {
  label: |
    # Release Steps
    - Build
    - Deploy
    - Smoke test
}
```

If you want plain text instead of Markdown, use `shape: text`.

```d2
warning {
  shape: text
  label: "plain text only"
}
```

## Code Blocks

Use fenced blocks in labels or text blocks.

````d2
snippet: |
  ```go
  func main() {
    fmt.Println("hello")
  }
  ```
````

### Block Strings

If content contains `|`, use a longer block delimiter such as `||` or another non-alphanumeric variant.

## Sequence Diagrams

Sequence diagrams are regular D2 objects with `shape: sequence_diagram`.

```d2
login_flow: Login Flow {
  shape: sequence_diagram

  user: User
  api: API
  db: DB

  user -> api: POST /login
  api -> db: lookup user
  db -> api: user record
  api -> user: 200 OK
}
```

### Sequence Diagram Rules

Two important differences from normal D2 diagrams:

1. Children share the same scope throughout the sequence diagram.
2. Definition order matters and controls visual order.

If you care about actor order, declare actors explicitly before messages.

## Sequence Diagram Features

### Spans

Spans show activation or lifespan periods by connecting a nested object on an actor.

```d2
flow: Request Flow {
  shape: sequence_diagram

  client
  server

  client.call -> server: request
}
```

### Groups

Groups are containers inside a sequence diagram that label a subset of messages.

```d2
flow {
  shape: sequence_diagram

  alice
  bob

  auth: Authentication {
    alice -> bob: credentials
    bob -> alice: token
  }
}
```

Because of sequence diagram scoping, referenced actors inside groups must exist at the top level.

### Notes

Create a note by defining a nested object on an actor with no connections.

```d2
flow {
  shape: sequence_diagram
  alice
  bob

  alice.note: retries after timeout
  alice -> bob: ping
}
```

### Self Messages

Self-referential messages are allowed.

```d2
flow {
  shape: sequence_diagram
  worker

  worker -> worker: refresh cache
}
```

## When To Reach For These Features

- Use icons for architecture and vendor-heavy diagrams.
- Use `shape: image` for logos, mascots, or diagram legends.
- Use Markdown blocks for documentation-oriented diagrams.
- Use code blocks for runbooks, config examples, or snippets.
- Use sequence diagrams when interaction order matters.

## Example: Deployment View Plus Request Flow

```d2
platform: Platform {
  icon: https://icons.terrastruct.com/dev%2Fkubernetes.svg

  api: API {
    icon: https://icons.terrastruct.com/dev%2Fgolang.svg
  }

  db: PostgreSQL {
    shape: cylinder
    icon: https://icons.terrastruct.com/dev%2Fpostgresql.svg
  }
}

platform.api -> platform.db: queries

request_flow: Request Flow {
  shape: sequence_diagram
  client
  api
  db

  client -> api: GET /users
  api -> db: select * from users
  db -> api: rows
  api -> client: 200 JSON
}
```

## Source Material

- Official docs: Icons, Text, Sequence Diagrams
- Hosted icons: `https://icons.terrastruct.com`
