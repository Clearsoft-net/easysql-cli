# AGENTS.md

Operational context for **easysql-cli** — the open-source CLI/TUI for the EasySQL platform. Two-minute read to get started.

## What it is

A TypeScript/Bun CLI that: logs in, manages local MySQL/Postgres/SQLite connectors (schema-only), runs natural-language queries through the EasySQL API, validates that the generated SQL is SELECT-only, executes it locally, and prints the results as a table. It ships an interactive TUI, self-update via GitHub Releases, and an `easysql demo` command that generates a sample SQLite database for instant experimentation.

**Core principle:** database credentials NEVER leave the host. Only schema metadata is sent to the API.

## Stack

- **Language:** TypeScript 5.7 (strict, `noUncheckedIndexedAccess`)
- **Runtime:** Bun 1.3+ (engines: `bun >=1.1.0`, `node >=20`)
- **CLI framework:** commander 12 + a hand-written help manual in `src/i18n/help.ts`
- **HTTP SDK:** `@easysql/client ^2.0.0` (openapi-fetch client, modular org `@easysql/*`)
- **DB layer:** `@easysql/connector-mysql` + `@easysql/connector-postgres` + `@easysql/connector-sqlite` (introspect + execute), `@easysql/schema-generation` (raw → API payload), contracts re-exported from `@easysql/common`
- **Output:** `chalk 5` (auto-detect TTY), custom table renderer
- **Lint/format:** Biome 2.5 (`biome.json`, tabs, 100 col, LF, double quotes)
- **TUI:** `ink` 7 + `react` 19 (`ink-testing-library` in dev) — running `easysql` with no subcommand opens React in the terminal
- **Tests:** `bun test` (117 specs, no vitest dependency)
- **Build:**
  - `bun run build` → `tsc -p scripts/tsconfig.json` → `dist/`
  - `bun run build:compile` → `bun build --compile --minify` → `bin/easysql` (standalone ~92 MB)

## Commands (delivered: 12/12 ACs EZSQL-38/45 + TUI EZSQL-46)

| Command | What it does |
|---|---|
| `easysql login` | Authenticates with an API key (`--api-key` / `$EASYSQL_API_KEY` / `--non-interactive`, -y) |
| `easysql logout` | Clears local credentials |
| `easysql demo` | Generates a local sample SQLite database and registers it as `local-demo` |
| `easysql connector add` | Introspects a local DB, sends only the schema to the API (mysql/mariadb/postgresql/sqlite) |
| `easysql connector sync [name]` | Re-introspects and re-sends the schema (`syncConnector`); with no name, uses the single local connector |
| `easysql connector list` | Lists connectors known to the API |
| `easysql connector remove <name>` | Removes the connector server-side (best-effort) and locally (`--yes` skips confirmation) |
| `easysql query "<q>"` | Generates SQL and executes it locally (SELECT-only) |
| `easysql query "<q>" --generate-only` | Prints the SQL without executing |
| `easysql usage` | Quota consumption (calls `/v1/dashboard/stats`) |
| `easysql history` | Local read-only log (`history.jsonl`) |
| `easysql update [--check]` | Self-update via GitHub Releases |
| `easysql` (no subcommand) | Opens the interactive TUI REPL |

**Global flags:** `--api-url`, `--config`, `--json`, `--no-color`, `-v`, `-h`.

## Structure

