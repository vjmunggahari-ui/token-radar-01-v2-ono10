// main.ts — token-radar-01 v2 entry point (Node 22, stdlib only).
// Usage (local):  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
// Usage (grade):  MAKEFUN_OUTPUT_DIR=/output node /bot/main.ts   (reads /input/snapshot.json)
// Writes /output/board.json, /output/data.js, /output/dashboard/, /output/screenshots/,
// /output/dossier.json. Runs twice -> byte-identical. No network. Throws if
// MAKEFUN_OUTPUT_DIR is unset (no ./output fallback).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { fitValueModel } from './lib/model.ts';
import type { Snapshot } from './lib/model.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR;
if (!out) throw new Error('MAKEFUN_OUTPUT_DIR is not set; refusing to write anywhere else');

const inputIdx = process.argv.indexOf('--input');
const inputPath = inputIdx >= 0 ? process.argv[inputIdx + 1] : '/input/snapshot.json';
const snapshot = JSON.parse(readFileSync(inputPath, 'utf8')) as Snapshot;

const { rows, fit, variant, layout } = fitValueModel(snapshot);

// The runtime fit must reproduce the documented constants; if the snapshot or
// the fit drifted, fail loudly instead of shipping a wrong model.
const approx = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;
if (!approx(fit.refIntercept, 3.0247, 0.01)) throw new Error(`value intercept drifted: ${fit.refIntercept}`);
if (!approx(fit.refSlope, 0.5223, 0.005)) throw new Error(`value slope drifted: ${fit.refSlope}`);
if (!approx(fit.odds.intercept, 10.3838, 0.05)) throw new Error(`odds intercept drifted: ${fit.odds.intercept}`);
if (!approx(fit.odds.slope, -1.4737, 0.05)) throw new Error(`odds slope drifted: ${fit.odds.slope}`);
const tvlOnly = fit.heldOut.find((h) => h.name === 'TVL only');
if (!tvlOnly || !approx(tvlOnly.meanRmse, 0.9046, 0.005)) throw new Error(`held-out RMSE drifted: ${tvlOnly?.meanRmse}`);
if (!approx(fit.odds.heldOutLogLoss, 0.5471, 0.01)) throw new Error(`odds log-loss drifted: ${fit.odds.heldOutLogLoss}`);

// Board gates: fail loudly instead of shipping a bad board.
if (rows.length !== 200) throw new Error(`board has ${rows.length} rows, expected 200`);
if (fit.watchlistCovered !== 40) throw new Error(`watchlist coverage ${fit.watchlistCovered}, expected 40`);
const ranks = new Set(rows.map((r) => r.rank));
if (ranks.size !== 200 || Math.min(...ranks) !== 1 || Math.max(...ranks) !== 200) throw new Error('ranks are not 1..200 unique');
for (let i = 1; i < rows.length; i++) {
  if (rows[i].implied_value_usd > rows[i - 1].implied_value_usd) throw new Error(`values not non-increasing at rank ${rows[i].rank}`);
}
for (const r of rows) {
  if (r.implied_value_usd <= 0) throw new Error(`non-positive implied value at rank ${r.rank}`);
  if (r.farm_steps.length < 3 || r.farm_steps.length > 12) throw new Error(`farm_steps ${r.farm_steps.length} at rank ${r.rank}`);
  for (const s of r.farm_steps) {
    if (s.length < 20 || s.length > 600) throw new Error(`farm step length ${s.length} at rank ${r.rank}`);
  }
}

mkdirSync(join(out, 'dashboard'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
const ROOT = fileURLToPath(new URL('.', import.meta.url));

const board = {
  as_of: snapshot.as_of,
  variant,
  layout,
  model: {
    value: `log10(mcap) = ${fit.valueIntercept.toFixed(4)} + ${fit.valueSlope.toFixed(4)} * log10(TVL)`,
    value_coef: fit.valueCoef,
    held_out_rmse_mean: tvlOnly.meanRmse,
    odds: `P(mcap/TVL >= 0.5) = sigmoid(${fit.odds.intercept.toFixed(4)} + ${fit.odds.slope.toFixed(4)} * log10(TVL))`,
    odds_held_out_logloss: fit.odds.heldOutLogLoss,
    odds_base_logloss: fit.odds.baseLogLoss,
    n_trading: fit.nTrading,
    selected_terms: fit.selectedTerms,
  },
  rows,
};
writeFileSync(join(out, 'board.json'), JSON.stringify(board, null, 2) + '\n');

const data = { variant, layout, asOf: snapshot.as_of, fit, rows };
writeFileSync(join(out, 'data.js'), 'window.RADAR = ' + JSON.stringify(data) + ';\n');

for (const sub of ['dashboard', 'screenshots']) {
  const src = join(ROOT, sub);
  const dst = join(out, sub);
  if (!existsSync(src)) throw new Error(`missing ${sub}/ in the repo root`);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
}

const dossier = buildDossier(out, { text_max_bytes: 65536 });
// buildDossier returns the dossier as raw bytes (Uint8Array) — write them as-is.
// JSON.stringify would expand every byte into an object key and blow up the file.
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`variant ${variant} (${layout}) — rows ${rows.length}, watchlist ${fit.watchlistCovered}/40`);
console.log(`value: log10(mcap) = ${fit.valueIntercept.toFixed(4)} + ${fit.valueSlope.toFixed(4)}*log10(TVL), held-out RMSE ${tvlOnly.meanRmse.toFixed(4)}`);
console.log(`odds: sigmoid(${fit.odds.intercept.toFixed(4)} ${fit.odds.slope.toFixed(4)}*log10(TVL)), held-out log-loss ${fit.odds.heldOutLogLoss.toFixed(4)} vs base ${fit.odds.baseLogLoss.toFixed(4)}`);
console.log(`implied range $${fit.valueMax.toLocaleString('en-US')} .. $${fit.valueMin.toLocaleString('en-US')}, median $${fit.medianImplied.toLocaleString('en-US')}`);
console.log(`dossier bytes: ${dossier.byteLength}`);
