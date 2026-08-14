import { seedData, emptyData, demoData } from './data.js?v=9';
import { seedMasters, MASTERS } from './masters.js?v=9';
import { toKey, todayKey, uid } from './util.js?v=9';

// 保存キー。データの形を変えたら上げる。
// 古い端末に残ったデモデータで初期状態が見えなくなるのを防ぐ
const KEY = 'guardflow-v4';
try { ['guardflow-demo-v3', 'guardflow-demo-v2'].forEach(k => localStorage.removeItem(k)); } catch (e) { /* 非対応環境 */ }
const listeners = new Set();

// 画面状態（永続化しない）
export const ui = {
  role: 'admin',             // 初見はまず管制ダッシュボードを見せる
  guardTab: 'report',        // notice | report | shift | leave | pay
  adminTab: 'dash',          // dash | board | monitor | billing | deposit | payroll | reports | master | leave | edu | finance | msg
  guardId: 'g1',
  boardDate: todayKey(),
  selectedGuard: null,
  report: { type: 'depart', shiftId: null, manual: false },
  reportMore: false,
  payMonth: null,            // 給与明細で見ている月（null=最新）
  noticeId: null,            // お知らせ本文で開いている記事
  groupId: null,             // 開いているメニューグループ
  itemId: null,              // 開いている機能
  masterQ: '',               // マスタ内検索
  ledgerClient: null,
  shiftDetail: null,
  leaveEdit: false,
  ganttUnit: 'day14',        // day14 | day7 | hour
  ganttOffice: '',           // '' = 全拠点
  ganttSite: '',             // '' = 全現場
  q: '',                     // 隊員の絞り込み（名前・コード・資格）
  detailShift: null,         // 詳細シートで開いている勤務
  staff: null,               // 操作中の担当者コード（権限でメニューを絞る）
};

export const state = load();
// 初回は即座に書き出す。保存できない環境（プライベートブラウズなど）を
// 最初の入力時ではなく起動時に知らせるため
try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* commit() が拾う */ }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // 入力したデータは日付が変わっても保持する。作り直しは「↺ リセット」だけの責務
      if (s && s.guards && s.masters) return s;
    }
  } catch (e) { /* 破損時のみ再生成 */ }
  return seedData();
}

// 保存に失敗したら黙って進めない（容量超過でデータが消えるのを防ぐ）
let saveError = null;
export const getSaveError = () => saveError;
export function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveError = null;
  } catch (e) {
    saveError = e.name === 'QuotaExceededError'
      ? '保存容量がいっぱいです。メンテナンス管理 → データ削除で古い勤務データを整理してください。'
      : `保存に失敗しました（${e.name}）。この変更は次回の起動時に失われます。`;
  }
  emit();
}
export function subscribe(fn) { listeners.add(fn); }
function emit() { listeners.forEach(f => f()); }
export function rerender() { emit(); }
/** state は参照ごと差し替えず中身を入れ替える。
 *  変数を再代入すると、既に state を掴んでいる側が古いオブジェクトを見続けるため */
function replaceState(next) {
  Object.keys(state).forEach(k => { if (!(k in next)) delete state[k]; });
  Object.assign(state, next);
  ui.adminTab = 'dash';
  ui.detailShift = null; ui.selectedGuard = null; ui.groupId = null; ui.itemId = null;
  ui.payMonth = null; ui.ledgerClient = null; ui.masterQ = ''; ui.q = '';
  commit();
}
export function resetDemo() { replaceState(emptyData()); }
/** デモデータを入れ直す（機能説明用）。初期状態との行き来を1クリックで */
export function loadDemo() { replaceState(demoData()); }
export const isDemo = () => !!state.demo;

