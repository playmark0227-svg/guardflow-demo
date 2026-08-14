import { state, ui, commit, paidGrantOf, masterRows } from './store.js?v=3';
import { blank } from './admin.js?v=3';
import { MASTERS } from './masters.js?v=3';
import { GROUPS, findGroup } from './menu.js?v=3';
import { esc, yen, fmtMD, todayKey, addDays, hrs, shiftMinutes } from './util.js?v=3';
import { wageOf, periodRows, clientTotals, needOf } from './gantt.js?v=3';
import { co } from './prints.js?v=3';

const guard = id => state.guards.find(g => g.id === id);
const site = id => state.sites.find(s => s.id === id);

// ===================== グループのタイル一覧 =====================
export function groupView(gid) {
  const g = findGroup(gid);
  if (!g) return '<div class="pc-muted">メニューが見つかりません</div>';
  return `
    <div class="mn-grid">
      ${g.items.map(it => `<button class="mn-tile" data-action="open-item" data-item="${it.id}">
        <span class="mn-ic">${it.ic}</span>
        <b>${esc(it.name)}</b>
        <span class="mn-sub">${esc(it.sub || (it.kind === 'master' ? MASTERS[it.master]?.name || '' : it.kind === 'report' ? '帳票出力' : ''))}</span>
      </button>`).join('')}
    </div>`;
}

// ===================== 汎用マスタエディタ =====================
const optionsFor = (f, mid) => {
  if (f.opt) return f.opt;
  if (f.optFrom === 'sites') return state.sites.map(s => s.name);
  if (f.optFrom === 'clients') return state.clients.map(c => c.name);
  if (f.optFrom === 'guards') return state.guards.map(g => g.name);
  return (state.masters[f.optFrom] || []).map(x => x.name);   // 任意のマスタを選択肢にできる
};

/** 複数選択セル。表の中に収めるため、選択中の内容を要約して <details> に畳む */
function multiCell(f, v, i, mid) {
  const cur = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v) : [];
  const opts = optionsFor(f, mid);
  const label = cur.length ? cur.join('、') : '未設定';
  return `<details class="mc">
    <summary title="${esc(label)}">${esc(label.length > 18 ? label.slice(0, 18) + '…' : label)}<i>${cur.length || ''}</i></summary>
    <div class="mc-list">
      ${opts.length ? opts.map(o => `<label><input type="checkbox" data-action-change="master-multi"
        data-m="${mid}" data-i="${i}" data-k="${f.k}" value="${esc(o)}" ${cur.includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')
        : `<span class="pc-muted small">${esc(f.emptyHint || '選択肢がまだありません')}</span>`}
    </div>
  </details>`;
}

function cell(f, v, i, mid) {
  const val = v == null ? '' : v;
  const nm = `data-mf="${f.k}" data-i="${i}"`;
  if (f.t === 'multi') return multiCell(f, v, i, mid);
  if (f.t === 'chk') return `<input type="checkbox" ${nm} ${val ? 'checked' : ''}>`;
  if (f.t === 'sel') return `<select ${nm}><option value=""></option>${optionsFor(f, mid).map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (f.t === 'area') return `<textarea ${nm} rows="2">${esc(val)}</textarea>`;
  const type = f.t === 'num' || f.t === 'yen' ? 'number' : f.t === 'date' ? 'date' : 'text';
  const step = f.t === 'num' ? ' step="0.001"' : '';
  return `<input type="${type}"${step} ${nm} value="${esc(val)}">`;
}

