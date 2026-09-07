# <picture>
#   <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Clearsoft-net/easysql-brand/main/logo/01-dark-horizontal.svg">
#   <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Clearsoft-net/easysql-brand/main/logo/02-light-horizontal.svg">
#   <img alt="EasySQL Logo" src="https://raw.githubusercontent.com/Clearsoft-net/easysql-brand/main/logo/01-dark-horizontal.svg">
# </picture>

# EasySQL CLI / TUI

> Ask questions in natural language to your local **MySQL**, **PostgreSQL** or **SQLite** database — straight from your terminal.

[![npm version](https://img.shields.io/npm/v/@clearsoft/easysql-cli?color=F97316&style=flat-square)](https://www.npmjs.com/package/@clearsoft/easysql-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Website](https://img.shields.io/badge/Product-easysql.net-F97316?style=flat-square)](https://easysql.net)

The **EasySQL CLI** is the open-source counterpart to the WordPress plugin. It runs the full EasySQL query flow client-side:

1. You connect a local MySQL, PostgreSQL or SQLite database. (Or run `easysql demo` to spin up a sample SQLite base in seconds.)
2. The CLI introspects the schema and pushes **only the schema metadata** to the EasySQL API — credentials never leave your machine. SQLite connectors have no credentials at all.
3. You ask questions in natural language; the API returns SQL.
4. The CLI validates that the SQL is **SELECT-only** and executes it against your local database.
5. Results are printed as a table — or opened in an interactive TUI shell.

## Install

```bash
# Run from source (requires Bun >= 1.1)
bunx @clearsoft/easysql-cli

# Or install globally
bun add -g @clearsoft/easysql-cli

# Or grab a standalone binary from GitHub Releases
curl -L https://github.com/Clearsoft-net/easysql-cli/releases/latest/download/easysql-linux-x64 -o easysql
chmod +x easysql && ./easysql --help
```

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
| `easysql connector sync` | Re-extract and push schema metadata |
| `easysql connector list` | List connectors from EasySQL |
| `easysql query "<question>"` | Generate SQL and run it locally |
| `easysql query "<question>" --generate-only` | Print the SQL without executing |
| `easysql usage` | Show plan consumption (quota used vs remaining) |
| `easysql history` | Show the local read-only question log |
| `easysql update` | Self-update to the latest release |
| `easysql --help` | List every command, flag, and parameter |

## Privacy & security

- **Credentials never leave your machine.** The CLI only introspects your local database to extract schema metadata (`tables`, `columns`, `types`, `primary_keys`, `foreign_keys`, `row_count_estimate`) and sends that — never passwords, hosts, or ports.
- **Read-only enforcement.** Generated SQL is validated server-side by the EasySQL API. The CLI additionally refuses to execute any non-SELECT statement.
- **API key storage.** Stored in `~/.config/easysql/config.json` with `0600` permissions.

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
make build-compile  # bun build --compile → easysql (standalone binary)
make test           # bun test
make check          # biome + tsc --noEmit
```

## License

MIT — see [LICENSE](LICENSE).

A [Clearsoft](https://clearsoft.net) product.
