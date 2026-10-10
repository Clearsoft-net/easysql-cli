# Capturing the TUI and converting to GIF

How to record the TUI (`easysql` with no subcommand) or any CLI command as a
replayable **terminal cast** (`.cast`) and turn it into a **GIF**.

The tool is the dev helper `scripts/tui-cast.ts`. It reuses the same key
driver as `scripts/tui-capture.ts`, but instead of capturing a single frame it
records the whole session with `asciinema`.

## Prerequisites

| Dependency | Purpose | Install |
|---|---|---|
| `tmux` | provides the PTY the TUI runs in (it requires a real TTY) | system package |
| `asciinema` 3.x | records the PTY → `.cast` | `cargo install asciinema` |
| `agg` | converts `.cast` → GIF (optional) | `cargo install --git https://github.com/asciinema/agg --locked` |
| a local connection | the Question screen needs one | `bun run src/bin.ts demo` (registers `local-demo`) |

> `cargo install` puts the binaries in `~/.cargo/bin`, which is **not** on
> `PATH` by default. Either use the full path (`~/.cargo/bin/asciinema`) or run
> once per shell: `export PATH="$HOME/.cargo/bin:$PATH"`.

## How it works

```
┌─ tmux pane (size = --size) ─────────────────────────────────────────────┐
│  $ asciinema rec --command "bun run src/bin.ts" ... /tmp/q.cast          │
│       │                                                                  │
│       └─► own PTY ──► bun run src/bin.ts  (the ink TUI)                  │
│                          ▲                                               │
└──────────────────────────┼──────────────────────────────────────────────┘
   tmux send-keys          │  (keys/tokens: "$Tab", "quantos...", "$Enter")
                           │
                 scripts/tui-cast.ts
```

1. The helper creates a tmux pane of the requested size and runs
   `asciinema rec --command "<cmd>" <out>.cast` in it. `asciinema` allocates its
   own PTY, runs the command inside it, and records all of the process output.
2. The helper sends the **keys/tokens** into the PTY via `tmux send-keys`
   (tokens starting with `$` are tmux key names — `$Tab`/`$Enter`/`$C-c`;
   anything else is sent as literal text). Because the TUI runs inside
   `asciinema`'s PTY, it receives the keys normally and sees a real TTY
   (alternate screen included).
3. Before quitting, the helper waits for the `--settle` marker (by default the
   text `Generating`) to **leave the screen** — that is how the cast ends with
   the query result already rendered instead of cutting off on the spinner.
4. It sends `--quit` (default `C-c`) so the TUI exits; `asciinema` then
   finalizes and writes the `.cast` file.
5. The helper confirms completion by watching the pane's foreground process
   (`#{pane_current_command}` goes from `asciinema` to `sleep`) and kills the
   session.

### File format

The `.cast` is [asciicast v3](https://docs.asciinema.org/manual/asciicast/v3/):
a header line (JSON with `cols`/`rows`/`title`/`command`) followed by events
`[time, "o", "data"]` (output) — the same ANSI bytes the TUI emits.

> **Alternate screen:** the TUI draws in the alternate buffer and restores it
> on exit. So `asciinema convert <file> <file>.txt` comes out **empty** (the
> final frame is the already-restored primary screen). The `.cast` plays fine
> in `asciinema play`, on asciinema.org and in `agg` — just don't expect a text
> dump.

## Recording the TUI answering a question

```sh
bun run scripts/tui-cast.ts --out /tmp/q.cast 'quantos clientes temos?' '$Enter'
```

Validated output (captured question → spinner → result):

```
Question
quantos clientes temos?

1 row(s) in 0ms
┌─────────────────┐
│ total_customers │
├─────────────────┤
│ 5               │
└─────────────────┘

SQL: SELECT COUNT(*) AS total_customers FROM customers LIMIT 100
```

## Recording a one-shot command

Commands that exit on their own (e.g. `query --generate-only`, `usage`) don't
need the `C-c`; pass `--quit none`:

```sh
bun run scripts/tui-cast.ts \
  --cmd 'bun run src/bin.ts query "quantos clientes?" --generate-only' \
  --quit none --out /tmp/q.cast
```

## Options

| Option | Default | Description |
|---|---|---|
| `--out <path>` | `/tmp/easysql-demo.cast` | output `.cast` file |
| `--cmd <cmd>` | `bun run src/bin.ts` | command run inside the recording |
| `--settle <text>` | `Generating` | wait for this text to leave the screen before `--quit` (captures the result); `''` disables |
| `--quit <key>` | `C-c` | tmux key that ends the TUI; `none` for commands that exit on their own |
| `--format v2\|v3` | `v3` | asciicast format |
| `--size WxH` | `100x26` | pane/recording geometry (drives the layout) |
| `--title <t>` | `EasySQL CLI` | title in the metadata |
| `--idle <s>` | `2` | `--idle-time-limit` (compresses pauses on playback) |
| `--wait ms` | `1500` | initial wait (TUI boot) before the keys |
| `--per-key ms` | `350` | pause after each key |
| `--hold ms` | `1500` | final pause before quitting |
| `--timeout ms` | `15000` | cap for `--settle` and for end detection |
| `--capture-input` | off | also record typed keys (mind secrets) |
| `--asciinema <path>` | auto | asciinema binary (otherwise `$ASCIINEMA`/`which`/`~/.cargo/bin`) |
| `--session <name>` | `easysql-cast` | tmux session name |
| `--keep` | off | don't kill the session (manual inspection) |

The positional **tokens** are sent in order; those starting with `$` are tmux
keys (`$Tab`, `$BTab`, `$Enter`, `$Escape`, `$Up`, `$Down`, `$Left`, `$Right`,
`$C-c`, `$BSpace`); any other value is sent as literal text.

## Converting to GIF (`agg`)

```sh
# full path if ~/.cargo/bin is not on PATH
~/.cargo/bin/agg /tmp/q.cast /tmp/q.gif

# pin the font (avoids the default falling back and warning about emoji)
~/.cargo/bin/agg --font-family "Source Code Pro" --font-size 16 /tmp/q.cast /tmp/q.gif
```

Example output: `GIF image data, version 89a, 979 x 605` (~43 KB).

Useful `agg` flags:

| Flag | Effect |
|---|---|
| `--font-family "<mono font>"` | pin the monospace font (e.g. `Source Code Pro`, `Liberation Mono`) |
| `--font-size <px>` | font size (default 16) |
| `--theme <name>` | theme (`asciinema`, `dracula`, `nord`, `monokai`, …) |
| `--speed <x>` | speed playback up/down |
| `--last-frame-duration <s>` | how long the last frame holds |

To list installed mono fonts: `fc-list :mono family | sort -u`.

## Playing without converting

```sh
~/.cargo/bin/asciinema play /tmp/q.cast
```

## Gotchas

- **PATH:** `asciinema` and `agg` come from `~/.cargo/bin` (not the system one —
  Fedora uses `/usr/bin/cargo`). Use the full path or export `PATH`.
- **Alternate screen:** converting to `.txt` comes out empty (see above); use
  the `.cast`/`.gif`.
- **Result missing?** Raise `--timeout` (SQL generation can take over 9 s) or
  adjust `--settle` to your version's loading-state text.
- **Blank frame:** raise `--wait` (the TUI may not have booted) and confirm the
  command is `bun run src/bin.ts`.

## Verification

```sh
bun run check                                   # lint + typecheck (the helper is TS)
bun run scripts/tui-cast.ts --out /tmp/smoke.cast \
  --cmd 'bun run src/bin.ts --version' --quit none
```