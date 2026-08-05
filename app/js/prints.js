import { state } from './store.js';
import { esc, yen, fmtMD, shiftMinutes, hrs, fmtAbs, addDays } from './util.js';
import { periodRows, ganttPeriod, visibleGuards } from './gantt.js';

// ---- 給与明細（隊員アプリ/PC共通） ----
export function calcPay(g) {
  const j = g.june;
  const base = j.hours * g.rate;
  const night = Math.round(j.night * g.rate * 0.25);
  const ot = Math.round(j.ot * g.rate * 1.25);
  const transport = 8000;
  const gross = base + night + ot + transport;
  const health = Math.round(gross * 0.0495);
  const pension = Math.round(gross * 0.0915);
  const emp = Math.round(gross * 0.0055);
  const tax = Math.round(gross * 0.021);
  const ded = health + pension + emp + tax;
  return { base, night, ot, transport, gross, health, pension, emp, tax, ded, net: gross - ded };
}

export function payslipPrintHTML(g) {
  const p = calcPay(g);
  const tr = (k, v) => `<tr><td>${k}</td><td style="text-align:right">${yen(v)}</td></tr>`;
  return `
  <div class="payslip">
    <h1>給与支給明細書</h1>
    <p class="ps-meta">2026年6月度　／　GuardFlow警備株式会社（デモ）</p>
    <p class="ps-name">${esc(g.code)}　${esc(g.name)} 殿</p>
    <table class="ps-table">
      <tr><th colspan="2">勤怠</th></tr>
      <tr><td>出勤日数</td><td style="text-align:right">${g.june.days}日</td></tr>
      <tr><td>総労働時間</td><td style="text-align:right">${g.june.hours}時間（深夜${g.june.night}h／残業${g.june.ot}h）</td></tr>
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
