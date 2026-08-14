import { state, ui, queuedCount } from './store.js?v=7';
import { todayKey, addDays, fmtMD, fmtTime, esc, yen, parseHM, pad } from './util.js?v=7';
import { calcPay } from './prints.js?v=7';

const site = id => state.sites.find(s => s.id === id);
const WD = ['日', '月', '火', '水', '木', '金', '土'];

// 勤怠報告の種別（実機アプリと同じ並び）
export const REPORT_TYPES = [
  ['depart', '自宅を出発しました', '🏠'],
  ['join', '合流しました', '👥'],
  ['on', '上番しました', '⏱'],
  ['off', '下番しました', '⏱'],
  ['break_s', '休憩開始します', '☕'],
  ['break_e', '休憩終了しました', '🔔'],
];

// 隊員の直近シフト（今日・明日）
function myShifts(g) {
  const D0 = todayKey();
  // 今日・明日を基本にしつつ、休みの日でも空画面にならないよう次の勤務まで拾う
  const all = state.shifts
    .filter(sh => sh.guardId === g.id && sh.date >= D0)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const near = all.filter(sh => sh.date <= addDays(D0, 1));
  return near.length ? near : all.slice(0, 1);
}

function appBar(title, opts = {}) {
  return `<div class="g-appbar">
    ${opts.back ? `<button class="g-back" data-action="${opts.backAction || 'shift-back'}">‹</button>` : ''}
    <span class="g-appbar-title">${esc(title)}</span>
    ${opts.right || ''}
  </div>`;
}

// 打刻の進み具合。次に押すべき報告はここで一意に決まる
const LABEL = Object.fromEntries(REPORT_TYPES.map(([t, l, i]) => [t, { l, i }]));
const SHORT = { depart: '出発', join: '合流', on: '上番', off: '下番', break_s: '休憩開始', break_e: '休憩終了' };

export function progressOf(sh) {
  const done = t => sh.punches.some(p => p.type === t);
  const brk = sh.punches.filter(p => p.type === 'break_s' || p.type === 'break_e');
  const onBreak = brk.length % 2 === 1;
  let next = null;
  if (!done('depart')) next = 'depart';
  else if (!done('on')) next = 'on';
  else if (onBreak) next = 'break_e';
  else if (!done('off')) next = 'off';
  return { next, onBreak, depart: done('depart'), on: done('on'), off: done('off') };
}

// 直近で報告すべきシフト（未完了のものを優先し、無ければ最初の1件）
function activeShift(shifts) {
  return shifts.find(sh => progressOf(sh).next) || shifts[0] || null;
}

function stepBar(sh) {
  const pr = progressOf(sh);
  const at = t => { const p = sh.punches.find(x => x.type === t); return p ? fmtTime(p.at) : ''; };
  return `<div class="rep-steps">
    ${['depart', 'on', 'off'].map((t, i) => {
      const ok = pr[t];
      return `${i ? '<span class="rep-arrow">›</span>' : ''}
      <span class="rep-step ${ok ? 'ok' : pr.next === t ? 'now' : ''}">
        <b>${ok ? '✓' : i + 1}</b>${SHORT[t]}<i>${ok ? at(t) : '—'}</i>
      </span>`;
    }).join('')}
  </div>`;
}