/** 初期セットアップの進み具合。未完了の先頭がその会社の「次にやること」 */
export function setupSteps() {
  const c = state.masters.company[0] || {};
  return [
    { id: 'm-company', name: '自社情報', hint: '会社名・認定番号', done: !!c.name },
    { id: 'm-branch', name: '支店・営業所', hint: '隊員の所属先', done: (state.masters.branch || []).length > 0 },
    { id: 'm-staff', name: '担当者', hint: '管制・事務の担当', done: (state.masters.staff || []).length > 0 },
    { id: 'm-guard', name: '隊員', hint: '氏名・時給・資格', done: state.guards.length > 0 },
    { id: 'm-client', name: '得意先', hint: '発注元・締日', done: state.clients.length > 0 },
    { id: 'm-site', name: '配置先', hint: '現場・時間・単価', done: state.sites.length > 0 },
    { id: 'board', name: '勤務予定', hint: '隊員を現場に配置', done: state.shifts.length > 0 },
  ];
}

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
  // 勤務マスタで「重複チェック」ONの勤務だけ同日重複をブロックする（巡回などは掛け持ち可）
  const wm = (state.masters.work || []).find(w => w.name === (state.sites.find(x => x.id === siteId) || {}).work);
  if (wm && wm.dup !== false && dayShifts.some(s => s.guardId === guardId))
    return { block: `ダブルブッキング：${g.name}さんは同日の別現場に配置済みです` };
  const st = state.sites.find(x => x.id === siteId) || {};
  if (g.siteNG && g.siteNG[siteId])
    return { block: `配置NG（出入り禁止）：${g.siteNG[siteId]}` };
  if ((g.siteNGNames || []).includes(st.name))
    return { block: `配置NG（出入り禁止）：${g.name}さんは${st.name}に配置できません` };
  const mates = dayShifts.filter(s => s.siteId === siteId)
    .map(s => state.guards.find(x => x.id === s.guardId)).filter(Boolean);
  const ng = mates.find(p => (g.pairNGNames || []).includes(p.name)
    || (g.pairNG || []).includes(p.id) || (p.pairNGNames || []).includes(g.name));
  if (ng) return { block: `相性NG：${g.name}さんと${ng.name}さんは同一現場に配置できません` };
  // オプション：承認済みの休暇日には配置できないようにする
  if (state.options.blockPaid
      && state.leaves.some(l => l.guardId === guardId && l.date === date && l.status === 'approved'))
    return { block: `${g.name}さんはこの日、休暇が承認されています（オプション設定で解除できます）` };
  // 申請中の休暇は止めない。気づかず上書きしないよう警告だけ出す
  if (state.leaves.some(l => l.guardId === guardId && l.date === date && l.status === 'pending'))
    return { warn: `${g.name}さんはこの日に休暇を申請中です（未承認）` };
  if (g.caution) return { warn: g.caution };
  return {};
}

export function assign(date, siteId, guardId, workId) {
  const site = state.sites.find(x => x.id === siteId);
  state.shifts.push({ id: uid('sh'), date, siteId, guardId, workId: workId || site.work,
    start: site.start, end: site.end, punches: [] });
  commit();
}

// 直前に外した配置を1件だけ覚えておき、取り消せるようにする
let lastRemoved = null;

export function unassign(shiftId) {
  const sh = state.shifts.find(s => s.id === shiftId);
  if (!sh) return null;
  lastRemoved = JSON.parse(JSON.stringify(sh));
  state.shifts = state.shifts.filter(s => s.id !== shiftId);
  commit();
  return lastRemoved;
}