```
src/
├── bin.ts                      # binary entrypoint (slices argv from bun compile)
├── cli.ts                      # run(argv) — the only place with a global try/catch
├── index.ts                    # public entrypoint (re-exports for tests)
├── version.ts                  # VERSION/NAME/REPO (read from package.json)
├── cli/
│   ├── program.ts              # buildProgram() — registers subcommands
│   ├── global-options.ts       # GlobalOptions type + DEFAULT_API_URL
│   ├── user-args.ts            # userArgs(argv) — strip runtime/script prefix
│   └── errors.ts               # CliError + NotLoggedInError/NetworkError/ApiError
├── commands/
│   ├── login.ts                # registerLogin(program)
│   ├── logout.ts
│   ├── demo.ts                 # easysql demo — generates a sample local SQLite DB
│   ├── connector.ts            # add|sync|remove|list group (mysql/mariadb/postgresql/sqlite)
│   ├── query.ts                # registerQuery
│   ├── usage.ts
│   ├── history.ts
│   ├── update.ts
│   ├── help.ts                 # easysql help [command] — manual
│   └── stubs.ts                # empty (legacy placeholder)
├── config/
│   ├── paths.ts                # XDG-aware: getConfigDir/getConfigPath/getDataDir/getHistoryPath
│   ├── store.ts                # loadConfig/saveConfig/clearConfig/isLoggedIn (0600)
│   └── connectors-store.ts     # CRUD for local connectors (0600, no password)
├── db/
│   ├── schema.ts               # re-exports ColumnSchema/TableSchema from @easysql/common + local aliases
│   ├── introspect.ts           # dispatcher over @easysql/connector-* + generateSchema()
│   ├── introspect-sqlite.ts    # thin SqliteConnector wrapper (kept for existing imports)
│   ├── demo.ts                 # buildDemoDatabase() — sample customers/products/orders
│   ├── parse-url.ts            # re-exports parseConnectionUrl()/mergeConnection() from @easysql/common
│   ├── sync-connector.ts       # syncLocalConnector() — re-introspect + POST /sync
│   └── execute.ts              # executeSelect() via @easysql/connector-*, validateSelectOnly() first
├── sdk/
│   └── client.ts               # @easysql/client wrapper + resolveApiUrl()
├── i18n/
│   ├── messages.ts             # UI strings (errors/prompts/success/info)
│   └── help.ts                 # help manual (HELP_TOP/HELP_COMMANDS/HELP_DEMO/...)
├── output/
│   ├── print.ts                # print/printError/printSuccess/printInfo (JSON-aware)
│   └── table.ts                # renderResult(format, cols, rows): table|json|csv
├── history/
│   └── store.ts                # appendHistory/readHistory/clearHistory (jsonl, 0600)
├── tui/
│   ├── app.tsx                 # ink Router — chrome + screen slot + help modal
│   ├── chrome.tsx              # static Header / TabBar / Footer
│   ├── cursor.tsx              # text cursor for input fields
│   ├── spinner.tsx             # Spinner (braille) for in-flight states
│   ├── result-table.tsx        # ResultTable — table rendered in ink (aligned)
│   ├── sql-highlight.tsx       # SqlText — keyword/string/number highlighting
│   ├── mount.tsx               # JSX wrapper that calls ink render(<App />, alternateScreen)
│   ├── repl.ts                 # startRepl() — checks TTY and delegates to mount
│   └── screens/
│       ├── connectors.tsx      # list + add/remove/sync + j/k + Enter to activate
│       ├── connector-sync.tsx  # <ConnectorSync> — introspect + POST /sync (inline password)
│       ├── usage.tsx           # <UsageView> — /usage (dashboard/stats)
│       ├── history.tsx         # paginated list of HistoryEntry
│       ├── question.tsx        # input + generate SQL + execute + table + /commands
│       └── help.tsx            # keybindings modal
├── update/
│   └── self-update.ts          # fetchLatestRelease/findAsset/atomicReplace/selfUpdate
└── util/
    ├── prompt.ts               # promptSecret/promptLine/promptLineDefault (raw mode + TTY-aware)
    └── sql-validator.ts        # validateSelectOnly() — defense in depth
scripts/
├── build.ts                    # tsc OR bun --compile
├── release-binaries.ts         # builds linux/darwin/windows x x64/arm64 → bin/easysql-*
├── tui-capture.ts              # dev: renders the TUI in a PTY (tmux) + --png screenshot
└── tsconfig.json               # extends ../tsconfig.json, outDir=../dist
tests/                          # bun:test — one file per module + _helpers.ts
.github/workflows/
├── ci.yml                      # push/PR to main → lint+typecheck+test+build+smoke
└── release.yml                 # tag v*.*.* → build binaries + SHA256SUMS + release
```

