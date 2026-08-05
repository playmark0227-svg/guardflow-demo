import {
  state, ui, subscribe, rerender, resetDemo, punch, toggleOffline,
  checkAssign, assign, unassign, addNotice, requestLeave, cancelLeave, setLeave, toggleDeposit,
} from './store.js';
import { renderGuard } from './guard.js';
import { renderAdmin } from './admin.js';
import { payslipPrintHTML, invoiceHTML, rosterHTML, scheduleHTML, wageSheetHTML } from './prints.js';
import { addDays, todayKey, addMonths } from './util.js';

// ---- テーマ（実機準拠でライトが既定） ----
const THEMES = ['light', 'dark'];
let theme = localStorage.getItem('gf-theme') || 'light';
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ---- トースト ----
function toast(msg, type = 'ok') {
  const wrap = document.getElementById('toast-wrap');
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.textContent = msg;
  wrap.appendChild(div);
  setTimeout(() => div.classList.add('show'), 10);
  setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 3800);
}

// ---- GPS取得（拒否・タイムアウト時はモック座標にフォールバック）----
function getGeo() {
  const mock = () => ({ lat: +(35.44 + Math.random() * 0.02).toFixed(5), lng: +(139.62 + Math.random() * 0.03).toFixed(5), acc: 15, mock: true });
  return new Promise(res => {
    let done = false;
    const finish = v => { if (!done) { done = true; res(v); } };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => finish({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }),
        () => finish(mock()),
        { timeout: 2000, maximumAge: 60000 });
      setTimeout(() => finish(mock()), 2300);
    } else finish(mock());
  });
}

// ---- 配置（クリック / D&D 共通）----
function tryAssign(guardId, siteId) {
  const date = ui.boardDate;
  const chk = checkAssign(date, siteId, guardId);
  if (chk.block) { toast('🚫 ' + chk.block, 'danger'); return; }
  assign(date, siteId, guardId);
  ui.selectedGuard = null;
  if (chk.warn) toast('⚠️ 注意喚起つきで配置しました：' + chk.warn, 'warn');
  else toast('✓ 配置しました');
}

// ---- 印刷 ----
function printHTML(html) {
  document.getElementById('print-area').innerHTML = html;
  window.print();
}

// ---- レンダリング ----
function render() {
  document.getElementById('btn-role-guard').classList.toggle('active', ui.role === 'guard');
  document.getElementById('btn-role-admin').classList.toggle('active', ui.role === 'admin');
  const el = document.getElementById('app');
  document.body.classList.toggle('pc-mode', ui.role === 'admin');
  if (ui.role === 'guard') renderGuard(el); else renderAdmin(el);
  bindDnD(el);
}
subscribe(render);

function bindDnD(el) {
  el.querySelectorAll('.gchip[draggable]').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', chip.dataset.guard);
      e.dataTransfer.effectAllowed = 'move';
    });
  });
  el.querySelectorAll('[data-drop-site]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drop-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-hover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drop-hover');
      const gid = e.dataTransfer.getData('text/plain');
      if (gid) tryAssign(gid, zone.dataset.dropSite);
    });
  });
}