export function undoUnassign() {
  if (!lastRemoved) return null;
  const sh = lastRemoved;
  lastRemoved = null;
  if (!state.shifts.some(s => s.id === sh.id)) state.shifts.push(sh);
  commit();
  return sh;
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

/** 管制側からの代理登録。電話・当日連絡で受けた休みをここで入れる */
export function addLeave(guardId, date, reason, status = 'approved') {
  state.leaves.unshift({ id: uid('lv'), guardId, date, reason: reason || '', status, at: new Date().toISOString() });
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

/** 入金消込。請求が得意先単位なのでキーも得意先名で持つ */
export function toggleDeposit(client) {
  state.deposits[client] = !state.deposits[client];
  commit();
}


// ---- マスタ（スキーマ駆動）----
/** そのマスタの実データ。store 指定のものは state 直下の業務データを直接編集する */
export function masterRows(mid) {
  const m = MASTERS[mid];
  if (m && m.store) return (state[m.store] = state[m.store] || []);
  return (state.masters[mid] = state.masters[mid] || []);
}
export function masterSet(mid, i, key, value) {
  const rows = masterRows(mid);
  if (!rows[i]) return;
  const m = MASTERS[mid];
  // 名前で参照している箇所は、改名したら一緒に付け替える（放置すると単価や配置NGが無言で外れる）
  const before = rows[i][key];
  if (m && key === 'name' && before && before !== value) {
    if (m.store === 'clients') {
      state.sites.forEach(st => { if (st.client === before) st.client = value; });
      if (before in state.deposits) { state.deposits[value] = state.deposits[before]; delete state.deposits[before]; }
    }
    if (m.store === 'sites') {
      (state.masters.siteRate || []).forEach(r => { if (r.site === before) r.site = value; });
      state.guards.forEach(g => {
        if (g.siteNGNames) g.siteNGNames = g.siteNGNames.map(x => x === before ? value : x);
      });
    }
    if (m.store === 'guards') {
      state.guards.forEach(g => {
        if (g.pairNGNames) g.pairNGNames = g.pairNGNames.map(x => x === before ? value : x);
      });
      state.education.forEach(e => { if (e.guardName === before) e.guardName = value; });
    }
  }
  rows[i][key] = value;
  commit();
}
/** 複数選択の1項目をON/OFFする。相性NGは相手側にも入れて対称に保つ */
export function masterMulti(mid, i, key, value, on) {
  const rows = masterRows(mid);
  const row = rows[i];
  if (!row) return;
  const cur = Array.isArray(row[key]) ? row[key].slice() : [];
  const next = on ? (cur.includes(value) ? cur : [...cur, value]) : cur.filter(x => x !== value);
  row[key] = next;
  if (key === 'pairNGNames') {                       // 相手の隊員にも同じ関係を入れる
    const me = row.name;
    state.guards.forEach(g => {
      if (g.name !== value) return;
      const l = Array.isArray(g.pairNGNames) ? g.pairNGNames.slice() : [];
      g.pairNGNames = on ? (l.includes(me) ? l : [...l, me]) : l.filter(x => x !== me);
    });
  }
  commit();
}

export function masterAdd(mid) {
  const rows = masterRows(mid);
  const m = MASTERS[mid] || {};
  rows.unshift(m.idPrefix ? { id: uid(m.idPrefix), ...defaultsFor(m) } : {});
  commit();
}
/** 業務データは空だと他画面が落ちるので、最低限の初期値を入れて追加する */
export function defaultsFor(mid) {
  const m = typeof mid === 'string' ? (MASTERS[mid] || {}) : mid;
  if (m.store === 'sites') return {
    name: '（新しい配置先）', start: '08:00', end: '17:00', brk: 60, need: 1, bill: 0, mark: '新',
    client: (state.clients[0] || {}).name || '',
    kind: ((state.masters.bizType || [])[1] || {}).name || '',
    // 勤務種別が空だとダブルブッキング判定が引けなくなるため必ず既定を入れる
    work: ((state.masters.work || [])[0] || {}).name || '',
  };
  if (m.store === 'guards') return { name: '（新しい隊員）', rate: 1200, quals: [], hiredAt: todayKey(), office: ((state.masters.branch || [])[0] || {}).name || '' };
  if (m.store === 'education') return { type: '現任', required: 10, done: 0, at: todayKey() };
  if (m.store === 'clients') return { name: '（新しい得意先）', honor: '御中', tax: '外税', close: '月末', payDay: '月末', payType: '振込' };
  return {};
}
export function masterDel(mid, i) {
  const rows = masterRows(mid);
  const m = MASTERS[mid] || {};
  const row = rows[i];
  if (!row) return;
  // 使用中の業務データは消させない（消すと請求も勤務も壊れる）
  if (m.store === 'sites' && state.shifts.some(s => s.siteId === row.id))
    return `${row.name} には勤務データがあるため削除できません`;
  if (m.store === 'guards' && state.shifts.some(s => s.guardId === row.id))
    return `${row.name} には勤務データがあるため削除できません`;
  if (m.store === 'guards' && state.leaves.some(l => l.guardId === row.id))
    return `${row.name} には休暇申請があるため削除できません`;
  if (m.store === 'clients' && state.sites.some(s => s.client === row.name))
    return `${row.name} には配置先が紐づいているため削除できません`;
  rows.splice(i, 1);
  commit();
  return null;
}
export function setOption(k, v) { state.options[k] = v; commit(); }
/** 警備業法施行規則の警備業務実施状況の記録にあわせ、現場ごとの天候を日単位で残す */
export function setWeather(date, siteId, name) {
  state.weatherLog[date] = state.weatherLog[date] || {};
  if (name) state.weatherLog[date][siteId] = name; else delete state.weatherLog[date][siteId];
  commit();
}
export function setOrder(date, siteId, n) {
  state.orders[date] = state.orders[date] || {};
  state.orders[date][siteId] = n;
  commit();
}
export function setAllowance(month, gid, k, v) {
  state.allowances[month] = state.allowances[month] || {};
  state.allowances[month][gid] = state.allowances[month][gid] || {};
  state.allowances[month][gid][k] = v;
  commit();
}
export function setBonus(gid, v) {
  state.bonus.amount = state.bonus.amount || {};
  state.bonus.amount[gid] = v;
  commit();
}
/** 勤務実績の打刻を直接編集する（勤務実績入力画面から）。
 *  労基法109条の記録義務にあわせ、元の打刻を消さずに修正履歴を残す */
export function editPunch(shiftId, type, hhmm, reason) {
  const sh = state.shifts.find(x => x.id === shiftId);
  if (!sh) return;
  const prev = sh.punches.find(p => p.type === type) || null;
  sh.punches = sh.punches.filter(p => p.type !== type);
  let after = null;
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const base = new Date(sh.date + 'T00:00:00');
    // 日跨ぎ勤務で下番が開始より前の時刻なら翌日として扱う
    let min = h * 60 + m;
    const st = Number(sh.start.slice(0, 2)) * 60 + Number(sh.start.slice(3));
    if (type === 'off' && min < st) min += 1440;
    after = new Date(base.getTime() + min * 60000).toISOString();
    // 手入力の打刻に位置情報は付けない（実際にそこに居た証拠にはならないため）
    sh.punches.push({ type, at: after, manual: true, wasAt: prev ? prev.at : null });
  }
  state.auditLog = state.auditLog || [];
  state.auditLog.unshift({
    at: new Date().toISOString(), by: '管制センター（デモ）', shiftId, date: sh.date,
    guardId: sh.guardId, type, before: prev ? prev.at : null, after, reason: reason || '',
  });
  commit();
}
export function bulkUpdate(from, to, siteId, op) {
  const hit = state.shifts.filter(s => s.date >= from && s.date <= to && (!siteId || s.siteId === siteId));
  if (op === 'clear-punch') hit.forEach(s => { s.punches = []; });
  else if (op === 'unassign') state.shifts = state.shifts.filter(s => !hit.includes(s));
  commit();
  return hit.length;
}
export function purgeBefore(date) {
  const n = state.shifts.filter(s => s.date < date).length;
  state.shifts = state.shifts.filter(s => s.date >= date);
  commit();
  return n;
}


/** 操作中の担当者と、その権限。未選択なら全権 */
export function currentStaff() {
  const list = state.masters.staff || [];
  return list.find(x => x.code === ui.staff) || null;
}
export function currentAuth() {
  const st = currentStaff();
  if (!st) return null;                                 // 担当者未選択＝制限なし
  return (state.masters.authority || []).find(a => a.role === st.role) || null;
}
/** メニューグループが今の担当者に見えるか。権限マスタの列名とグループIDの対応表 */
const AUTH_OF = { 'g-work': 'work', 'g-bill': 'bill', 'g-deposit': 'deposit', 'g-pay': 'pay',
  'g-master': 'master', 'g-master-bill': 'master', 'g-master-pay': 'master',
  'g-maint': 'maint', 'g-paid': 'pay', 'g-report': 'bill' };
export function canSee(groupId) {
  const a = currentAuth();
  if (!a) return true;
  const k = AUTH_OF[groupId];
  return !k || a[k] !== false;
}

/** 有給付与マスタと入社日から、その隊員の付与日数を引く */
export function paidGrantOf(g) {
  const t = state.masters.paidGrant || [];
  if (!t.length) return 0;
  const months = g.hiredAt
    ? Math.floor((new Date() - new Date(g.hiredAt + 'T00:00:00')) / 2629800000)
    : 42;
  const order = ['6か月', '1年6か月', '2年6か月', '3年6か月', '4年6か月', '5年6か月', '6年6か月以上'];
  const need = [6, 18, 30, 42, 54, 66, 78];
  let idx = -1;
  need.forEach((n, i) => { if (months >= n) idx = i; });
  if (idx < 0) return 0;
  const row = t.find(x => x.months === order[idx]) || t[t.length - 1];
  return Number(row.days) || 0;
}