## Security (non-negotiable)

- **Schema-only:** `introspectDatabase()` returns only `{tables, columns, types, pks, fks, rows_approx}`.
  Passwords, hosts, and ports NEVER cross the process boundary.
- **Password never persisted.** `$XDG_CONFIG_HOME/easysql/connectors.json` stores only `name/type/host/port/user/database/ssl`. The password is re-prompted (or read from `$EASYSQL_DB_PASSWORD`) on every query run.
- **API key in `config.json` with `0600`.** chmod is best-effort on Windows.
- **Local SQL validator** (`src/util/sql-validator.ts`): tokenizer + regex, applied before touching the local DB. The server side already enforces this; this is defense in depth.
- **Stacked statements rejected**, only one trailing `;` allowed, the head must be `WITH|SELECT|EXPLAIN|SHOW`.
- **SQLite connectors have no credentials.** The only thing leaving the machine is the schema; the `file` path stays in the local `connectors.json` (and is never sent to the API — only `{type: "sqlite", name, schema}`).

## Storage layout (XDG)

| File | Contents | Permissions |
|---|---|---|
| `~/.config/easysql/config.json` | `{api_url, api_key, last_login_at, user_email?, user_name?, plan_name?}` | 0600 |
| `~/.config/easysql/connectors.json` | array `StoredConnector[]` (no password) | 0600 |
| `~/.local/share/easysql/history.jsonl` | one JSON entry per line, append-only | 0600 |
| Windows: `%APPDATA%\easysql\` + `%LOCALAPPDATA%\easysql\` | same scheme, chmod is a no-op | — |

Override via `--config <path>` (acts on `getConfigPath()`). Directory: `$XDG_CONFIG_HOME` or `~/.config`.

## Exit codes (`src/cli.ts:6-11`)

- `0` success
- `1` generic error / commander parse
- `2` not authenticated (`NotLoggedInError`)
- `3` network error (`NetworkError`)
- `4` API error (`ApiError`)
- `5` safety violation (mutation rejected locally)

## SDK — how the CLI consumes the API

- `src/sdk/client.ts` is the only bridge to `@easysql/client` (modular SDK v2).
- `resolveApiUrl()`: `--api-url` > `$EASYSQL_API_URL` > saved config > `https://api.easysql.net`.
- `getAuthenticatedClient(key, url)` returns an `AuthenticatedClient` (a hand-written interface mirroring the SDK).
- `getSavedClient()`: throws `NotLoggedInError` if there is no config; used by `query`/`usage`/`connector`/`history`.
- `login` validates by calling `me()` before persisting; 401/403 → invalid-key error.
- `createQuery` returns `{id, sql_generated, needs_local_execution, status}`; `query.ts` reads `sql_generated`, executes locally, then calls `answerQuery` (POST `/v1/queries/:id/answer`) with `result_data: result.rows` so the API can generate the answer+chart.
- `syncConnector` requires a `{schema: TableSchema[]}` body; `connector.ts:282` still rejects `--id` with an explicit error — that is the place to change when implementing sync-by-name.
- DB work goes through the SDK too: `introspectDatabase()` opens the matching `@easysql/connector-*` class and maps raw → payload with `generateSchema()`; `executeSelect()` validates SELECT-only first, then delegates to `connector.execute()`. Schema/URL contracts come from `@easysql/common`. Connectors load lazily via `src/db/load-connector.ts` (`import()` per engine) — only the driver for the active connector type is loaded. `connector-mysql`/`connector-postgres` are `optionalDependencies` (install on demand with `bun add @easysql/connector-mysql`); a missing package surfaces as a `CliError` install hint, not a bare resolution error. `connector-sqlite` stays required (demo + default path).

## Self-update

- Feed: `https://api.github.com/repos/Clearsoft-net/easysql-cli/releases/latest`
- Asset naming: `easysql-<platform>-<arch>` (linux/darwin x x64/arm64 + windows-x64)
- `currentPlatform()` resolves from `node:os` (arch = `arm64` or `x64`)
- `atomicReplace()` uses `renameSync` (POSIX atomic on the same FS) — `bin/<exe>.easysql-update.tmp` is written first
- The current version comes from `package.json` (via `src/version.ts`), with an import `with { type: "json" }`

