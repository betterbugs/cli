# Reporting CI failures to BetterBugs

Every recipe does the same thing: after the test step fails, file one BetterBugs report per failed Playwright test with `betterbugs create bug --from-playwright`. Each report includes:

- the video
- console, network and steps from `trace.zip`
- the failure screenshot
- `error-context.md`

**Prerequisites**

- A token in the CI secret `BETTERBUGS_TOKEN`. Use a service token when available, so reports are attributed to CI rather than a person.
- `BETTERBUGS_PROJECT` set to the project id or name.
- In `playwright.config`, keep artifacts for failures:
  ```ts
  use: { video: 'retain-on-failure', screenshot: 'only-on-failure', trace: 'retain-on-failure' }
  ```
- **Always pass `--dedupe-key`.** Reruns of the same failure then update one report instead of filing a new one each time.
- **Pin the CLI version** (`@betterbugs/cli@0.1.0` below) and install it once per job. `@latest` would run whatever was published most recently, with your token, on every build; bump the pin deliberately instead.

## GitHub Actions

```yaml
- run: npx playwright test
- name: Report failures to BetterBugs
  if: failure()
  shell: bash
  env:
    BETTERBUGS_TOKEN: ${{ secrets.BETTERBUGS_TOKEN }}
    BETTERBUGS_PROJECT: ${{ vars.BETTERBUGS_PROJECT }}
    BETTERBUGS_CLIENT: github-actions
  run: |
    npm install -g @betterbugs/cli@0.1.0
    # At most 20 reports: a broken environment can fail every test at once.
    for dir in $(ls -d test-results/*/ 2>/dev/null | head -n 20); do
      betterbugs create bug --from-playwright "$dir" \
        --title "E2E failure: $(basename "$dir")" --tag ci \
        --meta "run=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" \
        --dedupe-key "gha:$GITHUB_REPOSITORY:$(basename "$dir"):$GITHUB_REF_NAME" --json || true
    done
```

Read-only diagnostics, for example in a scheduled job:

```yaml
- run: npx --yes @betterbugs/cli@0.1.0 doctor --json
  env: { BETTERBUGS_TOKEN: ${{ secrets.BETTERBUGS_TOKEN }} }
```

## GitLab CI

```yaml
e2e:
  image: mcr.microsoft.com/playwright:v1.49.0-jammy
  script:
    - npx playwright test
  after_script:
    - |
      if [ "$CI_JOB_STATUS" = "failed" ]; then
        npm install -g @betterbugs/cli@0.1.0
        # At most 20 reports: a broken environment can fail every test at once.
        for dir in $(ls -d test-results/*/ 2>/dev/null | head -n 20); do
          betterbugs create bug --from-playwright "$dir" \
            --title "E2E failure: $(basename "$dir")" --tag ci \
            --meta "pipeline=$CI_PIPELINE_URL" --meta "sha=$CI_COMMIT_SHORT_SHA" \
            --dedupe-key "gitlab:$CI_PROJECT_PATH:$(basename "$dir"):$CI_COMMIT_REF_NAME" --json \
            >> betterbugs-reports.jsonl || true
        done
      fi
  artifacts:
    when: always
    paths: [test-results/, betterbugs-reports.jsonl]
  variables:
    BETTERBUGS_CLIENT: gitlab-ci
    # BETTERBUGS_TOKEN and BETTERBUGS_PROJECT: masked CI/CD variables
```

## CircleCI

```yaml
jobs:
  e2e:
    docker: [{ image: mcr.microsoft.com/playwright:v1.49.0-jammy }]
    environment: { BETTERBUGS_CLIENT: circleci }
    steps:
      - checkout
      - run: npm ci
      - run: npx playwright test
      - run:
          name: Report failures to BetterBugs
          when: on_fail
          command: |
            npm install -g @betterbugs/cli@0.1.0
            # At most 20 reports: a broken environment can fail every test at once.
            for dir in $(ls -d test-results/*/ 2>/dev/null | head -n 20); do
              betterbugs create bug --from-playwright "$dir" \
                --title "E2E failure: $(basename "$dir")" --tag ci \
                --meta "build=$CIRCLE_BUILD_URL" \
                --dedupe-key "circle:$CIRCLE_PROJECT_REPONAME:$(basename "$dir"):$CIRCLE_BRANCH" --json || true
            done
      - store_artifacts: { path: test-results }
```

## Exit codes in pipelines

| Code  | Meaning                                                            | Typical handling                  |
| ----- | ------------------------------------------------------------------ | --------------------------------- |
| 0     | Report filed (or deduplicated)                                     | —                                 |
| 2     | Bad flags or payload                                               | Fix the recipe                    |
| 3     | Token missing or invalid                                           | Fix the secret                    |
| 4     | Token lacks a scope or role                                        | Re-issue the token                |
| 8     | Plan limit reached                                                 | Don't retry                       |
| 9     | Server rejected the payload                                        | Read the message                  |
| 6 / 7 | Rate limited / network error                                       | Safe to retry                     |
| 10    | Filed, but `--trim` couldn't be applied (video uploaded untrimmed) | Use the report; check the warning |

The recipes end each command with `|| true` so that reporting never changes the job's result. Drop it (or check `$?`) if you want a broken token (3) or a missing scope (4) to fail the build.
