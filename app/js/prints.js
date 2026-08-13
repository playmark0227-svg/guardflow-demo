import { state } from './store.js';
import { esc, yen, fmtMD, shiftMinutes, hrs, fmtAbs, addDays, todayKey } from './util.js';
import { periodRows, ganttPeriod, visibleGuards, wageOf } from './gantt.js';

// ---- 給与明細（隊員アプリ/PC共通） ----
// 実際の勤務データ（打刻）から、指定月の給与を組み立てる
export function payMonths() {
  return [...new Set(state.shifts.map(s => s.date.slice(0, 7)))].sort();
}

export function calcPay(g, ym) {
  const months = payMonths();
  const month = ym && months.includes(ym) ? ym : months[months.length - 1] || '';
  const list = state.shifts.filter(s => s.guardId === g.id && s.date.startsWith(month));
  const a = list.reduce((t, sh) => {
    const w = wageOf(sh, g);
    return { work: t.work + w.workMin, night: t.night + w.nightMin, ot: t.ot + w.otMin,
      base: t.base + w.base, np: t.np + w.nightPay, op: t.op + w.otPay };
  }, { work: 0, night: 0, ot: 0, base: 0, np: 0, op: 0 });

  const days = new Set(list.map(s => s.date)).size;
  const base = a.base, night = a.np, ot = a.op;
  const transport = days * 600;                       // 実費相当（1日600円）
  const gross = base + night + ot + transport;
  const health = Math.round(gross * 0.0495);
  const pension = Math.round(gross * 0.0915);
  const emp = Math.round(gross * 0.0055);
  const tax = Math.round(gross * 0.021);
  const ded = health + pension + emp + tax;
  return { month, months, days, hours: a.work / 60, nightH: a.night / 60, otH: a.ot / 60,
    base, night, ot, transport, gross, health, pension, emp, tax, ded, net: gross - ded };
}

export function payslipPrintHTML(g, ym) {
  const p = calcPay(g, ym);
  const tr = (k, v) => `<tr><td>${k}</td><td style="text-align:right">${yen(v)}</td></tr>`;
  return `
  <div class="payslip">
    <h1>給与支給明細書</h1>
    <p class="ps-meta">${p.month.replace('-', '年')}月度　／　GuardFlow警備株式会社（デモ）</p>
    <p class="ps-name">${esc(g.code)}　${esc(g.name)} 殿</p>
    <table class="ps-table">
      <tr><th colspan="2">勤怠</th></tr>
      <tr><td>出勤日数</td><td style="text-align:right">${p.days}日</td></tr>
      <tr><td>総労働時間</td><td style="text-align:right">${hrs(p.hours * 60)}時間（深夜${hrs(p.nightH * 60)}h／残業${hrs(p.otH * 60)}h）</td></tr>
      <tr><th colspan="2">支給</th></tr>
      ${tr('基本給', p.base)}${tr('深夜手当', p.night)}${tr('時間外手当', p.ot)}${tr('交通費', p.transport)}
      ${tr('総支払額', p.gross)}
      <tr><th colspan="2">控除</th></tr>
      ${tr('所得税', p.tax)}${tr('健康保険', p.health)}${tr('厚生年金', p.pension)}${tr('雇用保険', p.emp)}
      ${tr('控除計', p.ded)}
      <tr class="ps-net"><td><b>差引支給額</b></td><td style="text-align:right"><b>${yen(p.net)}</b></td></tr>
    </table>
    <p class="ps-foot">本明細はデモデータにより自動生成されています。</p>
  </div>`;
}

// ---- 請求書 ----
export function invoiceHTML(siteId, date) {
  const site = state.sites.find(s => s.id === siteId);
  const list = state.shifts.filter(s => s.date === date && s.siteId === siteId);
  const hours = shiftMinutes(site.start, site.end) / 60;
  const amount = list.length * hours * site.bill;
  const tax = Math.round(amount * 0.1);
  return `
  <div class="payslip">
    <h1>請　求　書</h1>
    <p class="ps-meta">発行日：${fmtMD(date)}　／　GuardFlow警備株式会社（デモ）</p>
    <p class="ps-name">${esc(site.client)} 御中</p>
    <p>件名：${esc(site.name)}（${site.kind}警備業務）</p>
    <table class="ps-table">
      <tr><th>摘要</th><th style="text-align:right">金額</th></tr>
      <tr><td>${fmtMD(date)}　警備員 ${list.length}名 × ${hours}h × @${site.bill.toLocaleString()}円</td><td style="text-align:right">${yen(amount)}</td></tr>
      <tr><td>消費税（10%）</td><td style="text-align:right">${yen(tax)}</td></tr>
      <tr class="ps-net"><td><b>合計金額</b></td><td style="text-align:right"><b>${yen(amount + tax)}</b></td></tr>
    </table>
    <p>お振込先：デモ銀行 本店営業部（普）0000000　カ）ガードフローケイビ</p>
    <p class="ps-foot">本請求書はデモデータにより自動生成されています。</p>
  </div>`;
}

