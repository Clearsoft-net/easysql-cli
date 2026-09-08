# AGENTS.md

Contexto operacional do **easysql-cli** — CLI/TUI open-source para a plataforma EasySQL. Lê em 2 minutos para começar.

## O que é

CLI em TypeScript/Bun que faz: login, gerencia conectores locais MySQL/Postgres/SQLite (schema-only), executa queries em linguagem natural via EasySQL API, valida que o SQL gerado é SELECT-only, executa localmente e mostra resultados em tabela. Inclui TUI interativa, self-update via GitHub Releases e um `easysql demo` que gera uma base SQLite de exemplo para experimentação imediata.

**Princípio central:** credenciais de banco NUNCA saem do host. Só metadata de schema é enviada à API.

## Stack

- **Linguagem:** TypeScript 5.7 (strict, `noUncheckedIndexedAccess`)
- **Runtime:** Bun 1.3+ (engines: `bun >=1.1.0`, `node >=20`)
- **CLI framework:** commander 12 + manual help manual em `src/i18n/help.ts`
- **HTTP SDK:** `@clearsoft/easysql-sdk` (cliente openapi-fetch)
- **Drivers DB:** `mysql2 ^3.11` + `pg ^8.13` + SQLite via `bun:sqlite` (built-in)
- **Output:** `chalk 5` (auto-detect TTY), renderer de tabela próprio
- **Lint/format:** Biome 2.5 (`biome.json`, tabs, 100 col, LF, double quotes)
- **TUI:** `ink` 7 + `react` 19 (`ink-testing-library` em dev) — `easysql` sem subcomando abre React no terminal
- **Testes:** `bun test` (90 specs após EZSQL-46, sem dependência de vitest)
- **Build:**
  - `bun run build` → `tsc -p scripts/tsconfig.json` → `dist/`
  - `bun run build:compile` → `bun build --compile --minify` → `bin/easysql` (standalone ~92 MB)

## Comandos (entregue: 12/12 ACs EZSQL-38/45 + TUI EZSQL-46)

| Comando | Faz |
|---|---|
| `easysql login` | Autentica com API key (`--api-key` / `$EASYSQL_API_KEY` / `--non-interactive`, -y) |
| `easysql logout` | Limpa credenciais locais |
| `easysql demo` | Gera base SQLite local de exemplo e registra como `local-demo` |
| `easysql connector add` | Introspecta DB local, envia só schema à API (mysql/mariadb/postgresql/sqlite) |
| `easysql connector sync` | Re-extrai schema (atualmente: refazer `add` com mesmo nome) |
| `easysql connector list` | Lista conectores conhecidos pela API |
| `easysql query "<q>"` | Gera SQL e executa localmente (SELECT-only) |
| `easysql query "<q>" --generate-only` | Imprime SQL sem executar |
| `easysql usage` | Consumo de quota (chama `/v1/dashboard/stats`) |
| `easysql history` | Log local read-only (`history.jsonl`) |
| `easysql update [--check]` | Self-update via GitHub Releases |
| `easysql` (sem subcomando) | Abre REPL TUI interativo |

**Global flags:** `--api-url`, `--config`, `--json`, `--no-color`, `-v`, `-h`.

## Estrutura

