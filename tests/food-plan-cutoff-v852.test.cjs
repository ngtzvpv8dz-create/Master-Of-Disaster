'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Exercise the real date calculation from the Food source, not a duplicated
// reimplementation in the test. Only extract the pure date helper declarations.
const code = fs.readFileSync(path.join(__dirname, '..', 'food-v544.js'), 'utf8');
const start = code.indexOf('  const monthlyPlanningCutoff=');
const end = code.indexOf('  const planningHorizonIso=', start);
assert.ok(start > 0 && end > start, 'Food date planning helpers available');
const segment = code.slice(start, end);
const monthlyPlanningCutoff = new Function('todayIso', 'plusDays',
  segment + '\nreturn monthlyPlanningCutoff;'
)(() => '2026-10-24', () => { throw Error('unexpected invalid date fallback'); });

test('cutoff on 24 Oct must open next planning cycle through 25 Nov', () => {
  assert.equal(monthlyPlanningCutoff('2026-10-24'), '2026-11-25');
  assert.equal(monthlyPlanningCutoff('2026-10-25'), '2026-11-25');
});

test('day before current cutoff remains in current cycle', () => {
  assert.equal(monthlyPlanningCutoff('2026-10-23'), '2026-10-24');
});

test('next shopping cutoff itself shows following cycle, never an empty plan', () => {
  assert.equal(monthlyPlanningCutoff('2026-11-25'), '2026-12-23');
  assert.equal(monthlyPlanningCutoff('2026-11-24'), '2026-11-25');
});

test('client date fetch, upcoming Plan and food priority use same horizon', () => {
  assert.match(code, /\.lte\('meal_date',planningHorizonIso\(\)\)/);
  assert.match(code, /meal\.meal_date<=horizon/);
  assert.match(code, /<h3>Geplant bis '\+esc\(fmtDate\(horizon\)\)/);
});
