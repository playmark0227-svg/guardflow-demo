import { state, ui, canSee, currentAuth, currentStaff, setupSteps } from './store.js';
import { todayKey, addDays, fmtMD, fmtTime, esc, yen, shiftMinutes, parseHM, nowMin, hrs } from './util.js';
import { calcPay } from './prints.js';
import { ganttView, wageOf, billOf, needOf, kindNo, billRateOf, clientTotals } from './gantt.js';
import { GROUPS, PINNED, findItem, findGroup } from './menu.js';
import { MASTERS } from './masters.js';
import {
  groupView, masterView, orderView, actualView, allowanceView, bonusView,
  zenginView, ledgerView, forecastView, paidView, maintView, masterPrintView,
} from './screens.js';

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
/** 契約直後に最初に見る画面。何から手を付ければよいかを順番で示す */
function setupView() {
  const steps = setupSteps();
  const done = steps.filter(x => x.done).length;
  const nextI = steps.findIndex(x => !x.done);
  return `
    <div class="pc-setup">
      <div class="pc-setup-head">
        <b>はじめの設定</b>
        <span class="pc-setup-bar"><span style="width:${Math.round(done / steps.length * 100)}%"></span></span>
        <span class="pc-muted small">${done}/${steps.length} 完了</span>
        <span style="margin-left:auto"></span>
        ${done === steps.length ? '' : '<span class="pc-muted small">上から順に登録してください</span>'}
      </div>
      <div class="pc-steps">
        ${steps.map((x, i) => `<button class="pc-step ${x.done ? 'done' : ''} ${i === nextI ? 'next' : ''}"
          data-action="atab" data-tab="${x.id}">
          <span class="pc-step-n">${x.done ? '✓' : i + 1}</span>
          <span class="pc-step-b"><b>${esc(x.name)}</b><span>${esc(x.hint)}</span></span>
        </button>`).join('')}
      </div>
    </div>`;
}

