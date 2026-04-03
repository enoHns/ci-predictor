# ci-predictor

[![CI](https://github.com/enoHns/ci-predictor/actions/workflows/ci.yml/badge.svg)](https://github.com/enoHns/ci-predictor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Before your pipeline finishes, know which jobs are likely to fail — based on what files you changed.

---

## Install

```yaml
- name: Predict failures
  uses: enoHns/ci-predictor@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Fetches the files changed in the PR
2. Detects code domains touched (auth, payments, database, CI, deps...)
3. Correlates changed file paths with historical job failure patterns
4. Applies domain-based risk boosts for high-risk areas
5. Posts a PR comment with per-job failure probability and a recommendation

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | required | Token with `actions:read` + `pull-requests:write` |
| `lookback-runs` | `50` | Historical runs for correlation model |
| `post-comment` | `true` | Post/update PR comment |
| `fail-on-high-risk` | `false` | Fail if risk is `high` or `critical` |

## Outputs

| Output | Description |
|--------|-------------|
| `risk-level` | `low` · `medium` · `high` · `critical` |
| `risk-score` | Numeric score 0–100 |

## Risk levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0–24 | `low` | No significant risk detected |
| 25–49 | `medium` | Some sensitive areas touched |
| 50–74 | `high` | High-risk domains affected |
| 75–100 | `critical` | Multiple high-risk domains + historical failures |

---

## License

MIT
