import { state, ui } from './store.js';
import { todayKey, addDays, fmtMD, fmtTime, esc, yen, shiftMinutes, parseHM, nowMin, hrs } from './util.js';
import { calcPay } from './prints.js';
import { ganttView, wageOf } from './gantt.js';

const guard = id => state.guards.find(g => g.id === id);
const site = id => state.sites.find(s => s.id === id);
const dayShifts = date => state.shifts.filter(s => s.date === date);

const statusOf = sh => {
  const has = t => sh.punches.some(p => p.type === t);
  if (has('off')) return 'done';
  if (has('on')) return 'onduty';
  if (has('depart')) return 'departed';
  return 'scheduled';
};
const STATUS = {
  scheduled: ['予定', 'st-scheduled'], departed: ['出発', 'st-departed'],
  onduty: ['上番中', 'st-onduty'], done: ['下番済', 'st-done'],
};

function datePager() {
  const d = ui.boardDate;
  return `<div class="pc-pager">
    <button class="pc-btn" data-action="board-date" data-delta="-1">◀ 前日</button>
    <b>${fmtMD(d)}${d === todayKey() ? '<span class="pc-chip-today">今日</span>' : ''}</b>
    <button class="pc-btn" data-action="board-date" data-delta="1">翌日 ▶</button>
    ${d !== todayKey() ? '<button class="pc-btn" data-action="board-date" data-delta="0">今日へ</button>' : ''}
  </div>`;
}

