// ═══════════════════════════════════════════════════════════════════
// <gesture-hull> — an embeddable widget that draws a gesture as a
// stress-coloured "vibrating hull": the path through abstraction space, each
// segment tinted by its local turning (blue = calm, red = taut), with live
// arc / bending / twist / planarity readouts.
//
// Usage (zero build, zero deps):
//   <script type="module" src="gesture-hull.js"></script>
//   <gesture-hull points="[[0,0],[1,2],[2,1],[3,3]]"></gesture-hull>
// or set el.points = [[...],[...]] in JS (arrays of any dimension; geometry is
// computed in full-D, the drawing projects to the two highest-variance axes).
// ═══════════════════════════════════════════════════════════════════

import { Gesture, readGesture } from './gesture.js';

// Project N-D points to 2-D by the two highest-variance axes (cheap: pick the
// two columns with the largest spread — stable, dependency-free, good enough to
// see the shape). Falls back to dims 0,1.
function projectAxes(points) {
  if (points.length === 0) return [0, 1];
  const d = points[0].length;
  if (d <= 2) return [0, 1];
  const min = new Array(d).fill(Infinity);
  const max = new Array(d).fill(-Infinity);
  for (const p of points) {
    for (let k = 0; k < d; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  const spread = min.map((m, k) => max[k] - m);
  const order = spread.map((s, k) => [s, k]).sort((a, b) => b[0] - a[0]);
  return [order[0][1], order[1] ? order[1][1] : order[0][1]];
}

function lerpColor(t) {
  // t in [0,1]: calm blue (210°) → taut red (0°) through amber.
  const hue = 210 - 210 * Math.max(0, Math.min(1, t));
  return `hsl(${hue}, 85%, 55%)`;
}

const STYLE = `
  :host { display:block; font-family: ui-sans-serif, system-ui, sans-serif; color: var(--gh-fg, #e8eaed);
          background: var(--gh-bg, #0e1116); border-radius: 10px; padding: 12px; box-sizing:border-box; }
  .wrap { display:flex; flex-direction:column; gap:8px; }
  svg { width:100%; height:auto; background: var(--gh-plot, #11151c); border-radius: 8px; display:block; }
  .stats { display:flex; flex-wrap:wrap; gap:10px 18px; font-size:12px; opacity:.92; }
  .stat b { font-variant-numeric: tabular-nums; }
  .k { opacity:.6; margin-right:4px; }
  .title { font-size:12px; letter-spacing:.04em; text-transform:uppercase; opacity:.55; }
`;

export class GestureHull extends HTMLElement {
  static get observedAttributes() { return ['points']; }

  constructor() {
    super();
    this._points = [];
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this._points.length && this.hasAttribute('points')) this._parseAttr();
    this.render();
  }

  attributeChangedCallback(name) {
    if (name === 'points') { this._parseAttr(); this.render(); }
  }

  _parseAttr() {
    try {
      const v = JSON.parse(this.getAttribute('points') || '[]');
      if (Array.isArray(v)) this._points = v;
    } catch { /* keep last good value */ }
  }

  /** Set the gesture's points programmatically: an array of numeric vectors. */
  set points(v) {
    this._points = Array.isArray(v) ? v : [];
    this.render();
  }
  get points() { return this._points; }

  render() {
    const pts = this._points.filter((p) => Array.isArray(p) && p.length);
    const g = new Gesture(pts);
    const stats = readGesture(g);
    const stress = g.stressProfile(); // one per interior vertex
    const [ax, ay] = projectAxes(pts);

    const W = 320, H = 200, pad = 16;
    let body;
    if (pts.length < 2) {
      body = `<text x="${W / 2}" y="${H / 2}" fill="#6b7280" font-size="12" text-anchor="middle">give me at least two readings</text>`;
    } else {
      const xs = pts.map((p) => p[ax] ?? 0);
      const ys = pts.map((p) => p[ay] ?? 0);
      const xmin = Math.min(...xs), xmax = Math.max(...xs);
      const ymin = Math.min(...ys), ymax = Math.max(...ys);
      const sx = (x) => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
      const sy = (y) => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);
      const P = pts.map((p) => [sx(p[ax] ?? 0), sy(p[ay] ?? 0)]);

      // Segments coloured by the stress at the vertex they lead into.
      let segs = '';
      for (let i = 1; i < P.length; i++) {
        const s = stress[i - 1] ?? 0;                 // stress at vertex i (interior)
        const col = lerpColor(s / 2);                 // stress in [0,2]
        const wdt = 1.5 + 3 * Math.min(1, s / 2);
        segs += `<line x1="${P[i - 1][0].toFixed(1)}" y1="${P[i - 1][1].toFixed(1)}" x2="${P[i][0].toFixed(1)}" y2="${P[i][1].toFixed(1)}" stroke="${col}" stroke-width="${wdt.toFixed(1)}" stroke-linecap="round"/>`;
      }
      const dots = P.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === P.length - 1 ? 4 : 2.2}" fill="${i === P.length - 1 ? '#e8eaed' : '#5b6472'}"/>`).join('');
      body = segs + dots;
    }

    const dims = pts[0]?.length ?? 0;
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <div class="wrap">
        <div class="title">gesture · ${stats.length} readings${dims > 2 ? ` · ${dims}-D → axes ${ax},${ay}` : ''}</div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="gesture hull">${body}</svg>
        <div class="stats">
          <span class="stat"><span class="k">arc</span><b>${stats.arcLength.toFixed(2)}</b></span>
          <span class="stat"><span class="k">bend</span><b>${stats.bendingEnergy.toFixed(2)}</b></span>
          <span class="stat"><span class="k">twist</span><b>${stats.twistEnergy.toFixed(2)}</b></span>
          <span class="stat"><span class="k">planarity</span><b>${stats.planarity.toFixed(2)}</b></span>
          <span class="stat"><span class="k">|d_mu|</span><b>${stats.speed.toFixed(2)}</b></span>
        </div>
      </div>`;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('gesture-hull')) {
  customElements.define('gesture-hull', GestureHull);
}

export default GestureHull;
