# Architecture Diagrams Reference

Architecture diagrams for Cloud/CI/CD deployments. Four building blocks: **Groups** (containers), **Services** (components), **Edges** (connections), **Junctions** (4-way routing).

**Requires**: v11.1.0+

```
architecture-beta
```

## Groups

**Syntax**: `group {id}({icon})[{title}] (in {parent_id})?`

```mermaid
architecture-beta
    group api(cloud)[API Layer]
    group frontend(server)[Frontend] in api  %% Nested
```

## Services

**Syntax**: `service {id}({icon})[{title}] (in {parent_id})?`

```mermaid
architecture-beta
    group backend(cloud)[Backend]
    service db(database)[User DB] in backend
    service cache(disk)[Cache] in backend
```

## Edges

**Syntax**: `{serviceId}{group}?:{T|B|L|R} {<}?--{>}? {T|B|L|R}:{serviceId}{group}?`

**Directions**: `T` (top), `B` (bottom), `L` (left), `R` (right)  
**Arrows**: `--` (none), `-->` (right), `<--` (left), `<-->` (bidirectional)

```mermaid
architecture-beta
    service client(server)[Client]
    service api(server)[API]
    service db(database)[DB]

    client:R --> L:api
    api:B --> T:db
```

**Group edges**: Use `{group}` modifier for edges from group boundaries (not direct `groupId`).

```mermaid
architecture-beta
    group g1(cloud)[Group 1]
    service svc[Service] in g1
    service external[External]

    svc{group}:R --> L:external
```

## Junctions

4-way routing points for complex flows (load balancing, message fanout, network routing).

**Syntax**: `junction {id} (in {parent_id})?`

```mermaid
architecture-beta
    service lb(internet)[LB]
    service web1(server)[Web 1]
    service web2(server)[Web 2]
    junction j

    lb:R --> L:j
    j:T --> B:web1
    j:B --> T:web2
```

## Icons

**Built-in**: `cloud`, `database`, `disk`, `internet`, `server`

**Custom icons** from [iconify.design](https://iconify.design) (200k+ icons):

```bash
npm install @iconify-json/logos
mmdc -i diagram.mmd --iconPacks @iconify-json/logos -o output.svg
```

```javascript
import mermaid from "mermaid";
import logos from "@iconify-json/logos";

mermaid.registerIconPacks([
  {
    name: "logos",
    loader: () => Promise.resolve(logos),
  },
]);
```

```mermaid
architecture-beta
    service aws(logos:aws)[AWS]
    service k8s(logos:kubernetes)[K8s]
```

**Popular packs**: `@iconify-json/logos`, `@iconify-json/mdi`, `@iconify-json/fa`

## Examples

**Three-tier architecture**:

```mermaid
architecture-beta
    group cloud(cloud)[Cloud]
    group web(server)[Web] in cloud
    group app(server)[App] in cloud

    service lb(internet)[LB] in web
    service web1(server)[Web 1] in web
    service app1(server)[App 1] in app
    service db(database)[DB] in app

    lb:B --> T:web1
    web1:B --> T:app1
    app1:R --> L:db
```

**Microservices**:

```mermaid
architecture-beta
    service gateway(internet)[Gateway]
    group services(cloud)[Services]
    service auth(server)[Auth] in services
    service user(server)[User] in services
    service db(database)[DB]

    gateway:R --> L:auth
    gateway:R --> L:user
    user:B --> T:db
```

## Best Practices

- **Organization**: Group by tiers/regions, use clear IDs, limit nesting to 3-4 levels, max 5-10 services per group
- **Edges**: Always specify T/B/L/R directions, minimize crossings, use junctions for complex routing
- **Icons**: Use consistent icon set, register custom packs for brands

## Troubleshooting

| Issue                | Solution                                                                                |
| -------------------- | --------------------------------------------------------------------------------------- |
| Icons not showing    | Register icon packs or use defaults (`cloud`, `database`, `disk`, `internet`, `server`) |
| Edges not connecting | Verify service IDs and directions (T/B/L/R)                                             |
| Group edges failing  | Use `service{group}:dir --> dir:target`, not `groupId` directly                         |
| CLI icon errors      | Add `--iconPacks @iconify-json/logos`                                                   |

**Docs**: https://mermaid.js.org/syntax/architecture.html  
**Icons**: https://iconify.design/
