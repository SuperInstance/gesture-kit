// ═══════════════════════════════════════════════════════════════════
// gesture-kit — read the SHAPE of motion through any abstraction space.
//
// A tensor approximates a function; this approximates the *abstraction* — the
// smooth motion between states. Give it an ordered sequence of numeric vectors
// (a phrase's notes, a room's mood readings, a conversation, a model's training
// path, a cell's value history) and it reads that path's geometry, order by
// order:
//
//   1st  arcLength / heading  — how far it travelled, and the unit direction it
//        is going *now* (a velocity — the "d_mu").
//   2nd  bendingEnergy        — curvature: how hard it turns *within* a plane.
//   3rd  twistEnergy          — torsion: how hard it turns *out of* that plane,
//        into a fresh dimension (planarity is the scale-free inverse).
//
// Plus gestureDistance — compare two motions free of position, scale, and
// sampling rate — and headingAlignment — do two things trend the same way.
//
// This is the canonical home for a reading the SuperInstance fleet re-derived
// across musician-soul, elephant, tensor-midi, quilt and federated-tinyml-vessel;
// "the property is in the twist" (twist-engine).
//
// Pure ES module, zero dependencies, never throws on empty/degenerate input.
// ═══════════════════════════════════════════════════════════════════

/** @typedef {number[]} Point a vector in an abstraction space (any dimension). */

function sub(a, b) {
  return a.map((x, i) => x - (b[i] ?? 0));
}
function norm(a) {
  return Math.sqrt(a.reduce((s, x) => s + x * x, 0));
}
function dot(a, b) {
  return a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
}
function unit(a) {
  const n = norm(a);
  return n > 1e-12 ? a.map((x) => x / n) : a.map(() => 0);
}
function cosine(a, b) {
  const na = norm(a);
  const nb = norm(b);
  return na < 1e-12 || nb < 1e-12 ? 0 : dot(a, b) / (na * nb);
}

/** The path a value (or vector of values) traces through state space over time. */
export class Gesture {
  /** @param {Point[]} points ordered readings, oldest first (defensively copied). */
  constructor(points = []) {
    this.points = points.map((p) => [...p]);
  }

  /** Build a gesture from a scalar series (e.g. one signal's history). */
  static fromSeries(series) {
    return new Gesture(series.map((v) => [v]));
  }

  get length() {
    return this.points.length;
  }

  /** The consecutive step vectors — the discrete velocity. */
  steps() {
    const out = [];
    for (let i = 1; i < this.points.length; i++) out.push(sub(this.points[i], this.points[i - 1]));
    return out;
  }

  /** Total distance travelled through state space. 0 for < 2 readings. */
  arcLength() {
    return this.steps().reduce((s, d) => s + norm(d), 0);
  }

  /** Magnitude of the latest step — how fast it is moving now. */
  speed() {
    const s = this.steps();
    return s.length ? norm(s[s.length - 1]) : 0;
  }

  /** Unit direction of the latest step — the "d_mu". Zero if still / too short. */
  heading() {
    const s = this.steps();
    return s.length ? unit(s[s.length - 1]) : (this.points[0]?.map(() => 0) ?? []);
  }

  /** Curvature — summed `1 − cos` between consecutive step directions. 0 for a
   *  straight drift at any speed; large for a path that keeps lurching. */
  bendingEnergy() {
    const s = this.steps();
    let e = 0;
    for (let i = 1; i < s.length; i++) {
      if (norm(s[i - 1]) > 1e-12 && norm(s[i]) > 1e-12) e += 1 - cosine(s[i - 1], s[i]);
    }
    return e;
  }

  /** Torsion — the turning that leaves the osculating plane. Per interior vertex,
   *  `sin θ` where θ is the angle by which the next step leaves the plane of the
   *  previous two; 0 for any planar path at any curvature; needs ≥ 4 points. */
  twistEnergy() {
    const s = this.steps();
    let e = 0;
    for (let i = 2; i < s.length; i++) {
      const s1 = s[i - 2], s2 = s[i - 1], s3 = s[i];
      const n1 = norm(s1);
      if (n1 < 1e-12) continue;
      const e1 = s1.map((x) => x / n1);
      const d21 = dot(s2, e1);
      const perp = s2.map((x, k) => x - d21 * e1[k]);
      const np = norm(perp);
      if (np < 1e-12) continue;
      const e2 = perp.map((x) => x / np);
      const n3 = norm(s3);
      if (n3 < 1e-12) continue;
      const d3 = s3.map((x) => x / n3);
      const c1 = dot(d3, e1);
      const c2 = dot(d3, e2);
      const out = d3.map((x, k) => x - c1 * e1[k] - c2 * e2[k]);
      e += Math.min(norm(out), 1);
    }
    return e;
  }

