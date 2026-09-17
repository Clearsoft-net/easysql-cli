# EasySQL CLI / TUI

> Ask questions in natural language to your local **MySQL**, **PostgreSQL** or **SQLite** database — straight from your terminal.

[![CI](https://img.shields.io/github/actions/workflow/status/Clearsoft-net/easysql-cli/ci.yml?branch=main&style=flat-square)](https://github.com/Clearsoft-net/easysql-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@clearsoft/easysql-cli?color=F97316&style=flat-square)](https://www.npmjs.com/package/@clearsoft/easysql-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Website](https://img.shields.io/badge/Product-easysql.net-F97316?style=flat-square)](https://easysql.net)

The **EasySQL CLI** is the open-source counterpart to the WordPress plugin. It runs the full EasySQL query flow client-side:

1. You connect a local MySQL, PostgreSQL or SQLite database. (Or run `easysql demo` to spin up a sample SQLite database in seconds.)
2. The CLI introspects the schema and pushes **only the schema metadata** to the EasySQL API — credentials never leave your machine. SQLite connectors have no credentials at all.
3. You ask questions in natural language; the API returns SQL.
4. The CLI validates that the SQL is **SELECT-only** and executes it against your local database.
5. Results are printed as a table — or opened in an interactive TUI shell.

## Requirements

The CLI is **Bun-only**: it uses `bun:sqlite` and the binary shebang is `#!/usr/bin/env bun`. Node.js alone cannot run it.

- [Bun](https://bun.sh) >= 1.4 — to run the npm package.
- Or no runtime at all — grab a standalone binary from GitHub Releases.

Because of this, `bunx` and `bun add -g` work, while `npx` / `npm i -g` only work if Bun is on your `PATH`.

## Install

```bash
# Run without installing
bunx @clearsoft/easysql-cli

# Or install globally
bun add -g @clearsoft/easysql-cli

# Or grab a standalone binary from GitHub Releases (no Bun required)
curl -L https://github.com/Clearsoft-net/easysql-cli/releases/latest/download/easysql-linux-x64 -o easysql
chmod +x easysql && ./easysql --help
```

Standalone binaries are published for `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64` and `windows-x64`.

MySQL and PostgreSQL drivers are optional: SQLite works out of the box, and the
other engines are installed on demand — `bun add @easysql/connector-mysql` or
`bun add @easysql/connector-postgres`. Without the package, the CLI prints an
install hint instead of a module-resolution error.

## Quick start

```bash
# 1. Authenticate (API key created in the dashboard)
easysql login

# 2a. (Easiest) Generate a local sample SQLite database and use it immediately
easysql demo
easysql query "Top 3 customers by revenue"

# 2b. Or add a real local database connector (schema is sent to EasySQL, not credentials)
easysql connector add \
  --name "Local Postgres" \
  --type postgresql \
  --host localhost --port 5432 --database mydb --user me --password mypass

# 2c. Or point at a local SQLite file
easysql connector add \
  --name "Local SQLite" \
  --type sqlite \
  --file /path/to/your.db

# 3. Ask a question
easysql query "How many orders did we get last week?"

# 4. SQL-only mode (no local execution)
easysql query "Top 5 customers by revenue" --generate-only

# 5. Open the interactive TUI shell
easysql
```

## Commands

| Command | Description |
|---|---|
| `easysql login` | Authenticate with an EasySQL API key |
| `easysql logout` | Clear local credentials |
| `easysql demo` | Generate a local sample SQLite database and register it as `local-demo` |
| `easysql connector add` | Add a local MySQL / Postgres / SQLite connector |
| `easysql connector sync [name]` | Re-introspect and push the schema again |
| `easysql connector list` | List connectors from EasySQL |
| `easysql connector remove <name>` | Remove a connector from EasySQL and locally |
| `easysql query "<question>"` | Generate SQL and run it locally |
| `easysql query "<question>" --generate-only` | Print the SQL without executing |
| `easysql usage` | Show plan consumption (quota used vs remaining) |
| `easysql history` | Show the local read-only question log |
| `easysql update` | Self-update to the latest release |
| `easysql --help` | List every command, flag, and parameter |

Global flags: `--api-url`, `--config`, `--json`, `--no-color`, `-v`, `-h`.

## Privacy & security

- **Credentials never leave your machine.** The CLI only introspects your local database to extract schema metadata (`tables`, `columns`, `types`, `primary_keys`, `foreign_keys`, `row_count_estimate`) and sends that — never passwords, hosts, or ports.
- **Read-only enforcement.** Generated SQL is validated server-side by the EasySQL API. The CLI additionally refuses to execute any non-SELECT statement.
- **API key storage.** Stored in `~/.config/easysql/config.json` with `0600` permissions.
- Database passwords are never persisted: they are re-prompted (or read from `$EASYSQL_DB_PASSWORD`) on every query.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Self-update

```bash
easysql update --check   # report current vs latest
easysql update           # download and replace
```

## Build from source

```bash
git clone https://github.com/Clearsoft-net/easysql-cli
cd easysql-cli
bun install
make build          # tsc → dist/
make build-compile  # bun build --compile → bin/easysql (standalone binary)
make test           # bun test
make check          # biome + tsc --noEmit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and conventions.

## License

MIT — see [LICENSE](LICENSE).

A [Clearsoft](https://clearsoft.net) product.
