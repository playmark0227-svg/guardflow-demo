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

export const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = p => p + Math.random().toString(36).slice(2, 8);
