---
name: tui-capture
description: Inspeciona e opera a TUI interativa (ink) do easysql-cli como um usuário real — renderiza num PTY via tmux e captura o frame. Use ao verificar/validar layout, telas, keybindings, bugs visuais ou o fluxo de query da TUI sem um terminal humano, via scripts/tui-capture.ts.
---

# Ver e operar a TUI do easysql como um agente

A TUI (`easysql` sem subcomando) exige um TTY real: `src/tui/repl.ts` rejeita
stdin/stdout que não sejam TTY, e ink escreve na alternate screen. Para um
agente inspecioná-la, rode-a dentro de um PTY (tmux) e leia o frame com
`tmux capture-pane`. O helper `scripts/tui-capture.ts` automatiza isso.

## Pré-requisitos

- `tmux` instalado (`command -v tmux`).
- Dependências instaladas (`bun install`).
- Pelo menos um conector local, senão a tela Question mostra
  "No connection selected". Gere um com `bun run src/bin.ts demo` (registra
  `local-demo`), ou semeie `connections.json` manualmente.
- A TUI lê `~/.config/easysql/config.json` e `connections.json` reais —
  sem `--config`/`--api-url` aqui, então o frame reflete o estado da máquina.

> **Entrypoint correto:** `bun run src/bin.ts`. O script `dev` do
> `package.json` (`bun run src/cli.ts`) NÃO abre a TUI — `src/cli.ts` só
> exporta `run` e não executa nada.

## Uso do helper

```sh
bun run scripts/tui-capture.ts [opções] [tokens...]
```

| Opção | Default | Descrição |
|---|---|---|
| `--size WxH` | `120x30` | Geometria do pane (define o layout capturado) |
| `--wait ms` | `1200` | Espera inicial antes das teclas (boot da TUI) |
| `--per-key ms` | `350` | Espera após cada tecla (re-render) |
| `--session nome` | `easysql-capture` | Nome da sessão tmux |
| `--cmd "..."` | `bun run src/bin.ts` | Comando executado no pane |
| `--keep` | off | Não mata a sessão (para inspeção interativa) |
| `--ansi` | off | Captura com escapes ANSI (`capture-pane -e`) |
| `--png <path>` | off | Gera screenshot PNG (ANSI→HTML→Chromium headless) e imprime o path |
| `--font-size px` | `14` | Tamanho da fonte do PNG |
| `--scale n` | `2` | `--force-device-scale-factor` (2 = PNG 2x nítido) |
| `--chrome <path>` | auto | Binário do Chrome/Chromium (senão `CHROME_PATH` ou `which`) |
| `--keep-html` | off | Mantém o HTML intermediário do PNG (debug) |

Os `tokens` são enviados na ordem: começando com `$` = tecla tmux
(`$Tab`, `$BTab`, `$Enter`, `$Escape`, `$Up`, `$Down`, `$Left`, `$Right`,
`$C-c`, `$BSpace`); qualquer outra coisa = texto literal.

> **Screenshot:** `--png` renderiza o frame colorido num PNG e imprime o
> caminho absoluto — útil para anexar evidência visual de mudanças de UI.
> Requer um Chrome/Chromium no host. Ex.:
> `bun run scripts/tui-capture.ts --size 100x26 --png /tmp/tabs.png '$Tab'`.

### Exemplos por tela

```sh
# Question (default) — caixa de input + exemplos
bun run scripts/tui-capture.ts --size 100x26

# Connections — Tab uma vez
bun run scripts/tui-capture.ts --size 100x26 '$Tab'

# Connections → form de add ("Remember password" ON por padrão)
bun run scripts/tui-capture.ts --size 100x32 '$Tab' 'j' 'j' '$Enter'

# Connections → form de edição do 2º conector da lista
bun run scripts/tui-capture.ts --size 100x32 '$Tab' 'j' 'e'

# History — Tab duas vezes
bun run scripts/tui-capture.ts --size 100x26 '$Tab' '$Tab'

# Modal de ajuda — digitando "/" + "help" + Enter
bun run scripts/tui-capture.ts --size 100x26 '$/' help '$Enter'

# Dropdown de comandos aberto (só a barra)
bun run scripts/tui-capture.ts --size 100x26 '/'

# Dropdown filtrado por "he" (mostra /help)
bun run scripts/tui-capture.ts --size 100x26 '/' he

# Dropdown com a 3ª opção selecionada (↓↓)
bun run scripts/tui-capture.ts --size 100x26 '/' '$Down' '$Down'

# Digitar uma pergunta (não submete)
bun run scripts/tui-capture.ts --size 100x26 'quantos clientes temos?'

# Fluxo completo: pergunta + Enter (precisa API key e, se não-sqlite, senha)
bun run scripts/tui-capture.ts --wait 1500 --per-key 4000 'quantos clientes?' '$Enter'
```

## Gravar um cast (asciinema)

`scripts/tui-cast.ts` grava a sessão como um `.cast` real (asciicast v3),
rodando o comando sob `asciinema rec` dentro do pane tmux e dirigindo as
mesmas teclas do `tui-capture.ts`. Requer `asciinema` 3.x
(`cargo install asciinema`, ou `--asciinema <path>`).