```
src/
├── bin.ts                      # entrypoint do binário (slice argv do bun compile)
├── cli.ts                      # run(argv) — único lugar com try/catch global
├── index.ts                    # entrypoint público (re-exports para testes)
├── version.ts                  # VERSION/NAME/REPO (lidos de package.json)
├── cli/
│   ├── program.ts              # buildProgram() — registra subcomandos
│   ├── global-options.ts       # GlobalOptions type + DEFAULT_API_URL
│   └── errors.ts               # CliError + NotLoggedInError/NetworkError/ApiError
├── commands/
│   ├── login.ts                # registerLogin(program)
│   ├── logout.ts
│   ├── demo.ts                 # easysql demo — gera SQLite local de exemplo
│   ├── connector.ts            # grupo add|sync|list (mysql/mariadb/postgresql/sqlite)
│   ├── query.ts                # registerQuery
│   ├── usage.ts
│   ├── history.ts
│   ├── update.ts
│   ├── help.ts                 # easysql help [command] — manual
│   └── stubs.ts                # vazio (placeholder legado)
├── config/
│   ├── paths.ts                # XDG-aware: getConfigDir/getConfigPath/getDataDir/getHistoryPath
│   ├── store.ts                # loadConfig/saveConfig/clearConfig/isLoggedIn (0600)
│   └── connectors-store.ts     # CRUD dos conectores locais (0600, sem password)
├── db/
│   ├── schema.ts               # tipos ColumnSchema/TableSchema/ConnectorSchema + DatabaseType
│   ├── introspect.ts           # dispatcher mysql/mariadb/postgresql/sqlite
│   ├── introspect-mysql.ts     # mysql2 + information_schema
│   ├── introspect-postgres.ts  # pg + pg_catalog
│   ├── introspect-sqlite.ts    # bun:sqlite + sqlite_master + PRAGMA
│   ├── demo.ts                 # buildDemoDatabase() — sample customers/products/orders
│   ├── parse-url.ts            # parseConnectionUrl() + mergeConnection() (sqlite:/// aceito)
│   └── execute.ts              # executeSelect() com validateSelectOnly() antes
├── sdk/
│   └── client.ts               # wrapper do @clearsoft/easysql-sdk + resolveApiUrl()
├── types/
│   └── bun-sqlite.d.ts         # ambient declarations para bun:sqlite (sem @types/bun)
├── i18n/
│   ├── messages.ts             # strings de UI (errors/prompts/success/info)
│   └── help.ts                 # manual help (HELP_TOP/HELP_COMMANDS/HELP_DEMO/...)
├── output/
│   ├── print.ts                # print/printError/printSuccess/printInfo (JSON-aware)
│   └── table.ts                # renderResult(format, cols, rows): table|json|csv
├── history/
│   └── store.ts                # appendHistory/readHistory/clearHistory (jsonl, 0600)
├── tui/
│   ├── app.tsx                 # ink Router — chrome + screen slot + help modal
│   ├── chrome.tsx              # Header / TabBar / Footer estáticos
│   ├── mount.tsx               # wrapper JSX que chama ink render(<App />, alternateScreen)
│   ├── repl.ts                 # startRepl() — verifica TTY e delega ao mount
│   └── screens/
│       ├── connectors.tsx      # lista + j/k + Enter ativa
│       ├── history.tsx         # lista paginada de HistoryEntry
│       ├── question.tsx        # input + generate SQL + execute + render tabela
│       └── help.tsx            # modal de keybindings
├── update/
│   └── self-update.ts          # fetchLatestRelease/findAsset/atomicReplace/selfUpdate
└── util/
    ├── prompt.ts               # promptSecret/promptLine/promptLineDefault (raw mode + TTY-aware)
    └── sql-validator.ts        # validateSelectOnly() — defesa em profundidade
scripts/
├── build.ts                    # tsc OU bun --compile
├── release-binaries.ts         # builda linux/darwin/windows x x64/arm64 → bin/easysql-*
└── tsconfig.json               # extends ../tsconfig.json, outDir=../dist
tests/                          # bun:test — 1 arquivo por módulo + _helpers.ts
.github/workflows/
├── ci.yml                      # push/PR em main → lint+typecheck+test+build+smoke
└── release.yml                 # tag v*.*.* → build binários + SHA256SUMS + release
```

## Segurança (não negociável)

- **Schema-only:** `introspectDatabase()` retorna só `{tables, columns, types, pks, fks, rows_approx}`.
  Passwords, hosts e ports NUNCA cruzam o limite do processo.
- **Password nunca persistido.** `$XDG_CONFIG_HOME/easysql/connectors.json` guarda só `name/type/host/port/user/database/ssl`. A senha é re-prompted (ou `$EASYSQL_DB_PASSWORD`) em toda execução de query.
- **API key em `config.json` com `0600`.** chmod é best-effort no Windows.
- **SQL validator local** (`src/util/sql-validator.ts`): tokenizer + regex, antes de tocar no DB local. Server-side já enforça, isto é defense-in-depth.
- **Stacked statements rejeitados**, só um `;` terminal permitido, head precisa ser `WITH|SELECT|EXPLAIN|SHOW`.
- **SQLite connectors não têm credenciais.** A única coisa que sai da máquina é o schema; o `file` path fica em `connectors.json` localmente (e nunca é enviado à API — só `{type: "sqlite", name, schema}`).

## Storage layout (XDG)

