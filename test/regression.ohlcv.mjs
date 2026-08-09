#!/usr/bin/env node
/**
 * Regression guard for DEG-1789 — unadjusted point-in-time OHLCV.
 *
 * The bug: get_ohlcv hardcoded adjustment:"splits", so TradingView back-adjusted
 * historical bars for splits + merger ratios. A trader in 2018 saw TLRY at ~$214,
 * but the feed returned the merger-adjusted ~$2140 — silently corrupting every
 * historical batch. It recurred across DEG-1671/1782/1789 because "wrong prices"
 * kept being misread as random corruption instead of the adjustment-mode default.
 *
 * This test locks the fix: default get_ohlcv must return UNADJUSTED bars. If the
 * default ever flips back to "splits"/"dividends" (revert, refactor, TV protocol
 * drift), the known-scale assertions below fail LOUDLY instead of silently
 * poisoning a scoring run weeks later.
 *
 * Integration test — hits the live TV feed. If auth/network is unavailable it
 * SKIPs (exit 0) rather than false-failing; it only fails on definitively-wrong
 * data (bars returned, but at the adjusted scale).
 *
 * Run: npm test   (build first: npm run build)
 */
import assert from "node:assert/strict";
import { getOHLCV } from "../dist/ohlcv.js";

// Known-good UNADJUSTED anchors (public historical record):
//   TLRY 2018-09-19: close ~$214.06, vol ~31.7M   (bug returned $2140.60 / 3.17M)
//   WKHS 2021-02-18: close ~$30,     vol tens-of-M (bug returned $93,660 / ~2.4k)
const ANCHORS = [
  { sym: "NASDAQ:TLRY", from: 1537228800, to: 1537833600, t: 1537363800,
    close: [210, 218], minVol: 20_000_000, label: "TLRY 2018-09-19" },
  { sym: "NASDAQ:WKHS", from: 1613000000, to: 1614211200, t: 1613658600,
    close: [15, 55],  minVol: 1_000_000,  label: "WKHS 2021-02-18" },
];

function findBar(bars, t) {
  return bars.find((b) => b.time === t) || bars.find((b) => Math.abs(b.time - t) < 86400);
}

let checked = 0;
for (const a of ANCHORS) {
  let bars;
  try {
    bars = await getOHLCV(a.sym, "1D", { from: a.from, to: a.to });
  } catch (err) {
    console.log(`SKIP  ${a.label} — feed unavailable (${err.message})`);
    continue; // no auth/network: don't flake, just skip
  }
  if (!bars || bars.length === 0) {
    console.log(`SKIP  ${a.label} — no bars returned`);
    continue;
  }
  const bar = findBar(bars, a.t);
  assert.ok(bar, `${a.label}: target bar not found in returned window`);
  assert.ok(
    bar.close >= a.close[0] && bar.close <= a.close[1],
    `${a.label}: close ${bar.close} outside unadjusted range [${a.close[0]}, ${a.close[1]}] ` +
    `— adjustment default may have regressed to "splits"/"dividends"`
  );
  assert.ok(
    bar.volume >= a.minVol,
    `${a.label}: volume ${bar.volume} below ${a.minVol} — inverse-scaled (adjusted) volume, regression`
  );
  console.log(`PASS  ${a.label}: close=${bar.close} vol=${bar.volume}`);
  checked++;
}

if (checked === 0) {
  console.log("\n⚠ regression test SKIPPED — no anchors verifiable (feed/auth unavailable).");
  process.exit(0);
}
console.log(`\n✅ ${checked}/${ANCHORS.length} anchors verified — get_ohlcv default is unadjusted (DEG-1789 locked).`);
process.exit(0);
