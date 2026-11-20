(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const ids = x => (Array.isArray(x) ? x : String(x).split(/\s+/).filter(Boolean));

  class Heap {
    constructor() { this.items = {}; this.edges = []; }
    clone() {
      const h = new Heap();
      for (const k in this.items) h.items[k] = { ...this.items[k] };
      h.edges = this.edges.map(e => ({ ...e }));
      return h;
    }
    add(id, p = {}) {
      this.items[id] = { id, kind: 'obj', x: 0, y: 0, w: 70, h: 44, label: id, sub: '', badge: '', cls: '', o: 1, ...p };
      return this;
    }
    region(id, p = {}) { return this.add(id, { kind: 'region', label: '', ...p }); }
    text(id, p = {}) { return this.add(id, { kind: 'text', w: 0, h: 0, ...p }); }
    ptr(id, p = {}) { return this.add(id, { kind: 'ptr', w: 0, h: 0, ...p }); }
    has(id) { return !!this.items[id]; }
    get(id) { return this.items[id]; }
    set(x, p) {
      for (const id of ids(x)) {
        const it = this.items[id];
        if (!it) throw new Error('no item ' + id);
        Object.assign(it, typeof p === 'function' ? p(it) : p);
      }
      return this;
    }
    cls(x, c) { return this.set(x, { cls: c }); }
    move(id, x, y) { return this.set(id, { x, y }); }
    del(x) {
      for (const id of ids(x)) {
        delete this.items[id];
        this.edges = this.edges.filter(e => e.a !== id && e.b !== id);
      }
      return this;
    }
    ref(a, b, p = {}) { this.unref(a, b); this.edges.push({ a, b, cls: '', ...p }); return this; }
    unref(a, b) { this.edges = this.edges.filter(e => !(e.a === a && (b === undefined || e.b === b))); return this; }
    edge(a, b, p) { this.edges.filter(e => e.a === a && e.b === b).forEach(e => Object.assign(e, p)); return this; }
    edgesFrom(a) { return this.edges.filter(e => e.a === a); }
    retarget(from, to) {
      for (const e of this.edges) { if (e.b === from) e.b = to; }
      return this;
    }
    each(f) { Object.values(this.items).forEach(f); return this; }
  }

  const scenes = {};
  const scene = (id, def) => { scenes[id] = def; };

  function buildStates(def) {
    const states = [];
    let h = new Heap();
    if (def.init) def.init(h);
    for (const st of def.steps) {
      h = h.clone();
      if (st.do) st.do(h);
      states.push(h);
    }
    return states;
  }

  const MARKERS = ['default', 'hot', 'weak', 'dead', 'barrier', 'muted', 'live', 'java', 'dotnet'];
  const markerOf = cls => {
    const c = ids(cls || '');
    return MARKERS.find(m => c.includes(m)) || 'default';
  };

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  class Player {
    constructor(def, svg) {
      this.def = def;
      this.states = buildStates(def);
      this.svg = svg;
      this.shown = {};
      this.nodes = {};
      this.items = {};
      this.edges = [];
      this.idx = -1;
      svg.setAttribute('viewBox', def.viewBox || '0 0 1000 640');
      const defs = el('defs', {}, svg);
      for (const m of MARKERS) {
        const mk = el('marker', { id: 'arr-' + m, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
        el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrowhead ah-' + m }, mk);
      }
      const glow = el('filter', { id: 'glow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
      el('feGaussianBlur', { stdDeviation: '5', result: 'b' }, glow);
      const merge = el('feMerge', {}, glow);
      el('feMergeNode', { in: 'b' }, merge);
      el('feMergeNode', { in: 'SourceGraphic' }, merge);
      this.layers = {
        region: el('g', { class: 'l-region' }, svg),
        edge: el('g', { class: 'l-edge' }, svg),
        bar: el('g', { class: 'l-bar' }, svg),
        obj: el('g', { class: 'l-obj' }, svg),
        ptr: el('g', { class: 'l-ptr' }, svg),
        text: el('g', { class: 'l-text' }, svg),
      };
    }
    get length() { return this.states.length; }

    node(it) {
      let n = this.nodes[it.id];
      const layer = this.layers[it.kind] || this.layers.obj;
      if (!n || n.kind !== it.kind) {
        if (n) n.g.remove();
        const g = el('g', {}, layer);
        n = { g, kind: it.kind };
        if (it.kind === 'text') {
          n.t = el('text', { class: 'txt' }, g);
        } else if (it.kind === 'ptr') {
          n.p = el('path', { d: 'M-9,-16 L9,-16 L0,0 z', class: 'ptr-head' }, g);
          n.t = el('text', { class: 'ptr-lbl', y: -24, 'text-anchor': 'middle' }, g);
        } else {
          n.r = el('rect', { class: 'box', rx: it.kind === 'region' ? 14 : it.kind === 'bar' ? 5 : 9 }, g);
          n.t = el('text', { class: 'lbl' }, g);
          n.s = el('text', { class: 'sub' }, g);
          n.bc = el('circle', { class: 'badge', r: 13 }, g);
          n.bt = el('text', { class: 'badge-t', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
        }
        this.nodes[it.id] = n;
      }
      n.g.setAttribute('class', `item k-${it.kind} ${it.cls || ''}`);
      n.t.textContent = it.label ?? '';
      if (it.kind === 'text') {
        n.t.setAttribute('text-anchor', it.anchor || 'start');
        n.t.style.fontSize = (it.size || 20) + 'px';
      }
      if (n.s) n.s.textContent = it.sub || '';
      if (n.bc) {
        const show = it.badge !== '' && it.badge !== undefined && it.badge !== null;
        n.bc.style.display = show ? '' : 'none';
        n.bt.style.display = show ? '' : 'none';
        n.bt.textContent = show ? it.badge : '';
      }
      return n;
    }

    layout(n, it, g) {
      n.g.setAttribute('transform', `translate(${g.x},${g.y})`);
      n.g.style.opacity = g.o;
      if (n.r) {
        n.r.setAttribute('width', Math.max(0, g.w));
        n.r.setAttribute('height', Math.max(0, g.h));
        if (it.kind === 'region') {
          n.t.setAttribute('x', 12); n.t.setAttribute('y', 24);
          n.s.setAttribute('x', g.w - 12); n.s.setAttribute('y', 24); n.s.setAttribute('text-anchor', 'end');
          n.t.setAttribute('text-anchor', 'start');
        } else {
          const hasSub = !!it.sub;
          n.t.setAttribute('x', g.w / 2); n.t.setAttribute('y', g.h / 2 + (hasSub ? -7 : 0));
          n.t.setAttribute('text-anchor', 'middle'); n.t.setAttribute('dominant-baseline', 'central');
          n.s.setAttribute('x', g.w / 2); n.s.setAttribute('y', g.h / 2 + 13);
          n.s.setAttribute('text-anchor', 'middle'); n.s.setAttribute('dominant-baseline', 'central');
        }
        n.bc.setAttribute('cx', g.w - 2); n.bc.setAttribute('cy', 2);
        n.bt.setAttribute('x', g.w - 2); n.bt.setAttribute('y', 2);
      }
    }

    goto(i, animate = true) {
      i = Math.max(0, Math.min(this.length - 1, i));
      const target = this.states[i];
      const dur = animate ? 700 : 0;
      const prev = this.shown;
      const from = {}, to = {}, removing = new Set();
      const all = new Set([...Object.keys(prev), ...Object.keys(target.items)]);
      for (const id of all) {
        const t = target.items[id];
        if (t) {
          this.node(t);
          to[id] = { x: t.x, y: t.y, w: t.w, h: t.h, o: t.o ?? 1 };
          if (prev[id]) from[id] = { ...prev[id] };
          else if (t.spawn && prev[t.spawn]) from[id] = { ...prev[t.spawn], o: Math.max(0.6, prev[t.spawn].o) };
          else from[id] = { ...to[id], o: 0 };
        } else {
          from[id] = { ...prev[id] };
          to[id] = { ...prev[id], o: 0 };
          removing.add(id);
        }
      }
      this.items = { ...this.items, ...target.items };
      this.edges = target.edges;
      this.idx = i;
      cancelAnimationFrame(this.raf);
      const start = performance.now();
      const frame = now => {
        const p = dur ? Math.min(1, (now - start) / dur) : 1;
        const e = ease(p);
        for (const id of all) {
          const a = from[id], b = to[id];
          const g = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e), o: lerp(a.o, b.o, e) };
          this.shown[id] = g;
          const n = this.nodes[id];
          if (n) this.layout(n, this.items[id], g);
        }
        this.drawEdges(p);
        if (p < 1) this.raf = requestAnimationFrame(frame);
        else {
          for (const id of removing) {
            if (this.nodes[id]) this.nodes[id].g.remove();
            delete this.nodes[id];
            delete this.shown[id];
            delete this.items[id];
          }
        }
      };
      if (dur) this.raf = requestAnimationFrame(frame);
      else frame(start);
    }

    drawEdges() {
      const layer = this.layers.edge;
      while (layer.firstChild) layer.firstChild.remove();
      for (const e of this.edges) {
        const A = this.shown[e.a], B = this.shown[e.b];
        if (!A || !B) continue;
        const ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
        let d, mid;
        if (e.c) {
          const ctrl = [(ca[0] + cb[0]) / 2 + e.c[0], (ca[1] + cb[1]) / 2 + e.c[1]];
          const s = clip(A, ca, ctrl), t = clip(B, cb, ctrl);
          d = `M${s[0]},${s[1]} Q${ctrl[0]},${ctrl[1]} ${t[0]},${t[1]}`;
          mid = [(s[0] + 2 * ctrl[0] + t[0]) / 4, (s[1] + 2 * ctrl[1] + t[1]) / 4];
        } else {
          const s = clip(A, ca, cb), t = clip(B, cb, ca);
          d = `M${s[0]},${s[1]} L${t[0]},${t[1]}`;
          mid = [(s[0] + t[0]) / 2, (s[1] + t[1]) / 2];
        }
        const o = Math.min(A.o, B.o) * (e.o ?? 1);
        el('path', { d, class: `edge ${e.cls || ''}`, 'marker-end': `url(#arr-${markerOf(e.cls)})`, style: `opacity:${o}` }, layer);
        if (e.label) {
          el('text', { x: mid[0] + (e.lx || 0), y: mid[1] - 8 + (e.ly || 0), class: `edge-lbl ${e.cls || ''}`, 'text-anchor': 'middle', style: `opacity:${o}` }, layer).textContent = e.label;
        }
      }
    }
  }

  function clip(g, c, toward) {
    const dx = toward[0] - c[0], dy = toward[1] - c[1];
    if (!dx && !dy) return c;
    const pad = g.w || g.h ? 5 : 0;
    const hw = g.w / 2 + pad, hh = g.h / 2 + pad;
    const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [c[0] + dx * t, c[1] + dy * t];
  }

  const KW = {
    cs: 'var new return if else null class void public private protected static using await async readonly struct ref out in fixed unsafe int byte bool string true false this override sealed',
    java: 'var new return if else null class void public private protected static try final int byte boolean String true false this import',
    c: 'char int void return if else NULL sizeof struct free malloc',
  };
  function highlight(code, lang) {
    const kw = new Set((KW[lang] || KW.cs).split(' '));
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return code.split('\n').map(line => {
      let out = '';
      const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d_]*\b)|([A-Za-z_][\w]*)|(\s+)|(.)/g;
      let m;
      while ((m = re.exec(line))) {
        if (m[1]) out += `<span class="c-com">${esc(m[1])}</span>`;
        else if (m[2]) out += `<span class="c-str">${esc(m[2])}</span>`;
        else if (m[3]) out += `<span class="c-num">${esc(m[3])}</span>`;
        else if (m[4]) out += kw.has(m[4]) ? `<span class="c-kw">${m[4]}</span>` : /^[A-Z]/.test(m[4]) ? `<span class="c-ty">${m[4]}</span>` : m[4];
        else out += esc(m[0]);
      }
      return out || ' ';
    });
  }

  window.GC = { Heap, Player, scene, scenes, highlight, ids };
})();
