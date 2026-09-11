# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities through GitHub's private vulnerability reporting: go to the repository's **Security** tab and click **Report a vulnerability**. If that is not available, open a minimal issue asking for a private contact channel without disclosing details.

Include, when possible:

- A description of the issue and its impact.
- Steps to reproduce (CLI version, OS, command, observed vs expected behavior).
- Any proof of concept, logs or screenshots.

We aim to acknowledge reports within a few business days.

## Scope

This repository covers the open-source `easysql-cli` (the npm package `@clearsoft/easysql-cli` and the standalone GitHub Releases binaries). The EasySQL API and dashboard are out of scope here.

## Security model

The CLI is designed around one invariant: **database credentials never leave the host.**

- Only schema metadata is sent to the API (`tables`, `columns`, `types`, `primary_keys`, `foreign_keys`, `row_count_estimate`). Passwords, hosts and ports are never transmitted.
- Database passwords are never persisted to disk. They are re-prompted — or read from `$EASYSQL_DB_PASSWORD` — on each query run.
- The EasySQL API key is stored in `~/.config/easysql/config.json` with `0600` permissions (best-effort on Windows).
- Generated SQL is validated server-side, and the CLI additionally rejects any non-SELECT statement before touching the local database (defense in depth).
- SQLite connectors carry no credentials at all; the file path stays in the local `connectors.json`.

## Supported versions

Security fixes are applied to the latest released version. Please upgrade with `easysql update` before reporting.
