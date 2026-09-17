# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Clearsoft-net/easysql-cli/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/Clearsoft-net/easysql-cli/releases/tag/v0.1.0