// ---- 勤務実績・時給計算表（ガントと同じ集計ロジックを使う） ----
export function wageSheetHTML() {
  const { byGuard, days } = periodRows();
  const { from } = ganttPeriod();
  const period = days > 1 ? `${fmtMD(from)} 〜 ${fmtMD(addDays(from, days - 1))}` : fmtMD(from);
  let T = { work: 0, night: 0, ot: 0, total: 0 };

  const rows = visibleGuards().filter(g => byGuard.has(g.id)).map(g => {
    const a = byGuard.get(g.id).reduce((t, { w }) => ({
      work: t.work + w.workMin, night: t.night + w.nightMin,
      ot: t.ot + w.otMin, total: t.total + w.total,
    }), { work: 0, night: 0, ot: 0, total: 0 });
    Object.keys(T).forEach(k => T[k] += a[k]);
    const detail = byGuard.get(g.id)
      .map(({ sh, w }) => `${days > 1 ? fmtMD(sh.date) + ' ' : ''}${fmtAbs(w.s)}–${fmtAbs(w.e)}`).join('、');
    return `<tr>
      <td>${esc(g.code)}</td>
      <td>${esc(g.name)}<br><span style="font-size:10px;color:#666">${esc(detail)}</span></td>
      <td style="text-align:right">${yen(g.rate)}</td>
      <td style="text-align:right">${hrs(a.work)}</td>
      <td style="text-align:right">${a.night ? hrs(a.night) : '—'}</td>
      <td style="text-align:right">${a.ot ? hrs(a.ot) : '—'}</td>
      <td style="text-align:right">${yen(a.total)}</td>
    </tr>`;
  }).join('');

  return `
  <div class="payslip">
    <h1>勤務実績・賃金計算表</h1>
    <p class="ps-meta">対象期間：${period}　／　GuardFlow警備株式会社（デモ）</p>
    <table class="ps-table">
      <tr><th>コード</th><th>氏名 / 勤務時間帯</th><th style="text-align:right">時給</th>
        <th style="text-align:right">実働(h)</th><th style="text-align:right">深夜(h)</th>
        <th style="text-align:right">残業(h)</th><th style="text-align:right">支給額</th></tr>
      ${rows || '<tr><td colspan="7">対象データなし</td></tr>'}
      <tr class="ps-net">
        <td colspan="3"><b>合計</b></td>
        <td style="text-align:right"><b>${hrs(T.work)}</b></td>
        <td style="text-align:right"><b>${hrs(T.night)}</b></td>
        <td style="text-align:right"><b>${hrs(T.ot)}</b></td>
        <td style="text-align:right"><b>${yen(T.total)}</b></td>
      </tr>
    </table>
    <p class="ps-foot">実働＝下番−上番−休憩。深夜（22:00〜翌5:00）に25%、1日8時間超に25%を加算。
      打刻が無い勤務は予定時刻で計算しています。週40時間超・法定休日の割増は未計算です。</p>
  </div>`;
}

// ---- 警備員名簿 ----
export function rosterHTML() {
  return `
  <div class="payslip">
    <h1>警備員名簿</h1>
    <p class="ps-meta">GuardFlow警備株式会社（デモ）　／　作成日：自動生成</p>
    <table class="ps-table">
      <tr><th>隊員コード</th><th>氏名</th><th>年齢</th><th>保有資格</th></tr>
      ${state.guards.map(g => `<tr>
        <td>${esc(g.code)}</td><td>${esc(g.name)}</td><td style="text-align:right">${g.age}</td>
        <td>${g.quals.length ? esc(g.quals.join('、')) : '—'}</td>
      </tr>`).join('')}
    </table>
    <p class="ps-foot">警備業法施行規則に基づく備付書類のデモ出力です（写真・本籍等の法定記載事項は省略）。</p>
  </div>`;
}