export function masterView(mid) {
  const m = MASTERS[mid];
  if (!m) return '<div class="pc-muted">マスタが見つかりません</div>';
  const rows = masterRows(mid);
  const q = (ui.masterQ || '').trim().toLowerCase();
  const idx = rows.map((r, i) => i).filter(i =>
    !q || m.fields.some(f => String(rows[i][f.k] ?? '').toLowerCase().includes(q)));

  return `
    <div class="pc-pager">
      <b>${esc(m.name)}</b>
      <span class="pc-muted small">${rows.length}件${q ? ` / 絞り込み ${idx.length}件` : ''}</span>
      <input type="search" id="master-q" class="mst-q" value="${esc(ui.masterQ || '')}" placeholder="この表を検索">
      <span style="margin-left:auto"></span>
      ${m.bulk ? `<button class="pc-btn" data-action="master-bulk" data-m="${mid}">${esc(m.bulk)}</button>` : ''}
      ${m.single ? '' : `<button class="pc-btn-navy" data-action="master-add" data-m="${mid}">＋ 新規登録</button>`}
      <button class="pc-btn" data-action="master-print" data-m="${mid}">🖨 一覧印刷</button>
    </div>
    ${m.note ? `<div class="mst-note">💡 ${esc(m.note)}</div>` : ''}
    <div class="pc-card pc-table-wrap">
      <table class="pc-table mst-table">
        <thead><tr>
          ${m.fields.map(f => `<th style="min-width:${f.w || 120}px">${esc(f.l)}${f.req ? '<i class="mst-req">必須</i>' : ''}${f.hint ? `<i class="mst-hint">${esc(f.hint)}</i>` : ''}</th>`).join('')}
          ${m.single ? '' : '<th style="width:70px">削除</th>'}
        </tr></thead>
        <tbody>
          ${idx.map(i => `<tr>
            ${m.fields.map(f => `<td>${cell(f, rows[i][f.k], i, mid)}</td>`).join('')}
            ${m.single ? '' : `<td><button class="rm" data-action="master-del" data-m="${mid}" data-i="${i}" title="削除">×</button></td>`}
          </tr>`).join('') || `<tr><td colspan="${m.fields.length + 1}" class="pc-muted">${q ? '該当する行がありません' : 'データがありません。「＋ 新規登録」で追加してください'}</td></tr>`}
        </tbody>
      </table>
    </div>
    <p class="pc-muted small">値を変更するとその場で保存されます（実機の F1=登録 に相当）。削除は「削除保護」の代わりに確認ダイアログで防いでいます。</p>`;
}

// ===================== 受注入力 =====================
export function orderView() {
  const date = ui.boardDate;
  const rows = state.sites.map(st => {
    const ord = needOf(st, date);
    const asg = state.shifts.filter(s => s.date === date && s.siteId === st.id).length;
    const short = asg < ord;
    return `<tr class="${short ? 'row-alert' : ''}">
      <td><b>${esc(st.name)}</b><br><span class="pc-muted small">${esc(st.client)}</span></td>
      <td>${st.kind}</td><td>${st.start}〜${st.end}</td>
      <td class="num"><input type="number" class="ord-in" min="0" max="30"
        data-action-change="order" data-site="${st.id}" value="${ord}"></td>
      <td class="num">${asg}名</td>
      <td class="num ${short ? 'warn-text' : ''}">${short ? `不足 ${ord - asg}名` : '✓ 充足'}</td>
      <td class="num">${yen(ord * (shiftMinutes(st.start, st.end) / 60) * st.bill)}</td>
    </tr>`;
  }).join('');
  const tot = state.sites.reduce((a, st) => a + needOf(st, date), 0);
  return `
    <div class="pc-pager">
      <button class="pc-btn" data-action="board-date" data-delta="-1">◀ 前日</button>
      <b>${fmtMD(date)}</b>
      <button class="pc-btn" data-action="board-date" data-delta="1">翌日 ▶</button>
      <button class="pc-btn" data-action="board-date" data-delta="0">今日へ</button>
      <span style="margin-left:auto"></span>
      <button class="pc-btn" data-action="order-copy">前日の受注をコピー</button>
      <button class="pc-btn-navy" data-action="atab" data-tab="board" data-date="${date}">配置する →</button>
    </div>
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${tot}名</b><span>受注人数</span></div>
      <div class="pc-kpi"><b>${state.shifts.filter(s => s.date === date).length}名</b><span>配置済み</span></div>
      <div class="pc-kpi"><b>${state.sites.length}</b><span>現場数</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>現場 / 得意先</th><th>区分</th><th>時間</th><th class="num">受注人数</th><th class="num">配置</th><th class="num">過不足</th><th class="num">請求見込</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="pc-muted small">受注人数を入力すると、管制ボードの必要人数と過不足判定に反映されます。</p>`;
}