## Build & release pipeline

- **CI** (`.github/workflows/ci.yml`): `bun install --frozen-lockfile` → `lint` → `typecheck` → `test` → `build` → `build:compile` → `./bin/easysql --version` smoke.
- **Release** (`.github/workflows/release.yml`): on a `v*.*.*` tag push or manual dispatch → `check` + `test` + `scripts/release-binaries.ts` → `sha256sum bin/easysql-* > SHA256SUMS` → `softprops/action-gh-release@v2` publishes the 5 binaries + SHA256SUMS.

## npm packaging

- The npm package ships **only `dist/`** (`package.json` `files`). The standalone binaries live on GitHub Releases, not in the npm tarball — a ~96 MB executable in the tarball would bloat installs and trip antivirus heuristics.
- `prepublishOnly` runs `bun run build`, so `dist/` is always fresh at publish time.
- The package is **Bun-only**: it imports `bun:sqlite` and the `bin` shebang is `#!/usr/bin/env bun`. `bunx` / `bun add -g` work; `npx` / `npm i -g` only work if Bun is on `PATH`.

## Code conventions

- **Tabs** (4-wide), double quotes, trailing commas, LF, 100 col (Biome).
- **No obvious comments.** The existing ones explain "why" (introspection strategy, defense in depth, asset naming). Do not add redundant comments.
- **No emojis** unless the user asks.
- **Never commit secrets.** `.gitignore` already covers `.env`, `dist/`, `bin/`, `node_modules/`.
- Each command exports `registerXxx(program: Command): void`. No wiring logic inside `program.ts` beyond `register*` + `preAction` for global flags.
- `printError/printSuccess/printInfo` (`src/output/print.ts`) honor `--json` and `--no-color`. User-facing messages come from `src/i18n/messages.ts` via `t().…`. Manual/help comes from `src/i18n/help.ts`.

## `easysql demo` — local demo database

- Command: `src/commands/demo.ts` + a pure generator in `src/db/demo.ts`.
- Creates `$XDG_DATA_HOME/easysql/demo.db` (or `%LOCALAPPDATA%/easysql/demo.db`) with 4 deterministic tables (`customers`, `products`, `orders`, `order_items`). Re-running overwrites (idempotent).
- Registers it as the `local-demo` connector (idempotent via `upsertConnector`). The `.db` path stays in the local `connectors.json`, never on the API.
- `--no-register`: only writes the file, skips the API + `connectors-store` (useful for smoke tests).
- The TUI empty-state (`src/tui/repl.ts:105`) suggests `easysql demo` as the on-ramp.

## TUI (ink-based)

