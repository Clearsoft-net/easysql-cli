/**
 * Manual help strings — one source of truth, rendered by the `help`
 * subcommand and surfaced through commander's --help via `addHelpText`.
 *
 * Kept separate from `messages.ts` because help content is structurally
 * richer than ordinary UI strings (descriptions, flag matrices, examples).
 */

export const APP_NAME = "easysql";
export const APP_TAGLINE = "Ask your database in natural language — from the terminal.";
export const APP_DESCRIPTION = `
The EasySQL CLI is the open-source client-side runtime for the EasySQL
platform. It connects to your LOCAL MySQL, PostgreSQL, ClickHouse or
SQLite database, extracts the schema, and pushes ONLY the schema metadata
to the EasySQL API — credentials never leave your machine. Ask questions
in plain English; the CLI validates that the generated SQL is SELECT-only
and executes it locally.
`.trim();

export const HELP_TOP = `
Usage: easysql [command] [options]

Run 'easysql help <command>' for detailed help on any subcommand.
Run 'easysql' with no command to open the interactive TUI shell.
`.trim();

export const HELP_COMMANDS = `
Commands:
  login                 Authenticate with an EasySQL API key
  logout                Clear stored credentials
  demo                  Generate a local sample SQLite database (local-demo)
  connector add         Add a local MySQL/Postgres/ClickHouse/SQLite connector
  connector sync        Re-extract and push schema metadata
  connector list        List connectors known to EasySQL
  connector remove      Remove a local connector (and delete it from EasySQL)
  query "<question>"    Generate SQL and run it against the local DB
  usage                 Show plan consumption (quota used vs remaining)
  history               Show the local read-only question log
  update                Self-update to the latest release
  help [command]        Show help (for a specific command)
`.trim();

export const HELP_GLOBAL_OPTIONS = `
Global options:
  --api-url <url>       EasySQL API base URL (default: https://api.easysql.net,
                        or $EASYSQL_API_URL)
  --config <path>       Override the local config file path
  --json                Output machine-readable JSON
  --no-color            Disable ANSI colors
  -v, --version         Print version
  -h, --help            Print help
`.trim();

export const HELP_LOGIN = `
Usage: easysql login [options]

Authenticate the CLI with an EasySQL API key. The key is stored in the
local config file with 0600 permissions and used for all subsequent
authenticated requests.

By default, the command is interactive: when --api-key is missing and
$EASYSQL_API_KEY is not set, the CLI prompts for the key with hidden echo.
Pass --non-interactive (or -y) to disable prompts and fail with a clear
error instead.

Options:
  --api-key <key>       Provide the key inline (otherwise prompted securely)
  --api-url <url>       Override the API base URL for this login only
  -y, --non-interactive  Disable prompts; fail when required values are missing

Example:
  easysql login
  easysql login --api-key easysql_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  easysql login --non-interactive --api-key easysql_sk_xxx
`.trim();

export const HELP_LOGOUT = `
Usage: easysql logout

Removes the stored API key from the local config file.
`.trim();

export const HELP_CONNECTOR_ADD = `
Usage: easysql connector add [options]

Connect to a LOCAL MySQL, PostgreSQL, ClickHouse or SQLite database,
extract its schema (tables, columns, types, primary keys, foreign keys,
row-count estimates), and push ONLY the schema metadata to EasySQL.
Connection credentials are NEVER sent to the API — they are kept in memory
for the introspection step and discarded. SQLite connectors have no
credentials: the only required parameter is the absolute file path to a
.db file.

By default, the command is interactive: missing required values are
prompted for one at a time. Pass --non-interactive (or -y) to disable
prompts; in that mode every required flag must be supplied explicitly
or the command exits with code 1.

Required (always):
  --name <name>         Human-readable connector name
  --type <type>         'mysql' | 'mariadb' | 'postgresql' | 'clickhouse' | 'sqlite'

Connection (one of --connection-url OR --host/--port/...):
  --connection-url <url> Full URL: mysql://user:pass@host:port/db
                          or clickhouse://user:pass@host:8123/db
                          or sqlite:///absolute/path/to.db
  --host <host>         Database host (default: 127.0.0.1)
  --port <port>         Database port (default: 3306 MySQL, 5432 Postgres,
                        8123 ClickHouse)
  --user <user>         Database user
  --password <pass>     Database password (otherwise prompted securely)
  --database <db>       Database name

SQLite-specific:
  --file <path>         Absolute path to a local .db file
                        (alternative to --connection-url sqlite:///...)

Options:
  --ssl                 Require SSL/TLS (ClickHouse: HTTPS on 8443)
  -y, --non-interactive  Disable prompts; fail when required values are missing

Example:
  easysql connector add \\
    --name "Local Postgres" \\
    --type postgresql \\
    --host localhost --port 5432 --database mydb --user me

  easysql connector add \\
    --name "Local ClickHouse" \\
    --type clickhouse \\
    --connection-url "clickhouse://default:pass@localhost:8123/analytics"

  easysql connector add --name "Local SQLite" --type sqlite --file /tmp/app.db

  # Fully non-interactive (CI / scripts):
  easysql connector add --non-interactive \\
    --name "Local Postgres" --type postgresql \\
    --connection-url "postgresql://user:pass@host:5432/db"
`.trim();