// ===================== 勤務実績入力（4つの切り口） =====================
export function actualView(mode) {
  const date = ui.boardDate;
  let list = state.shifts.filter(s => s.date === date);
  let groupBy = null, title = '勤務実績入力';
  if (mode === 'site') { groupBy = sh => site(sh.siteId).name; title = '現場別 勤務実績一覧入力'; }
  if (mode === 'guard') { groupBy = sh => guard(sh.guardId).name; title = '隊員別 勤務実績入力'; }
  if (mode === 'client') { groupBy = sh => site(sh.siteId).client; title = '得意先別 勤務実績入力'; }
  if (mode === 'list') title = '勤務実績一覧入力';

  const P = { depart: '出発', on: '上番', off: '下番' };
  const row = sh => {
    const g = guard(sh.guardId), st = site(sh.siteId), w = wageOf(sh);
    const t = ty => { const p = sh.punches.find(x => x.type === ty); return p ? new Date(p.at).toTimeString().slice(0, 5) : ''; };
    return `<tr class="${w.flags.length ? 'row-alert' : ''}">
      <td><b>${esc(g.name)}</b><br><span class="pc-muted small">${esc(st.name)}</span></td>
      <td>${sh.start}〜${sh.end}</td>
      ${['depart', 'on', 'off'].map(ty => `<td><input type="time" class="ac-in" value="${t(ty)}"
        data-action-change="punch-edit" data-shift="${sh.id}" data-type="${ty}"></td>`).join('')}
      <td class="num">${hrs(w.workMin)}h</td>
      <td class="num">${w.nightMin ? hrs(w.nightMin) + 'h' : '—'}</td>
      <td class="num">${w.otMin ? hrs(w.otMin) + 'h' : '—'}</td>
      <td class="num"><b>${yen(w.total)}</b></td>
      <td>${w.flags.length ? `<span class="pc-chip-warn" title="${esc(w.flags.join(' / '))}">⚠ 要確認</span>` : '<span class="pc-chip-ok">✓</span>'}</td>
    </tr>`;
  };

  let body;
  if (groupBy) {
    const map = new Map();
    list.forEach(sh => { const k = groupBy(sh); if (!map.has(k)) map.set(k, []); map.get(k).push(sh); });
    body = [...map.entries()].map(([k, v]) => `
      <tr class="ac-group"><td colspan="9">${esc(k)}　<span class="pc-muted small">${v.length}名</span></td></tr>
      ${v.map(row).join('')}`).join('');
  } else body = list.map(row).join('');

  return `
    <div class="pc-pager">
      <button class="pc-btn" data-action="board-date" data-delta="-1">◀ 前日</button>
      <b>${fmtMD(date)}</b>
      <button class="pc-btn" data-action="board-date" data-delta="1">翌日 ▶</button>
      <button class="pc-btn" data-action="board-date" data-delta="0">今日へ</button>
      <span class="pc-muted small">${title}</span>
      <span style="margin-left:auto"></span>
      <button class="pc-btn" data-action="report-out" data-report="wage">🖨 勤務実績表</button>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>隊員 / 現場</th><th>予定</th><th>出発</th><th>上番</th><th>下番</th>
        <th class="num">実働</th><th class="num">深夜</th><th class="num">残業</th><th class="num">賃金</th><th>状態</th></tr></thead>
      <tbody>${body || '<tr><td colspan="10" class="pc-muted">この日の配置はありません</td></tr>'}</tbody>
    </table></div>
    <p class="pc-muted small">時刻を直すとその場で保存され、実働・割増・賃金が再計算されます。空にすると打刻を取り消します。</p>`;
}

