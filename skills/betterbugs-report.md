---
name: betterbugs-report
description: File a BetterBugs bug report from a failing test or a bug you reproduced, with the `betterbugs` CLI. Use when a test fails in a way a human should look at, when CI should report an end-to-end failure, or when the user asks you to report a bug to BetterBugs.
---

# Filing a BetterBugs report

A good report lets someone else (or another agent) find the cause without re-running anything: a clear title, the page, what was expected, and the evidence: video or screenshot, console, network and steps.

## Decide whether to file

- **File** for real regressions: a failing end-to-end test, an error you reproduced, a broken user flow.
- **Don't file** for expected failures, known-flaky tests (unless the user asked), or failures caused by your own unfinished change. Say why you didn't file.
- **Check first:** `betterbugs list bugs --status open --search "<key words>"`. If it's already reported, comment on that bug instead (`betterbugs comment <id> "…"`).

## From a Playwright failure (preferred in CI)

```
betterbugs create bug --from-playwright test-results/<failed-test-folder>/ \
  --title "E2E: checkout total wrong with a coupon" \
  --url "$STAGING_URL/checkout" \
  --tag ci --tag e2e \
  --dedupe-key "e2e:<suite>:<test title>:<branch>"
```

- It reads `video.webm`, `trace.zip`, `test-failed-*.png` and `error-context.md` and attaches console, network and steps from the trace.
- **Always set `--dedupe-key`** in CI, so reruns of the same failure update one report instead of filing many. Make it stable across reruns and specific to the test: `${suite}:${test title}:${branch}`.

## From scratch

```
betterbugs create bug --title "<what is broken, in user terms>" --url "<page>" \
  --description-file notes.md \
  --screenshot shot.png \
  --console console.json --network requests.har \
  --priority high
```

Use `--video recording.webm` instead of (or as well as) `--screenshot` when you have a recording.

- **Title:** the symptom, not the cause ("Order total ignores coupon", not "Fix calcTotals").
- **Description:** steps to reproduce, expected result, actual result, and the environment (branch, commit, browser).
- **Evidence:** attach at least one of screenshot or video. Add console and network when you have them; they're redacted before upload.
- **Payloads:** `betterbugs create bug @payload.json` (or `-` for stdin) takes the full payload when you're building it programmatically.

## After filing

- **Print the link:** `create bug` prints the bug id and its web URL; put the URL in your summary or the CI step summary.
- **Add later evidence:** use `betterbugs attach <id> <file…>`, or `betterbugs add console <id> <file>` / `betterbugs add network <id> <file.har>`.
- **Exit codes:**
  - `0` filed (or deduplicated)
  - `3` not logged in (set `BETTERBUGS_TOKEN` in CI)
  - `4` missing permission
  - `8` plan limit (stop and tell the user)
  - `9` the server rejected the payload (check the message)
