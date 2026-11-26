# Git hooks

Two checks, each a CLI command, so they work with any hook manager:

| Check                                | Hook       | What it does                                                                                                                                                                                                          |
| ------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `betterbugs check artifacts`         | pre-commit | Fails (exit 9) when a staged file is inside `.betterbugs/`. That folder is written by `betterbugs pull` and holds console logs, network data and media. Even redacted, it is customer data and doesn't belong in git. |
| `betterbugs check commit-msg <file>` | commit-msg | Finds the bugs the message references and checks that they exist and that you can open them (exit 5 if not). It warns when a bug is already closed.                                                                   |

**References `check commit-msg` recognises:**

- **Bug URLs:** any host containing `betterbugs`, or your configured app URL. For example, `https://app.betterbugs.io/session/66f1c0ffee0123456789abcd`.
- **`bb:<id>` or `betterbugs:<id>`:** for example, `Fixes bb:66f1c0ffee0123456789abcd`.
- **A trailer:** `BetterBugs: 66f1c0ffee0123456789abcd`.

A bare 24-character hex string is not treated as a reference, because commit SHAs contain them.

**Behaviour when offline or logged out.** A hook should never block a commit just because you're offline or not logged in. In those cases `check commit-msg` warns and exits 0. Two flags change this:

- `--strict` fails instead of warning.
- `--require` fails when the message references no bug at all.

All of the setups below need the CLI on your PATH: `npm install -g @betterbugs/cli`.

## pre-commit

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: betterbugs-no-evidence
        name: no pulled BetterBugs evidence
        entry: betterbugs check artifacts
        language: system
        files: (^|/)\.betterbugs/
      - id: betterbugs-commit-refs
        name: BetterBugs references exist
        entry: betterbugs check commit-msg
        language: system
        stages: [commit-msg]
```

```bash
pre-commit install --hook-type pre-commit --hook-type commit-msg
```

## lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    betterbugs-no-evidence:
      run: betterbugs check artifacts
commit-msg:
  commands:
    betterbugs-commit-refs:
      run: betterbugs check commit-msg {1} --require
```

## Plain git hooks

```bash
printf '#!/bin/sh\nexec betterbugs check artifacts\n' > .git/hooks/pre-commit
printf '#!/bin/sh\nexec betterbugs check commit-msg "$1"\n' > .git/hooks/commit-msg
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg
```

## Husky

```bash
echo 'betterbugs check artifacts' > .husky/pre-commit
echo 'betterbugs check commit-msg "$1"' > .husky/commit-msg
```

`betterbugs init` also offers to add `.betterbugs/` to `.gitignore`, which keeps the folder out of `git add -A` in the first place.
