---
name: betterbugs-debug
description: Investigate and fix a BetterBugs bug report with the `betterbugs` CLI. Use when the user mentions a BetterBugs bug id or link, asks why a reported bug happens, or asks you to fix or triage a BetterBugs report.
---

# Debugging a BetterBugs bug report

BetterBugs captures what happened in the user's browser: console, network, the steps they took, screenshots, video and a session replay. The `betterbugs` CLI turns a report into files you can read selectively. Reading in the right order is what keeps your context small and your diagnosis right.

## Order of operations

1. **Pull first.** Run `betterbugs pull <id>`. Never start with unfiltered `get` commands; they return a lot of data.
   - It writes `.betterbugs/<id>/` and prints a short summary. Add `--no-media` if you only need text.
2. **Read `.betterbugs/<id>/manifest.json` → `signals` first.** Form a hypothesis before reading anything else. `probableCauses` is ranked, strongest first.
3. **Read `network-errors.json`, then `console.json` filtered to errors.** Network failures with their bodies usually name the cause; console errors usually show where the client broke.
   - For one-off questions use filtered commands instead of opening whole files:
     - `betterbugs get network <id> --status 5xx --bodies errors`
     - `betterbugs get console <id> --level error --tail 50`
     - `betterbugs get events <id> --errors-only` (one timeline of failures and steps)
4. **Read `steps.md`** to understand what the user did right before the failure.
5. **Read `comments.md` before investigating further**, so you don't repeat findings people already posted.
6. **Open screenshots only when the logs run out** (`media/`). They cost the most context.
7. **Never paste whole files into context.** Grep the files and cite line numbers.

## Things to keep in mind

- If `README.md` or `bug.json` says **Tech Mode was off**, missing console or network logs do **not** mean there were no errors.
- Data is redacted (tokens, cookies, password fields). `[REDACTED]` values are not the bug.
- Media URLs are public CDN links. Don't paste them into public places.
- Exit codes: `3` log in (`betterbugs auth login`), `4` missing permission or scope, `5` not found, `10` partial (pull wrote everything except some media).

## When you have found the cause

1. Fix the code and run the relevant tests.
2. Post the finding on the bug, anchored to the moment of failure when there is a recording:

   ```
   betterbugs comment <id> "Root cause: <one sentence>. Fixed in <branch/PR>." --at <ms>
   ```

3. Only if the user asks, change the status: `betterbugs update <id> --status resolved`.

## Useful commands

| Need                        | Command                                                       |
| --------------------------- | ------------------------------------------------------------- |
| Summary + signals           | `betterbugs get bug <id>`                                     |
| Everything as files         | `betterbugs pull <id>`                                        |
| Failed requests with bodies | `betterbugs get network <id> --status failed --bodies errors` |
| Console errors              | `betterbugs get console <id> --level error`                   |
| What the user did           | `betterbugs get steps <id> --tail 30`                         |
| Environment                 | `betterbugs get env <id>`                                     |
| Prior discussion            | `betterbugs get comments <id>`                                |
| Open bugs                   | `betterbugs list bugs --status open --since 7d`               |
| Full command list (JSON)    | `betterbugs agent-context`                                    |
