# betterbugs — the BetterBugs CLI

Read, file and act on BetterBugs bug reports from the terminal, CI pipelines and coding agents.
Built from the "BetterBugs CLI Engineering and Product Scope" document.

```bash
betterbugs auth login                 # browser login (or --token from stdin for CI)
betterbugs list bugs --status open --since 7d
betterbugs get bug <id>               # summary + ranked signals
betterbugs pull <id>                  # .betterbugs/<id>/ for an agent to navigate
betterbugs comment <id> "Root cause: …" --at 42100
betterbugs update <id> --status resolved
```

The package installs the same CLI under three names: `betterbugs`, `bbug` and `bb`. Scripts, CI and docs use `betterbugs`.

## Status

**Phase 1 (read path + agent enablement): implemented on the CLI side.**

| Area           | Commands                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth & setup   | `auth login` (browser, `--force`, `--login-timeout`, `--token`), `auth status` / `whoami`, `auth refresh`, `auth logout [--all] [--local]`, `auth token --print`, `init`, `config set\|unset\|list`, `doctor`, `agent-context` |
| Skills         | `skills list\|get\|source\|path\|install` (ships `betterbugs-debug`)                                                                                                                                                           |
| Lists          | `list workspaces`, `list projects`, `list bugs`, `list assignable-users`                                                                                                                                                       |
| Bug reads      | `get bug\|console\|network\|steps\|env\|metadata\|events\|comments\|screenshots\|video\|replay\|attachments\|activity\|viewers\|assignees`                                                                                     |
| Agent          | `pull`                                                                                                                                                                                                                         |
| Writes         | `comment`, `update`                                                                                                                                                                                                            |
| CLI management | `open`, `alias install`, `upgrade`, `uninstall`                                                                                                                                                                                |

**Phase 2 (write path and CI): implemented on the CLI side.**

| Area           | Commands                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --- | --- | ------------------------------------------------------------------------ |
| Filing bugs    | `create bug` (flags, `@payload.json` or `-`, `--from-playwright <dir>`, `--trim`, `--dedupe-key`), `attach`, `add console`, `add network`, `get feature-credits` |
| Comments       | `edit comment`, `delete comment`, `react`, `unreact`, `list reactions`                                                                                           |
| Tags           | `list tags`, `create tag`, `update tag`, `delete tag`                                                                                                            |
| Bug management | `move bug`, `archive bug`, `restore bug`, `delete bug`, `share bug`, `update privacy`; `update <id>` is now `update bug <id>` (the old form still works)         |
| Tokens         | `list tokens [--all] [--service]`, `get token`, `create token [--access read                                                                                     | write] [--expires 30d | 4w  | 6mo | 1y]`or`create token --service [--scopes]`, `delete token`, `list scopes` |
| SDK API keys   | `list api-keys`, `create api-key`, `regenerate api-key`, `expire api-key`, `delete api-key`                                                                      |
| CI             | `docs/ci.md` (GitHub Actions, GitLab and CircleCI recipes), skill `betterbugs-report`                                                                            |

**How `create bug` works:**

- It mirrors the extension:
  1. `POST …/bug`
  2. Upload the files to bb-api's authenticated `…/project/:projectId/bug/:id/files` route (older servers without it: `/upload/upload-bug-files/:id`)
  3. A finishing `PATCH` (this is what makes bb-api count the evidence, move files and fire `bug.created`)
- Console, network and steps are uploaded in the extension's evidence format (LOGS_VERSION 2), **redacted first**. Text attachments (`--attach` .har/.json/.log/.txt…) are redacted the same way unless `--no-redact`; binary files are uploaded as they are.
- `--dedupe-key` becomes a project-namespaced `idempotency-key`. bb-api updates the bug it created for that key instead of filing another.
- `--trim` uses a `videoTrimming` credit, the same as the extension. On the Free plan it exits 8 when none are left.

**Known gaps in Phase 2:**