function dashView() {
  const D0 = todayKey(), D1 = addDays(D0, 1), Dm1 = addDays(D0, -1);
  // 何も登録されていないうちは、KPIや売上グラフではなく手順を見せる
  if (!state.guards.length && !state.sites.length && !state.clients.length)
    return setupView() + blank('🛡️', 'ようこそ。まだデータはありません',
      'この画面は、契約直後の状態です。上の手順に沿って自社情報から登録していくと、<br>' +
      '管制ボード・請求・給与・帳票がそのまま使えるようになります。',
      ['m-company', '自社情報の登録から始める →'],
      '機能を先に見たいときは、画面右上の <b>🧪 デモデータ</b> でサンプルを入れられます。');
  const setup = setupSteps().every(x => x.done) ? '' : setupView();
  // 明日その現場に1人でも配置予定があるものだけを「稼働現場」として数える
  const liveSites = new Set(dayShifts(D1).map(s => s.siteId));
  const needSum = state.sites.filter(s => liveSites.has(s.id)).reduce((n, s) => n + needOf(s, D1), 0);
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
  const eduLow = state.education.filter(e => Number(e.done) / Number(e.required || 1) < 0.6).length;
  const pendingLv = state.leaves.filter(l => l.status === 'pending').length;
  const tasks = [
    missing ? { ic: '📅', cls: 'tk-orange', label: `明日${fmtMD(D1)}の配置不足（${missing}名）`, link: '勤務予定を入力', tab: 'board', date: D1 } : null,
    alerts ? { ic: '🚨', cls: 'tk-red', label: `未出発の隊員（${alerts}件）`, link: '上下番モニターへ', tab: 'monitor', date: D0 } : null,
    eduLow ? { ic: '🎓', cls: 'tk-blue', label: `法定教育の未達（${eduLow}名）`, link: '教育管理へ', tab: 'edu' } : null,
    pendingLv ? { ic: '✈️', cls: 'tk-green', label: `休暇申請の承認待ち（${pendingLv}件）`, link: '有休管理へ', tab: 'leave' } : null,
  ].filter(Boolean);

  const chart = lineChart(monthly, prevY);
  return setup + `
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
  const all = [...cur, ...prev].filter(v => Number.isFinite(v));
  // 実績が1件も無いと min/max が ±Infinity になり座標が NaN になる。0〜1のダミー軸で描く
  const lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
  const min = lo === hi ? lo - 1 : lo * 0.97;
  const max = lo === hi ? hi + 1 : hi * 1.03;
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
  if (!state.sites.length)
    return blank('📍', '配置先がまだ登録されていません',
      '管制ボードは「どの現場に、誰を置くか」を決める画面です。<br>'
      + 'まず発注元となる<b>得意先</b>を登録し、そのうえで現場（配置先）を追加してください。',
      state.clients.length ? ['m-site', '配置先を登録する →'] : ['m-client', '得意先の登録から始める →']);
  if (!state.guards.length)
    return blank('👥', '隊員がまだ登録されていません',
      '配置先は ' + state.sites.length + ' 件登録済みです。あとは配置する隊員を登録すれば、<br>'
      + 'ここでドラッグ&ドロップして勤務予定を組めるようになります。',
      ['m-guard', '隊員を登録する →']);
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
    const need = needOf(st, date);
    const short = list.length < need;
    const qualOK = !st.reqQual || list.some(s => guard(s.guardId).quals.includes(st.reqQual));
    return `<div class="site-card ${short ? 'site-short' : ''}" data-drop-site="${st.id}">
      <div class="site-head">
        <div><span class="pc-chip-kind">${kindNo(st)}</span> <b>${esc(st.name)}</b></div>
        <span class="${short ? 'staff-short' : 'staff-ok'}">${list.length}/${need}名${short ? ' ⚠ 不足' : ' ✓'}</span>
      </div>
      <div class="site-meta">
        <span>${st.start}〜${st.end}</span>${st.night ? '<span>🌙</span>' : ''}
        ${st.note ? `<span class="pc-muted">${esc(st.note)}</span>` : ''}
        ${st.reqQual ? `<span class="${qualOK ? 'pc-chip-ok' : 'pc-chip-warn'}">要 ${esc(st.reqQual)} ${qualOK ? '✓' : '⚠ 未充足'}</span>` : ''}
        <label class="wx-pick" title="警備業務日誌に記録する天候">
          <select data-action-change="set-weather" data-site="${st.id}" data-date="${date}">
            <option value="">天候</option>
            ${(state.masters.weather || []).map(w => {
              const cur = (state.weatherLog[date] || {})[st.id];
              return `<option value="${esc(w.name)}" ${cur === w.name ? 'selected' : ''}>${w.mark || ''} ${esc(w.name)}</option>`;
            }).join('')}
          </select>
        </label>
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
  if (!state.shifts.length)
    return blank('📡', '今日の勤務予定がありません',
      '上下番モニターは、当日の出発・上番・下番をリアルタイムに映す画面です。<br>管制ボードで今日の勤務予定を入れると、ここに並びます。',
      ['board', '管制ボードへ →']);
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
  if (!state.shifts.length)
    return blank('💴', '請求できる勤務がまだありません',
      '請求は「その日に配置した勤務」から自動で組み立てます。<br>配置先と単価を登録し、管制ボードで勤務予定を入れてください。',
      state.sites.length ? ['board', '勤務予定を入力する →'] : ['m-site', '配置先を登録する →']);
  const date = ui.boardDate;
  let T = { work: 0, extra: 0, tax: 0, total: 0 };
  const rows = state.sites.map(st => {
    const b = billOf(st, date);
    T.work += b.work; T.extra += b.extra; T.tax += b.tax; T.total += b.total;
    return `<tr>
      <td><b>${esc(st.name)}</b><br><span class="pc-muted small">${esc(st.client)}</span></td>
      <td class="num">${b.n}名 × ${b.hours}h × @${b.rate.toLocaleString()}</td>
      <td class="num">${yen(b.work)}</td>
      <td class="num">${b.extra ? yen(b.extra) : '—'}</td>
      <td class="num">${yen(b.tax)}</td>
      <td class="num"><b>${yen(b.total)}</b></td>
      <td>${b.n ? `<button class="pc-btn" data-action="print-invoice" data-site="${st.id}">📄 請求書</button>` : '<span class="pc-muted">—</span>'}</td>
    </tr>`;
  }).join('');
  // 得意先単位の集計（課税単位はオプションに従う）
  const ct = clientTotals(date);
  let C = { sub: 0, tax: 0, total: 0 };
  ct.forEach(v => { C.sub += v.sub; C.tax += v.tax; C.total += v.total; });
  const clientRows = [...ct.entries()].map(([k, v]) => `<tr>
    <td><b>${esc(k)}</b><span class="pc-muted small">（${v.sites}現場）</span></td>
    <td class="num">${yen(v.sub)}</td><td class="num">${yen(v.tax)}</td>
    <td class="num"><b>${yen(v.total)}</b></td></tr>`).join('');

  return `${datePager()}
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${yen(T.work)}</b><span>警備料金</span></div>
      <div class="pc-kpi"><b>${yen(T.extra)}</b><span>加算・値引</span></div>
      <div class="pc-kpi"><b>${yen(C.tax)}</b><span>消費税</span></div>
      <div class="pc-kpi"><b>${yen(C.total)}</b><span>請求合計</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>現場 / 得意先</th><th class="num">明細</th><th class="num">警備料金</th>
        <th class="num">加算・値引</th><th class="num">消費税</th><th class="num">請求額（税込）</th><th>帳票</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="pc-sec-head" style="margin-top:18px"><h2 style="font-size:15px;margin:0">得意先別 請求集計</h2></div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>得意先</th><th class="num">請求額（税抜）</th><th class="num">消費税</th><th class="num">請求額（税込）</th></tr></thead>
      <tbody>${clientRows || '<tr><td colspan="4" class="pc-muted">対象データがありません</td></tr>'}</tbody>
    </table></div>
    <p class="pc-muted small">単価は<b>配置先単価マスタ</b>、加算・値引は<b>請求項目マスタ</b>から引いています。
      消費税の課税単位は オプション設定「得意先合計に消費税を掛ける」に従います
      （現在：<b>${state.options.taxIn ? 'ON＝得意先の合計に1回課税' : 'OFF＝現場ごとに課税して合算'}</b>）。</p>`;
}

