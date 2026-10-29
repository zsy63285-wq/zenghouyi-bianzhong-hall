/* ═══ 编钟声音交互 DEMO · 页面逻辑 ═══
   自由演奏（正鼓 / 侧鼓）+ 曲目体验（跟随 / 自动）+ 声波可视化 */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const D = ZY.DATA;

  /* ───────── 提示条 ───────── */
  let toastTimer = null;
  function toast(name, info) {
    /* 嵌入主展厅 iframe 时，提示条交给父页面固定在视口底部显示，
       避免因 iframe 高度等于整段内容而把提示条推到看不见的底部。 */
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'sound-toast', name: name, info: info }, '*'); return; } catch (e) {}
    }
    const t = $('#toast');
    $('#toastName').textContent = name;
    $('#toastInfo').textContent = info;
    t.classList.remove('hidden');
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ───────── 声波可视化 ─────────
     不再用随机柱状高度，直接读取 AnalyserNode 的时域波形：
     钟声起振时线形起伏，随后随真实音频一起衰减。静止时只剩一条极淡的轴线。 */
  const waveCv = $('#waveCanvas'), waveCtx = waveCv.getContext('2d');
  const waveBuf = new Float32Array(2048);
  let waveLevel = 0;
  let waveDpr = 1;

  function fitWaveCanvas() {
    const w = waveCv.clientWidth || 260;
    const h = waveCv.clientHeight || 44;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    waveDpr = dpr;
    if (waveCv.width !== Math.round(w * dpr) || waveCv.height !== Math.round(h * dpr)) {
      waveCv.width = Math.round(w * dpr);
      waveCv.height = Math.round(h * dpr);
    }
    return { w: w, h: h };
  }

  (function waveLoop() {
    requestAnimationFrame(waveLoop);
    const { w, h } = fitWaveCanvas();
    const ctx = waveCtx;
    ctx.setTransform(waveDpr, 0, 0, waveDpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const mid = h / 2;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(33,29,23,.13)';
    ctx.beginPath();
    ctx.moveTo(10, mid + .5);
    ctx.lineTo(w - 10, mid + .5);
    ctx.stroke();

    if (!ZY.audio || !ZY.audio.readWave) return;
    const rms = ZY.audio.readWave(waveBuf);
    const target = Math.min(1, rms * 11);
    waveLevel += (target - waveLevel) * (target > waveLevel ? 0.55 : 0.07);
    if (waveLevel < 0.0035) return;

    /* 从一个上行过零点起画，避免波形相位随机跳动 */
    let start = 0;
    for (let i = 1; i < waveBuf.length; i++) {
      if (waveBuf[i - 1] <= 0 && waveBuf[i] > 0) { start = i; break; }
    }
    const span = Math.min(1024, waveBuf.length - start);
    const left = 10, right = w - 10;

    ctx.beginPath();
    ctx.lineWidth = 1.15;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(124,69,47,' + (0.16 + 0.62 * Math.min(1, waveLevel * 2.2)).toFixed(3) + ')';
    for (let x = 0; x <= right - left; x++) {
      const idx = start + Math.floor(x / Math.max(1, right - left) * (span - 1));
      /* tanh 软压缩：保留起振峰值，又不至于把波形削成方波 */
      const v = Math.tanh(waveBuf[idx] * 1.55);
      const px = left + x;
      const py = mid - v * (h / 2 - 5) * 0.96;
      if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  })();

  /* ───────── 演奏台 ───────── */
  let rack = null;
  let mode = 'free';                 // free | song
  let side = false;                  // false 正鼓 / true 侧鼓
  let curSong = D.SONGS.chushang;
  const player = new ZY.MusicPlayer(ZY.audio);

  /* ── 单件钟注释 ── */
  function bellTitle(rec) {
    if (rec.mono) {
      return '楚王熊章镈钟 · ' + rec.bo.mark + '\n' + rec.bo.size +
        '\n平口 · 环钮 · 不具一钟双音\n' + rec.bo.desc +
        '\n正鼓音 ≈ 89 Hz（约 F2，实测值）';
    }
    return rec.group + ' ' + rec.name + '（' + rec.groupNote + '）\n' +
      '正鼓 ' + rec.front.note + ' · ' + rec.front.jie + ' · ' + rec.front.lu + '律\n' +
      '侧鼓 ' + rec.side.note + ' · ' + rec.side.jie + ' · ' + rec.side.lu + '律（高出' +
      (rec.thirdIsMinor ? '小三度' : '大三度') + '）' +
      (rec.sideWeak ? '\n※ 下层大甬钟侧鼓音不明显（实测）' : '');
  }
  function noteLabel(info) {
    return info.note + (info.jie ? ' · ' + info.jie + ' · ' + info.lu + '律' : '');
  }

  /* 图像版演奏台：底图 + 逐列实测热区 */
  function buildImageRack(container, opts) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'img-rack';
    wrap.innerHTML = '<img src="assets/img/rack-flat.png" alt="曾侯乙编钟 · 演奏台">' +
      '<svg class="fx-layer" viewBox="0 0 1774 887" preserveAspectRatio="none" aria-hidden="true"></svg>' +
      '<div class="img-spots"></div>';
    container.appendChild(wrap);

    const img = wrap.querySelector('img');
    img.addEventListener('error', () => {
      /* 底图缺失 → 回退到程序化 SVG 钟架 */
      try { rack = ZY.RackSVG.buildRack(container, opts); } catch (e) { console.error(e); }
    });

    const spotLayer = wrap.querySelector('.img-spots');
    const fxLayer = wrap.querySelector('.fx-layer');
    const bgEcho = document.getElementById('bgEcho');
    const byId = {};
    let targetRing = null;

    /* 镈钟位置：悬于下层长架中部，编号「下层二组 6 号」
       —— 下层共 13 个位置（12 甬 + 1 镈），即左起第 9 位（＝右起第 5 位）→ 索引 8
       若所用底图左右相反，把 BO_SLOT 改成 4。 */
    const BO_SLOT = 8;

    const put = (f, fy, w, rec) => {
      const d = document.createElement('div');
      d.className = 'fh-spot';
      if (rec.mono) d.classList.add('fh-spot--bo');
      d.style.left = f * 100 + '%';
      d.style.top = fy * 100 + '%';
      d.style.width = 'max(' + (w * 100).toFixed(3) + '%, 15px)';
      d.title = bellTitle(rec);
      d.addEventListener('click', e => opts.onFreeClick(rec, d, !!e.shiftKey));
      spotLayer.appendChild(d);
      byId[rec.id] = { rec, fx: f, fy: fy, fw: w, el: d };
    };

    /* 钟体局部的明暗与极小幅位移：用同一张底图做遮片，
       只让对应钟体的像素产生 0.5px 级的错动和亮度变化，不改变形状与位置 */
    function nudgeBell(rec, dur) {
      const s = byId[rec.id];
      if (!s) return;
      const ghost = document.createElement('div');
      ghost.className = 'bell-ghost';
      ghost.style.setProperty('--x', (s.fx * 100).toFixed(3) + '%');
      ghost.style.setProperty('--y', (s.fy * 100).toFixed(3) + '%');
      ghost.style.setProperty('--rx', (s.fw * 56).toFixed(3) + '%');
      ghost.style.setProperty('--ry', (rec.tier === 0 ? 9.8 : rec.tier === 1 ? 4.9 : 3.7) + '%');
      wrap.appendChild(ghost);

      const life = dur || 230;
      if (ghost.animate) {
        const anim = ghost.animate([
          { opacity: 0,   transform: 'translateX(0)',     filter: 'brightness(1)' },
          { opacity: .6,  transform: 'translateX(-.55px)', filter: 'brightness(.8) saturate(.92)', offset: .28 },
          { opacity: .48, transform: 'translateX(.45px)',  filter: 'brightness(1.16) saturate(1.02)', offset: .58 },
          { opacity: 0,   transform: 'translateX(0)',     filter: 'brightness(1)' }
        ], { duration: life, easing: 'cubic-bezier(.22,.61,.2,1)' });
        anim.onfinish = () => ghost.remove();
        setTimeout(() => ghost.remove(), life + 120);
      } else {
        setTimeout(() => ghost.remove(), life);
      }
    }

    /* 从钟口附近散开的两三道细线弧，向外扩散并自然淡出 */
    function bellArcs(rec, isSide) {
      const s = byId[rec.id];
      if (!s || !fxLayer) return;
      const NS = 'http://www.w3.org/2000/svg';
      const W = 1774, H = 887;
      const cx = s.fx * W;
      const cy = s.fy * H + Math.max(8, s.fw * W * 0.88);
      const bw = Math.max(14, s.fw * W * 1.05);
      const colors = isSide
        ? ['rgba(139,82,46,.86)', 'rgba(120,74,44,.68)', 'rgba(96,60,40,.5)']
        : ['rgba(130,62,42,.86)', 'rgba(145,85,55,.68)', 'rgba(104,62,43,.5)'];
      const widths = [1.55, 1.25, .95];
      const g = document.createElementNS(NS, 'g');
      fxLayer.appendChild(g);
      const items = [];
      for (let k = 0; k < 3; k++) {
        const aw = bw * (1 + k * 0.17);
        const ah = aw * 0.22;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M ' + (-aw).toFixed(2) + ' 0 Q 0 ' + (ah * 1.8).toFixed(2) + ' ' + aw.toFixed(2) + ' 0');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', colors[k]);
        p.setAttribute('stroke-width', String(widths[k]));
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        p.setAttribute('opacity', '0');
        g.appendChild(p);
        items.push({ p: p, base: 0.82 - k * 0.16, delay: k * 105, dur: 1080 + k * 80 });
      }

      const t0 = performance.now();
      function step(now) {
        const elapsed = now - t0;
        items.forEach(it => {
          const f = (elapsed - it.delay) / it.dur;
          if (f < 0 || f >= 1) { it.p.setAttribute('opacity', '0'); return; }
          const e = 1 - Math.pow(1 - f, 3);
          const scale = 0.72 + e * 1.45;
          it.p.setAttribute('transform', 'translate(' + cx.toFixed(2) + ',' + cy.toFixed(2) + ') scale(' + scale.toFixed(4) + ')');
          it.p.setAttribute('opacity', (it.base * Math.min(1, f * 10) * Math.pow(1 - f, 1.15)).toFixed(4));
        });
        if (elapsed < 1380) requestAnimationFrame(step);
        else g.remove();
      }
      requestAnimationFrame(step);
    }

    /* 临近的一段背景纹样短暂增强，1.35s 后回到原来的淡度 */
    function echoPattern(rec) {
      if (!bgEcho) return;
      const s = byId[rec.id];
      if (!s) return;
      const r = wrap.getBoundingClientRect();
      const x = window.scrollX + r.left + s.fx * r.width;
      const y = window.scrollY + r.top + s.fy * r.height;
      const w = Math.min(480, Math.max(280, window.innerWidth * 0.34));
      const h = Math.min(280, Math.max(170, window.innerWidth * 0.13));
      bgEcho.style.width = w.toFixed(0) + 'px';
      bgEcho.style.height = h.toFixed(0) + 'px';
      bgEcho.style.left = (x - w * 0.5).toFixed(0) + 'px';
      bgEcho.style.top = (y - h * 0.55).toFixed(0) + 'px';
      bgEcho.style.backgroundPosition = '50% ' + (rec.tier === 2 ? '10%' : rec.tier === 1 ? '40%' : '72%');
      bgEcho.classList.remove('on');
      void bgEcho.offsetWidth;
      bgEcho.classList.add('on');
    }

    const tiers = { 0: [], 1: [], 2: [] };
    D.registry.forEach(rec => tiers[rec.tier].push(rec));
    Object.values(tiers).forEach(a => a.sort((x, y) => x.front.freq - y.front.freq));
    /* 下层：镈钟插在「下层二组 6 号」位置（见 BO_SLOT） */
    const bo = tiers[0].find(r => r.mono);
    const yongs0 = tiers[0].filter(r => !r.mono);
    tiers[0] = yongs0.slice(0, BO_SLOT).concat([bo], yongs0.slice(BO_SLOT)).filter(Boolean);

    /* 摆位表：按抠图版底图逐件实测的钟体中心（比例坐标）——65 件按音高左→右对应
       ys 为个别钟的纵向微调：中层最左两件挂得略高，镈钟钟体更高、中心更低 */
    const ROWS = [
      { fy: 0.310, w: 0.021, bells: tiers[2], xs: [0.1722, 0.1933, 0.2145, 0.2356, 0.2565, 0.2768, 0.4374, 0.4611, 0.4853, 0.5087, 0.5307, 0.5527, 0.7162, 0.7373, 0.7582, 0.7796, 0.8027, 0.8241, 0.8455] },
      { fy: 0.462, w: 0.022, bells: tiers[1], xs: [0.0474, 0.0733, 0.1412, 0.1638, 0.1852, 0.206, 0.2272, 0.2483, 0.2697, 0.2909, 0.3109, 0.3489, 0.3737, 0.4011, 0.4278, 0.4535, 0.48, 0.5059, 0.5318, 0.5567, 0.5817, 0.6071, 0.6316, 0.6778, 0.7015, 0.7252, 0.7494, 0.7737, 0.7985, 0.823, 0.8481, 0.8737, 0.8999], ys: { 0: 0.445, 1: 0.454 } },
      { fy: 0.696, w: 0.052, bells: tiers[0], xs: [0.1612, 0.2232, 0.2849, 0.3622, 0.4064, 0.4515, 0.4963, 0.5437, 0.6082, 0.6964, 0.7556, 0.8165, 0.8774], ys: { 8: 0.725 } },
    ];
    ROWS.forEach(({ fy, w, bells, xs, ys }) => {
      const n = bells.length;
      xs.forEach((f, i) => {
        const rec = xs.length === 1 ? bells[0] : (bells[Math.round(i * (n - 1) / (xs.length - 1))] || bells[n - 1]);
        put(f, (ys && ys[i] != null) ? ys[i] : fy, w, rec);
      });
    });

    return {
      flash(rec, ms, isSide, withEcho) {
        if (!rec || !byId[rec.id]) return;
        const dur = Math.min(250, Math.max(170, (ms || 230) * 0.45));
        nudgeBell(rec, dur);
        bellArcs(rec, isSide);
        if (withEcho) echoPattern(rec);
      },
      rippleFor(rec) { bellArcs(rec, false); },
      setTarget(rec, isSide) {
        /* 清掉上一件目标钟的命中放大，避免残留的大热区抢走邻钟的点击 */
        Object.keys(byId).forEach(id => {
          byId[id].el.classList.remove('fh-spot--target', 'fh-spot--target-side');
        });
        if (targetRing) { targetRing.remove(); targetRing = null; }
        if (!rec) return;
        const s = byId[rec.id];
        if (!s) return;
        /* 脉冲环会放大 1.16 倍，故同步放大该钟的命中区 —— 照着环点必中，不会落到邻钟 */
        s.el.classList.add('fh-spot--target');
        if (isSide) s.el.classList.add('fh-spot--target-side');
        targetRing = document.createElement('div');
        targetRing.className = 'fh-ring fh-target' + (isSide ? ' fh-target-side' : '');
        targetRing.style.left = s.fx * 100 + '%';
        targetRing.style.top = s.fy * 100 + '%';
        const ringMin = window.innerWidth <= 720 ? 18 : 26;
        targetRing.style.width = targetRing.style.height = 'max(' + (s.fw * 100).toFixed(3) + '%, ' + ringMin + 'px)';
        spotLayer.appendChild(targetRing);
      },
    };
  }

  /* ───────── 敲击 ───────── */
  function onFreeClick(rec, el, shift) {
    const useSide = shift ? !side : side;   // Shift + 点击 = 临时切换击奏部位

    /* 镈钟：平口单音，不在全套乐律序列内，古时演奏不用 */
    if (rec.mono) {
      if (useSide) {
        toast('镈钟不发侧鼓音', '平口 · 环钮 · 不具一钟双音');
        return;
      }
      ZY.audio.strike(rec.front.freq, { velocity: 0.8, tier: 0 });
      if (rack) rack.flash(rec, 620, false, true);
      toast('楚王熊章镈钟 · 约 89 Hz', '平口单音 · 不在乐律序列 · 古时演奏不用此钟');
      return;
    }

    const info = useSide ? rec.side : rec.front;

    if (mode === 'song' && player.playing) {
      const res = player.hit(rec, useSide);
      if (!res.matched) {
        const want = res.want && res.want.rec;
        if (!want) return;
        if (want.id === rec.id) {
          /* 钟对了，只是击奏部位不对 —— 说清楚，别笼统说「不是这一件」 */
          toast('这件钟对了 · 但要敲' + (want.side ? '侧鼓' : '正鼓'),
            want.side
              ? '切到「侧鼓」再敲，或按住 Shift 点这件钟'
              : '切回「正鼓」再敲，或按住 Shift 点这件钟');
        } else {
          toast('不是这一件', '循着脉冲的那件钟 · 需' +
            (want.side ? '侧鼓' : '正鼓') + '音 ' +
            (want.side ? want.rec.side.note : want.rec.front.note));
        }
        return;
      }
      return;
    }

    ZY.audio.strike(info.freq, {
      velocity: 0.88,
      tier: rec.tier,
      weak: useSide && rec.sideWeak          // 下层甬钟侧鼓音不明显
    });
    if (rack) rack.flash(rec, 520, useSide, true);
    toast((useSide ? '侧鼓音 ' : '正鼓音 ') + info.note,
      info.jie + ' · ' + info.lu + '律 · ' + rec.group + ' ' + rec.name +
      (useSide ? ' · 高出正鼓' + (rec.thirdIsMinor ? '小三度' : '大三度') +
        (rec.sideWeak ? '（此钟侧鼓音不明显）' : '') : ''));
  }

  rack = buildImageRack($('#rackBox'), { onFreeClick });

  /* ───────── 曲目模式 ───────── */
  function setNowNote(txt) { $('#nowNote').textContent = txt; }
  function setTransportUI(playing, modeName) {
    $('#btnFollow').classList.toggle('playing', playing && modeName === 'follow');
    $('#btnAuto').classList.toggle('playing', playing && modeName === 'auto');
    $('#btnFollow').textContent = playing && modeName === 'follow' ? '演奏中' : '跟随演奏';
    $('#btnAuto').textContent = playing && modeName === 'auto' ? '演奏中' : '自动演奏';
  }
  const resolveNote = (note, s) => D.findBell(note, s);

  player.onNote = (rec, n, i, info) => {
    if (rec && rack) rack.flash(rec, 520, !!n[3], !!player._fromUser);
    setNowNote((n[3] ? '侧鼓 ' : '正鼓 ') + noteLabel(info));
    $('#playProg').style.width = (player.progress() * 100).toFixed(1) + '%';
  };
  player.onTarget = t => {
    if (rack) rack.setTarget(t ? t.rec : null, t ? t.side : false);
    /* 目标要哪个部位，就把那个 tab 点亮 —— 免得敲对了钟却卡在部位上 */
    $$('.side-tab').forEach(b =>
      b.classList.toggle('need', !!t && ((b.dataset.side === 'side') === t.side)));
    if (t) setNowNote('待击 · ' + (t.side ? '侧鼓 ' : '正鼓 ') +
      noteLabel(t.side ? t.rec.side : t.rec.front));
    else $$('.side-tab').forEach(b => b.classList.remove('need'));
  };
  player.onSection = label => toast('乐段推进', label);
  /* 辅助击状态：辅助介入 / 连续过多暂停 / 用户敲中恢复 */
  player.onAssist = (kind, streak) => {
    if (kind === 'assist') {
      if (streak === 1) toast('补一击', '没跟上也没关系，接着敲下一件');
    } else if (kind === 'pause') {
      setNowNote('等你敲 · ' + curSong.name);
      toast('不再自动补击', '循着脉冲的那件钟敲一下，就继续');
    } else if (kind === 'resume') {
      setNowNote('循着脉冲敲击 · ' + curSong.name);
    }
  };
  player.onEnd = () => {
    setTransportUI(false);
    $('#playProg').style.width = '100%';
    setNowNote('乐曲终了 · ' + curSong.name);
    toast('乐曲终了', '《' + curSong.name + '》· 点击「跟随演奏 / 自动演奏」重新演奏');
    if (rack) rack.setTarget(null);
  };

  function startPlay(modeName) {
    ZY.audio.ensure();
    player.load(curSong);
    player.start(modeName, resolveNote);
    setTransportUI(true, modeName);
    /* 跟随模式直接给出「待击 · 正/侧鼓 音名 · 阶名 · 律名」，比只报曲名有用 */
    const t0 = modeName === 'follow' ? player._target() : null;
    setNowNote(t0
      ? '待击 · ' + (t0.side ? '侧鼓 ' : '正鼓 ') +
        noteLabel(t0.side ? t0.rec.side : t0.rec.front)
      : (modeName === 'follow' ? '循着脉冲敲击 · ' : '自动演奏 · ') + curSong.name);
    $('#playProg').style.width = '0%';
    if (curSong.sections) toast(curSong.name + ' · 起', curSong.sections[0].label);
  }
  function stopPlay(silent) {
    player.stop();
    setTransportUI(false);
    if (rack) rack.setTarget(null);
    $$('.side-tab').forEach(b => b.classList.remove('need'));
    if (!silent) setNowNote('已停止');
  }

  $('#btnFollow').addEventListener('click', () => {
    if (player.playing && player.mode === 'follow') { stopPlay(); return; }
    stopPlay(true);
    startPlay('follow');
  });
  $('#btnAuto').addEventListener('click', () => {
    if (player.playing && player.mode === 'auto') { stopPlay(); return; }
    stopPlay(true);
    startPlay('auto');
  });
  $('#btnStop').addEventListener('click', () => stopPlay());

  /* 辅助击开关：关掉后跟随演奏完全由你掌控，绝不自动发声 */
  $('#btnAssist').addEventListener('click', () => {
    player.assist = !player.assist;
    $('#btnAssist').classList.toggle('on', player.assist);
    $('#btnAssist').textContent = '辅助 ' + (player.assist ? '开' : '关');
  });

  $$('.song-btn').forEach(b => b.addEventListener('click', () => {
    $$('.song-btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    curSong = D.SONGS[b.dataset.song];
    stopPlay(true);
    setNowNote('《' + curSong.name + '》 · ' + curSong.desc);
  }));

  /* 模式切换 */
  $$('.mode-tab').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    $$('.mode-tab').forEach(x => x.classList.toggle('on', x === b));
    stopPlay(true);
    $('#songPanel').classList.toggle('hidden', mode !== 'song');
    $('.notes').hidden = mode !== 'free';
    $('#soundHint').textContent = mode === 'song'
      ? '曲目体验：跟随模式循着脉冲敲击推进；自动模式直接聆听'
      : '';
    $('#soundHint').hidden = mode !== 'song';
    setNowNote('—');
  }));

  /* 击奏部位：正鼓 / 侧鼓 */
  $$('.side-tab').forEach(b => b.addEventListener('click', () => {
    side = b.dataset.side === 'side';
    document.body.classList.toggle('side-on', side);
    $$('.side-tab').forEach(x => x.classList.toggle('on', x === b));
    $('#sideHint').textContent = side
      ? '侧鼓：敲击鼓部两侧，得高出三度的第二基频（下层大甬钟侧鼓音不明显）'
      : '正鼓：敲击鼓部正中，得第一基频 · 下层大甬钟以正鼓为主';
  }));

  $('#vol').addEventListener('input', e => ZY.audio.setVolume(e.target.value / 100));

  /* Shift 提示 */
  document.addEventListener('keydown', e => {
    if (e.key === 'Shift') document.body.classList.add('shift-on');
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'Shift') document.body.classList.remove('shift-on');
  });

  /* 首屏渐显 */
  requestAnimationFrame(() => document.querySelectorAll('.rv').forEach((el, i) => {
    setTimeout(() => el.classList.add('in'), 90 * i);
  }));
})();
