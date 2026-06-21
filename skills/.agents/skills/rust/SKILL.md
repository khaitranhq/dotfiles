---
name: rust
description: Provides specialized instructions and workflows for Rust/Rustlang programming tasks including code organization, error handling, ownership patterns, and post-impl quality steps (cargo check, test, clippy, fmt). Use when working with .rs files, Cargo.toml, Rust projects, Rust source code, or when user mentions Rust, cargo, clippy, rustfmt, or when editing/writing/creating/modifying any Rust code (lib.rs, main.rs, mod.rs, .rs files).
license: MIT
metadata:
  author: pi
  version: "1.0.0"
  domain: language
  triggers:
    - .rs
    - Cargo.toml
    - lib.rs
    - main.rs
    - mod.rs
    - cargo check
    - cargo test
    - cargo clippy
    - cargo fmt
    - cargo build
    - cargo run
    - rustfmt
    - clippy
    - rustc
  role: specialist
  scope: implementation
  output-format: code
---

# Rust Skill

## Purpose

Enforce consistent Rust code quality through post-implementation checks: `cargo check`, `cargo test`, `cargo clippy`, `cargo fmt`.

## Key Workflows

### 1. Code Organization

#### Module Structure

- One module per file, mod declarations in `lib.rs`/`main.rs`
- Group related types, impls, and fns into a single module
- Keep `main.rs` thin — delegate to library crate

#### File Order

1. **Attributes** - `#![...]` crate-level attrs
2. **Module declarations** - `mod ...`
3. **Imports** - `use` statements (std, external, crate) grouped with blank lines
4. **Constants & statics**
5. **Type definitions** - structs, enums, unions
6. **Trait definitions**
7. **Impl blocks** - inherent impls first, then trait impls
8. **Free functions** - public before private

### 2. Error Handling

- Use `Result<T, E>` for fallible functions — never `unwrap()`/`expect()` outside tests/prototypes
- Prefer `thiserror` for library error types (if already a dep)
- Prefer `anyhow` for binary/CLI error propagation (if already a dep)
- Mark deliberate panics with a `// ponytail:` or `// panic:` comment explaining why

### 3. Ownership & Borrowing

- Prefer `&str` over `&String`, `&[T]` over `&Vec<T>`
- Use `Cow<'_, str>` for return types that are sometimes owned
- Derive `Copy + Clone` on small enums/structs used as flags

### 4. Post-Implementation Steps (MANDATORY)

After writing/changing Rust code, run **all** of these in order:

1. **Check compilation**

   ```bash
   cargo check
   ```
   Faster than build, catches type errors and borrow-checker issues.

2. **Run tests**

   ```bash
   cargo test
   ```
   Includes doc-tests (`///` code blocks).

3. **Lint with Clippy**

   ```bash
   cargo clippy --all-targets -- -D warnings
   ```
   Deny warnings. Suppress false positives with `#[allow(clippy::...)]` and a justification comment.

4. **Format**

   ```bash
   cargo fmt
   ```
   Runs `rustfmt` on the whole workspace.

### 5. Discovering Rust Documentation

```bash
# List items in a crate
cargo doc --open --no-deps  # build + open docs
cargo doc --no-deps         # build only

# For a published crate
cargo search <crate>
rustup doc --std            # open std docs
```

## Constraints

### MUST DO

- **Run all 4 post-impl steps** — `cargo check`, `cargo test`, `cargo clippy`, `cargo fmt` in that order
- **Handle errors** — `Result<_, Box<dyn Error>>` as minimum; use proper error types in production crates
- **Document public API** — `///` doc comments on all public items
- **Run tests** — make sure both unit and doc tests pass
- **Use clippy pedantic group** on existing projects that already enable it

### MUST NOT DO

- **Unwrap/expect in production code** — use `?` operator with proper error types
- **Ignore clippy warnings** — fix them or suppress with a comment
- **Create orphan modules** — every `.rs` under `src/` must be declared in `lib.rs`/`mod.rs`
