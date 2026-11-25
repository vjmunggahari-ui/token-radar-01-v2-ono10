# token-radar-01 v2 — 3-variant comparison

Winner: **Variant C** (fitted TVL-only value model + fitted odds term + dense board).

## Self-scores (1–5 per judge criterion, builder's own scoring after viewing all renders)

| Criterion (in judge order) | A — TVL-only, clean | B — TVL+growthSign, KPI | C — TVL-only + odds, dense |
|---|---:|---:|---:|
| 1. Working radar (40/40, ranks by stated implied value) | 5 | 5 | 5 |
| 2. Value model (fitted, held-out tested) | 5 | 4 | 5 |
| 3. Farm plans (concrete, costs + time) | 5 | 5 | 5 |
| 4. Dashboard as a page (sortable/filterable, readable at a glance, detail view) | 5 | 5 | 4 |
| 5. Looks made (palette, spacing, type) | 4 | 4 | 5 |
| **Total** | **24** | **23** | **24** |

A and C tie at 24. Tie-break (task rule): the better value model (criterion 2), then farm plans. C's value model is A's model **plus** a fitted odds term that beats its base rate on the blind test (log-loss 0.5471 vs 0.6383); farm plans are identical. C wins. Under the judge's own rule (first differing criterion decides unless a later one differs by much more): criterion 1 ties, criterion 2 favours C (extra tested component), criterion 4 favours A only slightly (5 rows visible on the cover vs 7–8 — the self-check strip costs ~1.5 rows, not "much more").

## Relay second opinions (head-to-head)

| Relay | Model | Verdict | Scores (A / B / C totals) | Note |
|---|---|---|---|---|
| Groq | qwen/qwen3.8-27b | **C** | 24 / 23 / 25 | C adds a statistically significant odds term and a denser, more informative layout. |
| Xingchi | codex gpt-6.1-sol | **A** | 24 / 23 / 23 | C's extra strips and bars weaken glanceability — the first meaningful difference from A. |
| Coarena | deepseek-v4-1-flash-1017 | **A** | (reasoning) | A wins on readability; C's density costs criterion 4. |
| Requesty | google/gemma-4-31b-it | **C** | 20 / 19 / 25 | C sweeps criteria 2, 4 and 5. (Short prompt; long prompt truncated on reasoning tokens.) |
| NVIDIA | moonshotai/kimi-k3.1-pro | — | — | 200 but empty content, twice. Degraded, no vote. |
| Bluesminds | kimi-k3 / gpt-oss-20b / nemotron-70b | — | — | All three models 410 end-of-life. Catalog stale, no vote. |
| 100milionseek | deepseek-v4.1-flash-free | — | — | 502 bad gateway. No vote. |
| Gemini | gemini-2.5-flash / gemini-3.8-flash | — | — | 2.5-flash 404 retired; 3.8-flash 503 overloaded. No vote. |
| Z.AI | glm-4.5-flash | — | — | Degraded (empty content) in the smoke test. Not retried. |
| Xkiro | mistralai/ministral-14b | — | — | 503, model in maintenance until 2026-12-02. |
| RunComputer | deepseek-v4-flash | — | — | 404, model no longer available. |

Relay tally: C 2, A 2. The tie-break above (criterion 2) decides for C. The two A votes both rest on C's glanceability cost; the final C polish (self-check strip shortened to drop the repeated model formula) recovers part of that cost.

## Held-out numbers (two blind halves, fit on one, test on the other, swapped)

Value model — mean log10 RMSE (AB / BA):

| Term set | Mean RMSE | Verdict |
|---|---:|---|
| TVL only | 0.9046 (0.9068 / 0.9025) | KEPT |
| TVL + growth sign | 0.9076 (0.9065 / 0.9087) | dropped |
| TVL + growth | 0.9155 (0.9037 / 0.9274) | dropped |
| TVL + growth + age | 0.9353 (0.9173 / 0.9534) | dropped |
| TVL + growth + age + age² | 0.9364 (0.9145 / 0.9583) | dropped |
| TVL + growth + age + TVL × growth | 0.9243 (0.9082 / 0.9405) | dropped |
| TVL + growth + age + TVL × age | 0.9298 (0.9102 / 0.9493) | dropped |
| All terms | 0.9137 (0.8895 / 0.9378) | dropped |
| Category calibration (shrunk) | 0.9397–0.9520 | dropped |
| Naive baseline (TVL × 0.2227) | 0.9887 (in-sample) | beaten |