// ---- クリックの委譲 ----
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  if (a === 'role') { ui.role = t.dataset.role; rerender(); }
  else if (a === 'theme') { theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]; localStorage.setItem('gf-theme', theme); applyTheme(); }
  else if (a === 'reset') { resetDemo(); toast('デモデータをリセットしました'); }
  else if (a === 'gtab') { ui.guardTab = t.dataset.tab; ui.shiftDetail = null; rerender(); }
  else if (a === 'atab') { ui.adminTab = t.dataset.tab; rerender(); }
  else if (a === 'gantt-nav') {
    const dir = Number(t.dataset.dir);
    if (dir === 0) ui.boardDate = todayKey();
    else if (ui.ganttUnit === 'month') ui.boardDate = addMonths(ui.boardDate, dir);
    else ui.boardDate = addDays(ui.boardDate, dir * (ui.ganttUnit === 'hour' ? 1 : 7));
    rerender();
  }
  else if (a === 'board-date') {
    const d = Number(t.dataset.delta);
    ui.boardDate = d === 0 ? todayKey() : addDays(ui.boardDate, d);
    rerender();
  }
  // --- 隊員アプリ：勤怠報告 ---
  else if (a === 'rep-type') { ui.report.type = t.dataset.type; rerender(); }
  else if (a === 'rep-shift') { ui.report.shiftId = t.dataset.shift; rerender(); }
  else if (a === 'submit-report') {
    if (!ui.report.shiftId) { toast('報告対象シフトがありません', 'warn'); return; }
    const memo = (document.getElementById('rep-memo') || {}).value || '';
    t.disabled = true;
    const geo = await getGeo();
    punch(ui.report.shiftId, ui.report.type, geo, memo);
    const label = { depart: '出発', join: '合流', on: '上番', off: '下番', break_s: '休憩開始', break_e: '休憩終了' }[ui.report.type];
    toast(state.offline ? `☁ ${label}報告を端末に保存しました（圏外・通信回復時に自動送信）` : `✓ ${label}報告を送信しました（GPS添付）`, state.offline ? 'warn' : 'ok');
  }
  // --- 隊員アプリ：シフト・休暇 ---
  else if (a === 'shift-open') { ui.shiftDetail = t.dataset.shift; rerender(); }
  else if (a === 'shift-back') { ui.shiftDetail = null; rerender(); }
  else if (a === 'leave-edit') { ui.leaveEdit = !ui.leaveEdit; rerender(); }
  else if (a === 'cal-month') { ui.calMonth = (ui.calMonth || 0) + Number(t.dataset.delta); rerender(); }
  else if (a === 'leave-day') {
    if (!ui.leaveEdit) return;
    const date = t.dataset.date;
    if (date < todayKey()) { toast('過去の日付には申請できません', 'warn'); return; }
    const mine = state.leaves.find(l => l.guardId === ui.guardId && l.date === date);
    if (!mine) { requestLeave(ui.guardId, date, 'アプリから申請'); toast('✓ 休暇を申請しました'); }
    else if (mine.status === 'pending') { cancelLeave(ui.guardId, date); toast('申請を取り消しました'); }
    else toast('この日付は処理済みのため変更できません', 'warn');
  }
  else if (a === 'logout') { toast('デモのためログアウトは省略します'); }
  // --- PC：配置・承認・入金 ---
  else if (a === 'pick-guard') { ui.selectedGuard = ui.selectedGuard === t.dataset.guard ? null : t.dataset.guard; rerender(); }
  else if (a === 'drop-assign') {
    if (!ui.selectedGuard) { toast('先に「未配置の隊員」から選択してください', 'warn'); return; }
    tryAssign(ui.selectedGuard, t.dataset.site);
  }
  else if (a === 'remove-shift') { unassign(t.dataset.shift); toast('配置を解除しました'); }
  else if (a === 'leave') {
    setLeave(t.dataset.id, t.dataset.st);
    toast({ approved: '✓ 承認しました（隊員アプリへ反映）', nego: '「交渉可」にしました', rejected: '棄却しました' }[t.dataset.st]);
  }
  else if (a === 'toggle-deposit') { toggleDeposit(t.dataset.site); }
  // --- 帳票・印刷 ---
  else if (a === 'print-pay') { printHTML(payslipPrintHTML(state.guards.find(x => x.id === ui.guardId))); }
  else if (a === 'print-payslip') { printHTML(payslipPrintHTML(state.guards.find(x => x.id === t.dataset.guard))); }
  else if (a === 'print-invoice') { printHTML(invoiceHTML(t.dataset.site, ui.boardDate)); }
  else if (a === 'report-out') {
    const r = t.dataset.report;
    if (r === 'roster') printHTML(rosterHTML());
    else if (r === 'schedule') printHTML(scheduleHTML(ui.boardDate));
    else if (r === 'wage') printHTML(wageSheetHTML());
    else if (r === 'invoice-menu') { ui.adminTab = 'billing'; rerender(); }
    else toast('この帳票はデモでは未実装です', 'warn');
  }
});

// ---- フォーム・入力の委譲 ----
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(f).entries());
  if (f.dataset.form === 'notice') {
    addNotice(data.title, data.body);
    toast('✓ 隊員アプリへ配信しました');
  }
});

document.addEventListener('change', e => {
  // 勤務ガントのフィルタ行
  if (e.target.id === 'gantt-from') { if (e.target.value) { ui.boardDate = e.target.value; rerender(); } }
  else if (e.target.id === 'gantt-unit') { ui.ganttUnit = e.target.value; rerender(); }
  else if (e.target.id === 'gantt-office') { ui.ganttOffice = e.target.value; rerender(); }
  else if (e.target.id === 'gantt-site') { ui.ganttSite = e.target.value; rerender(); }
  else if (e.target.id === 'guard-switch') { ui.guardId = e.target.value; ui.shiftDetail = null; rerender(); }
  else if (e.target.id === 'offline-switch') {
    toggleOffline();
    toast(state.offline ? '📡 圏外モードに切り替えました' : '✓ 通信回復。送信待ちの報告を同期しました');
  }
});

applyTheme();
render();
