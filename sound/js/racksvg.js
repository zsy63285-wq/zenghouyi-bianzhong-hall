/* ═══ SVG 编钟演奏台生成器 ═══
   照片底图加载失败时的兜底方案：程序化生成三层钟架 + 65 件可点击编钟。 */
window.ZY = window.ZY || {};
(function () {
  'use strict';

  /* ── 单件钟正面轮廓 path（原点=钟口中心，y 向上为负） ──
     flat = true → 镈钟：平口（于口平直）；其余为合瓦形，于口呈月牙状上收 */
  function bellPath(r, h, flat) {
    const topW = r * 0.74;
    const by = 0, ty = -h;
    const rim = h * 0.16;           // 于口中部上收
    if (flat) {
      return 'M ' + (-topW) + ' ' + ty +
        ' C ' + (-r * 0.88) + ' ' + (ty + h * 0.28) + ', ' + (-r) + ' ' + (ty + h * 0.62) + ', ' + (-r) + ' ' + by +
        ' L ' + r + ' ' + by +
        ' C ' + r + ' ' + (ty + h * 0.62) + ', ' + (r * 0.88) + ' ' + (ty + h * 0.28) + ', ' + topW + ' ' + ty +
        ' Q 0 ' + (ty - h * 0.05) + ', ' + (-topW) + ' ' + ty + ' Z';
    }
    return 'M ' + (-topW) + ' ' + ty +
      ' C ' + (-r * 0.86) + ' ' + (ty + h * 0.28) + ', ' + (-r) + ' ' + (ty + h * 0.6) + ', ' + (-r) + ' ' + (by - rim * 0.4) +
      ' Q ' + (-r * 0.5) + ' ' + (by - rim * 1.15) + ', 0 ' + (by - rim) +
      ' Q ' + (r * 0.5) + ' ' + (by - rim * 1.15) + ', ' + r + ' ' + (by - rim * 0.4) +
      ' C ' + r + ' ' + (ty + h * 0.6) + ', ' + (r * 0.86) + ' ' + (ty + h * 0.28) + ', ' + topW + ' ' + ty +
      ' Q 0 ' + (ty - h * 0.05) + ', ' + (-topW) + ' ' + ty + ' Z';
  }

  /* 甬（柄）— 返回附加元素组 */
  function bellTop(type, r, h, doc) {
    const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
      const el = doc.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    };
    if (type === 'yong') {
      const w = r * 0.13;
      g.appendChild(mk('rect', { class: 'rk-yong', x: -w, y: -h * 1.3, width: w * 2, height: h * 0.32, rx: w * 0.4 }));
      g.appendChild(mk('path', { d: 'M ' + (-w * 1.7) + ' ' + (-h * 1.12) + ' H ' + (w * 1.7), fill: 'none', class: 'rk-hook' }));
    } else if (type === 'niu') {
      g.appendChild(mk('path', { d: 'M ' + (-r * 0.22) + ' ' + (-h) + ' q ' + (r * 0.22) + ' ' + (-h * 0.14) + ', ' + (r * 0.44) + ' 0', fill: 'none', class: 'rk-hook' }));
    } else { // bo
      g.appendChild(mk('rect', { class: 'rk-yong', x: -r * 0.3, y: -h * 1.16, width: r * 0.6, height: h * 0.16, rx: r * 0.08 }));
      g.appendChild(mk('circle', { cx: -r * 0.34, cy: -h * 1.2, r: r * 0.1 }));
      g.appendChild(mk('circle', { cx: r * 0.34, cy: -h * 1.2, r: r * 0.1 }));
    }
    return g;
  }

  /* 乳钉枚：两列三行 */
  function bellMeis(r, h, doc, small) {
    if (small || r < 9) return null;
    const NS = 'http://www.w3.org/2000/svg';
    const g = doc.createElementNS(NS, 'g');
    const rows = 3, cols = 2;
    for (let side = -1; side <= 1; side += 2) {
      for (let c = 0; c < cols; c++) {
        for (let i = 0; i < rows; i++) {
          const cx = side * r * (0.28 + c * 0.3);
          const cy = -h * (0.42 + i * 0.16);
          const dot = doc.createElementNS(NS, 'circle');
          dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
          dot.setAttribute('r', Math.max(1, r * 0.055));
          g.appendChild(dot);
        }
      }
    }
    return g;
  }

  /* 镈钟枚：两面各 10 枚，呈梅花形排列 */
  function bellMeisBo(r, h, doc) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = doc.createElementNS(NS, 'g');
    const R = Math.max(1.2, r * 0.055);
    [-1, 1].forEach(side => {
      const cx0 = side * r * 0.44, cy0 = -h * 0.56;
      [[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]].forEach(p => {
        const dot = doc.createElementNS(NS, 'circle');
        dot.setAttribute('cx', cx0 + p[0] * r * 0.13);
        dot.setAttribute('cy', cy0 + p[1] * h * 0.1);
        dot.setAttribute('r', R);
        g.appendChild(dot);
      });
    });
    return g;
  }

  function buildRack(container, opts) {
    opts = opts || {};
    const NS = 'http://www.w3.org/2000/svg';
    const doc = document;
    const W = 1200, H = 660;
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '曾侯乙编钟 · 演奏台');

    svg.innerHTML =
      '<defs>' +
      '<linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#bdbdb6"/><stop offset=".45" stop-color="#9c9c94"/>' +
      '<stop offset="1" stop-color="#73736c"/></linearGradient>' +
      '</defs>';

    const gAll = doc.createElementNS(NS, 'g');
    svg.appendChild(gAll);
    const el = (tag, attrs, parent) => {
      const e = doc.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      (parent || gAll).appendChild(e);
      return e;
    };

    const tierY = { 0: 470, 1: 318, 2: 200 };
    const beamH = { 0: 15, 1: 11, 2: 9 };

    el('rect', { x: 50, y: 640, width: 1120, height: 1, fill: 'rgba(233,227,213,.10)' });

    function columnPost(x, topY) {
      el('rect', { class: 'rk-post', x: x - 5, y: topY, width: 10, height: 640 - topY });
      el('rect', { class: 'rk-cap', x: x - 9, y: topY - 8, width: 18, height: 9 });
      el('rect', { class: 'rk-cap', x: x - 14, y: 630, width: 28, height: 10 });
    }
    [55, 415, 805, 1145].forEach(x => columnPost(x, tierY[2]));

    const SEGS = {
      0: [{ x0: 40, x1: 1160 }],
      1: [{ x0: 40, x1: 430 }, { x0: 470, x1: 1160 }],
      2: [{ x0: 70, x1: 390 }, { x0: 440, x1: 780 }, { x0: 850, x1: 1140 }],
    };
    [2, 1, 0].forEach(t => {
      SEGS[t].forEach(s => {
        el('rect', { class: 'rk-beam', x: s.x0, y: tierY[t], width: s.x1 - s.x0, height: beamH[t], rx: 1 });
        el('rect', { class: 'rk-cap', x: s.x0 - 2, y: tierY[t] - 4, width: 20, height: beamH[t] + 8 });
        el('rect', { class: 'rk-cap', x: s.x1 - 18, y: tierY[t] - 4, width: 20, height: beamH[t] + 8 });
      });
    });
    [2, 1].forEach(t => {
      const y0 = tierY[t] + beamH[t], y1 = tierY[t - 1];
      SEGS[t].forEach(s => {
        el('rect', { class: 'rk-post', x: s.x0 + 10, y: y0, width: 9, height: y1 - y0 });
        el('rect', { class: 'rk-post', x: s.x1 - 19, y: y0, width: 9, height: y1 - y0 });
      });
    });

    const byId = {};
    const bellsG = el('g', {});
    const D = ZY.DATA;
    const pool = { 0: [], 1: [], 2: [] };
    D.registry.forEach(rec => pool[rec.tier].push(rec));

    function placeBell(rec, cx, beamBottomY, r, h, slotIdx) {
      const off = rec.type === 'yong' ? h * 1.3 : rec.type === 'bo' ? h * 1.2 + r * 0.1 : h * 1.07;
      const g = doc.createElementNS(NS, 'g');
      g.setAttribute('class', 'rk-bell');
      g.setAttribute('data-id', rec.id);
      g.setAttribute('transform', 'translate(' + cx + ',' + (beamBottomY + off) + ')');
      const body = doc.createElementNS(NS, 'path');
      body.setAttribute('d', bellPath(r, h, rec.type === 'bo'));   // 镈钟平口
      g.appendChild(body);
      g.appendChild(bellTop(rec.type, r, h, doc));
      if (rec.type === 'bo') {
        g.appendChild(bellMeisBo(r, h, doc));                      // 两面具 10 枚，梅花形
      } else {
        const meis = bellMeis(r, h, doc, rec.tier === 2 && slotIdx % 2 === 0);
        if (meis) g.appendChild(meis);
      }
      const ring = doc.createElementNS(NS, 'circle');
      ring.setAttribute('class', 'rk-ring');
      ring.setAttribute('cx', 0); ring.setAttribute('cy', -h * 0.45);
      ring.setAttribute('r', Math.max(r * 1.5, 16));
      g.appendChild(ring);
      bellsG.appendChild(g);
      byId[rec.id] = { rec, g, h, r };
      return g;
    }

    const RF = { 0: 105, 1: 112, 2: 108 }, HF = { 0: 92, 1: 96, 2: 105 };
    const SEG_N = { 0: [13], 1: [13, 20], 2: [6, 6, 7] };
    [2, 1, 0].forEach(t => {
      const queue = pool[t].slice().sort((a, b) => (a.beam === b.beam ? 0 : a.beam === 'short' ? -1 : 1));
      if (t === 0) {
        const bo = queue.find(r => r.type === 'bo');
        const yongs = queue.filter(r => r.type !== 'bo');
        queue.splice(0, queue.length, ...yongs.slice(0, 6), bo, ...yongs.slice(6));
      }
      let ptr = 0;
      SEGS[t].forEach((s, si) => {
        const seg = queue.slice(ptr, ptr + SEG_N[t][si]);
        ptr += seg.length;
        const maxR = ((s.x1 - s.x0) / seg.length) * 0.5 * 0.9;
        const plain = seg.filter(x => x.type !== 'bo');
        const rMin = Math.min(...plain.map(x => x.r)), rMax = Math.max(...plain.map(x => x.r));
        const hMin = Math.min(...plain.map(x => x.h)), hMax = Math.max(...plain.map(x => x.h));
        seg.forEach((rec, i) => {
          const f = seg.length === 1 ? 0.5 : i / (seg.length - 1);
          const cx = s.x0 + (s.x1 - s.x0) * f;
          const isBo = rec.type === 'bo';
          const r = Math.min((isBo ? rMax * 1.2 : rMin + (rMax - rMin) * f) * RF[t], maxR);
          const h = (isBo ? hMax * 1.06 : hMin + (hMax - hMin) * f) * HF[t];
          placeBell(rec, cx, tierY[t] + beamH[t] - 2, r, h, i);
        });
      });
    });

    el('text', { class: 'rk-label', x: 70, y: tierY[2] - 44 }).textContent = '上层 · 钮钟 19';
    el('text', { class: 'rk-label', x: 70, y: tierY[1] - 30 }).textContent = '中层 · 甬钟 33';
    el('text', { class: 'rk-label', x: 70, y: tierY[0] - 40 }).textContent = '下层 · 甬钟 12 + 镈 1';

    container.innerHTML = '';
    container.appendChild(svg);

    /* 兜底 SVG 钟架也使用细线弧，而不是整圈光环 */
    function ripple(g, h, r) {
      const grp = doc.createElementNS(NS, 'g');
      grp.setAttribute('transform', 'translate(0,' + (-h * 0.12).toFixed(1) + ')');
      g.appendChild(grp);
      const bw = Math.max(r * 1.1, 12);
      const colors = ['rgba(130,62,42,.86)', 'rgba(145,85,55,.68)', 'rgba(104,62,43,.5)'];
      const widths = [1.55, 1.25, .95];
      const items = [];
      for (let k = 0; k < 3; k++) {
        const aw = bw * (1 + k * 0.18), ah = aw * 0.24;
        const p = doc.createElementNS(NS, 'path');
        p.setAttribute('d', 'M ' + (-aw).toFixed(1) + ' 0 Q 0 ' + (ah * 1.8).toFixed(1) + ' ' + aw.toFixed(1) + ' 0');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', colors[k]);
        p.setAttribute('stroke-width', String(widths[k]));
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        p.setAttribute('opacity', '0');
        grp.appendChild(p);
        items.push({ p: p, base: 0.82 - k * 0.16, delay: k * 105, dur: 1080 + k * 80 });
      }
      const t0 = performance.now();
      function step(ts) {
        const elapsed = ts - t0;
        items.forEach(it => {
          const f = (elapsed - it.delay) / it.dur;
          if (f < 0 || f >= 1) { it.p.setAttribute('opacity', '0'); return; }
          const e = 1 - Math.pow(1 - f, 3);
          it.p.setAttribute('transform', 'scale(' + (0.72 + e * 1.45).toFixed(4) + ')');
          it.p.setAttribute('opacity', (it.base * Math.min(1, f * 10) * Math.pow(1 - f, 1.15)).toFixed(4));
        });
        if (elapsed < 1380) requestAnimationFrame(step);
        else grp.remove();
      }
      requestAnimationFrame(step);
    }

    Object.keys(byId).forEach(id => {
      const item = byId[id];
      item.g.addEventListener('click', () => {
        ripple(item.g, item.h, item.r);
        if (opts.onFreeClick) opts.onFreeClick(item.rec, item.g);
      });
    });

    return {
      svg,
      byId,
      flash(rec, ms) {
        const item = byId[rec.id];
        if (!item) return;
        item.g.classList.add('hit');
        ripple(item.g, item.h, item.r);
        setTimeout(() => item.g.classList.remove('hit'), ms || 480);
      },
      setTarget(rec, side) {
        Object.keys(byId).forEach(id => {
          byId[id].g.classList.remove('target', 'target-side');
        });
        if (rec && byId[rec.id]) {
          byId[rec.id].g.classList.add('target');
          if (side) byId[rec.id].g.classList.add('target-side');
        }
      },
      rippleFor(rec) {
        const item = byId[rec.id];
        if (item) ripple(item.g, item.h, item.r);
      }
    };
  }

  ZY.RackSVG = { buildRack, bellPath };
})();