// ================= 入金管理 =================
function depositView() {
  const date = ui.boardDate;
  const ct = clientTotals(date);
  let T = { bill: 0, paid: 0, rest: 0 };
  const rows = [...ct.entries()].map(([client, v]) => {
    const paid = !!state.deposits[client];
    T.bill += v.total; if (paid) T.paid += v.total; else T.rest += v.total;
    const sites = state.sites.filter(s => s.client === client).map(s => s.name).join('、');
    return `<tr class="${paid ? '' : 'row-alert'}">
      <td><b>${esc(client)}</b><br><span class="pc-muted small">${esc(sites)}</span></td>
      <td class="num">${yen(v.total)}</td>
      <td>月末締め翌月末</td>
      <td><span class="st-chip ${paid ? 'st-onduty' : 'st-scheduled'}">${paid ? '入金済' : '未入金'}</span></td>
      <td><button class="pc-btn" data-action="toggle-deposit" data-site="${esc(client)}">${paid ? '消込を取消' : '入金消込'}</button></td>
    </tr>`;
  }).join('');
  return `${datePager()}
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${yen(T.bill)}</b><span>請求合計</span></div>
      <div class="pc-kpi"><b>${yen(T.paid)}</b><span>入金済</span></div>
      <div class="pc-kpi ${T.rest ? 'kpi-alert' : ''}"><b>${yen(T.rest)}</b><span>未入金</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>得意先 / 現場</th><th class="num">請求額（税込）</th><th>入金予定</th><th>状態</th><th>操作</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="pc-muted">この日の請求はありません</td></tr>'}</tbody>
    </table></div>
    <p class="pc-muted small">消込は得意先単位で記録し、<b>得意先元帳</b>にそのまま反映されます。</p>`;
}

// ================= 給与管理（PC） =================
function payrollView() {
  if (!state.shifts.length)
    return blank('💰', '給与を計算する勤務がまだありません',
      '給与は打刻と勤務予定から計算します。隊員を登録し、勤務予定を入れると<br>ここに支給額・控除・差引支給が並びます。',
      state.guards.length ? ['board', '勤務予定を入力する →'] : ['m-guard', '隊員を登録する →']);
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
    ['nippo', '管制日報', `対象日：${fmtMD(ui.boardDate)}／規則63条`, true],
    ['edu-sheet', '教育実施簿', '警備業法21条・規則38条', true],
    ['chingin', '賃金台帳', '労基法108条・3年保存', true],
    ['contract', '警備契約書', '警備業法19条の書面', true],
    ['invoice-menu', '請求書', '請求管理から出力', true],
  ];
  return `
    <div class="pc-cards-grid">
      ${items.map(([id, name, sub, ok]) => `<button class="pc-report-card" data-action="report-out" data-report="${id}">
        <span class="pc-report-ic">🖨</span><b>${name}</b>
        <span class="pc-muted small">${sub || '&nbsp;'}</span>
        <span class="${ok ? 'pc-chip-ok' : 'pc-chip-muted'}">${ok ? 'PDF出力可' : '準備中'}</span>
      </button>`).join('')}
    </div>
    <p class="pc-muted">帳票はボタン1つでPDF出力（ブラウザの印刷ダイアログが開きます）。</p>`;
}

