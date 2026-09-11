# Contributing to EasySQL CLI

Thanks for your interest in improving the EasySQL CLI. This document covers the development workflow. For a deeper operational map of the codebase, see [AGENTS.md](AGENTS.md).

## Requirements

- [Bun](https://bun.sh) >= 1.1
- `git`
- (Optional) `tmux` + a Chrome/Chromium binary, to capture the TUI with `scripts/tui-capture.ts`

## Setup

```bash
git clone https://github.com/Clearsoft-net/easysql-cli
cd easysql-cli
bun install --frozen-lockfile
```

## Development workflow

```bash
bun run dev         # run the CLI from source (not the TUI; use src/bin.ts for that)
bun run check       # Biome + tsc --noEmit (must be clean before opening a PR)
bun test            # 117 specs
bun run test:watch  # watch mode
```

Build:

```bash
make build          # tsc → dist/
make build-compile  # bun build --compile → bin/easysql
```

`bin/` and `dist/` are generated and gitignored — never commit them.

## Conventions

- **TypeScript strict**, tabs (4-wide), double quotes, trailing commas, LF, 100 columns (Biome).
- **No obvious comments.** Only explain the "why" (e.g. introspection strategy, defense in depth).
- **No emojis** in code or UI strings unless explicitly requested.
- Each command exports `registerXxx(program: Command): void`; keep wiring out of `src/cli/program.ts` beyond `register*` + `preAction`.
- User-facing text lives in `src/i18n/messages.ts` (via `t()`) and `src/i18n/help.ts`.
- **Never commit secrets.** `.env`, `dist/`, `bin/`, and `node_modules/` are gitignored.

## Tests

- Add or update a test for every behavior change. Tests use `bun:test`, one file per module.
- TUI assertions use `ink-testing-library` (`tests/tui.test.tsx`).
- SQLite, demo and the SQL validator are covered end-to-end; prefer extending those patterns.

## Commits and pull requests

- Keep commits focused and write imperative, lowercase messages (e.g. `fix(tui): pin frame to terminal height`).
- Before opening a PR: `bun run check` and `bun test` must both pass.
- Describe the change, the motivation, and how you verified it. Attach a TUI screenshot when the change is visual (`bun run scripts/tui-capture.ts --png out.png`).
- CI runs lint, typecheck, tests, build and a compiled-binary smoke test on every push/PR to `main`.

## Reporting bugs

Open an issue at https://github.com/Clearsoft-net/easysql-cli/issues with the CLI version (`easysql --version`), your OS, the command you ran and the full output. For security issues, follow [SECURITY.md](SECURITY.md) instead.