// ---- 配置予定表 ----
export function scheduleHTML(date) {
  const rows = state.sites.map(site => {
    const list = state.shifts.filter(s => s.date === date && s.siteId === site.id);
    const names = list.map(s => state.guards.find(g => g.id === s.guardId).name).join('、') || '（未配置）';
    return `<tr><td>${esc(site.name)}</td><td>${site.start}〜${site.end}</td><td style="text-align:right">${list.length}/${site.need}名</td><td>${esc(names)}</td></tr>`;
  }).join('');
  return `
  <div class="payslip">
    <h1>配置予定表</h1>
    <p class="ps-meta">${fmtMD(date)}　／　GuardFlow警備株式会社（デモ）</p>
    <table class="ps-table">
      <tr><th>現場</th><th>時間</th><th>人数</th><th>配置隊員</th></tr>
      ${rows}
    </table>
    <p class="ps-foot">本帳票はデモデータにより自動生成されています。</p>
  </div>`;
}

// ---- 実機メニューに対応する帳票群 ----
const P = (title, meta, head, rows, foot) => `
  <div class="payslip">
    <h1>${title}</h1>
    <p class="ps-meta">${meta}　／　GuardFlow警備株式会社（デモ）</p>
    <table class="ps-table"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows}</table>
    <p class="ps-foot">${foot || '本帳票はデモデータにより自動生成されています。'}</p>
  </div>`;

