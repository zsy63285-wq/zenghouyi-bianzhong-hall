/* ═══ 编钟声音交互 DEMO · 数据层 ═══
   ── 数据依据（公开资料整理）────────────────────────────
   · 全套 65 件：上层三组钮钟 19 + 中下层五组甬钟 45 + 镈钟 1
     （中层：一组短枚 11 / 二组无枚 12 / 三组长枚 10；下层：一组 3 / 二组 10 位，含镈）
   · 音域 C2（64.8 Hz，下层一组 1 号正鼓）— D7（2329.1 Hz，上层一组 1 号侧鼓）
   · 定音基准：姑洗宫 = 中层二组 8 号甬钟正鼓音 = 256.4 Hz，比 A440 标准低约 35 音分
     → 本文件所有频率以 C4 = 256.4 Hz 推算，故整体比现代 A440 略低
   · 一钟双音：正鼓与侧鼓呈三度，全套小三度 41 个、大三度 23 个
   · 音列规律：下层甬钟正鼓为七声下徵音阶，侧鼓音不明显；
     中低音区正鼓按「徵·羽·宫·商·角」重复排列；高音区音较稀疏；
     中层三组正鼓与侧鼓互补，可在 C4—G5 之间构成完备半音阶
   · 上层钮钟属「无铎均」「浊文王均」，与甬钟不同均，五音不全 —— 此处按高音区示意排列
   ────────────────────────────────────────────────────
   ⚠ 逐件音高为按上述规律生成的示意值，非测音报告逐件数据。 */
