export const pad = n => String(n).padStart(2, '0');
export const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = k => new Date(k + 'T00:00:00');
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const fmtMD = k => { const d = fromKey(k); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
export const todayKey = () => toKey(new Date());
export const parseHM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const shiftMinutes = (start, end) => { const s = parseHM(start), e = parseHM(end); return e > s ? e - s : e + 1440 - s; };

// 深夜帯(22:00〜翌5:00)との重なり分数。日跨ぎシフトにも対応
export const nightMinutes = (start, dur) => {
  const s = parseHM(start);
  const windows = [[0, 300], [1320, 1740], [2760, 3180]];
  let total = 0;
  for (const [a, b] of windows) total += Math.max(0, Math.min(s + dur, b) - Math.max(s, a));
  return total;
};

// ---- ガント／時給計算のための時刻ユーティリティ ----

export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);

// ---- 月の扱い ----
export const monthStart = k => `${k.slice(0, 7)}-01`;
export const daysInMonth = k => { const d = fromKey(k); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
export const addMonths = (k, n) => {
  const d = fromKey(k);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toKey(target);
};
export const fmtYM = k => { const d = fromKey(k); return `${d.getFullYear()}年${d.getMonth() + 1}月`; };

// ISO時刻を「基準日の0:00からの経過分」に変換する。日をまたぐ打刻は自然に1440超の値になる
export const absMin = (iso, baseKey) => Math.round((new Date(iso) - fromKey(baseKey)) / 60000);

// 深夜帯（22:00〜翌5:00）のうち[from,to]に収まる区間を返す。
// 期間の長さに関係なく必要なぶんだけ生成するので、週表示でも取りこぼさない
export function nightBandsIn(from, to) {
  const out = [];
  for (let d = Math.floor(from / 1440) - 1; d <= Math.ceil(to / 1440); d++) {
    const x = Math.max(d * 1440 + 1320, from);   // その日の22:00
    const y = Math.min(d * 1440 + 1740, to);     // 翌5:00
    if (y > x) out.push([x, y]);
  }
  return out;
}

// 区間[a,b]と深夜帯の重なり分数
export const nightOverlap = (a, b) => nightBandsIn(a, b).reduce((t, [x, y]) => t + (y - x), 0);

// 区間集合 segs から holes を差し引く（休憩を勤務時間から除くのに使う）
export function subtractIntervals(segs, holes) {
  let out = segs.map(s => [...s]);
  for (const [hs, he] of holes) {
    const next = [];
    for (const [s, e] of out) {
      if (he <= s || hs >= e) { next.push([s, e]); continue; }   // 重ならない
      if (hs > s) next.push([s, Math.min(hs, e)]);               // 前側の残り
      if (he < e) next.push([Math.max(he, s), e]);               // 後側の残り
    }
    out = next;
  }
  return out.filter(([s, e]) => e - s > 0);
}

// 絶対分 → "H:MM"。24時以降は 25:30 と表示して日跨ぎを明示し、
// 負（前夜集合など勤務日の0:00より前の打刻）は「前日23:50」と表示する
export function fmtAbs(m) {
  let d = 0, x = m;
  while (x < 0) { x += 1440; d--; }
  const t = `${Math.floor(x / 60)}:${pad(x % 60)}`;
  return d === 0 ? t : `${d === -1 ? '前日' : `${-d}日前`}${t}`;
}
export const hrs = m => (m / 60).toFixed(2).replace(/\.00$/, '');

export const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = p => p + Math.random().toString(36).slice(2, 8);