// ---- 勤怠報告 ----
function reportView(g) {
  const shifts = myShifts(g);
  if (!ui.report.shiftId || !shifts.some(s => s.id === ui.report.shiftId)) {
    const a = activeShift(shifts);
    ui.report.shiftId = a ? a.id : null;
  }
  const cur = shifts.find(s => s.id === ui.report.shiftId);
  const pr = cur ? progressOf(cur) : { next: null };

  // 次にやる報告を既定にする（利用者が種別を選ばなくてよいようにする）
  if (!ui.report.manual && pr.next) ui.report.type = pr.next;

  const now = new Date();
  const rows = REPORT_TYPES.map(([type, label, ic]) => {
    const sel = ui.report.type === type;
    return `<button class="rep-row ${sel ? 'sel' : ''}" data-action="rep-type" data-type="${type}">
      <span class="rep-ic">${ic}</span><span class="rep-label">${label}</span>
      <span class="rep-radio">${sel ? '✓' : ''}</span>
    </button>`;
  }).join('');
  const shiftRows = shifts.map(sh => {
    const s = site(sh.siteId);
    const sel = ui.report.shiftId === sh.id;
    const pre = parseHM(sh.start) < 360;
    return `<button class="rep-shift ${sel ? 'sel' : ''}" data-action="rep-shift" data-shift="${sh.id}">
      <span class="rep-shift-date"><b>${String(sh.date || '').replace(/-/g, '/')}</b><br><span class="rep-shift-time">${sh.start}〜${sh.end}</span></span>
      <span class="rep-shift-name">${esc(s.name)}${pre ? '<br><span class="rep-pre">🌙 日跨ぎ夜勤・前夜出発可</span>' : ''}</span>
      <span class="rep-radio">${sel ? '✓' : ''}</span>
    </button>`;
  }).join('') || '<div class="g-empty">対象シフトがありません</div>';
  const qn = queuedCount();
  const st = cur ? site(cur.siteId) : null;
  const pre = cur && parseHM(cur.start) < 360;

  // 主役は「次にやる報告」。1タップで完了できるようにする
  const hero = !cur ? '<div class="g-empty">直近の勤務予定はありません</div>' : `
    <div class="rep-hero">
      <div class="rep-hero-site">
        <span class="rep-hero-kind">${st.kind}</span><b>${esc(st.name)}</b>
        ${pre ? '<span class="rep-pre">🌙 前夜出発可</span>' : ''}
      </div>
      <div class="rep-hero-meta">${fmtMD(cur.date)}　${cur.start}〜${cur.end}　${esc(st.addr)}</div>
      ${stepBar(cur)}
      ${pr.next
        ? `<button class="rep-go" data-action="quick-report" data-type="${pr.next}">
             <span class="rep-go-ic">${LABEL[pr.next].i}</span>
             <span class="rep-go-t">${SHORT[pr.next]}を報告</span>
             <span class="rep-go-s">タップで送信・GPS添付</span>
           </button>
           ${pr.next === 'off' && !pr.onBreak ? `<button class="rep-sub" data-action="quick-report" data-type="break_s">☕ 休憩を開始する</button>` : ''}`
        : '<div class="rep-fin">✓ この勤務の報告はすべて完了しました</div>'}
    </div>`;

  return `
    ${appBar('勤怠報告')}
    ${state.offline ? `<div class="g-offline">📡 圏外です。報告は端末に保存し、通信回復時に自動送信します${qn ? `（送信待ち ${qn}件）` : ''}</div>` : qn ? `<div class="g-synced">✓ 通信回復。送信待ちの報告を同期しました</div>` : ''}
    ${hero}
    <button class="rep-more" data-action="rep-more">${ui.reportMore ? '▲ 閉じる' : '▼ ほかの報告をする・時刻や連絡事項を変える'}</button>
    <div class="rep-detail" ${ui.reportMore ? '' : 'hidden'}>
      <div class="g-sec">報告の種類</div>
      <div class="rep-list">${rows}</div>
      <div class="g-sec">報告時間</div>
      <div class="rep-time">🕐 ${pad(now.getHours())}:${pad(now.getMinutes())}</div>
      <div class="g-sec">報告対象シフト</div>
      <div class="rep-shifts">${shiftRows}</div>
      <div class="g-sec">連絡事項</div>
      <textarea class="rep-memo" id="rep-memo" placeholder="連絡事項を記入します。"></textarea>
      <button class="g-btn-red" data-action="submit-report">この内容で報告する</button>
      <div class="g-note">報告にはGPS位置情報が自動で添付されます</div>
    </div>`;
}

// ---- シフト管理 ----
function shiftListView(g) {
  const D0 = todayKey();
  const rows = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(D0, i);
    const mine = state.shifts.filter(sh => sh.guardId === g.id && sh.date === d);
    if (!mine.length) continue;
    mine.forEach(sh => {
      const s = site(sh.siteId);
      rows.push(`<button class="sh-row" data-action="shift-open" data-shift="${sh.id}">
        <span class="sh-date"><b>${fmtMD(d)}</b>${i === 0 ? '<span class="sh-today">今日</span>' : ''}</span>
        <span class="sh-body">${esc(s.name)}<br><span class="sh-time">${sh.start}〜${sh.end}</span></span>
        <span class="sh-chev">›</span>
      </button>`);
    });
  }
  return `
    ${appBar('シフト管理')}
    <div class="sh-list">${rows.join('') || '<div class="g-empty">直近のシフトはありません</div>'}</div>`;
}