- **`--since 12h` / `30m`:** bb-api filters whole UTC days; the CLI drops the extra rows locally (and warns).
- **Creation source:** with the bb-api `betterbugs-cli` branch (B7), bugs filed with the CLI's browser login or a personal / service token get `creationSource: CLI` (filter with `list bugs --source cli`). bb-api reads it from the session or token (`UserSession.isCli`), never from a header. Older servers file them as Chrome-extension captures.
- **Service-token attribution:** bb-api records the creating admin as the reporter of bugs filed with a service token; the CLI adds a "Filed by <service> (service token)" metadata line. A separate non-human reporter needs a product decision (seats, notifications).
- **Privacy is per project:** bb-api only stores privacy at project level, so `update privacy` sets it for the whole project.
- **Permanent delete:** OAuth and personal / service tokens can only move bugs to the trash, and `delete bug --permanent` is refused for them. A browser login is a normal BetterBugs session and follows the web app's rules.
- **Annotations:** `create bug --screenshot shot.png --annotations marks.json` draws `rect`, `arrow`, `line`, `highlight`, `redact` and `text` shapes into a PNG screenshot before upload. Only the annotated image is uploaded, so a `redact` box hides what is under it. Example: `[{"type":"redact","x":0,"y":0,"w":300,"h":40},{"type":"arrow","from":[500,300],"to":[420,220]},{"type":"text","x":420,"y":180,"text":"Total missing"}]`.

**Phase 3 (repro, verification, AI, links): implemented.**

