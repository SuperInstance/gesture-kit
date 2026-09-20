import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Gesture, headingAlignment, gestureDistance, readGesture, readTrajectory, normalizeColumns } from '../src/gesture.js';

// Same arc (0..3 rad) regardless of n, so resolution — not path — varies.
const circle = (n, extra) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * 3.0;
    return extra ? [Math.cos(a), Math.sin(a), ...extra(a)] : [Math.cos(a), Math.sin(a)];
  });

describe('degenerate input', () => {
  test('empty and single are graceful', () => {
    const e = new Gesture([]);
    assert.equal(e.length, 0);
    assert.equal(e.arcLength(), 0);
    assert.equal(e.bendingEnergy(), 0);
    assert.equal(e.twistEnergy(), 0);
    assert.equal(e.planarity(), 1);
    assert.deepEqual(new Gesture([[0.2, 0.3]]).heading(), [0, 0]);
  });
});

describe('first order', () => {
  test('arcLength counts travel; still goes nowhere', () => {
    assert.ok(Math.abs(new Gesture([[0, 0], [1, 0], [2, 0], [3, 0]]).arcLength() - 3) < 1e-9);
    assert.equal(new Gesture([[0.5, 0.5], [0.5, 0.5]]).arcLength(), 0);
  });
  test('heading is the unit last direction', () => {
    const h = new Gesture([[0, 0], [0, 0.5], [0, 2]]).heading();
    assert.ok(Math.abs(Math.hypot(...h) - 1) < 1e-9 && h[1] > 0.99);
  });
});

describe('second order', () => {
  test('a line barely bends; a zig-zag bends more', () => {
    const line = new Gesture([[0, 0], [1, 0], [2, 0], [3, 0]]);
    const zig = new Gesture([[0, 0], [1, 1], [2, 0], [3, 1]]);
    assert.ok(line.bendingEnergy() < 1e-9);
    assert.ok(zig.bendingEnergy() > line.bendingEnergy());
  });
});

describe('third order (twist)', () => {
  test('a planar curve does not twist; a helix does', () => {
    const planar = new Gesture(circle(8));
    const helix = new Gesture(circle(8, (a) => [0.5 * a]));
    assert.ok(planar.twistEnergy() < 1e-9);
    assert.ok(helix.twistEnergy() > planar.twistEnergy());
    assert.ok(helix.planarity() < planar.planarity());
  });
  test('a scalar series can never twist', () => {
    assert.equal(Gesture.fromSeries([1, 2, 4, 7, 11]).twistEnergy(), 0);
  });
});

describe('resample', () => {
  test('n points, even arc-length spacing, endpoints kept', () => {
    const g = new Gesture([[0, 0], [0.1, 0], [0.2, 0], [1, 0], [3, 0]]);
    const r = g.resample(5);
    assert.equal(r.length, 5);
    assert.deepEqual(r[0], [0, 0]);
    assert.ok(Math.abs(r[4][0] - 3) < 1e-6);
    for (let i = 1; i < r.length; i++) assert.ok(Math.abs(r[i][0] - r[i - 1][0] - 0.75) < 1e-6);
  });
});

describe('comparison across gestures', () => {
  test('headingAlignment: parallel ≈ 1, opposite ≈ -1', () => {
    assert.ok(headingAlignment(new Gesture([[0, 0], [1, 1]]), new Gesture([[5, 5], [6, 6]])) > 0.99);
    assert.ok(headingAlignment(new Gesture([[0, 0], [1, 1]]), new Gesture([[0, 0], [-1, -1]])) < -0.99);
  });
  test('gestureDistance is 0 to itself, symmetric, scale/offset/sampling invariant', () => {
    const base = new Gesture(circle(6));
    const moved = new Gesture(circle(6).map(([x, y]) => [3 * x + 5, 3 * y + 5]));
    const dense = new Gesture(circle(60));
    assert.ok(gestureDistance(base, base) < 1e-9);
    assert.ok(gestureDistance(base, moved) < 1e-6);   // scale + offset
    assert.ok(gestureDistance(base, dense) < 0.02);   // sampling rate
  });
  test('cross-domain: same shape closer than different shape', () => {
    const melody = new Gesture([60, 64, 67, 72, 74, 72, 67, 64, 60].map((p, i) => [i, p]));
    const room = new Gesture([0, 0.5, 1, 0.5, 0].map((m, i) => [1000 + i * 250, 500 + m * 900]));
    const climb = new Gesture(Array.from({ length: 7 }, (_, i) => [i, i]));
    assert.ok(gestureDistance(melody, room) < gestureDistance(melody, climb));
  });
});

