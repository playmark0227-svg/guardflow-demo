import { seedData } from './data.js';
import { toKey, todayKey, uid } from './util.js';

const KEY = 'guardflow-demo-v2';
const listeners = new Set();

// 画面状態（永続化しない）
export const ui = {
  role: 'guard',
  guardTab: 'report',        // notice | report | shift | leave | pay
  adminTab: 'dash',          // dash | board | monitor | billing | deposit | payroll | reports | master | leave | edu | finance | msg
  guardId: 'g1',
  boardDate: todayKey(),
  selectedGuard: null,
  report: { type: 'depart', shiftId: null, manual: false },
  reportMore: false,
  payMonth: null,            // 給与明細で見ている月（null=最新）
  shiftDetail: null,
  leaveEdit: false,
  ganttUnit: 'day14',        // day14 | day7 | hour
  ganttOffice: '',           // '' = 全拠点
  ganttSite: '',             // '' = 全現場
  q: '',                     // 隊員の絞り込み（名前・コード・資格）
  detailShift: null,         // 詳細シートで開いている勤務
};

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.seedDate === toKey(new Date())) return s; // 日付が変わったらデモデータを作り直す
    }
  } catch (e) { /* 破損時は再生成 */ }
  return seedData();
}

export function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
  emit();
}
export function subscribe(fn) { listeners.add(fn); }
function emit() { listeners.forEach(f => f()); }
export function rerender() { emit(); }
export function resetDemo() { state = seedData(); commit(); }

// ---- 打刻・勤怠報告 ----
export function punch(shiftId, type, geo, memo) {
  const s = state.shifts.find(x => x.id === shiftId);
  if (!s) return;
  s.punches.push({ type, at: new Date().toISOString(), ...geo, memo: memo || '', queued: state.offline });
  commit();
}

export function toggleOffline() {
  state.offline = !state.offline;
  if (!state.offline) {
    // 通信回復 → キューに溜まった打刻を同期済みにする
    state.shifts.forEach(s => s.punches.forEach(p => { if (p.queued) { p.queued = false; p.synced = true; } }));
  }
  commit();
}

export const queuedCount = () =>
  state.shifts.reduce((n, s) => n + s.punches.filter(p => p.queued).length, 0);

// ---- 配置 ----
export function checkAssign(date, siteId, guardId) {
  const g = state.guards.find(x => x.id === guardId);
  const dayShifts = state.shifts.filter(s => s.date === date);
  if (dayShifts.some(s => s.guardId === guardId && s.siteId === siteId))
    return { block: `${g.name}さんはすでにこの現場に配置済みです` };
  if (dayShifts.some(s => s.guardId === guardId))
    return { block: `ダブルブッキング：${g.name}さんは同日の別現場に配置済みです` };
  if (g.siteNG && g.siteNG[siteId])
    return { block: `配置NG（出入り禁止）：${g.siteNG[siteId]}` };
  const assigned = dayShifts.filter(s => s.siteId === siteId).map(s => s.guardId);
  const pairId = assigned.find(id => (g.pairNG || []).includes(id));
  if (pairId) {
    const p = state.guards.find(x => x.id === pairId);
    return { block: `相性NG：${g.name}さんと${p.name}さんは同一現場に配置できません` };
  }
  if (g.caution) return { warn: g.caution };
  return {};
}

export function assign(date, siteId, guardId) {
  const site = state.sites.find(x => x.id === siteId);
  state.shifts.push({ id: uid('sh'), date, siteId, guardId, start: site.start, end: site.end, punches: [] });
  commit();
}

export function unassign(shiftId) {
  state.shifts = state.shifts.filter(s => s.id !== shiftId);
  commit();
}

// ---- 連絡・申請 ----
export function addNotice(title, body) {
  state.notices.unshift({ id: uid('n'), cat: '本社', title, body, at: new Date().toISOString(), from: '管制センター' });
  commit();
}

export function requestLeave(guardId, date, reason) {
  state.leaves.unshift({ id: uid('lv'), guardId, date, reason, status: 'pending', at: new Date().toISOString() });
  commit();
}

export function cancelLeave(guardId, date) {
  const i = state.leaves.findIndex(l => l.guardId === guardId && l.date === date && l.status === 'pending');
  if (i >= 0) { state.leaves.splice(i, 1); commit(); return true; }
  return false;
}

export function setLeave(id, status) {
  const lv = state.leaves.find(x => x.id === id);
  if (lv) { lv.status = status; commit(); }
}

export function toggleDeposit(siteId) {
  state.deposits[siteId] = !state.deposits[siteId];
  commit();
}
