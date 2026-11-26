---
name: betterbugs-proof
description: Prove a BetterBugs bug is fixed with the `betterbugs` CLI. Generate a repro test, show it fails before the fix and passes after, then record the proof on the bug (test result, fixing PR, links). Use after fixing a bug that has a BetterBugs id, or when the user asks to verify or close one.
---

# Proving a fix

A fix is proven when a test that reproduces the bug fails on the old code and passes on the new code, and that evidence is recorded on the bug where the team can see it.

## 1. Get a reproduction test

```
betterbugs repro <id> --framework playwright --out ./e2e
```

- Read the generated spec before running it. It is a starting point; fix selectors and setup until it reproduces the reported behaviour.
- If the repo uses Selenium, pass `--framework selenium` (with `--language python` or `java`).

## 2. Show it fails before the fix

Run the spec on the commit before your fix (or with the fix stashed). It must fail for the reason in the report, not for a setup problem. If it passes, the test does not reproduce the bug: improve it first.

## 3. Show it passes after the fix

```
npx playwright test e2e/repro-<id>.spec.ts --reporter=json > result.json
```

## 4. Record the proof on the bug

```
betterbugs comment <id> --from-test-result ./result.json \
  --message "Repro passes on branch fix/<topic> (failed before the fix)"
betterbugs add resource <id> <pull-request-url> --label "Fix PR"
```

- `--from-test-result` attaches the pass/fail summary as a verification on the bug and posts it as a comment.
- If there is a recording of the fixed behaviour filed as another bug, link it: `betterbugs link bug <proof-id> <id> --type fixes`.

## 5. Status

Only change the status when the user asks, or when the team's process says a verified fix closes the bug: `betterbugs update <id> --status resolved`.

## Don't

- Don't claim a fix is proven from a test that never failed.
- Don't paste whole test logs into comments; the verification keeps the summary and the comment links to it.
- Don't run generated tests against production data.