Fitted value model: `log10(mcap) = 3.0247 + 0.5223 × log10(TVL)`, implied = 1058.5 × TVL^0.5223, median absolute error 87%. Variant B's fitted growth-sign coefficient is −0.1702 (positive growth lowers implied value). With the corrected percent scale, the continuous growth coefficient is −1.61.

Odds model — held-out log-loss: logTVL-only **0.5471** (kept) vs base rate 0.6383; +growth sign 0.5518, +young-age band 0.5478 (both dropped).

## Per-variant build facts

| | A | B | C (winner) |
|---|---:|---:|---:|
| Value model | TVL-only | TVL + growthSign | TVL-only |
| Held-out RMSE of its value model | 0.9046 | 0.9076 | 0.9046 |
| Layout | clean | kpi | dense |
| Rank 1 | Steakhouse Financial $90,123,744 | Steakhouse Financial $92,218,169 | Steakhouse Financial $90,123,744 |
| Median implied | $7,237,228 | $6,980,403 | $7,237,228 |
| Value range | $90,123,744 – $4,191,854 | $92,218,169 – $3,210,982 | $90,123,744 – $4,191,854 |
| Dossier bytes | 669,199 | 658,989 | 657,561 |
| Gate | 6/7 | 6/7 | 6/7 |
| Two runs byte-identical | yes | yes | yes |

All three: 200 rows, 40/40 watchlist, ranks 1–200 unique, values non-increasing, 5 farm steps per row (117–188 chars), dashboard source 29–30 KB (cap 64 KB), dossier under 1.5 MiB.

## Genuine revision step (done after the first full run, variant A)

1. **Growth-unit correction (found by viewing screenshots):** the snapshot's `change_7d` is in percent units (median −8.22 = −8.22%, max +4448%). The first fit clipped the raw percent to [−0.5, 1.0], which saturated the growth feature. Fixed `clipGrowth` to divide by 100, re-ran the full term audit (fit7): TVL-only still wins (0.9046); the corrected growth coefficient is −1.61. Also fixed the 7d column display (was showing −219.3% for a −2.19% move) and a CSS bug that left empty TVL-bar/value-make-up header columns in the clean/kpi layouts.
2. **Model extension:** the board now uses the variant's full linear predictor (previously the TVL-only formula was used even for variant B — a latent bug that would have fitted the growth term without applying it), and every row carries its term decomposition (`term_decomp`), so the dense layout's value-make-up bars show the model's own attribution. `main.ts` now asserts against the variant-independent TVL-only reference fit. Variant set to C; re-ran twice byte-identical.
3. **Dossier fix (found by the first run):** `buildDossier` returns raw bytes (Uint8Array); `JSON.stringify` on it produced a 10.8 MB file. `main.ts` now writes the bytes as-is (dossier 657,561 bytes).
4. **Final polish:** self-check strip shortened (dropped the model formula already shown in the header) to recover cover glanceability — the exact objection in the two A-voting relay verdicts.

## Weaknesses not fixed

- **Screenshot file sizes:** 145–162 KB each vs the 300–350 KB target. They are real 1440×900 renders of a clean, light design, which compresses efficiently; the dense variant is no larger (149–162 KB). The dossier is well under its 1.5 MiB cap (657,561 bytes), so nothing is lost by the smaller files — but the 300–350 KB checklist item is not literally met. Inflating the PNGs (e.g. re-encoding at lower compression) would be padding, not content, so it was not done.
- **Median error 87%:** the implied values are rough estimates. The dashboard labels them as estimates on every row, in the KPI strip, the self-check strip, and the methodology panel — but a judge may still treat the ranking as more precise than it is.
- **Category calibration dropped:** the top-10 pattern includes a category-calibrated entry; on this snapshot calibration hurts the blind test at every shrinkage level, so it was dropped honestly rather than forced in.
- **Variant B's rank order is arguably more "interesting"** (Gauntlet demoted to #4 by its positive growth), but its held-out error is worse, so it lost on the numbers.