  /** How flat the gesture stays, in [0,1]: 1 for a path in one plane, toward 0 as
   *  more turning leaves it. 1 for a path too short to twist. */
  planarity() {
    const vertices = Math.max(0, this.steps().length - 1);
    if (vertices === 0) return 1;
    return Math.min(1, Math.max(0, 1 - this.twistEnergy() / vertices));
  }

  /** Per-vertex local turning `1 − cos` — the "stress" along the path, one value
   *  per interior point (the vibrating-hull stress line). Length = max(0, T−2). */
  stressProfile() {
    const s = this.steps();
    const out = [];
    for (let i = 1; i < s.length; i++) {
      out.push(norm(s[i - 1]) > 1e-12 && norm(s[i]) > 1e-12 ? 1 - cosine(s[i - 1], s[i]) : 0);
    }
    return out;
  }

  /** Resample to `n` points spaced evenly BY ARC LENGTH along the path, so shape
   *  reads independent of how fast/often it was sampled. */
  resample(n) {
    if (n < 1 || this.points.length === 0) return [];
    if (this.points.length === 1 || n === 1) {
      return Array.from({ length: Math.max(1, n) }, () => [...this.points[0]]);
    }
    const seg = this.steps().map((d) => norm(d));
    const total = seg.reduce((s, l) => s + l, 0);
    if (total < 1e-12) return Array.from({ length: n }, () => [...this.points[0]]);
    const cum = [0];
    for (const l of seg) cum.push(cum[cum.length - 1] + l);
    const out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const target = (i / (n - 1)) * total;
      while (j < seg.length - 1 && cum[j + 1] < target) j++;
      const t = seg[j] > 1e-12 ? (target - cum[j]) / seg[j] : 0;
      const p0 = this.points[j], p1 = this.points[j + 1];
      out.push(p0.map((x, k) => x + t * (p1[k] - x)));
    }
    return out;
  }
}

/** Do two gestures trend the same way? Cosine of their d_mu headings, [-1,1]. */
export function headingAlignment(a, b) {
  const ha = a.heading(), hb = b.heading();
  if (ha.length !== hb.length) return 0;
  return cosine(ha, hb);
}

/** How differently two gestures MOVE — free of position, scale, and sampling
 *  rate. Both are arc-length resampled to a common count, reduced to unit step
 *  directions, and scored by mean angular difference. 0 = same motion, 2 =
 *  opposed at every step; symmetric; 0 to itself. */
export function gestureDistance(a, b, samples = 32) {
  const n = Math.max(3, Math.floor(samples));
  const pa = a.resample(n), pb = b.resample(n);
  if (pa.length < 2 || pb.length < 2) return pa.length === pb.length ? 0 : 2;
  const dirs = (pts) => {
    const out = [];
    for (let i = 1; i < pts.length; i++) out.push(sub(pts[i], pts[i - 1]));
    return out;
  };
  const da = dirs(pa), db = dirs(pb);
  const m = Math.min(da.length, db.length);
  let sum = 0;
  for (let i = 0; i < m; i++) {
    if (norm(da[i]) < 1e-12 || norm(db[i]) < 1e-12) sum += 1;
    else sum += 1 - cosine(da[i], db[i]);
  }
  return m === 0 ? 0 : Math.min(2, Math.max(0, sum / m));
}

/** One-call summary of a gesture's geometry. */
export function readGesture(points) {
  const g = points instanceof Gesture ? points : new Gesture(points);
  return {
    length: g.length,
    arcLength: g.arcLength(),
    speed: g.speed(),
    heading: g.heading(),
    bendingEnergy: g.bendingEnergy(),
    twistEnergy: g.twistEnergy(),
    planarity: g.planarity(),
  };
}

export default Gesture;
