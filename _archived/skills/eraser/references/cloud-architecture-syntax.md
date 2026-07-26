# Eraser Cloud Architecture Syntax Reference

## Nodes

A node is the most basic building block. Node names must be unique.

```
compute [icon: aws-ec2]
```

Nodes support `icon` and `color` properties.

## Groups

Groups are containers that encapsulate nodes and other groups. Group names must be unique.

```
Main Server {
    Server [icon: aws-ec2]
    Data [icon: aws-rds]
}
```

Groups can be nested:

```
VPC Subnet {
    Main Server {
        Server [icon: aws-ec2]
        Data [icon: aws-rds]
    }
}
```

Groups support `icon` and `color` properties.

## Properties

Key-value pairs in `[ ]` brackets. Optional. Multiple properties separated by commas.

```
Main Server [icon: aws-ec2, color: blue] {
    Server [icon: aws-ec2]
    Data [icon: aws-rds]
}
```

| Property   | Description           | Value                                | Default            |
| ---------- | --------------------- | ------------------------------------ | ------------------ |
| icon       | Attached icon         | Icon name (e.g. aws-ec2)             |                    |
| color      | Stroke and fill color | Color name (e.g. blue) or hex (e.g. `"#000000"`) |          |
| label      | Text label            | String. Quote if contains spaces     | Node/group name    |
| colorMode  | Fill color lightness  | pastel, bold, outline                | pastel             |
| styleMode  | Embellishments        | shadow, plain, watercolor            | shadow             |
| typeface   | Text typeface         | rough, clean, mono                   | rough              |

## Connections

Connections represent relationships between nodes and groups. Use `>` between names.

```
Compute > Storage
User > API: HTTPS
```

## Escape Strings

Wrap names containing reserved characters in double quotes.

```
User > "https://localhost:8080": GET
```

## Direction

Change diagram flow direction. Can appear anywhere.

Available: `down`, `up`, `right` (default), `left`.

```
direction down
```

## Diagram-Level Styling

| Property   | Values                    | Default  | Syntax            |
| ---------- | ------------------------- | -------- | ----------------- |
| colorMode  | pastel, bold, outline     | pastel   | `colorMode bold`  |
| styleMode  | shadow, plain, watercolor | shadow   | `styleMode plain` |
| typeface   | rough, clean, mono        | rough    | `typeface clean`  |