function shiftDetailView(g) {
  const sh = state.shifts.find(x => x.id === ui.shiftDetail);
  if (!sh) { ui.shiftDetail = null; return shiftListView(g); }
  const s = site(sh.siteId);
  const d = new Date(sh.date + 'T00:00:00');
  const title = `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日（${WD[d.getDay()]}）`;
  const mates = state.shifts
    .filter(x => x.date === sh.date && x.siteId === sh.siteId && x.guardId !== g.id)
    .map(x => state.guards.find(gg => gg.id === x.guardId).name).join('、') || 'なし';
  const q = encodeURIComponent(s.addrFull);
  const row = (ic, label, val) => `<div class="dt-row">
    <span class="dt-label">${ic} ${label}</span><span class="dt-val">${esc(val) || '&nbsp;'}</span>
  </div>`;
  return `
    ${appBar(title, { back: true })}
    ${row('👤', '得意先名', s.client)}
    <div class="g-sec">勤務先</div>
    ${row('🏢', '配置先名', s.name)}
    ${row('📍', '住所', s.addrFull)}
    ${row('👥', '同配置者', mates)}
    ${row('📝', '①備考', s.note1 || '')}
    ${row('📝', '②備考', s.note2 || '')}
    ${row('💬', 'メモ欄', '')}
    <div class="g-sec">マップ情報</div>
    <a class="g-btn-navy" href="https://www.google.com/maps?q=${q}" target="_blank" rel="noopener">地図アプリで勤務先を確認</a>
    <a class="g-btn-navy" href="https://www.google.com/maps/search/トイレ+near+${q}" target="_blank" rel="noopener">勤務先付近のトイレを検索</a>
    <a class="g-btn-navy" href="https://www.google.com/maps/search/コンビニ+near+${q}" target="_blank" rel="noopener">勤務先付近のコンビニを検索</a>
    <div class="g-sec">勤務時間帯</div>
    <div class="dt-times">
      <span class="dt-time">⏱ 上番　${sh.start}</span>
      <span class="dt-time">⏱ 下番　${sh.end}</span>
    </div>`;
}


// ---- お知らせ本文 ----
function noticeDetailView() {
  const n = state.notices.find(x => x.id === ui.noticeId);
  if (!n) { ui.noticeId = null; return null; }
  return `
    ${appBar('お知らせ', { back: true, backAction: 'notice-back' })}
    <div class="nt-detail">
      <div class="nt-detail-head">
        <span class="nt-badge">${esc(n.cat)}</span>
        <span class="pc-muted small">${esc(n.at.slice(0, 10))} ${fmtTime(n.at)}</span>
      </div>
      <h2 class="nt-title">${esc(n.title)}</h2>
      <p class="nt-text">${esc(n.body)}</p>
      <div class="nt-from">${esc(n.from)}</div>
    </div>`;
}

// ---- 休暇申請 ----
const LV_CLS = { pending: 'lv-pending', nego: 'lv-nego', approved: 'lv-approved', rejected: 'lv-rejected' };

function leaveView(g) {
  const now = new Date();
  now.setMonth(now.getMonth() + (ui.calMonth || 0));
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const myLv = {};
  state.leaves.filter(l => l.guardId === g.id).forEach(l => { myLv[l.date] = l.status; });
  let cells = '<tr>' + '<td></td>'.repeat(first);
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    const cls = myLv[key] ? LV_CLS[myLv[key]] : '';
    cells += `<td><button class="cal-day ${cls}" data-action="leave-day" data-date="${key}">${d}</button></td>`;
    if ((first + d) % 7 === 0 && d !== days) cells += '</tr><tr>';
  }
  cells += '</tr>';
  return `
    ${appBar('休暇申請')}
    <div class="cal-pager">
      <button class="cal-nav" data-action="cal-month" data-delta="-1">◀</button>
      　${y}年 ${m + 1}月
      <button class="cal-nav" data-action="cal-month" data-delta="1">▶</button>
    </div>
    <div class="g-hint">📅 希望日をタップすると休暇を申請できます（申請済をもう一度タップで取消）</div>
    <table class="cal">
      <tr>${WD.map(w => `<th>${w}</th>`).join('')}</tr>
      ${cells}
    </table>
    <div class="cal-legend">
      <div><span class="lg lv-pending"></span>・・・休暇申請済</div>
      <div><span class="lg lv-nego"></span>・・・交渉可</div>
      <div><span class="lg lv-approved"></span>・・・承認済み・休日</div>
      <div><span class="lg lv-rejected"></span>・・・棄却</div>
    </div>`;
}