// ===================== 手当・控除入力 =====================
export function allowanceView() {
  const m = ui.payMonth || (state.shifts.length ? state.shifts[state.shifts.length - 1].date.slice(0, 7) : todayKey().slice(0, 7));
  const pay = state.masters.payItem.filter(x => x.kind === '固定');
  const ded = state.masters.dedItem.filter(x => x.kind === '任意');
  const val = (gid, k) => ((state.allowances[m] || {})[gid] || {})[k] ?? '';
  return `
    <div class="pc-pager"><b>${m.replace('-', '年')}月度 手当・控除入力</b>
      <span class="pc-muted small">固定支給・任意控除を隊員ごとに登録します</span></div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>隊員</th>
        ${pay.map(p => `<th class="num">${esc(p.name)}</th>`).join('')}
        ${ded.map(d => `<th class="num ded">${esc(d.name)}</th>`).join('')}
        <th class="num">支給計</th><th class="num">控除計</th></tr></thead>
      <tbody>${state.guards.map(g => {
        const ps = pay.reduce((a, p) => a + (Number(val(g.id, 'p:' + p.name)) || 0), 0);
        const ds = ded.reduce((a, d) => a + (Number(val(g.id, 'd:' + d.name)) || 0), 0);
        return `<tr><td><b>${esc(g.name)}</b><br><span class="pc-muted small">${esc(g.code)}</span></td>
          ${pay.map(p => `<td><input type="number" class="ac-in num" data-action-change="allowance" data-g="${g.id}" data-k="p:${esc(p.name)}" value="${val(g.id, 'p:' + p.name)}" placeholder="${p.amount}"></td>`).join('')}
          ${ded.map(d => `<td><input type="number" class="ac-in num" data-action-change="allowance" data-g="${g.id}" data-k="d:${esc(d.name)}" value="${val(g.id, 'd:' + d.name)}" placeholder="${d.amount}"></td>`).join('')}
          <td class="num">${yen(ps)}</td><td class="num">${yen(ds)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="pc-muted small">空欄のときは括弧内の既定額（支払項目マスタ／控除項目マスタ）が使われます。</p>`;
}

// ===================== 賞与入力 =====================
export function bonusView(listMode) {
  const b = state.bonus;
  const rate = m => { const t = state.masters.bonusTax.find(x => m >= x.from && (x.to === 0 || m < x.to)); return t ? t.rate : 0; };
  let T = { amt: 0, ins: 0, tax: 0, net: 0 };
  const rows = state.guards.map(g => {
    const amt = Number((b.amount || {})[g.id] || 0);
    const prev = g.rate * 160;                       // 前月給与の概算
    const ins = Math.round(amt * 0.1465);
    const tax = Math.round((amt - ins) * rate(prev) / 100);
    const net = amt - ins - tax;
    T.amt += amt; T.ins += ins; T.tax += tax; T.net += net;
    return `<tr>
      <td>${esc(g.code)}</td><td><b>${esc(g.name)}</b></td>
      <td class="num"><input type="number" class="ac-in num" data-action-change="bonus" data-g="${g.id}" value="${amt || ''}" placeholder="0"></td>
      <td class="num">${rate(prev).toFixed(3)}%</td>
      <td class="num">${yen(ins)}</td><td class="num">${yen(tax)}</td><td class="num"><b>${yen(net)}</b></td>
    </tr>`;
  }).join('');
  return `
    <div class="pc-pager"><b>${listMode ? '賞与一覧入力' : '賞与入力'}</b>
      <label class="mst-inline">支給日 <input type="date" id="bonus-date" data-action-change="bonus-meta" data-k="date" value="${b.date || ''}"></label>
      <label class="mst-inline">名称 <input type="text" id="bonus-name" data-action-change="bonus-meta" data-k="name" value="${esc(b.name || '夏季賞与')}"></label>
      <span style="margin-left:auto"></span>
      <span class="pc-muted small">賞与税額算出率表から自動計算</span>
    </div>
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${yen(T.amt)}</b><span>支給総額</span></div>
      <div class="pc-kpi"><b>${yen(T.ins)}</b><span>社会保険料</span></div>
      <div class="pc-kpi"><b>${yen(T.tax)}</b><span>源泉所得税</span></div>
      <div class="pc-kpi"><b>${yen(T.net)}</b><span>差引支給額</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>コード</th><th>氏名</th><th class="num">賞与額</th><th class="num">税率</th>
        <th class="num">社会保険料</th><th class="num">所得税</th><th class="num">差引支給</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="pc-muted small">社会保険料は14.65%（健康保険4.95%＋厚生年金9.15%＋雇用保険0.55%）で概算しています。</p>`;
}

// ===================== 振込データ作成（全銀） =====================
export function zenginView() {
  const m = ui.payMonth || todayKey().slice(0, 7);
  const bank = state.masters.bank[0] || {};
  const lines = state.guards.map((g, i) => {
    const p = state.shifts.filter(s => s.guardId === g.id && s.date.startsWith(m))
      .reduce((a, sh) => a + wageOf(sh, g).total, 0);
    return { no: i + 1, g, amt: Math.round(p * 0.79) };     // 控除後の概算
  }).filter(x => x.amt > 0);
  const total = lines.reduce((a, x) => a + x.amt, 0);

  const c = co();
  const ready = !!(c.kana || c.name) && !!c.payerAcct;
  const recs = zenginRecords();
  const head = recs[0], body = recs.slice(1, -1);

  return `
    <div class="pc-pager"><b>振込データ作成（全銀フォーマット）</b>
      <span class="pc-muted small">${m.replace('-', '年')}月度</span>
      <span style="margin-left:auto"></span>
      ${ready ? '<button class="pc-btn-navy" data-action="zengin-dl">💾 テキストをダウンロード</button>'
      : '<button class="pc-btn" data-action="atab" data-tab="m-company">⚠ 自社マスタに振込元口座を登録してください →</button>'}
    </div>
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${lines.length}件</b><span>振込件数</span></div>
      <div class="pc-kpi"><b>${yen(total)}</b><span>振込金額合計</span></div>
      <div class="pc-kpi"><b>${esc(bank.name || '—')}</b><span>委託元金融機関</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th class="num">No</th><th>受取人名</th><th>金融機関</th><th class="num">振込金額</th></tr></thead>
      <tbody>${lines.map(x => `<tr><td class="num">${x.no}</td><td><b>${esc(x.g.name)}</b></td>
        <td>${esc(bank.name || '')} ${esc(bank.bname || '')}</td><td class="num">${yen(x.amt)}</td></tr>`).join('')
      || '<tr><td colspan="4" class="pc-muted">対象データがありません</td></tr>'}</tbody>
    </table></div>
    <div class="pc-card"><div class="pc-card-head"><b>生成されるレコード（先頭3件）</b></div>
      <pre class="zg-pre">${esc(recs.slice(0, 4).join('\n'))}${recs.length > 5 ? `\n…（全${recs.length}レコード）` : ''}</pre></div>
    <p class="pc-muted small">実運用では金融機関ごとの様式差（ヘッダ・トレーラ・改行コード）に合わせる必要があります。</p>`;
}

/** 全銀フォーマットのレコード列。画面プレビューとダウンロードで同じものを使う */
export function zenginRecords(ym) {
  const m = ym || ui.payMonth || todayKey().slice(0, 7);
  const bank = state.masters.bank[0] || {};
  const lines = state.guards.map((g, i) => {
    const p = state.shifts.filter(s => s.guardId === g.id && s.date.startsWith(m))
      .reduce((a, sh) => a + wageOf(sh, g).total, 0);
    return { no: i + 1, g, amt: Math.round(p * 0.79) };
  }).filter(x => x.amt > 0);
  const total = lines.reduce((a, x) => a + x.amt, 0);
  const kana = v => String(v || '').replace(/[^\uFF61-\uFF9FA-Z0-9()\-. ]/g, '');
  const pad = (v, n) => String(v || '').slice(0, n).padEnd(n, ' ');
  const num = (v, n) => String(Math.round(Number(v) || 0)).slice(-n).padStart(n, '0');
  const now = new Date();
  // 全銀協「総合振込」形式：ヘッダ(1)／データ(2)／トレーラ(8)／エンド(9)、いずれも120桁
  const c = co();
  const payer = (state.masters.bank || []).find(x => x.name === c.payerBank) || bank;
  const head = '1' + '21' + '0' + num(c.payerCode, 10) + pad(kana(c.kana || c.name), 40)
    + num(now.getMonth() + 1, 2) + num(now.getDate(), 2)
    + num(payer.code, 4) + pad(kana(payer.name), 15)
    + num(payer.bcode, 3) + pad(kana(payer.bname), 15) + '1' + num(c.payerAcct, 7) + pad('', 17);
  const body = lines.map(x => '2'
    + num(x.g.bank || bank.code, 4) + pad(kana(bank.name), 15)
    + num(x.g.branch || bank.bcode, 3) + pad(kana(bank.bname), 15) + num(0, 4)
    + '1' + num(x.g.acct, 7) + pad(kana(x.g.kana), 30) + num(x.amt, 10)
    + '0' + pad(x.g.code, 10) + pad('', 10) + '7' + ' ' + pad('', 7));
  const trailer = '8' + num(lines.length, 6) + num(total, 12) + pad('', 101);
  return [head, ...body, trailer, '9' + pad('', 119)];
}

// ===================== 得意先元帳 =====================
export function ledgerView() {
  const clients = [...new Set(state.sites.map(s => s.client))];
  const cur = ui.ledgerClient || clients[0];
  const rows = [];
  let bal = 0;
  const dates = [...new Set(state.shifts.map(s => s.date))].sort();
  dates.forEach(d => {
    const v = clientTotals(d).get(cur);
    if (!v) return;
    bal += v.total;
    rows.push(`<tr><td>${fmtMD(d)}</td><td>警備業務請求（${v.sites}現場）</td>
      <td class="num">${yen(v.total)}</td><td class="num">—</td><td class="num">${yen(bal)}</td></tr>`);
  });
  const paid = state.deposits[cur] ? bal : 0;
  if (paid) { bal -= paid; rows.push(`<tr class="lg-paid"><td>${fmtMD(todayKey())}</td><td>入金消込</td><td class="num">—</td><td class="num">${yen(paid)}</td><td class="num">${yen(bal)}</td></tr>`); }
  return `
    <div class="pc-pager"><b>得意先元帳</b>
      <select id="ledger-client" class="mst-sel">${clients.map(c => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <span style="margin-left:auto"></span>
      <span class="pc-muted small">残高 ${yen(bal)}</span>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>日付</th><th>摘要</th><th class="num">請求（借方）</th><th class="num">入金（貸方）</th><th class="num">残高</th></tr></thead>
      <tbody>${rows.join('') || '<tr><td colspan="5" class="pc-muted">取引がありません</td></tr>'}</tbody>
    </table></div>`;
}

// ===================== 予測表・粗利 =====================
export function forecastView(kind) {
  const D0 = todayKey();
  const days = Array.from({ length: 30 }, (_, i) => addDays(D0, i - 14));
  let bill = 0, cost = 0;
  const byMonth = new Map();
  days.forEach(d => {
    const list = state.shifts.filter(s => s.date === d);
    const b = list.reduce((a, sh) => { const st = site(sh.siteId); return a + (shiftMinutes(st.start, st.end) / 60) * st.bill; }, 0);
    const c = list.reduce((a, sh) => a + wageOf(sh).total, 0);
    bill += b; cost += c;
    const m = d.slice(0, 7);
    const cur = byMonth.get(m) || { bill: 0, cost: 0 };
    byMonth.set(m, { bill: cur.bill + b, cost: cur.cost + c });
  });
  const rows = [...byMonth.entries()].map(([m, v]) => {
    const gp = v.bill - v.cost, r = v.bill ? Math.round(gp / v.bill * 100) : 0;
    return `<tr><td><b>${m.replace('-', '年')}月</b></td><td class="num">${yen(v.bill)}</td>
      ${kind === 'pl' ? `<td class="num">${yen(v.cost)}</td><td class="num"><b>${yen(gp)}</b></td>
      <td class="bar-cell"><span class="pc-bar"><span class="pc-bar-fill ${r < 30 ? 'bar-warn' : ''}" style="width:${Math.max(0, Math.min(100, r))}%"></span></span><span class="small">${r}%</span></td>` : ''}
    </tr>`;
  }).join('');
  const gp = bill - cost;
  return `
    <div class="pc-pager"><b>${kind === 'pl' ? '収支予測表' : '売上高予測表'}</b>
      <span class="pc-muted small">配置済みデータ（前後2週間）から算出</span></div>
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${yen(bill)}</b><span>売上予測</span></div>
      ${kind === 'pl' ? `<div class="pc-kpi"><b>${yen(cost)}</b><span>人件費予測</span></div>
      <div class="pc-kpi"><b>${yen(gp)}</b><span>粗利予測</span></div>
      <div class="pc-kpi"><b>${bill ? Math.round(gp / bill * 100) : 0}%</b><span>粗利率</span></div>` : ''}
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>対象月</th><th class="num">売上</th>
        ${kind === 'pl' ? '<th class="num">人件費</th><th class="num">粗利</th><th>粗利率</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ===================== 有給管理 =====================
const paidDays = g => paidGrantOf(g);
export function paidView(mode) {
  if (!state.guards.length)
    return blank('🌴', '隊員がまだ登録されていません',
      '有給の付与日数は、入社年月日と有給付与マスタ（労基法39条の法定日数）から自動で計算します。<br>'
      + '隊員マスタに入社年月日を入れると、ここに付与・取得・残と年5日の取得義務が並びます。',
      ['m-guard', '隊員を登録する →']);
  const rows = state.guards.map(g => {
    const grant = paidDays(g);
    const used = state.leaves.filter(l => l.guardId === g.id && l.status === 'approved').length;
    const left = grant - used;
    // 付与前（入社6か月未満）の隊員に「残0日」「義務未達」を出すと誤解を招く
    const yet = grant === 0;
    const low = !yet && left <= 5;
    const must = yet ? 0 : Math.max(0, 5 - used);  // 年5日取得義務（労基法39条7項）
    return { g, grant, used, left, low, must, yet };
  });
  if (mode === 'month') {
    const by = new Map();
    rows.forEach(r => { const k = r.g.office; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    return `
      <div class="pc-pager"><b>付与月別 有給状況確認</b><span class="pc-muted small">拠点ごとの取得状況</span></div>
      ${[...by.entries()].map(([k, v]) => `<div class="pc-card">
        <div class="pc-card-head"><b>📍 ${esc(k)}</b><span class="pc-muted">${v.length}名</span></div>
        ${v.map(r => `<div class="edu-row">
          <span class="edu-name"><b>${esc(r.g.name)}</b></span>
          <span class="pc-bar edu-bar"><span class="pc-bar-fill ${r.must > 0 ? 'bar-warn' : ''}" style="width:${r.grant ? Math.round(r.used / r.grant * 100) : 0}%"></span></span>
          <span class="small">${r.used}/${r.grant}日</span>
          ${r.yet ? '<span class="pc-chip-muted">付与前</span>'
            : r.must > 0 ? `<span class="pc-chip-warn">⚠ 義務未達 あと${r.must}日</span>` : '<span class="pc-chip-ok">✓</span>'}
        </div>`).join('')}
      </div>`).join('')}`;
  }
  const need = rows.filter(r => r.must > 0).length;
  return `
    <div class="pc-pager"><b>${mode === 'guard' ? '隊員別 有給状況確認' : '有給集計'}</b>
      <span style="margin-left:auto"></span>
      <button class="pc-btn" data-action="report-out" data-report="paid">🖨 有給関連印刷</button></div>
    ${need ? `<div class="pc-banner-warn">⚠ 年5日の取得義務（労基法39条7項）が未達の隊員が <b>${need}名</b> います</div>` : ''}
    <div class="pc-card pc-table-wrap"><table class="pc-table">
      <thead><tr><th>コード</th><th>氏名</th><th>拠点</th><th>入社日</th><th class="num">付与日数</th><th class="num">取得</th><th class="num">残</th><th>年5日義務</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="${r.must > 0 ? 'row-alert' : ''}">
        <td>${esc(r.g.code)}</td><td><b>${esc(r.g.name)}</b></td><td>${esc(r.g.office)}</td>
        <td>${esc(r.g.hiredAt || '—')}</td><td class="num">${r.grant}日</td><td class="num">${r.used}日</td>
        <td class="num ${r.low ? 'warn-text' : ''}">${r.yet ? '—' : r.left + '日'}</td>
        <td>${r.yet ? '<span class="pc-chip-muted">付与前（入社6か月未満）</span>'
          : r.must > 0 ? `<span class="pc-chip-warn">あと${r.must}日</span>` : '<span class="pc-chip-ok">✓ 達成</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

// ===================== メンテナンス =====================
export function maintView(mode) {
  if (mode === 'opt') {
    const o = state.options;
    const sw = (k, l, note) => `<label class="opt-row">
      <input type="checkbox" data-action-change="option" data-k="${k}" ${o[k] ? 'checked' : ''}>
      <span><b>${l}</b><i>${note}</i></span></label>`;
    return `
      <div class="pc-pager"><b>オプション設定</b></div>
      <div class="pc-card">
        ${sw('nippoSplit', '管制日報の得意先と配置先を分ける', '日報の宛名を得意先ではなく配置先で出力します')}
        ${sw('dayNight', '管制日報に昼夜区分を印字する', '日付別管制日報の出力条件に昼夜区分を追加します')}
        ${sw('taxIn', '得意先合計に消費税を掛ける', '明細ごとではなく請求合計に対して課税します')}
        ${sw('autoHour', '時給自動計算を既定にする', '配置先・隊員マスタの新規登録時の初期値')}
        ${sw('blockPaid', '有給残がない隊員は配置できないようにする', '配置時にブロックします')}
        ${sw('warnRun', '6連勤以上を警告する', '勤務ガントの右端に警告を出します')}
      </div>
      <p class="pc-muted small">実機の「オプション設定」に相当します。変更は即時反映されます。</p>`;
  }
  if (mode === 'io') {
    return `
      <div class="pc-pager"><b>エクスポート / インポート</b></div>
      <div class="pc-cards-grid">
        ${[['guards', '隊員マスタ'], ['sites', '配置先マスタ'], ['shifts', '勤務データ'], ['masters', '全マスタ']].map(([k, l]) =>
      `<button class="pc-report-card" data-action="export" data-k="${k}">
          <span class="pc-report-ic">💾</span><b>${l}</b>
          <span class="pc-muted small">CSVで書き出し</span><span class="pc-chip-ok">実行できます</span>
        </button>`).join('')}
      </div>
      <div class="pc-card">
        <div class="pc-card-head"><b>インポート</b></div>
        <p class="pc-muted small">実機では専用の取込フォーマット（コンバートシート）を使ってマスタを移行します。
          このデモでは書き出しのみ対応しています。</p>
      </div>`;
  }
  if (mode === 'bulk') {
    return `
      <div class="pc-pager"><b>勤務一括更新</b></div>
      <div class="pc-card">
        <div class="pc-card-head"><b>対象と操作を選ぶ</b></div>
        <div class="blk-form">
          <label>対象期間 <input type="date" id="blk-from" value="${ui.boardDate}"> 〜 <input type="date" id="blk-to" value="${addDays(ui.boardDate, 6)}"></label>
          <label>現場 <select id="blk-site"><option value="">すべて</option>${state.sites.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
          <label>操作 <select id="blk-op">
            <option value="clear-punch">打刻を取り消す</option>
            <option value="unassign">配置を解除する</option>
          </select></label>
          <button class="pc-btn-navy" data-action="bulk-run">この条件で実行</button>
        </div>
      </div>
      <p class="pc-muted small">実行前に対象件数を表示して確認します。</p>`;
  }
  if (mode === 'zip') {
    return `
      <div class="pc-pager"><b>郵便番号更新</b></div>
      <div class="pc-card">
        <p>日本郵便が公開する郵便番号データ（KEN_ALL）を取り込み、郵便番号マスタを最新化します。</p>
        <button class="pc-btn-navy" data-action="master-bulk" data-m="zip">📮 郵便番号を一括取込</button>
        <p class="pc-muted small" style="margin-top:10px">現在の登録件数：${state.masters.zip.length}件</p>
      </div>`;
  }
  // データメンテナンス / データ削除
  const del = mode === 'del';
  const counts = [['隊員', state.guards.length], ['配置先', state.sites.length], ['勤務データ', state.shifts.length],
  ['休暇申請', state.leaves.length], ['お知らせ', state.notices.length]];
  return `
    <div class="pc-pager"><b>${del ? 'データ削除' : 'データメンテナンス'}</b></div>
    <div class="pc-kpi-row">${counts.map(([l, n]) => `<div class="pc-kpi"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
    <div class="pc-card">
      <div class="pc-card-head"><b>${del ? '期間を指定して削除' : '整合性チェック'}</b></div>
      ${del
      ? `<p class="pc-muted small">指定日より前の勤務データを削除します。削除したデータは戻せません。</p>
         <div class="blk-form">
           <label>この日より前 <input type="date" id="del-before" value="${addDays(todayKey(), -30)}"></label>
           <button class="pc-btn sd-danger" data-action="purge">削除を実行</button>
         </div>`
      : `<div class="mst-note">${checkIntegrity()}</div>`}
    </div>`;
}

function checkIntegrity() {
  const bad = [];
  state.shifts.forEach(sh => {
    if (!guard(sh.guardId)) bad.push(`勤務 ${sh.date}：隊員が見つかりません`);
    if (!site(sh.siteId)) bad.push(`勤務 ${sh.date}：配置先が見つかりません`);
  });
  const flagged = state.shifts.filter(sh => wageOf(sh).flags.length).length;
  return bad.length
    ? `⚠ 不整合が ${bad.length}件：<br>${bad.slice(0, 5).map(esc).join('<br>')}`
    : `✓ 参照の不整合はありません（勤務 ${state.shifts.length}件を検査）<br>` +
    `${flagged ? `⚠ 打刻・休憩に確認が必要な勤務が ${flagged}件あります` : '✓ 打刻の警告もありません'}`;
}

// ===================== マスタ一覧印刷のメニュー =====================
export function masterPrintView() {
  return `
    <div class="pc-pager"><b>マスタ一覧印刷</b><span class="pc-muted small">印刷したいマスタを選んでください</span></div>
    <div class="pc-cards-grid">
      ${Object.entries(MASTERS).map(([id, m]) => `<button class="pc-report-card" data-action="master-print" data-m="${id}">
        <span class="pc-report-ic">🖨</span><b>${esc(m.name)}</b>
        <span class="pc-muted small">${masterRows(id).length}件</span>
        <span class="pc-chip-ok">PDF出力可</span>
      </button>`).join('')}
    </div>`;
}