| Arquivo | Conteúdo | Permissões |
|---|---|---|
| `~/.config/easysql/config.json` | `{api_url, api_key, last_login_at}` | 0600 |
| `~/.config/easysql/connectors.json` | array `StoredConnector[]` (sem password) | 0600 |
| `~/.local/share/easysql/history.jsonl` | uma entrada JSON por linha, append-only | 0600 |
| Windows: `%APPDATA%\easysql\` + `%LOCALAPPDATA%\easysql\` | mesmo esquema, chmod é no-op | — |

Override via `--config <path>` (atua em `getConfigPath()`). Diretório: `$XDG_CONFIG_HOME` ou `~/.config`.

## Exit codes (`src/cli.ts:6-11`)

- `0` sucesso
- `1` erro genérico / commander parse
- `2` não autenticado (`NotLoggedInError`)
- `3` erro de rede (`NetworkError`)
- `4` erro de API (`ApiError`)
- `5` violação de safety (mutação rejeitada localmente)

## SDK — como a CLI consome a API

- `src/sdk/client.ts` é a única ponte para `@clearsoft/easysql-sdk`.
- `resolveApiUrl()`: `--api-url` > `$EASYSQL_API_URL` > config salvo > `https://api.easysql.net`.
- `getAuthenticatedClient(key, url)` retorna `AuthenticatedClient` (interface manual espelhando o SDK).
- `getSavedClient()`: throws `NotLoggedInError` se sem config; usado por `query`/`usage`/`connector`/`history`.
- `login` valida chamando `me()` antes de persistir; 401/403 → erro de chave inválida.
- `createQuery` retorna `{id, sql_generated, needs_local_execution, status}`; `query.ts` lê `sql_generated`, executa localmente e depois chama `answerQuery` (POST `/v1/queries/:id/answer`) com `result_data: result.rows` para a API gerar answer+chart.
- `syncConnector` (a partir do SDK 1.1.0) passou a exigir body `{schema: TableSchema[]}`; `connector.ts:282` ainda rejeita `--id` com erro explícito — quando for implementar sync-by-name, esse é o lugar.

## Self-update

- Feed: `https://api.github.com/repos/Clearsoft-net/easysql-cli/releases/latest`
- Asset naming: `easysql-<platform>-<arch>` (linux/darwin x x64/arm64 + windows-x64)
- `currentPlatform()` resolve de `node:os` (arch = `arm64` ou `x64`)
- `atomicReplace()` usa `renameSync` (POSIX atomic se mesmo FS) — `bin/<exe>.easysql-update.tmp` é escrito antes
- Versão atual vem de `package.json` (via `src/version.ts`), com import `with { type: "json" }`

## Build & release pipeline

- **CI** (`.github/workflows/ci.yml`): `bun install --frozen-lockfile` → `lint` → `typecheck` → `test` → `build` → `build:compile` → `./bin/easysql --version` smoke.
- **Release** (`.github/workflows/release.yml`): em push de tag `v*.*.*` ou manual dispatch → `check` + `test` + `scripts/release-binaries.ts` → `sha256sum bin/easysql-* > SHA256SUMS` → `softprops/action-gh-release@v2` publica os 5 binários + SHA256SUMS.

## Convenções de código

- **Tabs** (4-wide), double quotes, trailing commas, LF, 100 col (Biome).
- **Sem comentários óbvios.** Os existentes explicam "porquê" (estratégia de introspecção, defesa em profundidade, naming de assets). Não adicionar comments redundantes.
- **Sem emojis** a menos que o usuário peça.
- **Não commitar secrets.** `.gitignore` já cobre `.env`, `dist/`, `bin/`, `node_modules/`.
- Cada comando exporta `registerXxx(program: Command): void`. Nenhuma lógica de wiring dentro de `program.ts` além de `register*` + `preAction` para flags globais.
- `printError/printSuccess/printInfo` (`src/output/print.ts`) respeitam `--json` e `--no-color`. Mensagens user-facing vêm de `src/i18n/messages.ts` via `t().…`. Manual/help vem de `src/i18n/help.ts`.

## `easysql demo` — banco de demonstração local

- Comando: `src/commands/demo.ts` + gerador puro em `src/db/demo.ts`.
- Cria `$XDG_DATA_HOME/easysql/demo.db` (ou `%LOCALAPPDATA%/easysql/demo.db`) com 4 tabelas determinísticas (`customers`, `products`, `orders`, `order_items`). Re-rodar sobrescreve (idempotente).
- Registra como conector `local-demo` (idempotente via `upsertConnector`). O caminho do `.db` fica no `connectors.json` local, nunca na API.
- `--no-register`: só escreve o arquivo, pula API + `connectors-store` (útil para smoke tests).
- TUI empty-state (`src/tui/repl.ts:105`) sugere `easysql demo` como on-ramp.

## TUI (ink-based)