// ---- 給与管理 ----
function payView(g) {
  const p = calcPay(g, ui.payMonth);
  const i = p.months.indexOf(p.month);
  const ym = m => `${m.slice(0, 4)}年${Number(m.slice(5))}月度`;
  const row = (k, v, cls = '') => `<div class="pay-tr ${cls}"><span class="pay-th">${k}</span><span class="pay-td">${v}</span></div>`;
  return `
    ${appBar('給与管理')}
    <div class="pay-pager">
      <button class="pay-nav" data-action="pay-month" data-m="${p.months[i - 1] || ''}" ${i > 0 ? '' : 'disabled'}>◀</button>
      <span>${ym(p.month)} 給与明細書</span>
      <button class="pay-nav" data-action="pay-month" data-m="${p.months[i + 1] || ''}" ${i < p.months.length - 1 ? '' : 'disabled'}>▶</button>
    </div>
    <div class="pay-table">
      <div class="pay-tr pay-head"><span class="pay-th th-navy">隊員コード</span><span class="pay-td th-navy2">氏名</span></div>
      <div class="pay-tr"><span class="pay-th" style="text-align:center">${esc(g.code)}</span><span class="pay-td" style="text-align:center">${esc(g.name)}</span></div>
    </div>
    <div class="g-sec">支給</div>
    <div class="pay-table">
      ${row('基本給', yen2(p.base))}
      ${row('時間外手当', yen2(p.ot))}
      ${row('深夜手当', yen2(p.night))}
      ${row('精勤手当', yen2(0))}
      ${row('交通費', yen2(p.transport))}
      ${row('総支払額', yen2(p.gross), 'pay-sum')}
    </div>
    <div class="g-sec">控除</div>
    <div class="pay-table">
      ${row('所得税', yen2(p.tax))}
      ${row('健康保険', yen2(p.health))}
      ${row('厚生年金', yen2(p.pension))}
      ${row('雇用保険', yen2(p.emp))}
      ${row('控除計', yen2(p.ded), 'pay-sum')}
    </div>
    <div class="pay-table" style="margin-top:10px">
      ${row('差引支給額', yen2(p.net), 'pay-net')}
    </div>
    <button class="g-btn-navy" data-action="print-pay" style="margin-top:14px">📄 PDF出力 / 印刷</button>`;
}
const yen2 = n => n.toLocaleString('ja-JP') + '円';

// ---- お知らせ ----
function noticeView(g) {
  const banner = state.notices[0];
  return `
    ${appBar('お知らせ', { right: '<button class="g-logout" data-action="logout">ログアウト</button>' })}
    ${banner ? `<button class="nt-banner" data-action="notice-open" data-id="${banner.id}"><span class="nt-banner-logo">GF</span><div><b>${esc(banner.from)}より</b><br>${esc(banner.title)}</div><span class="sh-chev">›</span></button>` : ''}
    <div class="nt-list">
      ${state.notices.map(n => `<button class="nt-row" data-action="notice-open" data-id="${n.id}">
        <span class="nt-badge">お知らせ</span>
        <span class="nt-body">
          <b>${esc(n.at.slice(0, 10).replace(/-/g, '-'))} ${fmtTime(n.at)}</b><br>
          【 ${esc(n.cat)} 】<br>${esc(n.title)}
        </span>
        <span class="sh-chev">›</span>
      </button>`).join('')}
    </div>`;
}

export function renderGuard(el) {
  // 隊員が1人も登録されていないと、この画面は誰の画面でもない
  if (!state.guards.length) {
    el.innerHTML = `
    <div class="guard-shell">
      <div class="g-appbar"><span class="g-appbar-title">隊員アプリ</span></div>
      <div class="g-blank">
        <div class="g-blank-ic">📱</div>
        <b>隊員がまだ登録されていません</b>
        <p>この画面は、現場に出る隊員が自分のスマートフォンで使うアプリです。<br>
          管制センターで隊員を登録すると、その隊員としてログインした状態を確認できます。</p>
        <button class="g-btn-navy" data-action="role" data-role="admin">管制センターで隊員を登録する →</button>
        <p class="g-blank-sub">サンプルで動きを見たいときは、画面右上の <b>🧪 デモデータ</b> を押してください。</p>
      </div>
    </div>`;
    return;
  }
  // 選択中の隊員が消えていたら先頭に戻す
  const g = state.guards.find(x => x.id === ui.guardId) || state.guards[0];
  if (ui.guardId !== g.id) ui.guardId = g.id;
  let body;
  if (ui.guardTab === 'notice' && ui.noticeId) body = noticeDetailView() || noticeView(g);
  else if (ui.guardTab === 'shift' && ui.shiftDetail) body = shiftDetailView(g);
  else body = ({ notice: noticeView, report: reportView, shift: shiftListView, leave: leaveView, pay: payView })[ui.guardTab](g);
  const tabs = [
    ['notice', 'ℹ️', 'お知らせ'],
    ['report', '💬', '勤怠報告'],
    ['shift', '📅', 'シフト管理'],
    ['leave', '✈️', '休暇申請'],
    ['pay', '￥', '給与管理'],
  ];
  el.innerHTML = `
  <div class="guard-shell">
    <div class="g-demo-bar">
      <select id="guard-switch" class="g-switch">
        ${state.guards.map(x => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>${x.name}</option>`).join('')}
      </select>
      <label class="g-offline-toggle"><input type="checkbox" id="offline-switch" ${state.offline ? 'checked' : ''}> 📡 圏外</label>
    </div>
    <div class="g-body">${body}</div>
    <nav class="g-tabbar">
      ${tabs.map(([id, ic, label]) => `<button class="g-tab ${ui.guardTab === id ? 'on' : ''}" data-action="gtab" data-tab="${id}">
        <span class="g-tab-ic">${ic}</span><span>${label}</span>
      </button>`).join('')}
    </nav>
  </div>`;
}