- `easysql` (no subcommand) opens an interactive React/ink shell (`src/tui/`).
- 4 screens: **Connectors**, **History**, **Question**, **Help** modal.
- Chrome (`src/tui/chrome.tsx`): **Header** with brand + active user email (via `me()`, cached in `config.json`) + connector + plan + version + API URL + online/offline status; **TabBar** as a segmented control (active tab in a cyan pill); **Footer** with contextual hints for the current screen and globals.
- **Active user:** `App` (`src/tui/app.tsx`) calls `client.me()` on mount, updates the header, and persists `user_email`/`user_name`/`plan_name` to config for offline rendering; login already writes those fields.
- Renders in the **alternate screen buffer** (vim/htop-style: fills the terminal and restores scrollback on exit). `mountTui` forces `interactive: true` in ink's `render()` — its auto-detection disables EVERYTHING if the `CI` env var is present in the user's shell (even on a real TTY), which made the TUI draw nothing and leave a black hole above the last frame. The `isatty()` gate in `repl.ts` already guarantees we only run on a TTY.
- **Shortcut model:** `Tab` / `Shift-Tab` cycle Connectors → History → Question (the only global navigation key). The **Question** screen renders the **result (ink table `ResultTable`) before the SQL**, the SQL with **syntax highlighting** (`SqlText`), and uses a **spinner** (`Spinner`) instead of static text during "Generating/Executing". Actions starting with `/`: typing `/` in the Question input opens a **filterable dropdown** of commands (`/help`, `/connectors`, `/history`, `/question`, `/clear`, `/sync`, `/usage`, `/quit`) — `↑/↓` select, `Enter` runs, `Esc` cancels. Ordinary characters (`1`, `2`, `3`, `q`, `?`) go straight to the buffer — `"which customer is 3 years old?"` is not interrupted.
- The **Question** screen uses a local `useInput` to build the text buffer and calls the same domain pipeline (`getSavedClient` → `createQuery` → `executeSelect` → `answerQuery` → `appendHistory`) — no duplicated logic.
- Keybindings:
  - Connectors: `j/k` or `↑/↓` navigate; `Enter` activates the highlighted connector or opens the add form when the last row ("+ Add a connector…") is selected; `s` syncs the highlighted connector; `d`/Del removes (confirm with `y`/Enter). In the form: `↑/↓` field, `←/→` type/SSL, `Enter` saves, `Esc` cancels.
  - Sync (Connectors `s` and Question `/sync`): `<ConnectorSync>` (`src/tui/screens/connector-sync.tsx`) re-introspects and calls `syncLocalConnector`; asks for an inline password for MySQL/Postgres (uses `$EASYSQL_DB_PASSWORD` if set), SQLite does not need one.
  - History: `h/l` or `←/→` paginate
  - Question: type the question, `Enter` submits, `Backspace` deletes; `/usage` shows plan/quota
  - Globals: `Tab` (next screen), `Shift-Tab` (previous), `Ctrl-C` (quit), `Esc` (close overlay)
  - Slash-prompt: filterable dropdown — `/help` `/quit` `/connectors` `/history` `/question` `/clear` `/sync` `/usage`
- Tests in `tests/tui.test.tsx` use `ink-testing-library` (PassThrough stdin).
- Without a TTY: `repl.ts` rejects with a message instructing `easysql query "..."`.

## Where to change things

| Task | File(s) |
|---|---|
| Add a subcommand | `src/commands/<name>.ts` + register in `src/cli/program.ts` + entry in `src/i18n/help.ts` + manual in `commands/help.ts` |
| Change UI text | `src/i18n/messages.ts` (`t()`) |
| Change help text | `src/i18n/help.ts` + map in `src/commands/help.ts` |
| Add a DB driver | new `@easysql/connector-*` dep + case in `openConnector()` in `src/db/introspect.ts` + `src/db/execute.ts` |
| Add an API endpoint | `RawSdk` + `AuthenticatedClient` + `getAuthenticatedClient` in `src/sdk/client.ts` |
| Change the persisted schema | `StoredConnector` in `src/config/connectors-store.ts` (migrate manually — no migration runner) |
| Add a history entry | `HistoryEntry` in `src/history/store.ts` + write in `appendHistory` from the command |

## Local verification

```bash
bun install --frozen-lockfile   # the lockfile is mandatory in CI
bun run check                   # biome + tsc --noEmit (lint+typecheck)
bun test                        # 117 specs (sqlite + demo + TUI included)
make build                      # tsc → dist/
make build-compile              # bun --compile → bin/easysql
./bin/easysql --help            # smoke
```

`.env.example` documents `EASYSQL_API_URL` (default `http://localhost:8787` in dev) and `EASYSQL_LOG_LEVEL`.

## Current state

- 117/117 tests passing (`bun test`).
- `bun run check` clean (minor `noExplicitAny` warnings in the SDK wrapper and 1 `useImportType` — non-blocking).
- Standalone binary `bin/easysql` already built (~92 MB).
- `bin/` and `dist/` are in `.gitignore` — do not commit.
- Public repo: https://github.com/Clearsoft-net/easysql-cli (branch `main`).
- SDK: modular `@easysql/*` v2.0.0 on npm (`client`, `common`, `schema-generation`, `connector-mysql/postgres/sqlite`), consumed via `^2.0.0`.