// ================= ダッシュボード =================
function dashView() {
  const D0 = todayKey(), D1 = addDays(D0, 1), Dm1 = addDays(D0, -1);
  // 明日その現場に1人でも配置予定があるものだけを「稼働現場」として数える
  const liveSites = new Set(dayShifts(D1).map(s => s.siteId));
  const needSum = state.sites.filter(s => liveSites.has(s.id)).reduce((n, s) => n + s.need, 0);
  const tomorrowAssigned = dayShifts(D1).length;
  const missing = Math.max(0, needSum - tomorrowAssigned);
  const yShifts = dayShifts(Dm1);
  const unchecked = yShifts.filter(s => !s.punches.some(p => p.type === 'off')).length;

  // 売上推移（デモ用の決定論的な月次系列）
  const dayBill = state.sites.reduce((sum, st) => {
    const list = dayShifts(D0).filter(s => s.siteId === st.id);
    return sum + list.length * (shiftMinutes(st.start, st.end) / 60) * st.bill;
  }, 0);
  const monthly = [0.93, 0.95, 0.97, 0.96, 1.0, 1.02, 1.04].map(f => Math.round(dayBill * 26 * f / 10000));
  const prevY = [0.9, 0.91, 0.94, 0.92, 0.95, 0.96, 0.97, 0.98, 0.96, 0.99, 1.0, 1.01].map(f => Math.round(dayBill * 26 * f * 0.94 / 10000));
  const total = monthly.reduce((a, b) => a + b, 0);

  // タスク（実データから生成）
  const now = nowMin();
  const alerts = dayShifts(D0).filter(sh => statusOf(sh) === 'scheduled' && now >= parseHM(sh.start) - 30 && parseHM(sh.start) >= 360).length;
  const eduLow = state.education.filter(e => e.done / e.required < 0.6).length;
  const pendingLv = state.leaves.filter(l => l.status === 'pending').length;
  const tasks = [
    missing ? { ic: '📅', cls: 'tk-orange', label: `明日${fmtMD(D1)}の配置不足（${missing}名）`, link: '勤務予定を入力', tab: 'board', date: D1 } : null,
    alerts ? { ic: '🚨', cls: 'tk-red', label: `未出発の隊員（${alerts}件）`, link: '上下番モニターへ', tab: 'monitor', date: D0 } : null,
    eduLow ? { ic: '🎓', cls: 'tk-blue', label: `法定教育の未達（${eduLow}名）`, link: '教育管理へ', tab: 'edu' } : null,
    pendingLv ? { ic: '✈️', cls: 'tk-green', label: `休暇申請の承認待ち（${pendingLv}件）`, link: '有休管理へ', tab: 'leave' } : null,
  ].filter(Boolean);

  const chart = lineChart(monthly, prevY);
  return `
    <div class="pc-sec-head"><h2>勤務予定・勤務実績</h2><button class="pc-link" data-action="atab" data-tab="finance">経営モード ⇄</button></div>
    <div class="pc-2col">
      <div class="pc-card">
        <div class="pc-card-head"><span>🗓 勤務予定</span><span class="pc-muted">明日 ${fmtMD(D1)}</span></div>
        <div class="pc-card-big">${missing ? `<span class="pc-warn-ic">⚠</span> 入力漏れ <b>${missing}</b> 件` : '<span class="pc-ok-ic">✓</span> 入力漏れなし'}</div>
        <div class="pc-bar-row"><span class="pc-muted">◀ 前日</span>
          <div class="pc-bar"><div class="pc-bar-fill" style="width:${needSum ? Math.round(tomorrowAssigned / needSum * 100) : 0}%"></div></div>
          <span class="pc-muted">翌日 ▶</span></div>
        <div class="pc-bar-num">${tomorrowAssigned} / ${needSum}</div>
      </div>
      <div class="pc-card">
        <div class="pc-card-head"><span>✅ 勤務実績</span><span class="pc-muted">昨日 ${fmtMD(Dm1)}</span></div>
        <div class="pc-card-big">${unchecked ? `チェック漏れ <b>${unchecked}</b> 件` : '<span class="pc-ok-ic">✓</span> チェック漏れなし'}</div>
        <div class="pc-bar-row"><span class="pc-muted">◀ 前日</span>
          <div class="pc-bar"><div class="pc-bar-fill" style="width:${yShifts.length ? Math.round((yShifts.length - unchecked) / yShifts.length * 100) : 0}%"></div></div>
          <span class="pc-muted">翌日 ▶</span></div>
        <div class="pc-bar-num">${yShifts.length - unchecked} / ${yShifts.length}</div>
      </div>
    </div>
    <div class="pc-sec-head"><h2>売上の推移</h2></div>
    <div class="pc-card">
      <div class="pc-chart-head">
        <span class="pc-chart-total">${total.toLocaleString()}万円</span>
        <span class="pc-toggle"><button class="pc-tg">年別</button><button class="pc-tg on">月別</button><button class="pc-btn">2026年 ▾</button></span>
      </div>
      ${chart}
      <div class="pc-legend"><span><i class="lgd lgd-navy"></i>2026年</span><span><i class="lgd lgd-gray"></i>2025年</span></div>
    </div>
    <div class="pc-sec-head"><h2>タスク管理</h2></div>
    <div class="pc-card pc-card-flat">
      <div class="pc-task-head">≡ 優先タスク（全${tasks.length}件）<span style="float:right">⌃</span></div>
      ${tasks.map(t => `<button class="pc-task" data-action="atab" data-tab="${t.tab}"${t.date ? ` data-date="${t.date}"` : ''}>
        <span class="tk-ic ${t.cls}">${t.ic}</span>
        <span class="tk-label">${t.label}</span>
        <span class="tk-link">${t.link} ›</span>
      </button>`).join('') || '<div class="pc-muted" style="padding:14px">未対応のタスクはありません</div>'}
    </div>`;
}