| Area         | Commands                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Repro        | `repro <id> --framework playwright                                                                                                                    | selenium [--language] [--dry-run]`                                                                                                         |
| Verification | `comment --from-test-result <file> [--message]` (Playwright/Jest JSON, JUnit XML; records a verification + comment), `comment --reply-to <commentId>` |
| Links        | `link bug`, `unlink bug`, `add resource`, `remove resource`, `get links`                                                                              |
| AI           | `generate steps [--from-image                                                                                                                         | --from-video]`, `debug`, `ask`, `get chat`, `transcribe [--wait]`, `get transcription [--segments]`, `get video-analysis`, `analyze video` |
| Recording    | `get frames` (local ffmpeg; exit 13 if missing), `get chapters` (bb-api's chapters endpoint, X4; computed locally against older servers)              |
| Bulk / other | `export bugs --format json                                                                                                                            | csv`, `get backend-logs`, `list bugs --type --order-by --order`                                                                            |
| Distribution | `packaging/homebrew/betterbugs.rb`, skill `betterbugs-proof`                                                                                          |

**Not done in Phase 3:**

- **B13 (server-side redaction):** built as an opt-in, forward-only workspace setting (`set preferences server-redaction=on`, admins). It redacts the evidence of bugs created after it is turned on; stored evidence is never rewritten. The CLI still redacts before upload and before writing files.
- **OS keychain storage:** opt in with `betterbugs config set credential-store keychain` (or `BETTERBUGS_CREDENTIAL_STORE=keychain`). Tokens go to the macOS keychain or the Secret Service (`secret-tool`); on Windows they are DPAPI-encrypted. Secrets go to those tools on stdin, never as arguments. Switching moves saved logins, and `doctor` shows the store in use. On macOS the item is created by `/usr/bin/security`, so other programs running as you can read it through that tool without a prompt: it keeps tokens out of files and backups, but it is not a boundary against your own processes.
- **`get backend-logs`:** targets bb-api's backend-logs module, which only exists on the `sentry-cloudwatch-mcp` branch. On servers without it, the CLI says so.

**Phase 5 (ecosystem): implemented.** PDF Phase 4 (native recording) is still skipped, as agreed.

| Area             | What                                                                                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell completion | `completion bash                                                                                                                                                                                                                                                                 | zsh | fish | powershell`: commands, flags, flag values (statuses, priorities, enums, comma lists) and paths. Each Tab runs the hidden `\_\_complete`, which needs no login or network |
| Live updates     | `list bugs --watch [--events created,updated,ready,commented] [--max-events n]`: server-sent events from bb-api (backend item **X5**, `GET /workspace/:id/bug-events`). Resumes with Last-Event-ID; NDJSON in JSON mode; `ready` means the evidence is uploaded and safe to pull |
| Git hooks        | `check commit-msg <file>` (bug references exist), `check artifacts` (no `.betterbugs/` evidence staged); setups in `docs/hooks.md`                                                                                                                                               |
| Cookbook         | `docs/cookbook.md`: automation built on `agent-context` and `--json` (generated LLM tools, react to new bugs, routing, digests, closing the loop on merge, exports, exit codes)                                                                                                  |

**Phase 6 (account, workspaces, members, projects): implemented.**

| Area            | Commands                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Your account    | `get profile`, `update profile`, `change email` (codes to both inboxes; interactive), `get\|update\|reset notifications`, `get bug-count [--new]`, `list sessions`, `delete account --preview`                                                                                                                                                                              |
| Invitations     | `list invitations`, `accept invitation`, `decline invitation`, `join <invite-link>`, `leave workspace`, `leave project`, `list workspaces --joinable`                                                                                                                                                                                                                       |
| Workspaces      | `get workspace`, `create workspace`, `update workspace`, `archive\|restore workspace`, `enable\|disable workspace`, `get usage`, `get ai-credits`, `get dashboard [--assigned-to-me] [--all-projects]`, `list audit-logs`, `get\|set preferences [--me]`, `transfer ownership`                                                                                              |
| Domains, SSO    | `list domains`, `add domain`, `remove domain`, `verify domain [--wait]` (has the SDK or recorder loaded there?), `update sso`, `sync scim [--auto on\|off]`                                                                                                                                                                                                                 |
| Members         | `list members [--status] [--role] [--query]`, `invite member`, `resend invite`, `update member`, `remove member [--dry-run]`, `get\|update\|reset invite-link`, `request\|approve\|reject role-upgrade`, `update guest-approval`                                                                                                                                            |
| Projects        | `get project`, `create project`, `update project`, `enable\|disable project`, `archive\|restore project`, `delete project` (disable, archive, delete and `reset project-invite-link` need the project named as an argument or `--project`; they never fall back to the default project), `list projects --archived`, `get storage`, `mark seen`, `preview resolution-email` |
| Project members | `list project-members`, `add project-member`, `invite project-member`, `update project-member`, `remove project-member`, `request access`, `list access-requests`, `approve\|reject access-request`, `get\|update\|reset project-invite-link`                                                                                                                               |
| Saved filters   | `list filters`, `get filter`, `create filter`, `update filter`, `delete filter`, `list bugs --filter <id\|name>`. Stored in the web app's view format, so CLI filters and web views are the same objects                                                                                                                                                                    |
| Recording links | `list recording-links [--all-projects]`, `get recording-link`, `create recording-link [--title-template] [--reference]`, `update recording-link`, `delete recording-link`, `send recording-link-guide`, `list bugs --recording-link <id>`                                                                                                                                   |

**Deliberately web-only:** bb-api refuses apps and access tokens for deleting an account, deleting a workspace, and deleting a project permanently. `delete account`, `delete workspace` and `delete project --permanent` exit 4 and print the web page to do it. `archive workspace`, and `delete project` (trash for 30 days), work from the CLI.

**bb-api changes in Phase 6 (`betterbugs-cli` branch):**

- **X4 recording-link templates:**
  - Recording links gain `titleTemplate` and `reference` (Prisma fields; no migration on MongoDB).
  - Bugs recorded through a link get the rendered title and a "Reference" metadata row.
  - Responses carry `shareUrl`, built from the server's `RECORDING_LINK_ENDPOINT`.
- **Security fixes found while mapping the routes:**
  - Recording links were readable and editable by id from any workspace, including the bugs recorded through them. They are now scoped to the path workspace and the link's project.
  - Creating or moving a link now checks that its project is in the workspace.
  - A saved filter is reachable only through its own project, and a private one only by its owner.
  - Verified domains can only be deleted through their own workspace.
  - SCIM sync settings need a workspace admin, and the `workspace.sso` scope for tokens.
  - Account deletion refuses apps and tokens.
  - Service tokens can't act on their creator's account (`/auth` routes).
- **Bug fixes:**
  - `GET ai-credits` no longer fails when there is no preference row.
  - A reset user preference no longer swallows later saves.
  - Recording-link `expiresAt` sent as JSON is now validated.
  - Project API-key regenerate (`apiKey.reGenerate`) and `GET user-preference` (`workspace.getUserPreference`) needed scopes no plan granted, so they always failed for tokens and billing-enabled workspaces. Both scopes are now in the plans, and a spec fails if any route needs a scope that no plan grants.

**Not done in Phase 6:**

- **Avatars and logos:** there is no `--avatar` or `--logo`; image upload needs an authenticated upload route (B7).
- **Enable/disable for recording links:** bb-api has no route for it. Links are only disabled when their project is archived.
- **`--metadata` on recording links:** bb-api's `unchangedMetadata` drives the Intercom integration, so it stays server-set. Use `--reference` instead.
- **`send recording-link-guide`:** bb-api sends a fixed setup guide, not a particular link.
- **Account routes ignore OAuth scopes:** bb-api's `/auth` routes (profile, email change, leave, join) accept any login, even a read-only token. Adding `user.*` scopes there needs a product decision.

**Phase 7 (integrations and log sources): implemented.**

All 18 tools are described as data in `src/integrations/catalog.ts`: their lookups, push target and how they connect. The commands are generated from it.

| Area        | Commands                                                                                                                                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connections | `list integrations [--project-level]`, `connect <tool> [--wait]`, `disconnect <tool> [--all]`, `update integration-key proofhub\|bugasura`, `exclude project <p> --from <tool> [--undo]`, `list connected-projects`                                                                           |
| Lookups     | `list <tool>-<resource> [--limit] [--after]` (paged, 100 by default), e.g. `list jira-projects`, `list jira-fields --project-key WEB --type Bug`, `list github-labels --repo acme/shop`, `list linear-statuses --team ENG`, `list slack-channels` (`betterbugs agent-context` lists them all) |
| Push        | `push <bug> --to jira\|linear\|github\|gitlab\|asana\|clickup\|trello\|notion\|azure\|basecamp\|zoho\|proofhub\|bugasura\|slack\|msteams` with the tool's target flags, `--assignee`, `--label`, `--priority`, `--due`, `--parent`, `--field key=value`. Not pushed twice unless `--again`    |
| Automations | `set automation --tool <tool> [target flags] [--project-level] [--source web-sdk=all]`, `remove automation`, `list automation-overlaps`                                                                                                                                                       |
| Log sources | `connect cloudwatch --aws-account-id`, `test connection cloudwatch`, `get log-settings`, `update log-settings --region --log-group --time-range`, `list cloudwatch-log-groups`, `list cloudwatch-log-events`, `list sentry-projects`, `list sentry-issues`                                    |

**How connecting works:**

- **OAuth tools:** the provider redirects back to the web app, so `connect` opens the approval page in the browser. With `--wait` it waits until the connection exists.
- **API-key tools:** ProofHub and Bugasura read their key from stdin.
- **CloudWatch:** prints the external id for the IAM role.
- **Integration routes are called as bb-api version 12, as the web app does.** Below that, bb-api hides seven tools and turns project-level connects into workspace-level ones.
- **Lookups and pushes go through the bug's (or current) project,** so bb-api uses your project connection and falls back to your workspace one.

**bb-api changes in Phase 7:**

- **Basecamp could leak tokens.** Basecamp push sent the user's Basecamp token to any URL the caller supplied. It now only posts inside the user's own Basecamp accounts.
- **Scope checks restored:**
  - Basecamp's scope checks were commented out, so any BetterBugs token could use every Basecamp route. They are back on, and `basecamp.assignees` is in the plans.
  - Bugasura had no scope checks, and its exclude-project used `azure.excludeProject`. All its routes are now scoped; three read scopes were added to the plans.
  - ProofHub's `update-api-key` now needs `proofhub.update`.
- **Credentials no longer reach apps.** The integration lists returned your stored Jira, GitHub, Slack and other tokens and API keys to any app with read access. Apps and access tokens no longer get tokens, keys or secrets back; the web app is unchanged.
- **`gitlab/self-hosted` no longer echoes the OAuth client secret.**
- **Removing a workspace automation** could delete a project-level one; it is now limited to the workspace-wide automation.

**Known limits in Phase 7:**

- **OAuth connect needs a browser.** bb-api exchanges the code at the web app's fixed redirect URI.
- **GitLab self-managed** creates a row on every `self-hosted` call, and the row is unusable until the browser step completes (a bb-api behaviour, unchanged).
- **Pushes are not deduplicated by bb-api.** The CLI checks the bug's existing pushes before pushing.
- **Free plan push credits:** bb-api charges one credit even when a push fails.
- **Small bb-api quirks the CLI works around rather than fixes:**
  - Asana `--section` is sent as a My Tasks section.
  - ClickUp ignores a parent task.
  - Zoho list routes return 500 when Zoho is not connected.
  - GitHub, GitLab, Asana and ClickUp swallow provider errors; the CLI reports "did not create the issue".
- **Webhook CRUD and deliveries** are Phase 8.

**Phase 8 (webhooks, OAuth apps, billing): implemented.** The roadmap is complete except PDF Phase 4 (native recording).

| Area                 | Commands                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhooks             | `list webhooks`, `get webhook`, `create webhook --url [--projects] [--header Name=value\|Name=@file\|Name=@-] [--field] [--form-data]`, `update webhook [--pause\|--resume]`, `delete webhook`, `test webhook <id>\|--url` |
| Signing secret       | `get webhook-secret [--reveal]`, `create webhook-secret`, `rotate webhook-secret [--no-grace]`, `expire webhook-secret`                                                                                                    |
| Deliveries           | `list webhook-deliveries [--webhook] [--result] [--since]`, `get webhook-delivery`, `resend webhook-delivery`                                                                                                              |
| OAuth apps           | `list oauth-apps`, `get oauth-app`, `create oauth-app --name --redirect-uri [--type public] [--scopes]`, `update oauth-app [--enable\|--disable]`, `delete oauth-app`, `rotate oauth-app-secret`                           |
| Subscription         | `get subscription`, `preview plan [--seats] [--guests]`, `change plan …` (previews, then asks), `cancel subscription [--now]`, `keep subscription`, `update payment-method` (opens the web app)                            |
| Invoices and details | `list invoices`, `get invoice <txn> [--open]`, `get\|update billing-profile [--me]`, `list\|add\|remove billing-email`, `get\|update business`, `redeem prime-club`                                                        |

**Webhooks:**

- bb-api has one event, `bug.created`, sent once a bug's evidence is uploaded.
- Deliveries are signed with the workspace secret (`X-BetterBugs-Signature: t=…,v1=<HMAC-SHA256 of "t.body">`) and retried at 1m, 5m and 30m. See cookbook recipe 16 for verifying a signature.
- Header values are never shown to the CLI.

**Billing:**

- `change plan` charges the saved card at once (prorated), so it previews and confirms first; scripts pass `--yes`.
- Starting a paid plan and changing the card happen in the web app, because Paddle takes card details there.

**bb-api changes in Phase 8:**

- **Billing could act on other workspaces.**
  - Cancel, preview and plan change trusted a Paddle subscription id sent by the client, and invoices trusted a transaction id. An admin of one workspace could cancel or re-plan another workspace's subscription, or read its invoices. All four now only act on the workspace's own subscription and transactions.
  - The plan-change payload went to Paddle unchecked, so it could carry discounts or another price. It is now limited to seat items at BetterBugs' own prices.
- **Billing scopes:**
  - No billing route checked an OAuth scope, so a read-only token of an admin could change or cancel the plan.
  - Apps and access tokens now need the admin-level `workspace.subscription` scope, which is now in the plans so it can be granted.
  - The Paddle customer token is admin-only.
  - New `GET subscription/prices` lists the seat prices, so clients can switch between monthly and yearly.
- **Webhook headers:** custom header values (often the receiver's credentials) were returned to every member, guests included, and to apps. Members who can manage a webhook still see them in the web app; everyone else, and every app or token, gets them masked.
- **Webhook scopes:** revealing the signing secret now needs `workspace.webhook.update`, and `test-connection` (an outbound signed request) needs `workspace.webhook.create`.
- **OAuth apps:**
  - Any member could create, change, delete or rotate the workspace's OAuth apps; now only admins can.
  - A redirect URI could be any string. The consent page opens that URI, so a `javascript:` value would run in the web app's origin. Redirect URIs must now be https, http on localhost, or an app scheme (RFC 8252).

**Known limits in Phase 8:**

- **One webhook event:** bb-api sends only `bug.created`, so there is no `--events` flag.
- **Webhook header secrets:** pass credentials as `--header Authorization=@file` or `=@-` (stdin) so they stay out of shell history and `ps`; an inline value for a credential-like header prints a warning.
- **`test webhook <id>`** doesn't send the webhook's stored headers (they are never given to the CLI); add them with `--header`.
- **Paid plans start in the web app,** as does changing the card.
- **Deleting an OAuth app** doesn't revoke the tokens it already issued (a bb-api behaviour, unchanged).
- **Invoice amounts** come from Paddle's payout totals as bb-api stores them.

`betterbugs agent-context` prints the whole surface (flags, enums, scopes, output shapes) as JSON.

### What works against today's bb-api, and what waits on backend work

| Feature                                                                                         | Today                                                                                                                                                                                                                                                                                                                                                                     | Needs                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Every read/write command                                                                        | ✅ with a browser login, or a personal/service token (`BETTERBUGS_TOKEN`, or `auth login --token`)                                                                                                                                                                                                                                                                        | —                                                                                           |
| `auth login` (browser, the admin CLI's `bba login` flow)                                        | ✅ with the bb-api `betterbugs-cli` branch (`/auth/cli/config`, `/auth/cli/authorize`, `/auth/cli/token`, `/auth/cli/refresh`; Prisma model `UserCliAuthCode`, `UserSession.isCli`) and bb-app `/cli/authorize` deployed. The session is an ordinary BetterBugs login (8 h access token, 90-day rotating refresh token), so it has no OAuth scopes and needs no paid plan | implemented                                                                                 |
| `auth login --token` with a PAT / service token                                                 | ✅ `bb_pat_…` (read or write; `/user/personal-access-token`, Team / Enterprise) or `bb_svc_…` (workspace, chosen scopes; `/oauth/tokens`) from `betterbugs create token` or bb-app Settings → Access tokens                                                                                                                                                               | Implemented, settings page included                                                         |
| `auth logout` server-side                                                                       | ✅ ends the browser-login session with `POST /auth/logout` (`--local` skips it)                                                                                                                                                                                                                                                                                           | implemented                                                                                 |
| Uploads (`create bug`, `attach`, `add …`)                                                       | ✅ through the authenticated `POST .../bug/:id/files` (scope `bug.updateAttachments`); older servers fall back to the extension's unauthenticated `/upload` route                                                                                                                                                                                                         | **B7**: implemented (the extension's `/upload/*` routes still need auth on the client side) |
| Console/network/steps filters                                                                   | ✅ sent to the server (`GET /bug/:id/logs?section=…`); a real-regex `--grep` and older servers filter locally                                                                                                                                                                                                                                                             | **B4**: implemented                                                                         |
| `--limit/--after`                                                                               | ✅ bb-api's own cursor on `list bugs` / `export bugs` (time sorts); offsets elsewhere                                                                                                                                                                                                                                                                                     | **B5**: implemented                                                                         |
| `get bug` signals                                                                               | ✅ from `GET /bug/:id/logs?view=summary`; computed locally against older servers                                                                                                                                                                                                                                                                                          | **B6**: implemented                                                                         |
| Comment timestamps                                                                              | ✅ `comment --at` sends `atMs`; comments come back with `atMs`                                                                                                                                                                                                                                                                                                            | **B9**: implemented                                                                         |
| Missing scope                                                                                   | ✅ 403 `SCOPE_MISSING` with `requiredScope` (exit 4 naming the scope); the old 400 is still understood                                                                                                                                                                                                                                                                    | **B3**: implemented                                                                         |
| Rate limits                                                                                     | ✅ 429 with `Retry-After` (reads retry once); one budget per token across routes (`RATE_LIMIT_TOKEN_PER_MINUTE`, default 600)                                                                                                                                                                                                                                             | **B14**: implemented                                                                        |
| Request IDs, minimum CLI version                                                                | ✅ `X-Request-Id` echoed and logged; `X-BetterBugs-CLI-Min-Version` from `CLI_MIN_VERSION`                                                                                                                                                                                                                                                                                | **B15 / B16**: implemented                                                                  |
| Server-side redaction                                                                           | ✅ opt-in: `set preferences server-redaction=on` (admins), new bugs only                                                                                                                                                                                                                                                                                                  | **B13**: implemented                                                                        |
| Playwright trace                                                                                | ✅ `create bug --from-playwright … --upload-trace` stores trace.zip (raw, not redacted); `get bug` links Playwright's trace viewer                                                                                                                                                                                                                                        | **B10**: implemented (alignment stays client-side)                                          |
| `list bugs --watch`                                                                             | ✅ with the bb-api `betterbugs-cli` branch (X5: `GET /workspace/:id/bug-events`); older servers get exit 5 with a hint                                                                                                                                                                                                                                                    | **X5**: implemented                                                                         |
| Recording-link `--title-template`, `--reference`, share URLs                                    | ✅ with the bb-api `betterbugs-cli` branch; older servers drop the two fields (the CLI warns) and return no `shareUrl`                                                                                                                                                                                                                                                    | **X4** (recording links): implemented                                                       |
| Phase 6 scopes for personal/service tokens (workspace, member, project, filter, recording-link) | ✅ after re-running `POST /seed/oauth-cli-client/:pin` so the `betterbugs-cli` client (which personal tokens belong to) gets them; existing tokens are created again. Browser logins have no scopes                                                                                                                                                                       | —                                                                                           |
| Phase 7 scopes for personal/service tokens (integrations)                                       | ✅ after re-running `GET /seed/oauth-scopes/:pin` (creates the new Bugasura, Basecamp and other scopes), then `POST /seed/oauth-cli-client/:pin`                                                                                                                                                                                                                          | —                                                                                           |
| Billing from the CLI                                                                            | ✅ with the bb-api `betterbugs-cli` branch (billing routes check `workspace.subscription` for tokens). For personal/service tokens, re-run `GET /seed/oauth-scopes/:pin` and `POST /seed/oauth-cli-client/:pin`. Member/guest seat changes only: switch monthly ↔ yearly in the web app (the other interval's prices are only available there)                           | —                                                                                           |

## Development

```bash
yarn install
yarn dev -- get bug <id>       # run from source (tsx)
yarn run check                 # typecheck + lint + tests (`yarn check` alone is Yarn's lockfile check)
yarn run test                  # node:test suites under test/
yarn run deps:audit            # high/critical advisories in the bundled dependencies
yarn build                     # bundles to dist/ (the published package has no runtime dependencies)
node dist/index.js --help
```

Point at another environment with `BETTERBUGS_API_URL` / `BETTERBUGS_APP_URL` (https only, except localhost).

> `package.json` pins `rollup` to `@rollup/wasm-node` via `resolutions`. Some Windows machines block rollup's
> native binary (Application Control); the WASM build behaves the same everywhere, just a little slower.

### CI and releases

- **CI:** `.github/workflows/ci.yml` runs typecheck, lint, tests, build and a bundle smoke test on macOS, Ubuntu and Windows × Node 20/22, plus `deps:audit`.
- **Release:** this repository is private and never published directly (`"private": true`). The public package is `@betterbugs/cli` on npm (it installs the commands `betterbugs`, `bbug` and `bb`), published from the public repository `betterbugs/cli`, the same way `@betterbugs/web-sdk` is:
  1. Bump `version` in `package.json` (the only place it is set) and push a `v<version>` tag here.
  2. `.github/workflows/release.yml` runs `yarn run check` on all three OSes, builds, runs `scripts/prepare-public.mjs` and pushes `build-public/` to `betterbugs/cli` with the tag. `build-public/package.json` is `package.build.json` (name, MIT licence, repository, `publishConfig`) plus the version.
  3. Publish a GitHub release for that tag in `betterbugs/cli`. Its `publish.yml` (source: `packaging/public-repo/`) publishes to npm with provenance (prereleases go to the `next` dist-tag), then renders the Homebrew formula from the published tarball's sha256 and attaches `betterbugs.rb` to the release. Copy it to `Formula/betterbugs.rb` in the `betterbugs/tap` repository.
- **Secrets:** `PUBLIC_REPO_TOKEN` here (a fine-grained personal access token for `betterbugs/cli` only, Contents and Workflows: Read and write); `NPM_TOKEN` in `betterbugs/cli`.

## Layout

```
src/
  index.ts              entry
  cli/                  run (commander wiring), runtime (context, auth, resolution), spec, registry, globals, scopes, io
  core/                 api.ts (the ONLY file with bb-api routes), http, errors (exit codes), config, credentials, settings, media, paths, logger
  auth/cli-login.ts     browser login like `bba login` (loopback + PKCE S256 + state → /cli/authorize), refresh, logout
  logs/                 evidence normalisation, filters, records, signals (ported from betterbugs-mcp)
  artifacts/            HAR conversion, README generation for `pull`
  redact/               credential redaction (log-redact.ts copied from betterbugs-mcp) + configurable redactor
  output/               JSON envelope, human tables
  commands/             one module per area; each exports CommandSpec[]
skills/                 markdown skills shipped in the package
```

## Adding a command

1. Add a `CommandSpec` (`defineCommand({...})`) in `src/commands/<area>.ts` and export it in that module's list.
2. Add a typed method to `src/core/api.ts` (routes live nowhere else).
3. Return `{ data, human, pagination?, truncated?, warnings? }`; never print to stdout directly.
4. Add its bb-api scopes to `spec.scopes` and, if new, to `src/cli/scopes.ts`.

## Contracts

- **Exit codes** (stable from v1.0.0): 0 ok, 1 error, 2 usage, 3 not logged in, 4 forbidden/missing scope, 5 not found, 6 rate limited, 7 network, 8 plan limit, 9 validation, 10 partial, 11 not ready, 13 missing dependency, 130 cancelled at a prompt (Ctrl-C / Ctrl-D). 12/14/15/16 are reserved for recording.
- **JSON envelope**: `{ apiVersion: "v1", data, pagination?, truncated?, warnings[] }`; errors `{ apiVersion, error: { code, message, hint, requestId } }` on stdout.
- **Security**: BetterBugs tokens are never accepted as arguments (`auth login --token` reads stdin), and webhook header secrets can come from a file or stdin (`--header Name=@file`); an inline credential-like header value prints a warning; credentials file `0600` (refused if world-readable on POSIX; on Windows mode bits don't apply, so `doctor` reads the file's ACL and flags it if Everyone/Users can read it); https enforced; redaction on by default before anything reaches stdout or disk; no auth header is sent to the media CDN. `auth login` binds its callback to 127.0.0.1 only, ignores any callback whose `state` doesn't match, shows success in the browser only after the code exchange succeeds, and sends the PKCE verifier only to the API; the server stores the one-time code and refresh token as hashes. `auth login --token` saves a token only after BetterBugs confirms it (`--no-verify` saves it unchecked when the API can't be reached). Output to a terminal is stripped of escape sequences that bug data could carry (window titles, links, clipboard writes); colours and piped/JSON output are unchanged.
