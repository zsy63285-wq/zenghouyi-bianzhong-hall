/* ═══ 钟声合成引擎 + 乐曲播放器（Web Audio，零采样） ═══
   分音组叠加（含非谐分音，近似编钟模态）+ 击奏噪声瞬态 + 指数衰减。 */
window.ZY = window.ZY || {};
(function () {
  'use strict';

  function BellSynth() {
    this._ctx = null;
    this._master = null;
    this._analyser = null;
    this._vol = 0.8;
  }
  BellSynth.prototype.ctx = function () {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._vol;
      const comp = this._ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      /* 分析节点串在音量之后：波形随实际听到的声音强弱与衰减变化 */
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 2048;
      this._analyser.smoothingTimeConstant = 0.45;
      this._master.connect(this._analyser);
      this._analyser.connect(comp); comp.connect(this._ctx.destination);
    }
    return this._ctx;
  };
  /* 读取实时波形。音频上下文尚未建立时返回 0，页面保持安静。 */
  BellSynth.prototype.readWave = function (arr) {
    if (!this._analyser || !arr || !arr.length) return 0;
    this._analyser.getFloatTimeDomainData(arr);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    return Math.sqrt(sum / arr.length);
  };
  BellSynth.prototype.ensure = function () {
    const c = this.ctx();
    if (c.state === 'suspended') c.resume();
    return c;
  };
  BellSynth.prototype.setVolume = function (v) {
    this._vol = v;
    if (this._master) this._master.gain.setTargetAtTime(v, this._ctx.currentTime, 0.03);
  };

  /* ── 分音表：[频率比, 振幅, 衰减系数] —— 低分音长、高分音短
     近似编钟模态：嗡音(1/2) · 基音(1) · 小三度(≈1.19) · 五度(≈1.5) · 标称(2) … ── */
  const PARTIALS = [
    [0.5,   0.32, 1.55],
    [1.0,   1.00, 1.00],
    [1.183, 0.40, 0.82],
    [1.506, 0.24, 0.68],
    [2.0,   0.30, 0.52],
    [2.514, 0.15, 0.40],
    [2.662, 0.11, 0.34],
    [3.011, 0.08, 0.28],
    [4.05,  0.05, 0.20],
    [5.43,  0.03, 0.15]
  ];

  /* ── 各层音色（据实测描述）──
     下层：浑厚、音量大、余音长（和声烘托）
     中层：铿锵和谐、余音适中（旋律主体）
     上层：清脆嘹亮、音量小、余音较短 */
  const TIER_TONE = {
    0: { dur: 8.0, bright: 0.52, vel: 0.95 },
    1: { dur: 5.6, bright: 0.82, vel: 0.85 },
    2: { dur: 3.2, bright: 1.12, vel: 0.70 }
  };
  const defBright = f => (f < 150 ? 0.55 : f < 400 ? 0.8 : 1.05);
  const defDur = f => (f < 150 ? 7.5 : f < 400 ? 5 : 3.2);

  BellSynth.prototype.strike = function (freq, opts) {
    opts = opts || {};
    const c = this.ensure();
    const t0 = c.currentTime + 0.012;
    const tone = TIER_TONE[opts.tier] || null;
    let vel = opts.velocity != null ? opts.velocity : (tone ? tone.vel : 0.9);
    let bright = opts.brightness != null ? opts.brightness : (tone ? tone.bright : defBright(freq));
    const dur0 = opts.dur != null ? opts.dur : (tone ? tone.dur : defDur(freq));
    /* 乐曲演奏模式：旋律要听得清，收敛余音、拍音与非谐分音 */
    const mel = !!opts.melodic;
    const inharm = mel ? 0.56 : 1;                      // 非谐分音（编钟的金属感来源）
    const beatAmp = mel ? 0.12 : 0.42;                  // 拍音伴生振子：过强则音高发虚
    let dur = dur0;
    if (mel) {
      const cap = opts.gap ? Math.max(0.4, opts.gap * 2.0) : 1.7;   // 余音不超过音间隔的 2 倍
      dur = Math.min(dur, cap);
    }
    /* 下层甬钟侧鼓音不明显 —— 弱奏、偏暗 */
    if (opts.weak) { vel *= 0.5; bright *= 0.72; }
    /* 合瓦形钟的两个振动模态频率极近，干涉产生每秒 1—4 次的拍音（编钟的标志性听感） */
    const beatHz = opts.beat != null ? opts.beat : (1.4 + Math.random() * 2.6);
    const out = c.createGain(); out.gain.value = 1; out.connect(this._master);

    function mkTone(freq_, amp_, dec_, at) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq_;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp_, at);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + dec_);
      osc.connect(g); g.connect(out);
      osc.start(t0); osc.stop(t0 + dec_ + 0.1);
    }

    for (let i = 0; i < PARTIALS.length; i++) {
      const ratio = PARTIALS[i][0], amp = PARTIALS[i][1], dScale = PARTIALS[i][2];
      const f = freq * ratio;
      if (f > c.sampleRate * 0.42) break;
      if (i > 4 && ratio > 1.5 && ratio * bright > 6) continue;
      /* 旋律模式只保留基音与八度作主干：嗡音(1/2倍频)衰减最慢、最易糊，压到 0.28；
         其余非谐分音减半，让位给音高辨识，同时留住编钟的金属底色 */
      const keep = (i === 1 || i === 4);
      const cut = mel ? (keep ? 1 : (i === 0 ? 0.28 : inharm)) : 1;
      const a = Math.max(0.0005, amp * vel * (i > 3 ? bright : 1) * (i === 1 ? 1 : 0.9) * cut);
      const dec = Math.max(0.25, dur * dScale);
      const at = t0 + 0.006 + i * 0.0012;
      mkTone(f * (1 + (Math.random() - 0.5) * 0.0025), a, dec, at);
      if (i <= 2) mkTone(f + beatHz, a * beatAmp, dec, at);   // 拍音伴生振子
    }
    /* 击槌瞬态：短噪声 + 带通 */
    const nlen = Math.floor(c.sampleRate * 0.05);
    const nb = c.createBuffer(1, nlen, c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nlen, 2.2);
    const ns = c.createBufferSource(); ns.buffer = nb;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = Math.min(freq * 7, 5400); bp.Q.value = 1.1;
    const ng = c.createGain(); ng.gain.value = 0.22 * vel * bright;
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t0);

    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, (dur + 1.5) * 1000);
    return t0;
  };

  /* ── 乐曲播放器 ──
     auto  : 按 Web Audio 时钟推进，自动敲击
     follow: 等待用户敲击推进。等待基准是「上一次发声的时刻」，而非原曲时间轴 ——
             否则人手跟不上的累积偏差会越滚越大，一旦落后即每 200ms 自动补一击，
             听起来就成了「前面正常、后面自动播完」。
             超时后由辅助击补上；连续辅助则等待逐次加长，至第 4 次起停止自动补击，
             用户敲中任一音即恢复。 */
  function MusicPlayer(synth) {
    this.synth = synth;
    this.song = null;
    this.mode = null;
    this.playing = false;
    this.idx = 0;
    this.t0 = 0;
    this._lastAt = 0;       // follow：上一次发声（用户击或辅助击）的时刻
    this._streak = 0;       // follow：连续辅助击次数
    this._paused = false;   // follow：连续辅助过多，已停止自动补击
    this._resolve = null;   // (note, side) -> registry rec
    this.onNote = null;     // (rec, noteData, idx)
    this.onEnd = null;
    this.onTarget = null;   // follow 模式：{rec, side, index} | null
    this.onSection = null;  // 乐段切换：(label)
    this.onAssist = null;   // follow：辅助击介入 / 停止 (kind, streak)
    this._secIdx = 0;
    this.assist = true;
    this.assistDelay = 3.4; // 首次辅助前的等待秒数
    this._timer = null;
  }
  MusicPlayer.prototype.load = function (song) { this.song = song; this.idx = 0; };
  MusicPlayer.prototype._sec = function (beat) { return beat * 60 / this.song.bpm; };
  MusicPlayer.prototype.start = function (mode, resolve) {
    if (!this.song) return;
    this.mode = mode; this._resolve = resolve;
    this.playing = true; this.idx = 0; this._secIdx = 0;
    this.t0 = this.synth.ctx().currentTime + 0.45;
    this._lastAt = this.synth.ctx().currentTime;
    this._streak = 0; this._paused = false;
    if (mode === 'follow' && this.onTarget) this.onTarget(this._target());
    clearInterval(this._timer);
    this._timer = setInterval(() => this.update(), 200);
  };
  MusicPlayer.prototype.stop = function () {
    this.playing = false;
    clearInterval(this._timer);
    if (this.onTarget) this.onTarget(null);
  };
  MusicPlayer.prototype._target = function () {
    if (!this.playing || this.mode !== 'follow' || !this.song || this.idx >= this.song.notes.length) return null;
    const n = this.song.notes[this.idx];
    return { rec: this._resolve(n[0], !!n[3]), side: !!n[3], index: this.idx, raw: n };
  };
  /* 乐段推进提示（如《楚商》的旋宫段） */
  MusicPlayer.prototype._checkSection = function (beat) {
    const ss = this.song.sections;
    if (!ss || !(beat > 0)) return;
    while (this._secIdx < ss.length && beat >= ss[this._secIdx].at) {
      if (this.onSection) this.onSection(ss[this._secIdx].label);
      this._secIdx++;
    }
  };
  /* 到下一音的秒数间隔 —— 供旋律模式收敛余音 */
  MusicPlayer.prototype._gap = function (i) {
    const ns = this.song && this.song.notes;
    if (!ns || !ns[i + 1]) return 1.7;
    return Math.max(0.3, (ns[i + 1][1] - ns[i][1]) * 60 / this.song.bpm);
  };
  MusicPlayer.prototype._fire = function (n, i) {
    this._checkSection(n[1]);
    const rec = this._resolve ? this._resolve(n[0], !!n[3]) : null;
    const info = rec ? (n[3] ? rec.side : rec.front) : { freq: ZY.DATA.noteToFreq(n[0]) };
    this.synth.strike(info.freq, {
      velocity: 0.72,
      tier: rec ? rec.tier : undefined,
      weak: !!(rec && n[3] && rec.sideWeak),
      melodic: true, gap: this._gap(i)
    });
    if (this.onNote) this.onNote(rec, n, i, info);
  };
  MusicPlayer.prototype.update = function () {
    if (!this.playing || !this.song) return;
    const now = this.synth.ctx().currentTime;
    if (this.mode === 'auto') {
      while (this.idx < this.song.notes.length &&
             this.t0 + this._sec(this.song.notes[this.idx][1]) < now + 0.16) {
        const n = this.song.notes[this.idx];
        this._fire(n, this.idx);
        this.idx++;
      }
      if (this.idx >= this.song.notes.length) {
        this.playing = false; clearInterval(this._timer);
        if (this.onEnd) this.onEnd();
      }
    } else if (this.mode === 'follow') {
      if (!this.assist || this._paused) return;
      const n = this.song.notes[this.idx];
      if (!n) return;
      /* 连续辅助则逐次加长等待，避免整首被自动播完 */
      const wait = this.assistDelay * (1 + 0.9 * this._streak);
      if (now - this._lastAt < wait) return;
      this._streak++;
      if (this._streak >= 4) {
        this._paused = true;
        if (this.onAssist) this.onAssist('pause', this._streak);
        return;                       // 停在此音，等用户自己敲
      }
      if (this.onAssist) this.onAssist('assist', this._streak);
      this._fire(n, this.idx); this.idx++;
      this._lastAt = this.synth.ctx().currentTime;
      if (!this._advance()) return;
    }
  };
  /* 推进一个音后的收尾：返回 false 表示乐曲已结束 */
  MusicPlayer.prototype._advance = function () {
    if (this.idx >= this.song.notes.length) {
      this.playing = false; clearInterval(this._timer);
      if (this.onEnd) this.onEnd(); if (this.onTarget) this.onTarget(null);
      return false;
    }
    if (this.mode === 'follow' && this.onTarget) this.onTarget(this._target());
    return true;
  };
  /* 用户敲击：follow 模式下与目标匹配则推进，返回是否命中 */
  MusicPlayer.prototype.hit = function (rec, side) {
    if (!this.playing || this.mode !== 'follow') return { matched: false };
    const t = this._target();
    if (!t || !t.rec || !rec) return { matched: false };
    const ok = rec.id === t.rec.id && side === t.side;
    if (ok) {
      const n = this.song.notes[this.idx];
      const info = side ? rec.side : rec.front;
      this.synth.strike(info.freq, {
        velocity: 0.78,
        tier: rec.tier,
        weak: side && rec.sideWeak,
        melodic: true, gap: this._gap(this.idx)
      });
      /* 标记这次发声来自用户点击：视觉上可给出更完整的背景反馈 */
      this._fromUser = true;
      if (this.onNote) this.onNote(rec, n, this.idx, info);
      this._fromUser = false;
      this.idx++;
      /* 基准随敲击刷新 —— 等待的是「你」，不是原曲的时间轴 */
      this._lastAt = this.synth.ctx().currentTime;
      if (this._streak || this._paused) {
        this._streak = 0; this._paused = false;
        if (this.onAssist) this.onAssist('resume', 0);
      }
      this._advance();
      return { matched: true };
    }
    return { matched: false, want: t };
  };
  MusicPlayer.prototype.progress = function () {
    if (!this.song || !this.song.notes.length) return 0;
    return Math.min(1, this.idx / this.song.notes.length);
  };

  ZY.BellSynth = BellSynth;
  ZY.MusicPlayer = MusicPlayer;
  ZY.audio = new BellSynth();
})();