- `easysql` (sem subcomando) abre um shell interativo com React/ink (`src/tui/`).
- 4 telas: **Connectors**, **History**, **Question**, **Help** modal.
- Chrome (`src/tui/chrome.tsx`): **Header** com nome + versão + conector + URL da API + status online/offline; **TabBar** com `◀` / `▸` / `▶` setas sinalizando a posição e a tela ativa destacada em negrito; **Footer** com hints contextuais da tela atual e globais.
- Renderiza em **alternate screen buffer** (vim/htop-style: ocupa o terminal e restaura o scrollback ao sair). `mountTui` força `interactive: true` no `render()` do ink — a auto-detecção dele desativa TUDO se a env var `CI` existir no shell do usuário (mesmo em TTY real), o que fazia a TUI não desenhar nada e deixar um buraco preto acima do último frame. O gate de `isatty()` em `repl.ts` já garante que só rodamos em TTY.
- **Modelo de atalhos:** `Tab` / `Shift-Tab` ciclam entre Connectors → History → Question (única tecla de navegação global). Ações que começam com `/`: digitando `/` no input da Question screen abre um mini slash-prompt que aceita `/help`, `/quit`, `/connectors`, `/history`, `/question`, `/clear`. Caracteres comuns (`1`, `2`, `3`, `q`, `?`) passam direto pro buffer — `"qual o cliente tem 3 anos?"` não é interrompido.
- O **Question** screen usa `useInput` local pra montar o buffer de texto e chama o mesmo pipeline de domínio (`getSavedClient` → `createQuery` → `executeSelect` → `answerQuery` → `appendHistory`) — não duplica lógica.
- Keybindings:
  - Connectors: `j/k` ou `↑/↓` navegam, `Enter` ativa
  - History: `h/l` ou `←/→` paginam
  - Question: digita a pergunta, `Enter` envia, `Backspace` apaga
  - Globais: `Tab` (próxima tela), `Shift-Tab` (anterior), `Ctrl-C` (quit), `Esc` (fecha overlay)
  - Slash-prompt: `/help` `/quit` `/connectors` `/history` `/question` `/clear`
- Tests em `tests/tui.test.tsx` usam `ink-testing-library` (PassThrough stdin).
- Sem TTY: `repl.ts` rejeita com mensagem instruindo `easysql query "..."`.

## Onde mexer para cada coisa

| Tarefa | Arquivo(s) |
|---|---|
| Adicionar subcomando | `src/commands/<name>.ts` + registrar em `src/cli/program.ts` + entrada em `src/i18n/help.ts` + manual em `commands/help.ts` |
| Mudar texto de UI | `src/i18n/messages.ts` (`t()`) |
| Mudar texto de help | `src/i18n/help.ts` + map em `src/commands/help.ts` |
| Adicionar driver DB | `src/db/introspect-<name>.ts` + caso em `src/db/introspect.ts` + `execute-<name>` em `src/db/execute.ts` |
| Adicionar endpoint de API | `RawSdk` + `AuthenticatedClient` + `getAuthenticatedClient` em `src/sdk/client.ts` |
| Mudar schema persistido | `StoredConnector` em `src/config/connectors-store.ts` (migrar manualmente — sem migration runner) |
| Adicionar entry de history | `HistoryEntry` em `src/history/store.ts` + escrever em `appendHistory` no comando |

## Verificação local

```bash
bun install --frozen-lockfile   # lockfile é obrigatório no CI
bun run check                   # biome + tsc --noEmit (lint+typecheck)
bun test                        # 97 specs (sqlite + demo + TUI inclusos)
make build                      # tsc → dist/
make build-compile              # bun --compile → bin/easysql
./bin/easysql --help            # smoke
```

`.env.example` documenta `EASYSQL_API_URL` (default `http://localhost:8787` em dev) e `EASYSQL_LOG_LEVEL`.

## Estado atual

- 97/97 testes passando (`bun test`).
- `bun run check` limpo (warnings menores de `noExplicitAny` em SDK wrapper e 1 `useImportType` — não bloqueiam).
- Binário standalone `bin/easysql` já construído (~92 MB).
- `bin/` e `dist/` estão no `.gitignore` — não comitar.
- Repo público: https://github.com/Clearsoft-net/easysql-cli (branch `main`).
- SDK: `@clearsoft/easysql-sdk` no npm, consumido via dep semver `^1.1.0` (1.1.0 introduziu `type: "sqlite"` em `ConnectorCreate`, renomeou o campo de SQL de `sql` → `sql_generated`, e adicionou `POST /v1/queries/:id/answer`).