// 簡易折れ線チャート（SVG・当年=紺 / 前年=グレー）
function lineChart(cur, prev) {
  const W = 720, H = 180, PL = 46, PB = 22, PT = 10;
  const all = [...cur, ...prev];
  const min = Math.min(...all) * 0.97, max = Math.max(...all) * 1.03;
  const x = i => PL + i * (W - PL - 10) / 11;
  const y = v => PT + (H - PT - PB) * (1 - (v - min) / (max - min));
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const gridY = [0, .5, 1].map(t => { const v = min + (max - min) * t; return `<line x1="${PL}" y1="${y(v)}" x2="${W - 10}" y2="${y(v)}" class="ch-grid"/><text x="${PL - 6}" y="${y(v) + 4}" class="ch-lbl" text-anchor="end">${Math.round(v).toLocaleString()}万円</text>`; }).join('');
  const months = Array.from({ length: 12 }, (_, i) => `<text x="${x(i)}" y="${H - 6}" class="ch-lbl" text-anchor="middle">${i + 1}月</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="pc-chart" role="img" aria-label="売上の推移">
    ${gridY}${months}
    <path d="${path(prev)}" class="ch-prev"/>
    <path d="${path(cur)}" class="ch-cur"/>
    ${cur.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" class="ch-dot"/>`).join('')}
  </svg>`;
}

// ================= 勤務管理（管制ボード） =================
function boardView() {
  const date = ui.boardDate;
  const shifts = dayShifts(date);
  const assignedIds = new Set(shifts.map(s => s.guardId));
  const free = state.guards.filter(g => !assignedIds.has(g.id));

  const chips = free.map(g => `
    <button class="gchip ${ui.selectedGuard === g.id ? 'gchip-on' : ''}" draggable="true"
      data-action="pick-guard" data-guard="${g.id}"
      title="${esc((g.caution || '') + (g.siteNG ? ' / 出禁現場あり' : ''))}">
      <b>${esc(g.name)}</b><span class="pc-muted">${g.age}</span>
      ${g.quals.map(q => `<span class="pc-chip-qual">${esc(q)}</span>`).join('')}
      ${g.caution ? '<span title="注意喚起あり">⚠️</span>' : ''}
      ${g.siteNG ? '<span title="出入り禁止現場あり">🚫</span>' : ''}
    </button>`).join('');

  const cards = state.sites.map(st => {
    const list = shifts.filter(s => s.siteId === st.id);
    const short = list.length < st.need;
    const qualOK = !st.reqQual || list.some(s => guard(s.guardId).quals.includes(st.reqQual));
    return `<div class="site-card ${short ? 'site-short' : ''}" data-drop-site="${st.id}">
      <div class="site-head">
        <div><span class="pc-chip-kind">${st.kind}</span> <b>${esc(st.name)}</b></div>
        <span class="${short ? 'staff-short' : 'staff-ok'}">${list.length}/${st.need}名${short ? ' ⚠ 不足' : ' ✓'}</span>
      </div>
      <div class="site-meta">
        <span>${st.start}〜${st.end}</span>${st.night ? '<span>🌙</span>' : ''}
        ${st.note ? `<span class="pc-muted">${esc(st.note)}</span>` : ''}
        ${st.reqQual ? `<span class="${qualOK ? 'pc-chip-ok' : 'pc-chip-warn'}">要 ${esc(st.reqQual)} ${qualOK ? '✓' : '⚠ 未充足'}</span>` : ''}
      </div>
      <div>
        ${list.map(sh => {
          const g = guard(sh.guardId);
          const [label, cls] = STATUS[statusOf(sh)];
          return `<div class="assigned-row">
            <span class="dot ${cls}"></span><b>${esc(g.name)}</b>
            <span class="st-chip ${cls}">${label}</span>
            ${g.caution ? '<span>⚠️</span>' : ''}
            <button class="rm" data-action="remove-shift" data-shift="${sh.id}" title="配置解除">×</button>
          </div>`;
        }).join('')}
        <div class="drop-zone" data-action="drop-assign" data-site="${st.id}">＋ ドロップ / クリックで配置</div>
      </div>
    </div>`;
  }).join('');

  return `${datePager()}
    <div class="pc-card">
      <div class="pc-card-head"><b>未配置の隊員</b><span class="pc-muted">クリックで選択 → 現場の「＋」をクリック（ドラッグ&ドロップも可）</span></div>
      <div class="roster-chips">${chips || '<span class="pc-muted">全員配置済み</span>'}</div>
    </div>
    <div class="sites-grid">${cards}</div>
    <p class="pc-muted">配置NG（出禁）・相性NG・ダブルブッキングは自動でブロック、注意喚起は警告つきで配置します。</p>`;
}

// ================= 上下番モニター =================
function monitorView() {
  const date = ui.boardDate;
  const shifts = dayShifts(date).sort((a, b) => a.start.localeCompare(b.start));
  const now = nowMin();
  const counts = { scheduled: 0, departed: 0, onduty: 0, done: 0, alert: 0 };
  const rows = shifts.map(sh => {
    const g = guard(sh.guardId), s = site(sh.siteId);
    const stt = statusOf(sh);
    counts[stt]++;
    const isToday = date === todayKey();
    const alert = isToday && stt === 'scheduled' && now >= parseHM(sh.start) - 30 && parseHM(sh.start) >= 360;
    if (alert) counts.alert++;
    const last = sh.punches[sh.punches.length - 1];
    const [label, cls] = STATUS[stt];
    const seq = ['depart', 'on', 'off'].map(t => {
      const p = sh.punches.find(x => x.type === t);
      const name = { depart: '出発', on: '上番', off: '下番' }[t];
      return p ? `<span class="seq seq-on">${name} ${fmtTime(p.at)}${p.queued ? '☁' : ''}</span>` : `<span class="seq">${name} --:--</span>`;
    }).join('<span class="seq-arrow">→</span>');
    return `<tr class="${alert ? 'row-alert' : ''}">
      <td><b>${esc(g.name)}</b><br><span class="pc-muted small">${esc(s.name)}</span></td>
      <td>${sh.start}〜${sh.end}</td>
      <td><span class="st-chip ${cls}">${label}</span>${alert ? '<span class="st-chip st-alert">🔴 未出発</span>' : ''}</td>
      <td class="seq-cell">${seq}</td>
      <td>${last ? `<span class="small">${last.lat}, ${last.lng}<br>±${last.acc}m <a href="https://www.google.com/maps?q=${last.lat},${last.lng}" target="_blank" rel="noopener">地図</a></span>` : '<span class="pc-muted small">—</span>'}</td>
    </tr>`;
  }).join('');
  return `${datePager()}
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${counts.onduty}</b><span>上番中</span></div>
      <div class="pc-kpi"><b>${counts.departed}</b><span>移動中</span></div>
      <div class="pc-kpi"><b>${counts.done}</b><span>下番済</span></div>
      <div class="pc-kpi ${counts.alert ? 'kpi-alert' : ''}"><b>${counts.alert}</b><span>未出発 ⚠</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>隊員 / 現場</th><th>予定</th><th>状態</th><th>打刻</th><th>GPS</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="pc-muted">この日の配置はありません</td></tr>'}</tbody>
    </table></div>`;
}

// ================= 請求管理 =================
function billingView() {
  const date = ui.boardDate;
  const rows = state.sites.map(st => {
    const list = dayShifts(date).filter(s => s.siteId === st.id);
    const hours = shiftMinutes(st.start, st.end) / 60;
    const amount = list.length * hours * st.bill;
    return `<tr>
      <td><b>${esc(st.name)}</b><br><span class="pc-muted small">${esc(st.client)}</span></td>
      <td class="num">${list.length}名 × ${hours}h × @${st.bill.toLocaleString()}</td>
      <td class="num"><b>${yen(amount)}</b></td>
      <td>${amount ? `<button class="pc-btn" data-action="print-invoice" data-site="${st.id}">📄 請求書</button>` : '<span class="pc-muted">—</span>'}</td>
    </tr>`;
  }).join('');
  return `${datePager()}
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>現場 / 得意先</th><th class="num">明細</th><th class="num">請求額（税抜）</th><th>帳票</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="pc-muted">「請求書」でPDF印刷プレビューを出力します（消費税10%を自動計算）。</p>`;
}

// ================= 入金管理 =================
function depositView() {
  const date = todayKey();
  const rows = state.sites.map(st => {
    const list = dayShifts(date).filter(s => s.siteId === st.id);
    const hours = shiftMinutes(st.start, st.end) / 60;
    const amount = Math.round(list.length * hours * st.bill * 1.1);
    const paid = !!state.deposits[st.id];
    return `<tr>
      <td><b>${esc(st.client)}</b><br><span class="pc-muted small">${esc(st.name)}</span></td>
      <td class="num">${yen(amount)}</td>
      <td>月末</td>
      <td><span class="st-chip ${paid ? 'st-onduty' : 'st-scheduled'}">${paid ? '入金済' : '未入金'}</span></td>
      <td><button class="pc-btn" data-action="toggle-deposit" data-site="${st.id}">${paid ? '消込を取消' : '入金消込'}</button></td>
    </tr>`;
  }).join('');
  return `
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>得意先 / 現場</th><th class="num">請求額（税込）</th><th>入金予定</th><th>状態</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="pc-muted">入金実績・入金予定・入金漏れを判別します（デモ：本日分請求ベース）。</p>`;
}

// ================= 給与管理（PC） =================
function payrollView() {
  const rows = state.guards.map(g => {
    const p = calcPay(g);
    return `<tr>
      <td>${esc(g.code)}</td><td><b>${esc(g.name)}</b></td>
      <td class="num">${p.days}日 / ${hrs(p.hours * 60)}h</td>
      <td class="num">${yen(p.gross)}</td>
      <td class="num">${yen(p.ded)}</td>
      <td class="num"><b>${yen(p.net)}</b></td>
      <td><button class="pc-btn" data-action="print-payslip" data-guard="${g.id}">📄 明細</button></td>
    </tr>`;
  }).join('');
  return `
    <div class="pc-pager"><b>2026年6月度 給与一覧</b></div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>隊員コード</th><th>氏名</th><th class="num">勤怠</th><th class="num">総支給</th><th class="num">控除</th><th class="num">差引支給</th><th>帳票</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ================= 帳票管理 =================
