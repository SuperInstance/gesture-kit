import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Gesture, headingAlignment, gestureDistance, readGesture } from '../src/gesture.js';

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