```sh
# pergunta completa na TUI (espera o spinner "Generating" sumir e encerra)
bun run scripts/tui-cast.ts --out /tmp/q.cast 'quantos clientes temos?' '$Enter'

# comando one-shot (encerra sozinho; --quit none)
bun run scripts/tui-cast.ts --cmd 'bun run src/bin.ts query "quantos clientes?"' --quit none --out /tmp/q.cast

# tocar / gerar GIF (agg é opcional)
asciinema play /tmp/q.cast
agg /tmp/q.cast /tmp/q.gif
```

| Opção | Default | Descrição |
|---|---|---|
| `--out <path>` | `/tmp/easysql-demo.cast` | arquivo `.cast` de saída |
| `--settle <texto>` | `Generating` | espera esse texto sair da tela antes do `--quit` (captura o resultado); `''` desliga |
| `--quit <tecla>` | `C-c` | tecla tmux que encerra a TUI; `none` para comandos que terminam sozinhos |
| `--format v2\|v3` | `v3` | formato asciicast |
| `--title <t>` | `EasySQL CLI` | título no metadata |
| `--idle <s>` | `2` | `--idle-time-limit` (acelera pausas no playback) |
| `--wait/--per-key/--hold/--timeout ms` | 1500/350/1500/15000 | temporizações |
| `--cmd`, `--size`, `--session`, `--keep`, `--asciinema` | igual ao tui-capture | |

Tokens iguais aos do `tui-capture.ts` (`$Tab`, `$Enter`, `$C-c`, texto literal).
A TUI roda no alternate screen: converter para `.txt` sai vazio (o frame final
é a tela primária restaurada), mas o `.cast` toca normalmente em `asciinema play`,
asciinema.org e `agg`.

### Modo interativo (agente dirige a mesma sessão)

```sh
bun run scripts/tui-capture.ts --keep --size 120x30
tmux send-keys -t easysql-capture '$Tab'
tmux capture-pane -t easysql-capture -p
tmux kill-session -t easysql-capture
```

Sempre encerre a sessão ao terminar; `--keep` só existe para inspeção manual.

## Keybindings (para roteirizar teclas)

- **Globais:** `Tab` próxima tela · `Shift-Tab` (`$BTab`) anterior · `Ctrl-C`
  (`$C-c`) quit · `Esc` fecha overlay/slash.
- **Connections:** `j`/`k` ou setas navegam · `Enter` ativa o conector em
  destaque (ou abre o form de add quando a última linha "+ Add a connection…"
  está selecionada) · `e` abre o form de **edição** do conector em destaque ·
  `s` sincroniza o conector em destaque · `d`/Del remove (confirmação
  `y`/Enter, `n`/Esc). No form de add/edit: `↑`/`↓` campo, `←`/`→` ciclo de
  tipo / toggle SSL / toggle **Remember password** (padrão ON — grava a senha
  no keyring do SO sob o `uid` local do conector), `Enter` salva, `Esc` cancela. No
  edit, `name`/`type` ficam travados (identidade na API) e Password vazio
  mantém o valor armazenado.
- **Sync:** `s` (Connections) e `/sync` (Question) re-introspectam o conector
  ativo e reenviam o schema; MySQL/Postgres pedem a senha inline (ou usam
  `$EASYSQL_DB_PASSWORD`), SQLite não.
- **History:** `h`/`l` ou setas paginam.
- **Question:** qualquer texto entra no buffer · `Enter` submete · `Backspace`
  apaga · `?` e números são literais (não atalhos).
- **Slash (dentro da Question):** digitar `/` abre um **dropdown filtrável** de
  comandos (`/help`, `/connections`, `/history`, `/question`, `/clear`, `/sync`, `/usage`, `/login`, `/logout`, `/quit`).
  Digitar filtra; `↑`/`↓` (`$Up`/`$Down`) navegam a seleção; `Enter` executa;
  `Esc` cancela; `Backspace` edita. Aliases continuam aceitos ao digitar
  (`/c`,`/1` connections; `/h2`,`/2` history; `/q2`,`/3` question; `/cls` clear).

## Gotchas

- `tmux capture-pane -p` já lê a alternate screen — **não** use `-a` (retorna
  "no alternate screen").
- Nunca redirecione a saída da TUI (`>`, `|`) no pane: sem TTY em stdout o
  `startRepl` aborta com erro.
- O `useWindowSize()` do ink pega as dimensões do pane; `--size` muda o layout
  de verdade (útil para testar responsividade do header/tab bar).
- O teste `tests/tui.test.tsx` (ink-testing-library) é determinístico e sem
  PTY — use-o para asserções; use o tmux para ver "como o usuário vê".
- Se o frame sair em branco, aumente `--wait` (a TUI pode não ter bootado) ou
  confirme que o comando é `bun run src/bin.ts`.

## Verificação

```sh
bun run check                                   # lint + typecheck (o script é TS)
bun run scripts/tui-capture.ts --size 100x26    # deve imprimir o header + tabs
```

Ao alterar o entrypoint, keybindings ou o `mountTui` (`src/tui/`), atualize
esta skill e, se necessário, `AGENTS.md` (seção TUI).
