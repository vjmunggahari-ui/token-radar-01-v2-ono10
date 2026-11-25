// app.js — renders the radar from window.RADAR (data.js) and window.METHOD (method.js).
// No network, no external resources. Sorting, filtering and the detail view are
// all client-side. URL params drive the three screenshot states:
//   ?view=detail&slug=<slug>  — detail view for one protocol
//   ?view=filtered&cat=<category> — filtered board
(function () {
  var D = window.RADAR;
  var M = window.METHOD;
  var rows = D.rows;
  var fit = D.fit;

  // The variant's own held-out entry. heldOut[0] is only the right row when the
  // selected term set is ['tvl']; match on terms (order-insensitive) so variant B
  // reads its own RMSE instead of the TVL-only row's. A missing entry means the
  // data is inconsistent — fail loudly rather than show another variant's number.
  function sameTerms(a, b) {
    return a.length === b.length && a.every(function (t) { return b.indexOf(t) >= 0; });
  }
  var variantHeldOut = fit.heldOut.filter(function (h) { return sameTerms(h.terms, fit.selectedTerms); })[0];
  if (!variantHeldOut) throw new Error('no held-out entry for selected terms: ' + JSON.stringify(fit.selectedTerms));

  // Exclusion counts, rendered from the runtime fit (single source of truth).
  // Fixed reason order matches the methodology prose; only nonzero reasons are
  // listed, so a reason that never fires leaves no trace.
  var EXCL_LABELS = {
    'category': 'category (Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking / Restaked BTC / CEX)',
    'version-marker': 'version markers such as "v2" or "3.0" in the name',
    'wrapped/staked-word': 'wrapped/staked/staking words',
    'stem': 'names that repeat a trading protocol\'s name stem',
    'exchange-name': 'exchange names (Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini)',
    'first-word': 'names whose first word matches a trading protocol name'
  };
  var EXCL_ORDER = ['category', 'version-marker', 'wrapped/staked-word', 'stem', 'exchange-name', 'first-word'];
  function exclusionsText() {
    var total = 0, parts = [];
    EXCL_ORDER.forEach(function (r) {
      var n = fit.exclusions[r] || 0;
      if (n > 0) { total += n; parts.push(EXCL_LABELS[r] + ' ' + n); }
    });
    return 'Of the ' + fit.nBelowFloor + ' pre-token protocols below the floor, ' + total +
      ' were excluded by mechanical rules: ' + parts.join('; ') +
      '. That leaves ' + fit.nBelowFloorPlausible + ' eligible; the top 160 by TVL fill the board. ' +
      'The rules use only the snapshot\'s own fields (category, name) and the trading set\'s name stems.';
  }

  document.body.classList.add('layout-' + D.layout);

  function $(s) { return document.querySelector(s); }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function moneyShort(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; }
  function ageFmt(a) { return a === null || a === undefined ? '—' : a.toFixed(1) + 'y'; }
  // change_7d is in PERCENT units in the snapshot: show it as-is.
  function growthFmt(g) {
    if (g === null || g === undefined) return '—';
    return (g >= 0 ? '+' : '') + g.toFixed(1) + '%';
  }

  // One odds-formula string for every place it appears (single source of truth):
  // the intercept/slope always come from the runtime fit, with correct sign spacing.
  function oddsFormula(label) {
    return 'sigmoid(' + fit.odds.intercept.toFixed(2) +
      (fit.odds.slope >= 0 ? ' + ' : ' - ') + Math.abs(fit.odds.slope).toFixed(2) +
      ' × log10(' + (label || 'TVL') + '))';
  }

  // Why rank 1 on implied value can have a lower expected value than a lower
  // rank: the board ranks by stated implied value, while expected value
  // (implied x odds) can rise down the ranks because smaller protocols have
  // higher launch odds. The top-EV row is computed from the rows at runtime.
  function evNote(r) {
    var top = rows.reduce(function (a, b) { return b.expected_value_usd > a.expected_value_usd ? b : a; });
    if (top.slug === r.slug) return 'Board ranks by stated implied value. This row also has the highest expected value on the board (' + money(r.expected_value_usd) + ').';
    return 'Board ranks by stated implied value, not by expected value. The highest expected value on the board is ' + top.name + ' (rank ' + top.rank + ', ' + money(top.expected_value_usd) + ') — expected value can rise down the ranks because smaller protocols have higher launch odds (' + pct(top.odds, 0) + ' vs ' + pct(r.odds, 0) + ' here).';
  }

  // Header model line + KPI strip.
  // Header model line — the board's actual fitted formula, growth term included when used.
  var modelTxt = 'Model: log10(mcap) = ' + fit.valueIntercept.toFixed(4) + ' + ' + fit.valueSlope.toFixed(4) + ' × log10(TVL)';
  if (fit.growthCoef !== null && fit.growthCoef !== undefined) {
    modelTxt += ' + ' + fit.growthCoef.toFixed(4) + ' × growthSign';
  }
  modelTxt += '  ·  fitted on ' + fit.nTrading + ' trading protocols  ·  held-out RMSE ' +
    variantHeldOut.meanRmse.toFixed(4) + '  ·  odds: ' + oddsFormula();
  $('#model-line').textContent = modelTxt;
  var kpis = [
    ['Coverage', fit.watchlistCovered + ' / 40', 'watchlist protocols ranked'],
    ['Board rows', String(fit.boardRows), '40 watchlist + 160 below-floor'],
    ['Median implied', money(fit.medianImplied), 'estimate, not a price'],
    ['Held-out RMSE', variantHeldOut.meanRmse.toFixed(4), 'log10, two blind halves'],
    ['Farm plans', (fit.boardRows * 5).toLocaleString('en-US'), '5 concrete steps each'],
    ['Median odds', pct(fit.medianOdds, 0), 'of realising ≥ 0.5× TVL as mcap'],
  ];
  $('#kpis').innerHTML = kpis.map(function (k) {
    return '<div class="kpi"><div class="k">' + k[0] + '</div><div class="v">' + k[1] +
      '</div><div class="n">' + k[2] + '</div></div>';
  }).join('');

  // Self-check strip (dense layout only). Kept to one line: the model formula
  // already sits in the header, so it is not repeated here.
  var checks = [
    'coverage ' + fit.watchlistCovered + '/40',
    fit.boardRows + ' rows',
    'values non-increasing',
    'farm steps 5 per row',
    'held-out RMSE ' + variantHeldOut.meanRmse.toFixed(4),
    'odds log-loss ' + fit.odds.heldOutLogLoss.toFixed(4) + ' vs base ' + fit.odds.baseLogLoss.toFixed(4),
    'implied values are estimates (median error 87%)',
  ];
  $('#selfcheck').innerHTML = '<b>SELF-CHECKS —</b> ' + checks.join(' · ');

  // Filters.
  var cats = [];
  rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  $('#cat').innerHTML += cats.map(function (c) { return '<option>' + c + '</option>'; }).join('');
  var chains = [];
  rows.forEach(function (r) { r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
  chains.sort();
  $('#chain').innerHTML += chains.map(function (c) { return '<option>' + c + '</option>'; }).join('');

  var state = { q: '', cat: '', chain: '', band: '', sort: 'rank', dir: 1 };
  var selected = rows[0].slug;

  var COLS = [
    { k: 'rank', t: '#', num: true },
    { k: 'name', t: 'Protocol' },
    { k: 'category', t: 'Category' },
    { k: 'tvl_usd', t: 'TVL', num: true },
    { k: 'change_7d', t: '7d', num: true },
    { k: 'age_years', t: 'Age', num: true },
    { k: 'implied_value_usd', t: 'Implied value (est.)', num: true },
    { k: 'odds', t: 'Launch odds', num: true },
    { k: 'expected_value_usd', t: 'Expected value', num: true },
    { k: 'tvlbar', t: 'TVL bar', bars: true },
    { k: 'comp', t: 'Value make-up', bars: true },
  ];
  var maxTvl = Math.max.apply(null, rows.map(function (r) { return r.tvl_usd; }));
  var maxLogTvl = Math.log10(maxTvl);

  function bandOf(r) {
    if (r.tvl_usd >= 500e6) return 'big';
    if (r.tvl_usd >= 100e6) return 'mid';
    if (r.tvl_usd >= 50e6) return 'small';
    return 'below';
  }
  function visible() {
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0)) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.band && bandOf(r) !== state.band) return false;
      return true;
    });
    var k = state.sort;
    out.sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      var c = typeof va === 'string' ? (va < vb ? -1 : va > vb ? 1 : 0) : va - vb;
      return c * state.dir;
    });
    return out;
  }
  function renderHead() {
    $('#headrow').innerHTML = COLS.map(function (c) {
      var arrow = state.sort === c.k ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
      return '<th data-k="' + c.k + '" class="' + (c.num ? 'num ' : '') + (c.bars ? 'bars' : '') + '">' + c.t + arrow + '</th>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#headrow th'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (k === 'tvlbar' || k === 'comp') return;
        if (state.sort === k) state.dir = -state.dir;
        else { state.sort = k; state.dir = k === 'name' || k === 'category' ? 1 : -1; }
        renderTable();
      });
    });
  }
  function renderTable() {
    renderHead();
    var list = visible();
    $('#count').textContent = list.length + ' of ' + rows.length + ' rows';
    $('#rows').innerHTML = list.map(function (r) {
      var logT = Math.log10(r.tvl_usd);
      var tvlPct = Math.max(2, Math.round((logT / maxLogTvl) * 100));
      // Value make-up: the model's own term decomposition for this row.
      var logIv = Math.log10(r.implied_value_usd);
      var td = r.term_decomp;
      var intShare = Math.max(0, Math.min(100, Math.round((td.intercept / logIv) * 100)));
      var tvlShare = Math.max(0, Math.min(100, Math.round((td.tvl_term / logIv) * 100)));
      var groShare = Math.max(0, 100 - intShare - tvlShare);
      var oddsCls = r.odds >= 0.3 ? 'odds-hi' : 'odds-lo';
      return '<tr data-slug="' + r.slug + '"' + (r.slug === selected ? ' class="sel"' : '') + '>' +
        '<td><span class="rank">' + r.rank + '</span></td>' +
        '<td><span class="name">' + r.name + '</span>' + (r.watchlist ? ' <span class="wl">★</span>' : '') + '</td>' +
        '<td class="cat">' + (r.category || '—') + '</td>' +
        '<td class="num">' + moneyShort(r.tvl_usd) + '</td>' +
        '<td class="num">' + growthFmt(r.change_7d) + '</td>' +
        '<td class="num">' + ageFmt(r.age_years) + '</td>' +
        '<td class="num val">' + money(r.implied_value_usd) + '</td>' +
        '<td class="num ' + oddsCls + '">' + pct(r.odds, 0) + '</td>' +
        '<td class="num">' + money(r.expected_value_usd) + '</td>' +
        '<td class="bars"><div class="bar"><i style="width:' + tvlPct + '%"></i></div></td>' +
        '<td class="bars"><div class="comp"><i style="width:' + intShare + '%"></i><i style="width:' + tvlShare + '%"></i><i style="width:' + groShare + '%"></i></div></td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#rows tr'), function (tr) {
      tr.addEventListener('click', function () {
        selected = tr.getAttribute('data-slug');
        renderTable();
        renderDetail();
      });
    });
  }
  function renderDetail() {
    var r = rows.filter(function (x) { return x.slug === selected; })[0] || rows[0];
    var logIv = Math.log10(r.implied_value_usd);
    var td = r.term_decomp;
    var decomp = 'implied = 10^(' + fit.valueIntercept.toFixed(4) + ' + ' + fit.valueSlope.toFixed(4) +
      ' × log10(' + moneyShort(r.tvl_usd) + ')' +
      (fit.growthCoef !== null && fit.growthCoef !== undefined ? ' + ' + fit.growthCoef.toFixed(4) + ' × growthSign' : '') +
      ') = 10^(' + td.intercept.toFixed(4) + ' + ' + td.tvl_term.toFixed(4) +
      (td.growth_term !== 0 ? ' + ' + td.growth_term.toFixed(4) : '') +
      ') = 10^' + logIv.toFixed(4) + ' = ' + money(r.implied_value_usd);
    var oddsLine = 'odds = ' + oddsFormula(moneyShort(r.tvl_usd)) + ' = ' + pct(r.odds, 1);
    $('#detail').innerHTML =
      '<h2>' + r.name + ' <span class="wl">' + (r.watchlist ? '★ watchlist' : '') + '</span></h2>' +
      '<p class="meta">Rank ' + r.rank + ' of ' + rows.length + ' · ' + (r.category || 'no category') +
      ' · ' + r.chains.join(', ') + ' · records no token in the snapshot (as of 2026-11-14).</p>' +
      '<div class="grid">' +
      '<div class="cell"><div class="k">Implied value (est.)</div><div class="v">' + money(r.implied_value_usd) +
      '</div><div class="n">fitted from TVL; median error 87%</div></div>' +
      '<div class="cell"><div class="k">Launch odds</div><div class="v">' + pct(r.odds, 1) +
      '</div><div class="n">P(mcap/TVL ≥ 0.5) from TVL</div></div>' +
      '<div class="cell"><div class="k">Expected value</div><div class="v">' + money(r.expected_value_usd) +
      '</div><div class="n">implied × odds</div></div>' +
      '<div class="cell"><div class="k">TVL · 7d · Age</div><div class="v">' + moneyShort(r.tvl_usd) +
      '</div><div class="n">' + growthFmt(r.change_7d) + ' · ' + ageFmt(r.age_years) + '</div></div>' +
      '</div>' +
      '<h3>How the number is made</h3>' +
      '<div class="decomp">' + decomp + '<br>' + oddsLine + '</div>' +
      '<p class="note">' + evNote(r) + '</p>' +
      '<h3>Farm plan — 5 steps, starter sizes</h3>' +
      '<ol>' + r.farm_steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
  }
  // Distribution charts (real data from the board rows).
  function renderSpread() {
    var logs = rows.map(function (r) { return Math.log10(r.implied_value_usd); });
    var lo = Math.floor(Math.min.apply(null, logs) * 10) / 10;
    var hi = Math.ceil(Math.max.apply(null, logs) * 10) / 10;
    var nb = 10, counts = [];
    for (var i = 0; i < nb; i++) counts.push(0);
    logs.forEach(function (v) {
      var j = Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb));
      counts[j]++;
    });
    var mx = Math.max.apply(null, counts);
    var W = 520, H = 108, pad = 6;
    var bw = (W - pad * 2) / nb;
    var bars = counts.map(function (c, j) {
      var h = Math.max(2, (c / mx) * (H - 30));
      var x = pad + j * bw + 2, y = H - 22 - h;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 4).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="#0f766e" rx="2"/>' +
        '<text x="' + (x + (bw - 4) / 2).toFixed(1) + '" y="' + (H - 8) +
        '" font-size="9" fill="#5b6470" text-anchor="middle">' +
        moneyShort(Math.pow(10, lo + (j + 0.5) * (hi - lo) / nb)) + '</text>';
    }).join('');
    var hist = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + bars + '</svg>';
    var tvls = rows.map(function (r) { return Math.log10(r.tvl_usd); });
    var tlo = Math.min.apply(null, tvls), thi = Math.max.apply(null, tvls);
    var pts = [];
    for (var k = 0; k <= 40; k++) {
      var lt = tlo + (thi - tlo) * k / 40;
      var o = 1 / (1 + Math.exp(-(fit.odds.intercept + fit.odds.slope * lt)));
      pts.push((pad + (lt - tlo) / (thi - tlo) * (W - pad * 2)).toFixed(1) + ',' +
        (H - 22 - o * (H - 30)).toFixed(1));
    }
    var dots = rows.map(function (r) {
      var x = pad + (Math.log10(r.tvl_usd) - tlo) / (thi - tlo) * (W - pad * 2);
      var y = H - 22 - r.odds * (H - 30);
      return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.2" fill="#b45309"/>';
    }).join('');
    var curve = '<svg viewBox="0 0 ' + W + ' ' + H + '"><polyline points="' + pts.join(' ') +
      '" fill="none" stroke="#0f766e" stroke-width="2"/>' + dots + '</svg>';
    $('#spread').innerHTML =
      '<div class="card"><h3>How the implied values spread</h3>' + hist +
      '<p class="note">200 rows, log scale. Most protocols cluster at $4–12M; the watchlist top sits far above.</p></div>' +
      '<div class="card"><h3>Launch odds vs TVL — the fitted curve</h3>' + curve +
      '<p class="note">Every row sits on one fitted curve: odds = ' + oddsFormula() + '. Small TVL, higher odds.</p></div>';
  }

  function renderMethod() {
    var h = '<h2>Methodology — fitted, tested, and kept only if it survives a blind test</h2>' +
      '<p>The value model is fitted on the snapshot\'s own trading protocols: the ' + fit.nTrading +
      ' protocols whose token already trades, with log10(mcap) as the target. Nothing about the value is a hardcoded list of names. Every candidate term was fitted on one blind half of the trading protocols and tested on the other, then swapped; a term is kept only if it improves that held-out error.</p>' +
      '<p><strong>Value model:</strong> log10(mcap) = ' + fit.valueIntercept.toFixed(4) + ' + ' + fit.valueSlope.toFixed(4) +
      ' × log10(TVL), i.e. implied value = ' + Math.round(fit.valueCoef) + ' × TVL^' + fit.valueSlope.toFixed(4) +
      '. Held-out log10 RMSE ' + variantHeldOut.meanRmse.toFixed(4) + ', median absolute error on market cap 87%. ' +
      'The naive baseline (mcap = TVL × median ratio 0.2227) scores 0.9887 in-sample — the fitted model beats it, and it is still a rough estimate.</p>' +
      '<p><strong>Odds model:</strong> P(mcap/TVL ≥ 0.5) = sigmoid(' + fit.odds.intercept.toFixed(4) + ' + ' +
      fit.odds.slope.toFixed(4) + ' × log10(TVL)). Held-out log-loss ' + fit.odds.heldOutLogLoss.toFixed(4) +
      ' against ' + fit.odds.baseLogLoss.toFixed(4) + ' for always predicting the base rate (' +
      pct(fit.odds.baseRate, 0) + '). Small protocols realise more of their TVL as market cap: $5M TVL → 63%, $50M → 28%, $500M → 8%, $5B → 2%.</p>' +
      '<h3>Held-out test — every candidate term set (two blind halves)</h3>' +
      '<table><thead><tr><th>Term set</th><th class="num">Held-out RMSE</th><th>Verdict</th><th>Why</th></tr></thead><tbody>' +
      M.termSets.map(function (t) {
        // Numbers + verdict come from the runtime fit (single source of truth);
        // the static file carries only the prose 'why'. Rows with no held-out
        // entry (category calibration, naive baseline) keep their static numbers.
        var h = fit.heldOut.filter(function (x) { return x.name === t.name; })[0];
        var rmse = h ? h.meanRmse.toFixed(4) + ' (' + h.rmseAB.toFixed(4) + ' / ' + h.rmseBA.toFixed(4) + ')' : t.rmse;
        var kept = h ? h.kept : t.kept;
        return '<tr><td>' + t.name + '</td><td class="num">' + rmse + '</td><td class="' +
          (kept ? 'kept' : 'dropped') + '">' + (kept ? 'KEPT' : 'dropped') + '</td><td>' + t.why + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<h3>What was dropped, and why</h3><p>' + M.dropped + '</p>' +
      '<h3>Board construction</h3><p>' + M.construction + '</p>' +
      '<h3>Exclusions from the below-floor extras</h3><p>' + exclusionsText() + '</p>' +
      '<h3>What this radar does not do</h3><p>' + M.limits + '</p>';
    $('#method').innerHTML = h;
  }

  // Events.
  $('#q').addEventListener('input', function (e) { state.q = e.target.value; renderTable(); });
  $('#cat').addEventListener('change', function (e) { state.cat = e.target.value; renderTable(); });
  $('#chain').addEventListener('change', function (e) { state.chain = e.target.value; renderTable(); });
  $('#band').addEventListener('change', function (e) { state.band = e.target.value; renderTable(); });

  // URL params for the screenshot states.
  var qs = new URLSearchParams(window.location.search);
  if (qs.get('cat')) { state.cat = qs.get('cat'); $('#cat').value = state.cat; }
  if (qs.get('slug')) { selected = qs.get('slug'); }
  renderTable();
  renderDetail();
  renderMethod();
  renderSpread();
  // Detail screenshot state: show the detail panel at the top (no scrolling —
  // headless screenshots do not repaint reliably after a programmatic scroll).
  if (qs.get('view') === 'detail') {
    document.body.classList.add('shot-detail');
  }
})();