/** 勤務実績表（日付×隊員） */
export function workReportHTML(date) {
  const list = state.shifts.filter(s => s.date === date);
  const rows = list.map(sh => {
    const g = state.guards.find(x => x.id === sh.guardId);
    const st = state.sites.find(x => x.id === sh.siteId);
    const w = wageOf(sh, g);
    return `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td><td>${esc(st.name)}</td>
      <td>${fmtAbs(w.s)}–${fmtAbs(w.e)}</td>
      <td style="text-align:right">${hrs(w.workMin)}</td>
      <td style="text-align:right">${w.nightMin ? hrs(w.nightMin) : '—'}</td>
      <td style="text-align:right">${w.otMin ? hrs(w.otMin) : '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="7">対象データなし</td></tr>';
  return P('勤 務 実 績 表', fmtMD(date), ['コード', '氏名', '配置先', '勤務時間', '実働(h)', '深夜(h)', '残業(h)'], rows);
}

/** 作業所別／得意先別 請求印刷 */
export function billSheetHTML(by, date) {
  const keyOf = st => by === 'client' ? st.client : st.name;
  const map = new Map();
  state.sites.forEach(st => {
    const n = state.shifts.filter(s => s.date === date && s.siteId === st.id).length;
    if (!n) return;
    const amt = n * (shiftMinutes(st.start, st.end) / 60) * st.bill;
    const k = keyOf(st);
    map.set(k, (map.get(k) || 0) + amt);
  });
  let sum = 0;
  const rows = [...map.entries()].map(([k, v]) => {
    sum += v;
    return `<tr><td>${esc(k)}</td><td style="text-align:right">${yen(v)}</td>
      <td style="text-align:right">${yen(v * 0.1)}</td><td style="text-align:right">${yen(v * 1.1)}</td></tr>`;
  }).join('') || '<tr><td colspan="4">対象データなし</td></tr>';
  const total = `<tr class="ps-net"><td><b>合計</b></td><td style="text-align:right"><b>${yen(sum)}</b></td>
    <td style="text-align:right"><b>${yen(sum * 0.1)}</b></td><td style="text-align:right"><b>${yen(sum * 1.1)}</b></td></tr>`;
  return P(by === 'client' ? '得意先別 請求一覧' : '作業所別 請求一覧', fmtMD(date),
    [by === 'client' ? '得意先' : '作業所', '請求額（税抜）', '消費税', '税込'], rows + total);
}

/** 入金一覧 */
export function depositListHTML() {
  let sum = 0;
  const rows = state.sites.map(st => {
    const n = state.shifts.filter(s => s.date === todayKey() && s.siteId === st.id).length;
    const amt = Math.round(n * (shiftMinutes(st.start, st.end) / 60) * st.bill * 1.1);
    if (!amt) return '';
    const paid = !!state.deposits[st.id];
    if (paid) sum += amt;
    return `<tr><td>${esc(st.client)}</td><td>${esc(st.name)}</td>
      <td style="text-align:right">${yen(amt)}</td><td>${paid ? '入金済' : '未入金'}</td></tr>`;
  }).join('') || '<tr><td colspan="4">対象データなし</td></tr>';
  return P('入 金 一 覧 表', fmtMD(todayKey()), ['得意先', '現場', '請求額（税込）', '状態'],
    rows + `<tr class="ps-net"><td colspan="2"><b>入金済 合計</b></td><td style="text-align:right"><b>${yen(sum)}</b></td><td></td></tr>`);
}

/** 給与一覧帳票 */
export function payListHTML(ym) {
  let T = { gross: 0, ded: 0, net: 0 };
  const rows = state.guards.map(g => {
    const p = calcPay(g, ym);
    T.gross += p.gross; T.ded += p.ded; T.net += p.net;
    return `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td>
      <td style="text-align:right">${p.days}</td><td style="text-align:right">${hrs(p.hours * 60)}</td>
      <td style="text-align:right">${yen(p.gross)}</td><td style="text-align:right">${yen(p.ded)}</td>
      <td style="text-align:right">${yen(p.net)}</td></tr>`;
  }).join('');
  const m = calcPay(state.guards[0], ym).month;
  return P('給 与 一 覧 表', m.replace('-', '年') + '月度',
    ['コード', '氏名', '出勤', '実働(h)', '総支給', '控除計', '差引支給'],
    rows + `<tr class="ps-net"><td colspan="4"><b>合計</b></td>
      <td style="text-align:right"><b>${yen(T.gross)}</b></td>
      <td style="text-align:right"><b>${yen(T.ded)}</b></td>
      <td style="text-align:right"><b>${yen(T.net)}</b></td></tr>`);
}

/** 給与明細書（全員ぶんを連続印刷） */
export function payslipAllHTML(ym) {
  return state.guards.map(g => payslipPrintHTML(g, ym)).join('<div style="page-break-after:always"></div>');
}

/** DM印刷（得意先宛の宛名ラベル） */
export function dmHTML() {
  const seen = new Set();
  const rows = state.sites.filter(s => !seen.has(s.client) && seen.add(s.client)).map(s =>
    `<tr><td>${esc(s.addrFull ? s.addrFull.slice(0, 3) : '')}</td><td>${esc(s.addrFull || s.addr)}</td>
     <td><b>${esc(s.client)}</b> 御中</td></tr>`).join('');
  return P('D M 印 刷（宛名一覧）', `${seen.size}件`, ['都道府県', '住所', '宛名'], rows,
    'フリガナ順（五十音）で出力されます。実機では郵便番号バーコードにも対応します。');
}

/** コードブック印刷（各マスタのコード一覧） */
export function codebookHTML() {
  const parts = Object.entries(MASTERS_REF()).map(([id, m]) => {
    const rows = (state.masters[id] || []).slice(0, 12);
    if (!rows.length) return '';
    const f = m.fields.slice(0, 3);
    return `<h2 class="cb-h">${esc(m.name)}</h2>
      <table class="ps-table"><tr>${f.map(x => `<th>${esc(x.l)}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>${f.map(x => `<td>${esc(x.t === 'chk' ? (r[x.k] ? '✓' : '') : (r[x.k] ?? ''))}</td>`).join('')}</tr>`).join('')}</table>`;
  }).join('');
  return `<div class="payslip"><h1>コ ー ド ブ ッ ク</h1>
    <p class="ps-meta">GuardFlow警備株式会社（デモ）</p>${parts}
    <p class="ps-foot">各マスタの先頭12件を抜粋しています。</p></div>`;
}
let _M = null;
export const setMastersRef = m => { _M = m; };
const MASTERS_REF = () => _M || {};

/** 有給関連印刷 */
export function paidHTML() {
  const grant = 14;
  let T = 0;
  const rows = state.guards.map(g => {
    const used = state.leaves.filter(l => l.guardId === g.id && l.status === 'approved').length;
    T += used;
    const must = Math.max(0, 5 - used);
    return `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td><td>${esc(g.office)}</td>
      <td style="text-align:right">${grant}</td><td style="text-align:right">${used}</td>
      <td style="text-align:right">${grant - used}</td><td>${must ? `あと${must}日` : '達成'}</td></tr>`;
  }).join('');
  return P('年 次 有 給 休 暇 管 理 簿', fmtMD(todayKey()),
    ['コード', '氏名', '拠点', '付与日数', '取得日数', '残日数', '年5日義務'], rows,
    '労働基準法第39条第7項に基づく年5日の取得義務の管理簿です（労基則24条の7・3年保存）。');
}
