# Automation cookbook

These recipes build internal automation on the CLI. Everything here rests on two contracts:

- **`betterbugs agent-context`** describes every command, flag, flag value, required scope and output shape as JSON. Generate from it instead of hard-coding the CLI's surface.
- **`--json`** gives one stable document per command (`{ apiVersion: "v1", data, … }`). Exit codes are stable too (see the end of this page). The exceptions are `list bugs --watch`, which streams one JSON object per line, and `get frames`, which writes files.

Authentication:

- **Scripts on a machine:** `betterbugs auth login` once. It opens the BetterBugs web app; click **Activate** there. On a machine without a browser, set `BETTERBUGS_NO_BROWSER=1` and open the printed URL yourself (the browser must reach this machine's 127.0.0.1, so use a CI token on remote hosts).
- **CI and services:** set `BETTERBUGS_TOKEN` to a service token (`betterbugs create token --service`), and set `BETTERBUGS_CLIENT` to a short name for your automation. The name ends up in request logs.

---

## 1. Discover the surface from `agent-context`

```bash
# Every command, one per line
betterbugs agent-context --json | jq -r '.data.commands[].command'

# The flags of one command, with their types and allowed values
betterbugs agent-context --json \
  | jq '.data.commands[] | select(.command == "betterbugs list bugs") | .flags'

# Read-only commands: safe for an unattended agent
betterbugs agent-context --json | jq -r '.data.commands[] | select(.readOnly) | .command'
```

## 2. Check a token before a job relies on it

Compare the scopes a job needs with the scopes a personal or service token was granted (a browser login is a full session and has no scopes to check):

```bash
need=$(betterbugs agent-context --json | jq -c '[.data.commands[]
  | select(.command == "betterbugs list bugs" or .command == "betterbugs comment") | .scopes[]] | unique')
have=$(betterbugs auth status --json | jq -c '.data.scopes')
jq -n --argjson need "$need" --argjson have "$have" '$need - $have'   # [] means the token is enough
```

`connect`, `disconnect`, `exclude project` and `push` list the scopes of every integration; a job needs only the scopes of the tool it actually uses.

## 3. Generate LLM tool definitions

Expose read-only commands to your own agent as tools. They are generated from `agent-context`, so they follow the installed CLI version:

```js
// tools.mjs: node tools.mjs > tools.json
import { execFileSync } from 'node:child_process';

const ctx = JSON.parse(execFileSync('betterbugs', ['agent-context', '--json'])).data;
const tools = ctx.commands
  .filter((c) => c.readOnly && c.path[0] === 'get')
  .map((c) => ({
    name: c.path.join('_').replace(/-/g, '_'),
    description: c.summary,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries([
        ...c.args.map((a) => [a.name, { type: 'string', description: a.description }]),
        ...c.flags.map((f) => {
          const name = f.flags.match(/--([\w-]+)/)[1];
          const enumValues = f.choices ?? f.values;
          return [
            name,
            {
              type: f.type === 'boolean' ? 'boolean' : 'string',
              description: f.description,
              ...(enumValues ? { enum: enumValues } : {}),
            },
          ];
        }),
      ]),
      required: c.args.filter((a) => a.required).map((a) => a.name),
    },
  }));
console.log(JSON.stringify(tools, null, 2));
```

To run a tool call, build the argument list: `[...c.path, ...args, ...flags, '--json']`. Then pass it to `execFileSync('betterbugs', …)`. Always use `execFile`, never a shell string.

## 4. React to new bugs as they arrive

`list bugs --watch` streams changes from the server (server-sent events). It reconnects and resumes on its own. A `ready` event means the evidence has finished uploading, so the bug is safe to pull:

```bash
betterbugs list bugs --watch --events ready --json | while read -r event; do
  id=$(jq -r '.bugId' <<< "$event")
  betterbugs pull "$id" --no-media --json > /dev/null && ./triage.sh ".betterbugs/$id"
done
```

Each line looks like this (wrapped here; it is one line on stdout):

<!-- prettier-ignore -->
```json
{"apiVersion":"v1","event":"bug.ready","id":"1763547600000-0","at":"2026-11-19T10:20:00.000Z",
 "bugId":"66f1c0ffee0123456789abcd","projectId":"65b0…","actorId":"64c0…",
 "bug":{"id":"66f1c0ffee0123456789abcd","title":"Checkout total is wrong","status":"open","priority":"high",
        "type":"screenRecording","source":"CHROME_EXTENSION","reporterId":"64c0…","projectId":"65b0…"}}
```

Things to know about the stream:

- **Event types:** `bug.created`, `bug.updated` (with a `change`, such as `status` or `assignee_added`), `bug.ready` and `comment.created`.
- **Filters:** `--status`, `--priority`, `--type`, `--source` and `--reporter` work as they do for listing. `--all-projects` watches the whole workspace.
- **Missed events:** a line with `"event":"gap"` means some events were missed while reconnecting. Run `betterbugs list bugs` to catch up.

## 5. Wait for the next bug in a script

```bash
next=$(betterbugs list bugs --watch --events ready --max-events 1 --json)
betterbugs get bug "$(jq -r '.bugId' <<< "$next")" --json
```

## 6. Route urgent bugs to whoever is on call

```bash
betterbugs list bugs --watch --events created --priority urgent --json | while read -r event; do
  id=$(jq -r '.bugId' <<< "$event")
  betterbugs update bug "$id" --assignee "$(./oncall-email.sh)" --tag needs-triage
  betterbugs comment "$id" "Routed to on-call automatically."
done
```

## 7. Daily digest in Slack

```bash
betterbugs list bugs --status open --since 1d --json \
  | jq '{text: ("*" + (.data | length | tostring) + " new open bugs*\n" +
        (.data | map("• " + .title + " (" + .priority + ")") | join("\n")))}' \
  | curl -sf -X POST -H 'content-type: application/json' --data @- "$SLACK_WEBHOOK_URL"
```

## 8. Close the loop when a fix merges

In CI on the default branch:

1. Read the bug references from the merge commit.
2. Attach the pull request to each bug.
3. Post the test run as proof.
4. Resolve the bug.

```bash
git log -1 --format=%B > /tmp/msg
refs=$(betterbugs check commit-msg /tmp/msg --json | jq -r '.data.refs[].id')
for id in $refs; do
  betterbugs add resource "$id" "$PR_URL" --label "Fix PR"
  betterbugs comment "$id" --from-test-result test-results/results.json --message "Fixed in $PR_URL"
  betterbugs update bug "$id" --status resolved
done
```

`comment --from-test-result` also records a verification on the bug. To check that the fix holds, rerun the generated repro with `betterbugs repro <id> --framework playwright`.

## 9. Weekly export for a spreadsheet

```bash
betterbugs export bugs --format csv --since 7d --all-projects --file "bugs-$(date +%F).csv"
```

The CSV export neutralises cells that start with `=`, `+`, `-` or `@`, so formulas in bug titles never execute in the spreadsheet.

## 10. Hand a bug to a coding agent

```bash
betterbugs skills install --target claude-code   # once: teaches the agent the read order
betterbugs pull 66f1c0ffee0123456789abcd         # writes .betterbugs/<id>/ with a README for the agent
```

## 11. A recording link per support ticket

Send a customer a link that files their recording against the ticket. The bug title comes from the template, and the ticket id lands on the bug as "Reference" metadata (bb-api X4).

```bash
url=$(betterbugs create recording-link --name "ZD-48213" --reference ZD-48213 \
  --title-template "[{reference}] {title}" --expires 7d --json | jq -r .data.url)
echo "Please record the problem here: $url"

# Later: what came in through it?
betterbugs list bugs --recording-link 65c000000000000000000001 --json
```

## 12. Offboard a teammate

`--dry-run` shows which projects change owner before anything is removed. Removing a member also revokes a pending invitation.

```bash
betterbugs remove member dev@acme.com --dry-run
betterbugs remove member dev@acme.com --yes
betterbugs list audit-logs --actor dev@acme.com --since 30d --json   # what they did recently
```

## 13. Check the SDK snippet is live after a deploy

```bash
betterbugs verify domain https://app.example.com --wait --timeout 120 || echo "BetterBugs SDK not seen yet"
```

## 14. File urgent bugs in Jira

Find the ids once, then push. A bug already pushed to Jira is skipped (add `--again` to file another issue).

```bash
betterbugs list jira-projects
betterbugs list jira-fields --project-key WEB --type Bug   # required custom fields go in --field
betterbugs list bugs --priority urgent --since 1d --json | jq -r '.data[].id' |
  while read -r id; do
    betterbugs push "$id" --to jira --project-key WEB --type Bug --label betterbugs --json
  done
```

Or let BetterBugs do it for every bug you report:

```bash
betterbugs set automation --tool jira --project-key WEB --type Bug --label betterbugs
```

## 15. Pull backend logs around a bug

```bash
betterbugs update log-settings --region eu-west-1 --log-group /aws/ecs/api   # once per project
betterbugs list cloudwatch-log-events --region eu-west-1 --log-group /aws/ecs/api --since 30m --level error --json
```

## 16. Receive new bugs on your own endpoint

```bash
betterbugs create webhook-secret                      # once per workspace (admins); store it as WEBHOOK_SECRET
betterbugs create webhook --url https://hooks.example.com/betterbugs --projects Checkout
betterbugs test webhook --url https://hooks.example.com/betterbugs
betterbugs list webhook-deliveries --result failed --since 1d
```

Check each delivery's signature before trusting it. The header is `X-BetterBugs-Signature: t=<unix seconds>,v1=<hex>`. The `v1` value is an HMAC-SHA256 of `<t>.<raw body>`, keyed with the whole secret (including `whsec_`). During a rotation there are two `v1` values, and either may match. Use `X-BetterBugs-Delivery` to drop repeats.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verify(rawBody, header, secret, toleranceSeconds = 300) {
  // Works on Node 18+ (no Object.groupBy, which needs Node 21).
  const parts = {};
  for (const p of header.split(',')) (parts[p.split('=')[0]] ??= []).push(p);
  const t = Number(parts.t?.[0]?.split('=')[1]);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  // rawBody: the exact bytes received (Buffer or string), before any JSON parsing.
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  return (parts.v1 ?? []).some((p) => {
    const got = Buffer.from(p.split('=')[1] ?? '', 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
```

## Exit codes in automation

| Code  | Meaning                                          | What a script should do                                      |
| ----- | ------------------------------------------------ | ------------------------------------------------------------ |
| 0     | OK                                               | Continue                                                     |
| 2     | Usage error                                      | Fix the script                                               |
| 3     | Not logged in, or the token is invalid           | Rotate the token; don't retry                                |
| 4     | Forbidden, or a scope is missing                 | Re-issue the token with the scope (`betterbugs list scopes`) |
| 5     | Not found                                        | Skip this bug                                                |
| 6 / 7 | Rate limited / network error                     | Retry with backoff                                           |
| 8     | Plan limit                                       | Stop; retrying won't help                                    |
| 9     | Validation                                       | Read `error.message`                                         |
| 10    | Partial (for example, `pull` without some media) | Use what was written                                         |
| 11    | Not ready (for example, a transcription)         | Poll again later                                             |
| 13    | Missing local dependency (ffmpeg, git)           | Install it                                                   |
| 130   | Cancelled at a prompt (Ctrl-C / Ctrl-D)          | Treat as "not done"; pass `--yes` in scripts                 |

```bash
betterbugs get bug "$id" --json > bug.json; code=$?
case $code in
  0) ;;
  6|7) sleep 30; betterbugs get bug "$id" --json > bug.json ;;
  *) jq -r '.error.message' bug.json >&2; exit $code ;;
esac
```