function reportsView() {
  const items = [
    ['roster', '警備員名簿', '備付書類（規則66条）', true],
    ['schedule', '配置予定表', `対象日：${fmtMD(ui.boardDate)}`, true],
    ['nippo', '管制日報（B4横）', '', false],
    ['edu-sheet', '教育実施簿', '', false],
    ['chingin', '賃金台帳', '', false],
    ['invoice-menu', '請求書', '請求管理から出力', false],
  ];
  return `
    <div class="pc-cards-grid">
      ${items.map(([id, name, sub, ok]) => `<button class="pc-report-card" data-action="report-out" data-report="${id}">
        <span class="pc-report-ic">🖨</span><b>${name}</b>
        <span class="pc-muted small">${sub || '&nbsp;'}</span>
        <span class="${ok ? 'pc-chip-ok' : 'pc-chip-muted'}">${ok ? 'PDF出力可' : 'デモ未実装'}</span>
      </button>`).join('')}
    </div>
    <p class="pc-muted">帳票はボタン1つでPDF出力（ブラウザの印刷ダイアログが開きます）。</p>`;
}

// ================= マスタ管理 =================
function masterView() {
  return `
    <div class="pc-pager"><b>隊員マスタ</b></div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>コード</th><th>氏名</th><th class="num">年齢</th><th class="num">時給</th><th>資格</th><th>特記</th></tr></thead>
      <tbody>${state.guards.map(g => `<tr>
        <td>${esc(g.code)}</td><td><b>${esc(g.name)}</b></td><td class="num">${g.age}</td>
        <td class="num">${yen(g.rate)}</td>
        <td>${g.quals.length ? esc(g.quals.join('、')) : '—'}</td>
        <td>${g.caution ? '⚠️ 注意喚起' : ''}${g.siteNG ? ' 🚫 出禁あり' : ''}${g.pairNG ? ' 👥 相性NG' : ''}${g.rookie ? ' 🔰 新任' : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="pc-pager"><b>現場マスタ</b></div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>名称</th><th>区分</th><th>時間</th><th class="num">必要人数</th><th class="num">請求単価</th><th>必置資格</th></tr></thead>
      <tbody>${state.sites.map(s => `<tr>
        <td><b>${esc(s.name)}</b><br><span class="pc-muted small">${esc(s.client)}</span></td>
        <td>${s.kind}</td><td>${s.start}〜${s.end}${s.night ? ' 🌙' : ''}</td>
        <td class="num">${s.need}名</td><td class="num">@${s.bill.toLocaleString()}</td>
        <td>${s.reqQual ? esc(s.reqQual) : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

// ================= 有休管理 =================
function leaveAdminView() {
  const st = { pending: ['申請中', 'st-scheduled'], nego: ['交渉可', 'st-nego'], approved: ['承認済', 'st-onduty'], rejected: ['棄却', 'st-alert'] };
  return `
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>隊員</th><th>希望日</th><th>理由</th><th>状態</th><th>操作</th></tr></thead>
      <tbody>${state.leaves.map(l => `<tr>
        <td><b>${esc(guard(l.guardId).name)}</b></td>
        <td>${fmtMD(l.date)}</td>
        <td>${esc(l.reason)}</td>
        <td><span class="st-chip ${st[l.status][1]}">${st[l.status][0]}</span></td>
        <td>${l.status === 'pending' || l.status === 'nego' ? `
          <button class="pc-btn" data-action="leave" data-id="${l.id}" data-st="approved">承認</button>
          <button class="pc-btn" data-action="leave" data-id="${l.id}" data-st="nego">交渉可</button>
          <button class="pc-btn" data-action="leave" data-id="${l.id}" data-st="rejected">棄却</button>` : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="pc-muted">申請はありません</td></tr>'}</tbody>
    </table></div>
    <p class="pc-muted">状態は隊員アプリの休暇申請カレンダーに即時反映されます（紺=申請済／橙=交渉可／緑=承認済み／赤=棄却）。</p>`;
}

// ================= 教育管理 =================
function eduView() {
  const alerts = state.education.filter(e => e.done / e.required < 0.6);
  return `
    ${alerts.length ? `<div class="pc-banner-warn">⚠ 法定教育の未達が <b>${alerts.length}名</b>：${alerts.map(e => esc(guard(e.guardId).name)).join('、')}（年度末 2027/3/31 までに現任10h／新任20h）</div>` : ''}
    <div class="pc-card">
      ${state.education.map(e => {
        const g = guard(e.guardId);
        const pct = Math.round(e.done / e.required * 100);
        const low = pct < 60;
        return `<div class="edu-row">
          <span class="edu-name"><b>${esc(g.name)}</b> <span class="${e.type === '新任' ? 'pc-chip-kind' : 'pc-chip-muted'}">${e.type}</span></span>
          <span class="pc-bar edu-bar"><span class="pc-bar-fill ${low ? 'bar-warn' : ''}" style="width:${pct}%"></span></span>
          <span class="small">${e.done}/${e.required}h</span>
          ${low ? '<span class="pc-chip-warn">⚠ 要対応</span>' : '<span class="pc-chip-ok">✓</span>'}
        </div>`;
      }).join('')}
    </div>`;
}

// ================= 収支分析（経営モード） =================
function financeView() {
  const date = ui.boardDate;
  const shifts = dayShifts(date);
  let totalBill = 0, totalPay = 0, totalNeed = 0, totalAssigned = 0;
  const rows = state.sites.map(st => {
    const list = shifts.filter(s => s.siteId === st.id);
    const hours = shiftMinutes(st.start, st.end) / 60;
    const bill = list.length * hours * st.bill;
    // 人件費はガント／時給計算表と同じ wageOf() を使う（打刻・休憩・残業割増まで反映）
    const pay = list.reduce((sum, sh) => sum + wageOf(sh).total, 0);
    const margin = bill - pay;
    const rate = bill ? Math.round(margin / bill * 100) : 0;
    totalBill += bill; totalPay += pay; totalNeed += st.need; totalAssigned += list.length;
    const low = bill > 0 && rate < 30;
    return `<tr>
      <td><b>${esc(st.name)}</b><br><span class="pc-muted small">${list.length}/${st.need}名 × ${hours}h</span></td>
      <td class="num">${yen(bill)}</td>
      <td class="num">${yen(pay)}</td>
      <td class="num"><b>${yen(margin)}</b></td>
      <td class="bar-cell">
        <span class="pc-bar"><span class="pc-bar-fill ${low ? 'bar-warn' : ''}" style="width:${Math.max(0, Math.min(100, rate))}%"></span></span>
        <span class="small ${low ? 'warn-text' : ''}">${rate}%${low ? ' ⚠ 低粗利' : ''}</span>
      </td>
    </tr>`;
  }).join('');
  const totalMargin = totalBill - totalPay;
  return `${datePager()}
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${yen(totalBill)}</b><span>売上見込</span></div>
      <div class="pc-kpi"><b>${yen(totalPay)}</b><span>人件費</span></div>
      <div class="pc-kpi"><b>${yen(totalMargin)}</b><span>粗利</span></div>
      <div class="pc-kpi"><b>${totalBill ? Math.round(totalMargin / totalBill * 100) : 0}%</b><span>粗利率</span></div>
      <div class="pc-kpi ${totalAssigned < totalNeed ? 'kpi-alert' : ''}"><b>${totalAssigned}/${totalNeed}</b><span>充足</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>現場</th><th class="num">請求</th><th class="num">支払（実働・割増込）</th><th class="num">粗利</th><th>粗利率</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ================= 伝言板（お知らせ配信） =================
function msgView() {
  return `
    <div class="pc-2col">
      <div class="pc-card">
        <div class="pc-card-head"><b>お知らせ配信（アプリ用伝言板）</b></div>
        <form class="pc-form" data-form="notice">
          <label>タイトル <input type="text" name="title" placeholder="例：台風接近に伴う体制について" required></label>
          <label>本文 <textarea name="body" rows="4" required></textarea></label>
          <button class="pc-btn-navy" type="submit">隊員アプリへ配信</button>
        </form>
      </div>
      <div class="pc-card">
        <div class="pc-card-head"><b>配信履歴</b></div>
        ${state.notices.map(n => `<div class="pc-msg-row"><b>${esc(n.title)}</b><span class="pc-muted small">${fmtMD(n.at.slice(0, 10))} ${fmtTime(n.at)}</span></div>`).join('')}
      </div>
    </div>`;
}

// ================= シェル =================
const MENU = [
  ['dash', '🏠', 'ダッシュボード'],
  ['board', '👥', '勤務管理'],
  ['monitor', '📡', '上下番モニター'],
  ['gantt', '📊', '勤務ガント'],
  ['billing', '📄', '請求管理'],
  ['deposit', '🏦', '入金管理'],
  ['payroll', '💰', '給与管理'],
  null,
  ['reports', '🖨', '帳票管理'],
  ['master', '📚', 'マスタ管理'],
  ['leave', '✈️', '有休管理'],
];
const TITLES = {
  dash: 'ダッシュボード', board: '勤務管理（管制ボード）', monitor: '上下番モニター',
  gantt: '勤務ガント / 時給計算',
  billing: '請求管理', deposit: '入金管理', payroll: '給与管理', reports: '帳票管理',
  master: 'マスタ管理', leave: '有休管理', edu: '教育管理', finance: '収支分析（経営モード）', msg: 'アプリ用伝言板',
};

export function renderAdmin(el) {
  const views = {
    dash: dashView, board: boardView, monitor: monitorView, gantt: ganttView, billing: billingView,
    deposit: depositView, payroll: payrollView, reports: reportsView, master: masterView,
    leave: leaveAdminView, edu: eduView, finance: financeView, msg: msgView,
  };
  const pendingLv = state.leaves.filter(l => l.status === 'pending').length;
  el.innerHTML = `
  <div class="pc-shell">
    <aside class="pc-sidebar">
      <div class="pc-logo"><span class="pc-logo-b">GuardFlow</span><span class="pc-logo-r">警備</span></div>
      <nav class="pc-menu">
        ${MENU.map(m => m === null ? '<hr class="pc-menu-hr">' : `
          <button class="pc-menu-item ${ui.adminTab === m[0] ? 'on' : ''}" data-action="atab" data-tab="${m[0]}">
            <span class="pc-menu-ic">${m[1]}</span>${m[2]}<span class="pc-menu-chev">›</span>
          </button>`).join('')}
      </nav>
      <div class="pc-sidebar-bottom">
        <button class="pc-navy-block" data-action="atab" data-tab="edu">教育管理 ↗</button>
        <button class="pc-navy-block" data-action="atab" data-tab="finance">収支分析 ↗</button>
        <div class="pc-company">GuardFlow警備株式会社（デモ）</div>
      </div>
    </aside>
    <div class="pc-main">
      <header class="pc-topbar">
        <b class="pc-title">${TITLES[ui.adminTab]}</b>
        <span class="pc-topbar-right">
          <button class="pc-btn" data-action="atab" data-tab="msg">アプリ用伝言板</button>
          <button class="pc-bell" data-action="atab" data-tab="leave">🔔${pendingLv ? `<span class="pc-bell-badge">${pendingLv}</span>` : ''}</button>
          <button class="pc-btn pc-kebab">⋮</button>
        </span>
      </header>
      <div class="pc-content">${views[ui.adminTab]()}</div>
    </div>
  </div>`;
}
