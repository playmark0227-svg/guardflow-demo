import {
  state, ui, subscribe, rerender, resetDemo, punch, toggleOffline,
  checkAssign, assign, unassign, undoUnassign, addNotice, commit,
  masterSet, masterAdd, masterDel, setOption, setOrder, setAllowance, setBonus,
  editPunch, bulkUpdate, purgeBefore, requestLeave, cancelLeave, setLeave, toggleDeposit,
} from './store.js';
import { renderGuard } from './guard.js';
import { renderAdmin } from './admin.js';
import {
  payslipPrintHTML, invoiceHTML, rosterHTML, scheduleHTML, wageSheetHTML,
  workReportHTML, billSheetHTML, depositListHTML, payListHTML, payslipAllHTML,
  dmHTML, codebookHTML, paidHTML, setMastersRef,
} from './prints.js';
import { addDays, todayKey, addMonths, esc, fmtMD } from './util.js';
import { MASTERS } from './masters.js';
import { findItem } from './menu.js';

// ---- テーマ（実機準拠でライトが既定） ----
const THEMES = ['light', 'dark'];
let theme = localStorage.getItem('gf-theme') || 'light';
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ---- トースト ----
function toast(msg, type = 'ok', action = null) {
  const wrap = document.getElementById('toast-wrap');
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.textContent = msg;
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-act';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { action.run(); div.remove(); });
    div.appendChild(btn);
    div.style.pointerEvents = 'auto';
  }
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
  else if (a === 'gtab') { ui.guardTab = t.dataset.tab; ui.shiftDetail = null; ui.noticeId = null; rerender(); }
  else if (a === 'notice-open') { ui.noticeId = t.dataset.id; rerender(); }
  else if (a === 'notice-back') { ui.noticeId = null; rerender(); }
  else if (a === 'atab') { ui.adminTab = t.dataset.tab; if (t.dataset.date) ui.boardDate = t.dataset.date; rerender(); }
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
  else if (a === 'rep-type') { ui.report.type = t.dataset.type; ui.report.manual = true; rerender(); }
  else if (a === 'rep-more') { ui.reportMore = !ui.reportMore; rerender(); }
  else if (a === 'pay-month') { if (t.dataset.m) { ui.payMonth = t.dataset.m; rerender(); } }
  else if (a === 'quick-report') {
    // 次にやる報告を1タップで送信する
    if (!ui.report.shiftId) { toast('報告対象シフトがありません', 'warn'); return; }
    t.disabled = true;
    const geo = await getGeo();
    punch(ui.report.shiftId, t.dataset.type, geo, '');
    ui.report.manual = false;
    const label = { depart: '出発', join: '合流', on: '上番', off: '下番', break_s: '休憩開始', break_e: '休憩終了' }[t.dataset.type];
    toast(state.offline ? `☁ ${label}を端末に保存しました（圏外・通信回復時に自動送信）` : `✓ ${label}を報告しました（GPS添付）`, state.offline ? 'warn' : 'ok');
  }
  else if (a === 'rep-shift') { ui.report.shiftId = t.dataset.shift; rerender(); }
  else if (a === 'submit-report') {
    if (!ui.report.shiftId) { toast('報告対象シフトがありません', 'warn'); return; }
    const memo = (document.getElementById('rep-memo') || {}).value || '';
    t.disabled = true;
    const geo = await getGeo();
    punch(ui.report.shiftId, ui.report.type, geo, memo);
    ui.report.manual = false;
    const label = { depart: '出発', join: '合流', on: '上番', off: '下番', break_s: '休憩開始', break_e: '休憩終了' }[ui.report.type];
    toast(state.offline ? `☁ ${label}報告を端末に保存しました（圏外・通信回復時に自動送信）` : `✓ ${label}報告を送信しました（GPS添付）`, state.offline ? 'warn' : 'ok');
  }
  // --- 隊員アプリ：シフト・休暇 ---
  else if (a === 'shift-open') { ui.shiftDetail = t.dataset.shift; rerender(); }
  else if (a === 'shift-back') { ui.shiftDetail = null; rerender(); }
  else if (a === 'cal-month') { ui.calMonth = (ui.calMonth || 0) + Number(t.dataset.delta); rerender(); }
  else if (a === 'leave-day') {
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
  // --- 新メニュー・マスタ ---
  else if (a === 'open-item') { ui.adminTab = t.dataset.item; ui.masterQ = ''; rerender(); }
  else if (a === 'master-add') { masterAdd(t.dataset.m); toast('行を追加しました。値を入力してください'); }
  else if (a === 'master-del') {
    if (!confirm('この行を削除します。よろしいですか？')) return;
    masterDel(t.dataset.m, Number(t.dataset.i)); toast('削除しました');
  }
  else if (a === 'master-bulk') {
    const add = [['160-0022', '東京都新宿区新宿'], ['100-0005', '東京都千代田区丸の内'], ['150-0043', '東京都渋谷区道玄坂'],
                 ['231-0023', '神奈川県横浜市中区山下町'], ['210-0006', '神奈川県川崎市川崎区砂子']];
    let n = 0;
    add.forEach(([zip, addr]) => { if (!state.masters.zip.some(z => z.zip === zip)) { state.masters.zip.push({ zip, addr }); n++; } });
    commit(); toast(`✓ ${n}件を取り込みました（合計 ${state.masters.zip.length}件）`);
  }
  else if (a === 'master-print') { printHTML(masterSheetHTML(t.dataset.m)); }
  else if (a === 'order-copy') {
    const prev = addDays(ui.boardDate, -1);
    state.orders[ui.boardDate] = { ...(state.orders[prev] || {}) };
    commit(); toast(`✓ ${fmtMD(prev)} の受注をコピーしました`);
  }
  else if (a === 'zengin-dl') { download('zengin.txt', state.guards.map(g => g.name).join('\n'), 'text/plain'); }
  else if (a === 'export') { exportCsv(t.dataset.k); }
  else if (a === 'bulk-run') {
    const from = document.getElementById('blk-from').value, to = document.getElementById('blk-to').value;
    const sid = document.getElementById('blk-site').value, op = document.getElementById('blk-op').value;
    const n = state.shifts.filter(x => x.date >= from && x.date <= to && (!sid || x.siteId === sid)).length;
    if (!n) { toast('対象データがありません', 'warn'); return; }
    if (!confirm(`${n}件が対象です。実行しますか？`)) return;
    toast(`✓ ${bulkUpdate(from, to, sid, op)}件を更新しました`);
  }
  else if (a === 'purge') {
    const d = document.getElementById('del-before').value;
    const n = state.shifts.filter(x => x.date < d).length;
    if (!n) { toast('対象データがありません', 'warn'); return; }
    if (!confirm(`${fmtMD(d)} より前の勤務データ ${n}件を削除します。元に戻せません。`)) return;
    toast(`${purgeBefore(d)}件を削除しました`, 'warn');
  }
  else if (a === 'open-shift') { ui.detailShift = t.dataset.shift; rerender(); }
  else if (a === 'close-shift') { ui.detailShift = null; rerender(); }
  else if (a === 'goto-board') { ui.boardDate = t.dataset.date; ui.detailShift = null; ui.adminTab = 'board'; rerender(); }
  else if (a === 'remove-shift') {
    const sh = state.shifts.find(x => x.id === t.dataset.shift);
    if (sh && sh.punches.length &&
        !confirm(`この勤務には打刻が${sh.punches.length}件あります。外すと実績も一緒に消えます。よろしいですか？`)) return;
    ui.detailShift = null;
    if (unassign(t.dataset.shift)) {
      toast('配置を解除しました', 'ok', { label: '元に戻す', run: () => { undoUnassign(); toast('✓ 配置を戻しました'); } });
    }
  }
  else if (a === 'leave') {
    setLeave(t.dataset.id, t.dataset.st);
    toast({ approved: '✓ 承認しました（隊員アプリへ反映）', nego: '「交渉可」にしました', rejected: '棄却しました' }[t.dataset.st]);
  }
  else if (a === 'toggle-deposit') { toggleDeposit(t.dataset.site); }
  // --- 帳票・印刷 ---
  else if (a === 'print-pay') { printHTML(payslipPrintHTML(state.guards.find(x => x.id === ui.guardId), ui.payMonth)); }
  else if (a === 'print-payslip') { printHTML(payslipPrintHTML(state.guards.find(x => x.id === t.dataset.guard))); }
  else if (a === 'print-invoice') { printHTML(invoiceHTML(t.dataset.site, ui.boardDate)); }
  else if (a === 'report-out') {
    const r = t.dataset.report;
    if (r === 'roster') printHTML(rosterHTML());
    else if (r === 'schedule') printHTML(scheduleHTML(ui.boardDate));
    else if (r === 'wage') printHTML(wageSheetHTML());
    else if (r === 'workreport') printHTML(workReportHTML(ui.boardDate));
    else if (r === 'bill-site') printHTML(billSheetHTML('site', ui.boardDate));
    else if (r === 'bill-client') printHTML(billSheetHTML('client', ui.boardDate));
    else if (r === 'deposit-list') printHTML(depositListHTML());
    else if (r === 'paylist') printHTML(payListHTML(ui.payMonth));
    else if (r === 'payslip-all') printHTML(payslipAllHTML(ui.payMonth));
    else if (r === 'dm') printHTML(dmHTML());
    else if (r === 'codebook') printHTML(codebookHTML());
    else if (r === 'paid') printHTML(paidHTML());
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

// 検索は打つそばから絞り込む（フォーカスとカーソル位置は維持する）
document.addEventListener('input', e => {
  if (e.target.id === 'master-q') {
    ui.masterQ = e.target.value;
    const pos = e.target.selectionStart; rerender();
    const el2 = document.getElementById('master-q');
    if (el2) { el2.focus(); el2.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id !== 'gantt-q') return;
  ui.q = e.target.value;
  const pos = e.target.selectionStart;
  rerender();
  const el = document.getElementById('gantt-q');
  if (el) { el.focus(); el.setSelectionRange(pos, pos); }
});

document.addEventListener('change', e => {
  const el = e.target, ac = el.dataset.actionChange;
  if (el.dataset.mf !== undefined) {                       // マスタのセル編集
    const mid = (findItem(ui.adminTab) || {}).master;
    if (mid) { masterSet(mid, Number(el.dataset.i), el.dataset.mf, el.type === 'checkbox' ? el.checked : el.value); return; }
  }
  if (ac === 'order') { setOrder(ui.boardDate, el.dataset.site, Number(el.value) || 0); return; }
  if (ac === 'punch-edit') { editPunch(el.dataset.shift, el.dataset.type, el.value); return; }
  if (ac === 'allowance') { setAllowance(ui.payMonth || todayKey().slice(0, 7), el.dataset.g, el.dataset.k, Number(el.value) || 0); return; }
  if (ac === 'bonus') { setBonus(el.dataset.g, Number(el.value) || 0); return; }
  if (ac === 'option') { setOption(el.dataset.k, el.checked); return; }
  if (el.id === 'ledger-client') { ui.ledgerClient = el.value; rerender(); return; }
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

// キーボード操作：Enter/Space で開く、Esc で閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.detailShift) { ui.detailShift = null; rerender(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.action === 'open-shift') {
    e.preventDefault(); ui.detailShift = e.target.dataset.shift; rerender();
  }
});

setMastersRef(MASTERS);
applyTheme();
render();


// ---- ファイル書き出し ----
function download(name, text, mime) {
  const blob = new Blob(['\ufeff' + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  toast(`\u2713 ${name} を書き出しました`);
}
function exportCsv(kind) {
  const pick = {
    guards: () => [Object.keys(state.guards[0]), ...state.guards.map(g => Object.values(g))],
    sites: () => [Object.keys(state.sites[0]), ...state.sites.map(s => Object.values(s))],
    shifts: () => [['date', 'siteId', 'guardId', 'start', 'end', 'punches'],
      ...state.shifts.map(s => [s.date, s.siteId, s.guardId, s.start, s.end, s.punches.length])],
    masters: () => { const o = [['master', 'row']]; Object.entries(state.masters).forEach(([k, v]) => v.forEach(r => o.push([k, JSON.stringify(r)]))); return o; },
  }[kind];
  if (!pick) return;
  download(`${kind}.csv`, pick().map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv');
}
function masterSheetHTML(mid) {
  const m = MASTERS[mid], rows = state.masters[mid] || [];
  const v = (f, r) => f.t === 'chk' ? (r[f.k] ? '✓' : '') : (r[f.k] ?? '');
  return `<div class="payslip">
    <h1>${esc(m.name)}</h1>
    <p class="ps-meta">${rows.length}件　／　GuardFlow警備株式会社（デモ）</p>
    <table class="ps-table">
      <tr>${m.fields.map(f => `<th>${esc(f.l)}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>${m.fields.map(f => `<td>${esc(v(f, r))}</td>`).join('')}</tr>`).join('')}
    </table>
    <p class="ps-foot">本帳票はデモデータにより自動生成されています。</p>
  </div>`;
}
