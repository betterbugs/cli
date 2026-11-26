# BetterBugs CLI

Read, file and act on [BetterBugs](https://betterbugs.io) bug reports from your terminal, CI pipelines and coding agents.

```bash
npm install -g @betterbugs/cli

betterbugs auth login                        # log in through your browser
betterbugs list bugs --status open --since 7d
betterbugs get bug <id>                      # summary, environment and the most useful signals
betterbugs pull <id>                         # the whole report as files, for you or an agent
betterbugs comment <id> "Root cause: …"
betterbugs update <id> --status resolved
```

The package installs the same CLI under three names: **`betterbugs`**, **`bbug`** and **`bb`**.
Use whichever you like day to day; scripts and docs use `betterbugs`.

## Install

**npm** (Node.js 20.18.1 or newer):

```bash
npm install -g @betterbugs/cli
```

**Homebrew:**

```bash
brew install betterbugs/tap/betterbugs
```

**Run without installing:**

```bash
npx @betterbugs/cli --help
```

`get frames` uses [ffmpeg](https://ffmpeg.org) if it is installed; everything else needs nothing extra.

> **`bb` already taken?** If another tool (for example Babashka) owns `bb`, npm may refuse to install over it.
> `bbug` and `betterbugs` always work, and `betterbugs alias install` adds `bb` as a shell alias instead.

## Log in

```bash
betterbugs auth login       # opens BetterBugs in your browser; click "Activate"
betterbugs whoami
```

For CI and other non-interactive use, create a token (`betterbugs create token`, or in the web app under
Settings → Access tokens) and pass it on **stdin**. Tokens are never accepted as command-line arguments.

```bash
echo "$BETTERBUGS_TOKEN" | betterbugs auth login --token
```

On a machine without a browser, `BETTERBUGS_NO_BROWSER=1 betterbugs auth login` prints the URL to open elsewhere.

Pin a workspace and project for a repository so you don't have to pass `--workspace` / `--project` every time:

```bash
betterbugs init             # writes ./.betterbugs.json
```

## What you can do

**Read bugs**

- `list bugs` with filters: `--status`, `--since`, `--assignee`, `--filter <saved filter>`, `--watch` for live updates
- `get bug <id>`, plus `get console`, `get network`, `get steps`, `get env`, `get comments`, `get screenshots`, `get video`, `get replay` and more
- `export bugs --format json` or `--format csv`

**Work on bugs**

- `comment <id> "text"`, with `--at <ms>` to point at a moment in the recording
- `update <id> --status resolved`, `--assignee`, `--priority`, tags
- `link bug`, `move bug`, `archive bug`, `share bug`
- `push <id> --to jira` (also Linear, GitHub, GitLab, Asana, ClickUp, Trello, Notion, Azure DevOps, Basecamp, Zoho,
  ProofHub, Bugasura, Slack and Microsoft Teams)

**File bugs**

- `create bug --title … --attach file.har`, or from a JSON payload
- `create bug --from-playwright test-results/` files one report per failed Playwright test, with traces and screenshots
- `--dedupe-key` updates the same report on reruns instead of filing duplicates
- Console logs, network logs and text attachments are **redacted before upload**

**Debug and verify**

- `repro <id> --framework playwright` generates a reproduction test
- `comment <id> --from-test-result result.json` records that a fix was verified
- `debug <id>`, `ask <id> "…"` and `generate steps` use BetterBugs AI

**Manage**

Workspaces, projects, members, saved filters, recording links, integrations, webhooks, OAuth apps, access tokens and
billing. Run `betterbugs --help` or `betterbugs <command> --help` for everything.

## For coding agents

`betterbugs pull <id>` writes the report to `.betterbugs/<id>/` as plain files an agent can read: a `README.md` to start
from, the bug, environment, console log, `network.har`, steps, comments and screenshots. Credentials are redacted by
default.

Install the bundled agent skills (debug a bug, file a report, prove a fix) for Claude Code, Cursor, Codex or OpenCode:

```bash
betterbugs skills install                       # Claude Code
betterbugs skills install --target cursor,codex
```

`betterbugs agent-context --json` describes every command, flag, value and output shape as JSON.

## Scripting and CI

- Add `--json` for stable JSON output. It is the default for read commands when stdout isn't a terminal.
- Destructive commands ask for confirmation; pass `--yes` in scripts.
- Exit codes are stable: `0` ok, `1` error, `2` usage, `3` not logged in, `4` forbidden or missing scope,
  `5` not found, `6` rate limited, `7` network, `8` plan limit, `9` validation, `10` partial, `11` not ready,
  `13` missing dependency, `130` cancelled.

Guides:

- [CI recipes](https://github.com/betterbugs/cli/blob/main/docs/ci.md): GitHub Actions, GitLab CI and CircleCI
- [Git hooks](https://github.com/betterbugs/cli/blob/main/docs/hooks.md): check bug references in commit messages
- [Cookbook](https://github.com/betterbugs/cli/blob/main/docs/cookbook.md): automation built on `--json`

## Shell completion

```bash
echo 'eval "$(betterbugs completion zsh)"' >> ~/.zshrc     # after compinit
echo 'eval "$(betterbugs completion bash)"' >> ~/.bashrc
betterbugs completion fish > ~/.config/fish/conf.d/betterbugs.fish
```

PowerShell: add `betterbugs completion powershell | Out-String | Invoke-Expression` to your `$PROFILE`.

## Configuration

- `betterbugs config set <key> <value>` for your user config, `--local` for `./.betterbugs.json`
- `--profile <name>` switches between saved logins (several accounts)
- `betterbugs config set credential-store keychain` keeps tokens in the OS keychain instead of a file
- `betterbugs doctor` checks your setup

## Security

- Credentials are stored with owner-only permissions, or in the OS keychain if you opt in.
- Console logs, network logs and attachments are redacted before they are uploaded, printed or written to disk.
- Browser login uses PKCE and a callback bound to `127.0.0.1` only.
- Output to a terminal is stripped of escape sequences that bug data could carry.

## Upgrade and uninstall

```bash
betterbugs upgrade          # npm install -g @betterbugs/cli@latest
betterbugs uninstall        # removes saved logins and config, then the package
```

## License

MIT