window.ZY = window.ZY || {};
(function () {
  'use strict';

  /* ── 定音基准：姑洗 = 宫 = C ── */
  const GUXIAN_C4 = 256.4;
  const midiToFreq = m => GUXIAN_C4 * Math.pow(2, (m - 60) / 12);

  const NOTE_IDX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteToFreq(name) {
    const m = /^([A-G]#?)(-?\d)$/.exec(name);
    if (!m) return GUXIAN_C4;
    const midi = NOTE_IDX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return midiToFreq(midi);
  }

  /* 十二音位（姑洗均）：四基「宫商角徵羽」+ 角（基音上方大三度）+ 曾（两个大三度）
     pc 0=C 1=C# 2=D 3=D# 4=E 5=F 6=F# 7=G 8=G# 9=A 10=A# 11=B */
  const JIE_NAMES = ['宫', '羽角', '商', '徵曾', '角', '羽曾', '商角', '徵', '宫曾', '羽', '商曾', '徵角'];
  /* 十二律：姑洗为宫（姑洗居十二律第 5 位 → 索引 4 = C） */
  const LU_NAMES = ['黄钟', '大吕', '太簇', '夹钟', '姑洗', '仲吕', '蕤宾', '林钟', '夷则', '南吕', '无射', '应钟'];
  const luOf = pc => LU_NAMES[((pc + 4) % 12 + 12) % 12];

  function pitchInfo(freq, ratio, off) {
    const raw = 60 + 12 * Math.log2(freq / GUXIAN_C4);
    const semi = Math.round(raw);
    const pc = ((semi % 12) + 12) % 12;
    return {
      freq, ratio, semi, pc,
      cents: Math.round((raw - semi) * 100),
      note: NOTE_NAMES[pc] + (Math.floor(semi / 12) - 1),
      jie: JIE_NAMES[pc],
      lu: luOf(pc)
    };
  }

  /* ── 分组（与实物一致）── tier: 0 下层 / 1 中层 / 2 上层 ── */
  const GROUPS = [
    { id: 'L1', tier: 0, name: '下层一组', type: 'yong', n: 3, note: '大型长枚甬钟' },
    { id: 'L2', tier: 0, name: '下层二组', type: 'yong', n: 10, note: '大型长枚甬钟', boAt: 5 },
    { id: 'M1', tier: 1, name: '中层一组', type: 'yong', n: 11, note: '短枚甬钟' },
    { id: 'M2', tier: 1, name: '中层二组', type: 'yong', n: 12, note: '无枚甬钟' },
    { id: 'M3', tier: 1, name: '中层三组', type: 'yong', n: 10, note: '长枚甬钟' },
    { id: 'U1', tier: 2, name: '上层一组', type: 'niu', n: 6, note: '钮钟 · 浊文王均' },
    { id: 'U2', tier: 2, name: '上层二组', type: 'niu', n: 6, note: '钮钟 · 无铎均' },
    { id: 'U3', tier: 2, name: '上层三组', type: 'niu', n: 7, note: '钮钟 · 无铎均' }
  ];

  /* 下层：七声下徵音阶（C D E F# G A B），自 C2 起 */
  const HEPTA_LOWER = [0, 2, 4, 6, 7, 9, 11];

  /* 中层三组音列（低 → 高，五声骨架：宫商角徵羽）
     组内编号 1 号为最小钟、音最高（如中层二组 1 号通高 37.2 cm 为全套最小），
     故序列自高向低分配给 idx 1…n。中层二组 8 号正鼓 = 姑洗宫 = C4 = 256.4 Hz。 */
  const MID_SEQ = {
    M1: [55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79],        // 短枚 11 · G3 → G5
    M2: [50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76],    // 无枚 12 · D3 → E5（第 8 号 = C4）
    M3: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81]             // 长枚 10 · C4 → A5
  };
  /* 上层 19 件钮钟：高音区，音较稀疏，A5 → B6（正鼓），侧鼓可及 D7 */
  const UP_SEQ = (function () {
    const a = [];
    for (let i = 0; i < 19; i++) a.push(81 + Math.round(i * 14 / 18));
    return a;
  })();
  const UP_SLICE = { U3: [0, 7], U2: [7, 6], U1: [13, 6] };   // 段起点 / 件数（由低到高）

  /* 确定性微扰（±8 音分）：模拟逐件调音误差，避免机械的等程感 */
  function detune(midi, seed) {
    const r = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;   // 0..1
    return midi + (r - 0.5) * 0.16;                                    // ±8 音分
  }

  /* ── 生成钟注册表 ── */
  const registry = (function () {
    const made = [];
    let id = 0, seq = 0;

    GROUPS.forEach(g => {
      for (let k = 0; k < g.n; k++) {
        const isBo = g.boAt != null && k === g.boAt;
        const f = g.n === 1 ? 0 : k / (g.n - 1);
        made.push({
          id: id++, tier: g.tier, group: g.name, groupId: g.id, groupNote: g.note,
          type: isBo ? 'bo' : g.type, idx: k + 1,
          h: isBo ? 0.92 : g.tier === 0 ? 1.30 + 0.22 * f : g.tier === 1 ? 0.62 + 0.16 * f : 0.30 + 0.10 * f,
          r: isBo ? 0.52 : g.tier === 0 ? 0.62 + 0.12 * f : g.tier === 1 ? 0.26 + 0.08 * f : 0.15 + 0.05 * f
        });
      }
    });

    /* 逐组赋音 */
    let lowerPtr = 0;
    const groupIndex = (g, r) => made.filter(x => x.groupId === g.id && x.type !== 'bo').indexOf(r);
    GROUPS.forEach(g => {
      made.filter(r => r.groupId === g.id && r.type !== 'bo').forEach(r => {
        let semi;
        if (g.tier === 0) {
          /* 下层：七声下徵音阶，自 C2 起（最低音即下层一组 1 号正鼓） */
          const h = lowerPtr++;
          semi = 36 + Math.floor(h / 7) * 12 + HEPTA_LOWER[h % 7];
        } else if (g.tier === 1) {
          /* 中层三组：五声骨架上行，三组音列相互重叠 */
          const arr = MID_SEQ[g.id];
          const i = groupIndex(g, r);
          semi = arr[arr.length - 1 - i];                   // idx 越大 → 钟越大 → 音越低
        } else {
          /* 上层：三段钮钟，音较稀疏，组内 1 号音最高 */
          const sl = UP_SLICE[g.id];
          const i = groupIndex(g, r);
          semi = UP_SEQ[sl[0] + sl[1] - 1 - i];
        }
        /* 姑洗宫标准音（中层二组 8 号）取精确值，不加调音微扰 */
        const exact = (g.id === 'M2' && r.idx === 8);
        const midi = exact ? semi : detune(semi, r.id + 1);
        /* 双音音程：全套小三度 41 / 大三度 23 → 交错分布，约 64% 为小三度 */
        let minor = ((seq * 23) % 64) >= 23;
        if (g.id === 'U1' && r.idx === 1) minor = true;      // 最高音 D7 = B6 + 小三度
        const third = minor ? 3 : 4;
        r.front = pitchInfo(midiToFreq(midi), 1.0);
        r.side = pitchInfo(midiToFreq(exact ? semi + third : detune(semi + third, r.id + 40)), third === 3 ? 1.1892 : 1.2599);
        r.thirdIsMinor = third === 3;
        r.sideWeak = g.tier === 0;                           // 下层甬钟侧鼓音不明显
        seq++;
      });
    });

    /* 镈钟：楚王熊章镈钟 —— 平口、环钮、单音，不在全套乐律序列内，古时不用于演奏 */
    const bo = made.find(r => r.type === 'bo');
    if (bo) {
      bo.front = { freq: 89.4, ratio: 1.0, semi: 41, pc: 5, cents: 0, note: 'F2', jie: '—', lu: '—' };
      bo.side = null;
      bo.mono = true;
      bo.sideWeak = false;
      bo.bo = {
        name: '楚王熊章镈钟',
        mark: '下层二组 6 号 · 悬于下层长架中部',
        size: '通高 92.5 cm · 重 134.8 kg · 口径 60.5×46.2 cm',
        insc: '隹王五十又六祀，返自西阳，楚王酓章作曾侯乙宗彝，奠之于西阳，其永时用享',
        desc: '楚惠王五十六年（前 433）赠。平口、环钮，不具一钟双音；铭文无一字涉及乐律，不在全套十二音位体系内。'
      };
    }

    /* 校准：全套双音音程应为小三度 41 个、大三度 23 个 */
    (function calibrate() {
      const play = made.filter(r => !r.mono && r.side);
      const top = made.find(r => r.groupId === 'U1' && r.idx === 1);   // 最高音钟锁定小三度
      const fix = (r, minor) => {
        const third = minor ? 3 : 4;
        r.thirdIsMinor = minor;
        r.side = pitchInfo(midiToFreq(r.front.semi + third), third === 3 ? 1.1892 : 1.2599);
      };
      let n = play.filter(r => r.thirdIsMinor).length;
      for (let i = 0; i < play.length && n > 41; i++) {
        if (play[i].thirdIsMinor && play[i] !== top) { fix(play[i], false); n--; }
      }
      for (let i = 0; i < play.length && n < 41; i++) {
        if (!play[i].thirdIsMinor && play[i] !== top) { fix(play[i], true); n++; }
      }
    })();

    made.forEach(r => {
      if (r.mono) { r.name = '镈钟'; return; }
      r.name = r.type === 'niu' ? '钮钟' : '甬钟';
    });
    return made;
  })();

  function noteToMidi(name) {
    const m = /^([A-G]#?)(-?\d)$/.exec(name);
    if (!m) return 60;
    return NOTE_IDX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  }

  /* 按音名查找钟（曲目跟随/自动演奏用）
     同音常有多件可击，按音区择层：低音归下层大甬钟、中音归中层、高音归上层钮钟，
     使跟随演奏时点亮的钟落在听感与体量相符的一层。 */
  const tierOfMidi = m => (m < 60 ? 0 : m <= 79 ? 1 : 2);
  function findBell(noteName, side) {
    const want = tierOfMidi(noteToMidi(noteName));
    let best = null, bestD = 99;
    for (let i = 0; i < registry.length; i++) {
      const r = registry[i];
      if (r.mono) continue;
      const info = side ? r.side : r.front;
      if (!info || info.note !== noteName) continue;
      const d = Math.abs(r.tier - want);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  /* ── 乐曲 ── [音名, 起拍, 时值拍, 侧鼓?]
     ⚠ 两首均为「示意改编」，非原谱：
       《楚商》：1978 年黄翔鹏据唐代陈康士琴曲《离骚》开篇新编的钟曲，商调式
         （主音＝商），含清角、变宫二变音，一曲旋六宫以验编钟旋宫转调之能。
         此处取其商调式骨干「商—徵—宫」与旋宫结构作示意。
       《天问》：湖北省博物馆编钟乐团以《楚辞·天问》为题的新创曲目（作曲罗乐），
         无公开谱；此处按题意作「问天—问地—叩问—合」四段示意。
     侧鼓?＝1 者用侧鼓音，多为补正鼓音列所无之音（如清角 F4、变宫 B4），
     正是「一钟双音」补全半音的实际用法。 */
  const SONGS = {
    chushang: {
      name: '楚商', bpm: 60,
      desc: '商调式 · 主音商 · 含旋宫段 · 示意改编',
      sections: [
        { at: 0, label: '商调式 · 宫＝姑洗 C · 主音商' },
        { at: 24, label: '旋宫 · 宫移至徵 G · 主题上移五度' },
        { at: 48, label: '回宫 · 落商 · 钟磬余韵' }
      ],
      notes: [
        /* A 主题：商调式，骨干 商—徵—宫，环绕主音商 D */
        ['A4', 0, 2], ['G4', 2, 1], ['A4', 3, 1],
        ['D4', 4, 4],
        ['C4', 8, 2], ['D4', 10, 1], ['E4', 11, 1],
        ['D4', 12, 2], ['C4', 14, 1], ['A3', 15, 1],
        ['G3', 16, 2], ['A3', 18, 2],
        ['C4', 20, 2], ['D4', 22, 2],
        /* B 旋宫：宫由姑洗 C 移至徵 G，同一主题整体上移五度 */
        ['E5', 24, 2], ['D5', 26, 1], ['E5', 27, 1],
        ['A4', 28, 4],
        ['G4', 32, 2], ['A4', 34, 1], ['B4', 35, 1, 1],
        ['A4', 36, 2], ['G4', 38, 2],
        ['D4', 40, 2], ['E4', 42, 2],
        ['F4', 44, 2, 1], ['E4', 46, 1], ['D4', 47, 1],
        /* C 回宫收束：低音商与上层高音叠置 */
        ['D4', 48, 2], ['C4', 50, 1], ['A3', 51, 1],
        ['G3', 52, 2], ['A3', 54, 2],
        ['D3', 56, 4], ['A5', 56, 4]
      ]
    },
    tianwen: {
      name: '天问', bpm: 66,
      desc: '《楚辞·天问》题意 · 四段 · 示意改编',
      sections: [
        { at: 0, label: '问天 · 上行问句 · 中层' },
        { at: 16, label: '问地 · 下层大甬钟' },
        { at: 32, label: '叩问 · 上层钮钟' },
        { at: 44, label: '合 · 天地相应' }
      ],
      notes: [
        /* 问天：短句上行，落商悬置（问而未答） */
        ['C4', 0, 1], ['D4', 1, 1], ['E4', 2, 1], ['G4', 3, 1],
        ['A4', 4, 2], ['G4', 6, 2],
        ['E4', 8, 1], ['D4', 9, 1], ['C4', 10, 2],
        ['D4', 12, 2],
        /* 问地：低音区，长音沉厚 */
        ['C3', 16, 2], ['D3', 18, 2], ['E3', 20, 2],
        ['G3', 22, 2], ['A3', 24, 2], ['G3', 26, 2],
        ['E3', 28, 2], ['D3', 30, 2],
        /* 叩问：上层钮钟，清脆追问 */
        ['A5', 32, 1], ['C6', 33, 1], ['D6', 34, 2],
        ['C6', 36, 1], ['A5', 37, 1], ['G5', 38, 2],
        ['A5', 40, 2], ['E5', 42, 2],
        /* 合：上下呼应，低音收束 */
        ['D5', 44, 1], ['C5', 45, 1], ['A4', 46, 2],
        ['G4', 48, 2], ['A4', 50, 1], ['C5', 51, 1],
        ['D5', 52, 2], ['C5', 54, 1], ['A4', 55, 1],
        ['G3', 56, 4], ['D4', 60, 4]
      ]
    }
  };

  ZY.DATA = {
    GUXIAN_C4, GROUPS, SONGS, registry, findBell, noteToFreq, midiToFreq,
    LU_NAMES, JIE_NAMES, NOTE_NAMES, pitchInfo, noteToMidi
  };
})();