// ================= 有休管理 =================
function leaveAdminView() {
  const st = { pending: ['申請中', 'st-scheduled'], nego: ['交渉可', 'st-nego'], approved: ['承認済', 'st-onduty'], rejected: ['棄却', 'st-alert'] };
  return `
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>隊員</th><th>希望日</th><th>理由</th><th>状態</th><th>操作</th></tr></thead>
      <tbody>${state.leaves.map(l => `<tr>
        <td><b>${esc((guard(l.guardId) || { name: '（削除された隊員）' }).name)}</b></td>
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

/** 何も無い画面を「壊れている」ではなく「これから始める」に見せる。
 *  cta は [遷移先タブID, ボタン文言]。次の一手を必ず1つだけ示す */
export function blank(ic, title, body, cta, sub) {
  return `<div class="pc-blank">
    <div class="pc-blank-ic">${ic}</div>
    <b>${esc(title)}</b>
    <p>${body}</p>
    ${cta ? `<button class="pc-btn-navy" data-action="atab" data-tab="${cta[0]}">${esc(cta[1])}</button>` : ''}
    ${sub ? `<p class="pc-blank-sub">${sub}</p>` : ''}
  </div>`;
}

// ================= 教育管理 =================
/** 教育記録の隊員。名前参照（新規登録）と旧来のID参照の両方を引く */
const eduGuard = e => state.guards.find(g => g.name === e.guardName)
  || state.guards.find(g => g.id === e.guardId) || { name: e.guardName || '（未選択）' };

function eduView() {
  if (!state.education.length)
    return blank('👨‍🏫', '教育記録がまだありません',
      '警備業法21条により、新任20時間・現任は年度ごとに10時間の教育が必要です。<br>隊員を登録したあと、ここに実施状況を記録してください。',
      state.guards.length ? ['m-edu', '＋ 教育記録を追加'] : ['m-guard', 'まず隊員を登録する →']);
  const alerts = state.education.filter(e => Number(e.done) / Number(e.required || 1) < 0.6);
  return `
    ${alerts.length ? `<div class="pc-banner-warn">⚠ 法定教育の未達が <b>${alerts.length}名</b>：${alerts.map(e => esc(eduGuard(e).name)).join('、')}（年度末までに現任10h／新任20h）</div>` : ''}
    <div class="pc-pager"><span class="pc-muted small">${state.education.length}件</span>
      <span style="margin-left:auto"></span>
      <button class="pc-btn" data-action="report-out" data-report="edu-sheet">🖨 教育実施簿</button>
      <button class="pc-btn-navy" data-action="atab" data-tab="m-edu">教育記録を編集 →</button></div>
    <div class="pc-card">
      ${state.education.map(e => {
        const g = eduGuard(e);
        const pct = Math.min(100, Math.round(Number(e.done) / Number(e.required || 1) * 100)) || 0;
        const low = pct < 60;
        return `<div class="edu-row">
          <span class="edu-name"><b>${esc(g.name)}</b> <span class="${e.type === '新任' ? 'pc-chip-kind' : 'pc-chip-muted'}">${esc(e.type || '')}</span></span>
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
    const bill = list.length * hours * billRateOf(st);
    // 人件費はガント／時給計算表と同じ wageOf() を使う（打刻・休憩・残業割増まで反映）
    const pay = list.reduce((sum, sh) => sum + wageOf(sh).total, 0);
    const margin = bill - pay;
    const rate = bill ? Math.round(margin / bill * 100) : 0;
    totalBill += bill; totalPay += pay; totalNeed += needOf(st, date); totalAssigned += list.length;
    const low = bill > 0 && rate < 30;
    return `<tr>
      <td><b>${esc(st.name)}</b><br><span class="pc-muted small">${list.length}/${needOf(st, date)}名 × ${hours}h</span></td>
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
const TITLES = {
  dash: 'ダッシュボード', board: '勤務管理（管制ボード）', monitor: '上下番モニター',
  gantt: '勤務ガント / 時給計算', billing: '請求集計・入力', deposit: '入金入力',
  payroll: '給与集計・入力', reports: '帳票管理', master: 'マスタ一覧', leave: '休暇申請の承認',
  edu: '教育管理', finance: '請求、給与実粗利確認表', msg: 'アプリ用伝言板',
  order: '受注入力', actual: '勤務実績入力', 'actual-list': '勤務実績一覧入力',
  'actual-site': '現場別 勤務実績一覧入力', 'actual-guard': '隊員別 勤務実績入力',
  'actual-client': '得意先別 勤務実績入力', allowance: '手当・控除入力',
  bonus: '賞与入力', 'bonus-list': '賞与一覧入力', zengin: '振込データ作成',
  ledger: '得意先元帳', 'sales-forecast': '売上高予測表', 'pl-forecast': '収支予測表',
  'bill-ref': '請求参照・更新', 'paid-sum': '有給集計', 'paid-guard': '隊員別 有給状況確認',
  'paid-month': '付与月別 有給状況確認', 'maint-data': 'データメンテナンス', 'maint-del': 'データ削除',
  'maint-zip': '郵便番号更新', 'maint-opt': 'オプション設定', 'maint-bulk': '勤務一括更新',
  'maint-io': 'エクスポートインポート', 'rep-master': 'マスタ一覧印刷',
  'm-client': '得意先マスタ', 'm-site': '配置先マスタ', 'm-guard': '隊員マスタ',
};

/** 開いている画面のHTMLを返す */
function contentFor() {
  const tab = ui.adminTab;
  const base = {
    dash: dashView, board: boardView, monitor: monitorView, gantt: ganttView,
    billing: billingView, deposit: depositView, payroll: payrollView, reports: reportsView,
    master: masterListView, leave: leaveAdminView, edu: eduView, finance: financeView, msg: msgView,
  };
  if (base[tab]) return base[tab]();

  // メニューグループのタイル一覧
  if (tab.startsWith('g-')) return groupView(tab);

  // マスタ編集
  const item = findItem(tab);
  if (item && item.kind === 'master') return masterView(item.master);
  // 帳票：出力条件を確認してから印刷する画面を出す
  if (item && item.kind === 'report') return reportItemView(item);

  const map = {
    order: orderView,
    actual: () => actualView('one'), 'actual-list': () => actualView('list'),
    'actual-site': () => actualView('site'), 'actual-guard': () => actualView('guard'),
    'actual-client': () => actualView('client'),
    allowance: allowanceView, bonus: () => bonusView(false), 'bonus-list': () => bonusView(true),
    zengin: zenginView, ledger: ledgerView,
    'sales-forecast': () => forecastView('sales'), 'pl-forecast': () => forecastView('pl'),
    'bill-ref': billingView,
    'paid-sum': () => paidView('sum'), 'paid-guard': () => paidView('guard'), 'paid-month': () => paidView('month'),
    'maint-data': () => maintView('data'), 'maint-del': () => maintView('del'), 'maint-zip': () => maintView('zip'),
    'maint-opt': () => maintView('opt'), 'maint-bulk': () => maintView('bulk'), 'maint-io': () => maintView('io'),
    'rep-master': masterPrintView,
  };
  if (map[tab]) return map[tab]();
  return '<div class="pc-muted">画面が見つかりません</div>';
}

/** 帳票タイルを押したときの画面。対象期間と件数を見せてから出力する */
function reportItemView(item) {
  const date = ui.boardDate;
  const info = {
    workreport: ['勤務実績表', `${fmtMD(date)} の全配置`, dayShifts(date).length + '件'],
    'bill-site': ['作業所別 請求一覧', `${fmtMD(date)} 締め`, state.sites.length + '現場'],
    'bill-client': ['得意先別 請求一覧', `${fmtMD(date)} 締め`, new Set(state.sites.map(s => s.client)).size + '得意先'],
    'deposit-list': ['入金一覧表', '本日時点', state.sites.length + '現場'],
    paylist: ['給与一覧表', (ui.payMonth || '最新月') + ' 度', state.guards.length + '名'],
    'payslip-all': ['給与明細書（全員）', (ui.payMonth || '最新月') + ' 度', state.guards.length + '名を連続印刷'],
    dm: ['DM印刷（宛名一覧）', '得意先あて', new Set(state.sites.map(s => s.client)).size + '件'],
    codebook: ['コードブック', '全マスタのコード一覧', Object.keys(MASTERS).length + 'マスタ'],
    paid: ['年次有給休暇管理簿', '労基則24条の7（3年保存）', state.guards.length + '名'],
  }[item.report] || [item.name, '', ''];
  return `
    ${['workreport', 'bill-site', 'bill-client'].includes(item.report) ? datePager() : ''}
    <div class="pc-card rp-card">
      <div class="rp-ic">🖨</div>
      <div class="rp-body">
        <b>${esc(info[0])}</b>
        <span class="pc-muted">${esc(info[1])}　／　対象 ${esc(info[2])}</span>
      </div>
      <button class="pc-btn-navy" data-action="report-out" data-report="${item.report}">この内容で出力する</button>
    </div>
    <p class="pc-muted small">ブラウザの印刷ダイアログが開きます。「PDFに保存」を選ぶとファイルとして残せます。</p>`;
}

// 得意先・配置先・隊員は項目が多いので専用画面にする



function masterListView() {
  return `
    <div class="pc-pager"><b>マスタ一覧</b><span class="pc-muted small">全${Object.keys(MASTERS).length + 3}マスタ</span></div>
    ${['g-master', 'g-master-bill', 'g-master-pay'].map(gid => {
      const g = findGroup(gid);
      return `<div class="pc-sec-head"><h2 style="font-size:15px;margin:0">${g.ic} ${esc(g.name)}</h2></div>${groupView(gid)}`;
    }).join('')}`;
}

export function renderAdmin(el) {
  const pendingLv = state.leaves.filter(l => l.status === 'pending').length;
  const cur = ui.adminTab;
  const openG = GROUPS.find(g => g.id === cur || g.items.some(i => i.id === cur));
  const hidden = GROUPS.filter(g => !canSee(g.id)).length;

  el.innerHTML = `
  <div class="pc-shell">
    <aside class="pc-sidebar">
      <div class="pc-logo"><span class="pc-logo-b">GuardFlow</span><span class="pc-logo-r">警備</span></div>
      <nav class="pc-menu">
        <div class="pc-menu-cap">よく使う</div>
        ${PINNED.map(m => `<button class="pc-menu-item ${cur === m.id ? 'on' : ''}" data-action="atab" data-tab="${m.id}">
          <span class="pc-menu-ic">${m.ic}</span>${m.name}</button>`).join('')}
        <div class="pc-menu-cap">メインメニュー</div>
        ${GROUPS.filter(g => canSee(g.id)).map(g => {
          const open = openG && openG.id === g.id;
          return `<button class="pc-menu-item pc-menu-g ${cur === g.id ? 'on' : ''}" data-action="atab" data-tab="${g.id}">
            <span class="pc-menu-ic">${g.ic}</span>${g.name}<span class="pc-menu-chev">${open ? '⌄' : '›'}</span></button>
          ${open ? `<div class="pc-submenu">${g.items.map(it =>
            `<button class="pc-sub-item ${cur === it.id ? 'on' : ''}" data-action="atab" data-tab="${it.id}">${esc(it.name)}</button>`).join('')}</div>` : ''}`;
        }).join('')}
      </nav>
      <div class="pc-sidebar-bottom">
        <button class="pc-navy-block" data-action="atab" data-tab="edu">教育管理 ↗</button>
        <label class="pc-staff">
          <span>操作担当者</span>
          <select data-action-change="staff">
            <option value="">（制限なし）</option>
            ${(state.masters.staff || []).map(x =>
              `<option value="${esc(x.code)}" ${ui.staff === x.code ? 'selected' : ''}>${esc(x.name)}／${esc(x.role)}</option>`).join('')}
          </select>
        </label>
        ${currentAuth() ? `<div class="pc-authnote">${esc((currentStaff() || {}).role)}権限で表示中${hidden ? `（${hidden}メニュー非表示）` : ''}</div>` : ''}
        <button class="pc-company" data-action="atab" data-tab="m-company">${esc((state.masters.company[0] || {}).name || '（自社名を登録する）')}</button>
      </div>
    </aside>
    <div class="pc-main">
      <header class="pc-topbar">
        <b class="pc-title">${esc(TITLES[cur] || (findItem(cur) || {}).name || (findGroup(cur) || {}).name || '')}</b>
        <span class="pc-topbar-right">
          <button class="pc-btn" data-action="atab" data-tab="msg">アプリ用伝言板</button>
          <button class="pc-bell" data-action="atab" data-tab="leave">🔔${pendingLv ? `<span class="pc-bell-badge">${pendingLv}</span>` : ''}</button>
          <button class="pc-btn pc-kebab">⋮</button>
        </span>
      </header>
      <div class="pc-content">${contentFor()}</div>
    </div>
  </div>`;
}