export const HELP_CONNECTOR_SYNC = `
Usage: easysql connector sync [name] [options]

Re-introspect a locally-registered connector and push the updated schema
metadata to EasySQL (POST /v1/connectors/{id}/sync). The local database is
contacted again, so a password is required for MySQL/Postgres/ClickHouse
connectors (SQLite has none); it is used in memory only and never persisted.

With no argument and exactly one local connector, that connector is synced.

Arguments:
  [name]                Connector name (from \`easysql connector list\`)

Options:
  --id <connector-id>   Sync a specific connector by server id
  --password <pass>     Database password (otherwise $EASYSQL_DB_PASSWORD or prompted)
  -y, --non-interactive  Fail instead of prompting when the password is missing

Example:
  easysql connector sync
  easysql connector sync local-demo
  easysql connector sync --id <connector-uuid>
`.trim();

export const HELP_CONNECTOR_LIST = `
Usage: easysql connector list

List all connectors known to your EasySQL account.
`.trim();

export const HELP_CONNECTOR_REMOVE = `
Usage: easysql connector remove <name> [options]

Remove a locally-registered connector. Deletes it from the EasySQL API
(the server-side schema cache) and from the local connectors.json. When
not logged in, only the local entry is removed.

By default it asks for confirmation. Pass --yes (or -y) to skip the
prompt — required in non-interactive shells.

Options:
  -y, --yes             Skip the confirmation prompt

Example:
  easysql connector remove local-demo
  easysql connector remove local-demo --yes
`.trim();

export const HELP_QUERY = `
Usage: easysql query "<question>" [options]

Send the natural-language question plus the selected connector's schema
to the EasySQL API. The API returns SQL. The CLI then validates that the
SQL is SELECT-only (defense-in-depth — the API already enforces this)
and executes it against the LOCAL database.

Arguments:
  <question>            The natural-language question (must be quoted if it
                        contains spaces)

Options:
  --connector <id|name> Pick a specific connector (otherwise prompted)
  --generate-only       Print the generated SQL WITHOUT executing it
  --rows <n>            Override the LIMIT (1..100; default from server)
  --format <fmt>        Output format: table | json | csv (default: table)

Examples:
  easysql query "How many orders did we get last week?"
  easysql query "Top 5 customers by revenue" --generate-only
  easysql query "List users created in 2026" --format json
`.trim();

export const HELP_USAGE = `
Usage: easysql usage

Display plan consumption fetched from the EasySQL API: daily / weekly /
monthly queries used vs remaining, and the active plan tier.
`.trim();

export const HELP_HISTORY = `
Usage: easysql history [options]

Show the local read-only log of questions asked via this CLI.

Options:
  --limit <n>           Show the last N entries (default: 50)
  --clear               Clear the local history

History is stored locally in ~/.local/share/easysql/history.jsonl and is
NEVER sent to the EasySQL API.
`.trim();

export const HELP_UPDATE = `
Usage: easysql update [options]

Fetch the latest release from GitHub and (optionally) replace the
currently-installed binary.

Options:
  --check               Report current and latest version without installing
  --target <path>       Override the path of the binary to replace
                        (default: the path of the running executable)

Examples:
  easysql update --check
  easysql update
`.trim();

export const HELP_HELP = `
Usage: easysql help [command]

Print help for a specific command. With no argument, prints the top-level
help.
`.trim();

export const HELP_DEMO = `
Usage: easysql demo [options]

Generate a small, fictional sample SQLite database and register it as a
local connector named \`local-demo\`. Useful as a low-friction on-ramp:
you can immediately run \`easysql query "..." --connector local-demo\`
without setting up MySQL or PostgreSQL.

The generated file lives at $XDG_DATA_HOME/easysql/demo.db (or
%LOCALAPPDATA%/easysql/demo.db on Windows) and contains 4 tables
(customers, products, orders, order_items) with ~5/6/7/10 rows of
deterministic sample data. Re-running the command removes and
recreates the file, so the data is reset to the same state every time.

Options:
  --file <path>         Override the output SQLite file path
  --name <name>         Override the connector name (default: local-demo)
  --no-register         Only write the .db file; skip the API +
                        connectors-store registration steps

Example:
  easysql demo
  easysql query "Top 3 customers by revenue" --connector local-demo
  easysql demo --file /tmp/custom.db --name staging
`.trim();
