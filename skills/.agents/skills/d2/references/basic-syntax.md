# D2 Basic Syntax Reference

This reference covers the core D2 authoring model: objects, shapes, connections, and containers.

## Mental Model

- A D2 diagram is a map of objects and fields.
- Object keys identify nodes and are what connections refer to.
- Labels are presentation text; keys are the stable identifiers.
- Keys are case-insensitive, so `API`, `api`, and `Api` refer to the same object.

## Smallest Valid Patterns

Declare a shape by name:

```d2
api
db
```

Set a label explicitly:

```d2
api: API Server
db: Primary Database
```

Set fields on an object:

```d2
api: API Server {
  shape: rectangle
  style.fill: "#e3f2fd"
}
```

Define multiple objects on one line:

```d2
api; db; cache
```

## Shapes

By default, objects render as `rectangle`. Override with the `shape` field.

```d2
db: PostgreSQL {
  shape: cylinder
}

user: Customer {
  shape: person
}

queue: Jobs {
  shape: queue
}

cloud: AWS {
  shape: cloud
}
```

Common shapes from the official tour:

- `rectangle`
- `square`
- `page`
- `parallelogram`
- `document`
- `cylinder`
- `queue`
- `package`
- `step`
- `callout`
- `stored_data`
- `person`
- `diamond`
- `oval`
- `circle`
- `hexagon`
- `cloud`
- `c4-person`

### 1:1 Ratio Shapes

These always keep equal width and height:

- `circle`
- `square`

If you set `width` or `height` unevenly, D2 uses the larger value for both dimensions.

## Connections

Connections describe relationships between objects.

Valid connection operators:

- `--`
- `->`
- `<-`
- `<->`

Examples:

```d2
api -> db
worker -> queue: consumes
user <-> browser: interacts
cache -- db: replication
```

### Important Rules

Connections must reference object keys, not labels.

Connections must use the **full path** for nested objects. The path starts from the outermost scope, not from the connection’s scope. Example:

```d2
aws: AWS Cloud {
  vpc: VPC {
    subnet: Subnet {
      instance
    }
  }
  s3: S3
}

# ✅ full path
aws.vpc.subnet.instance -> aws.s3: stores

# ❌ unqualified — D2 does not know "subnet" or "s3" outside the container
subnet.instance -> s3
```

```d2
api: API Server
db: Primary Database

api -> db: queries
```

### Repeated Connections

Repeated edges create additional connections; they do not replace earlier ones.

```d2
db -> backup: nightly
db -> backup: hourly snapshot
```

### Chained Connections

Use chains for readability when several objects connect in sequence.

```d2
client -> api -> db
```

### Arrowheads

Customize arrowheads with `source-arrowhead` and `target-arrowhead` on the connection.

```d2
order -> payment: charges {
  target-arrowhead.shape: diamond
  target-arrowhead.style.filled: true
}
```

Supported arrowhead shapes noted in the D2 tour:

- `triangle`
- `arrow`
- `diamond`
- `circle`
- `box`
- `cf-one`
- `cf-one-required`
- `cf-many`
- `cf-many-required`
- `cross`

Keep arrowhead labels short because D2 does not autolayout them like regular labels.

## Containers

Containers group related objects by nesting them inside another object.

```d2
cloud: Platform {
  api
  db
}
```

You can also use nested map syntax to avoid repeating container names:

```d2
cloud: Platform {
  aws: AWS {
    load_balancer
    api
    db
  }
}
```

### Container Labels

Use shorthand:

```d2
vpc: Private Network {
  api
}
```

Or an explicit `label` field:

```d2
vpc {
  label: Private Network
  api
}
```

### Referencing the Parent

Within a container, `_` refers to the parent container.

```d2
office {
  printer
  employee -> _.printer: prints
}
```

## Recommended Authoring Pattern

Start from structure, then add detail:

1. Declare key objects.
2. Connect them with simple arrows.
3. Add labels and shapes.
4. Group related objects into containers.
5. Add styling only after the structure reads clearly.

## Example: Service Topology

```d2
users: Users

platform: Application Platform {
  edge: Edge {
    lb: Load Balancer {
      shape: parallelogram
    }
  }

  services: Services {
    api: API {
      shape: rectangle
    }
    worker: Worker {
      shape: rectangle
    }
  }

  data: Data {
    db: PostgreSQL {
      shape: cylinder
    }
    queue: Jobs {
      shape: queue
    }
  }
}

users -> platform.edge.lb: HTTPS
platform.edge.lb -> platform.services.api
platform.services.api -> platform.data.db: reads/writes
platform.services.api -> platform.data.queue: enqueues
platform.services.worker -> platform.data.queue: consumes
platform.services.worker -> platform.data.db: updates
```

## Source Material

- Official docs: Shapes, Connections, Containers
- D2 cheat sheet and CLI docs for syntax confirmation
