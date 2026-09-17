# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0]

### Added

- `make deb` / `make rpm` (and `make packages`) to build `.deb` and `.rpm` packages of the standalone Linux binary via `scripts/package-linux.ts`. `ARCH=arm64` cross-builds for arm64.
- The release workflow now attaches `amd64`/`arm64` `.deb` and `x86_64`/`aarch64` `.rpm` packages to each GitHub Release (arm64 built on a native `ubuntu-24.04-arm` runner, since `rpmbuild` rejects cross-architecture builds).

## [0.3.1]

### Fixed

- Subcommands are recognized again when the CLI is launched through the npm bin shim (`npx @easysql/cli`, global install): the extensionless `node_modules/.bin/easysql` path was leaking into commander and shifting the arguments.

## [0.3.0]

### Changed

- The CLI now runs on Node.js >= 22.13 as well as Bun >= 1.4 — `demo` uses `node:sqlite` and the `bin` shebang is `#!/usr/bin/env node`.
- Renamed the npm package to `@easysql/cli`.
- The release workflow now fails when the pushed tag does not match the `package.json` version.

## [0.2.0]

### Changed

- Migrated to the modular `@easysql/*` v2 SDK (`client`, `common`, `schema-generation`, `connector-mysql/postgres/sqlite`).
- `src/db` delegates introspection and execution to the SDK connectors; schema/URL contracts re-exported from `@easysql/common`.
- MySQL/PostgreSQL drivers are now `optionalDependencies`, lazy-loaded per engine — a missing package prints a `bun add` hint. SQLite stays required.

### Fixed

- TUI: cursor sits before the placeholder when empty and follows typed text; the submitted question is shown above result + SQL.

## [0.1.0]

### Added

- `easysql login` / `logout` with API-key authentication (`--api-key`, `$EASYSQL_API_KEY`, `--non-interactive`).
- `easysql demo` — generates a local sample SQLite database and registers it as `local-demo`.
- `easysql connector add|sync|list|remove` for MySQL, MariaDB, PostgreSQL and SQLite (schema-only introspection).
- `easysql query "<question>"` — natural-language → SQL via the EasySQL API, SELECT-only validation, local execution and table output. `--generate-only` prints the SQL without executing.
- `easysql usage`, `easysql history` and `easysql update` (self-update via GitHub Releases).
- Interactive ink-based TUI (Connectors, History, Question, Help) opened when running `easysql` with no subcommand.
- Standalone binaries for linux/darwin (x64, arm64) and windows-x64 via GitHub Releases.
- Local SQL validator (defense in depth) and XDG-compliant storage with `0600` permissions.

[Unreleased]: https://github.com/Clearsoft-net/easysql-cli/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.4.0
[0.3.1]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.3.1
[0.3.0]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.3.0
[0.2.0]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.1.0