describe('readGesture summary', () => {
  test('returns all orders, finite', () => {
    const r = readGesture(circle(8, (a) => [0.5 * a]));
    for (const k of ['arcLength', 'bendingEnergy', 'twistEnergy', 'planarity']) {
      assert.ok(Number.isFinite(r[k]), `${k} finite`);
    }
    assert.equal(r.length, 8);
  });
});

describe('normalizeColumns', () => {
  test('maps each column to [0,1]; a constant column → 0', () => {
    const out = normalizeColumns([[0, 5], [10, 5], [5, 5]]);
    assert.deepEqual(out, [[0, 0], [1, 0], [0.5, 0]]);
  });
  test('ragged rows are padded with 0; input is not mutated', () => {
    const rows = [[1], [3, 9]];
    const frozen = JSON.stringify(rows);
    const out = normalizeColumns(rows);
    assert.equal(out[0].length, 2);         // padded to widest row
    assert.equal(JSON.stringify(rows), frozen);
  });
  test('empty → empty', () => { assert.deepEqual(normalizeColumns([]), []); });
});

describe('readTrajectory', () => {
  test('without normalization equals readGesture on the raw rows', () => {
    const rows = circle(8, (a) => [0.5 * a]);
    const a = readTrajectory(rows, { normalize: false });
    const b = readGesture(rows);
    assert.ok(Math.abs(a.arcLength - b.arcLength) < 1e-12);
    assert.ok(Math.abs(a.twistEnergy - b.twistEnergy) < 1e-12);
    assert.equal(a.normalized, false);
  });

  test('normalization stops a large-scale axis from drowning a small one', () => {
    // A zig-zag that lives mostly in a tiny column beside a huge monotone one:
    // raw, the big column dominates and the zig-zag barely bends; normalized,
    // the turning in the small column is visible.
    const rows = Array.from({ length: 10 }, (_, i) => [i * 1000, i % 2 ? 1 : 0]);
    const raw = readTrajectory(rows, { normalize: false });
    const norm = readTrajectory(rows); // normalized by default
    assert.ok(norm.bendingEnergy > raw.bendingEnergy + 1,
      `norm=${norm.bendingEnergy.toFixed(2)} raw=${raw.bendingEnergy.toFixed(2)}`);
  });

  test('dims selects columns (e.g. semantic dials, dropping an entropy axis)', () => {
    // Column 1 is pure noise-magnitude; keep only the meaningful columns 0 and 2.
    const rows = [[0, 999, 0], [1, -999, 1], [2, 999, 0], [3, -999, 1]];
    const g = readTrajectory(rows, { dims: [0, 2] });
    assert.equal(g.points[0].length, 2);
    assert.deepEqual(g.dims, [0, 2]);
    assert.ok(Number.isFinite(g.twistEnergy));
  });

  test('exposes the exact points it measured (so a view draws what was read)', () => {
    const g = readTrajectory([[0, 5], [10, 5], [5, 5]]);
    assert.deepEqual(g.points, [[0, 0], [1, 0], [0.5, 0]]);
    assert.equal(g.length, 3);
  });

  test('degenerate input is graceful and pure', () => {
    const rows = [[0, 0], 'junk', null, [1, 1]];
    const frozen = JSON.stringify(rows);
    const g = readTrajectory(rows);
    assert.equal(g.length, 2);              // junk filtered
    assert.equal(JSON.stringify(rows), frozen); // not mutated
    assert.equal(readTrajectory([]).length, 0);
    assert.equal(readTrajectory(null).length, 0);
  });
});
