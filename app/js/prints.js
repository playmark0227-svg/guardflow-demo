import { state, masterRows } from './store.js?v=3';
import { esc, yen, fmtMD, shiftMinutes, hrs, fmtAbs, addDays, todayKey, toKey } from './util.js?v=3';
import { periodRows, ganttPeriod, visibleGuards, wageOf, hourlyOf, workKindOf, kindNo, billOf, billRateOf, needOf } from './gantt.js?v=3';

// ---- 給与明細（隊員アプリ/PC共通） ----
// 実際の勤務データ（打刻）から、指定月の給与を組み立てる
export function payMonths() {
  const ms = [...new Set(state.shifts.map(s => s.date.slice(0, 7)))].sort();
  return ms.length ? ms : [todayKey().slice(0, 7)];   // 勤務が無くても当月は選べる
}

// マスタから料率を引く。見つからないときだけ既定値に落とす
/** 自社マスタ。帳票の発行元はすべてここから引く（未登録なら空欄と分かる文言を出す） */
export const co = () => state.masters.company[0] || {};
const coName = () => co().name || '（自社マスタ未設定）';

const rateOf = (name, key, fb) => {
  const r = (state.masters.insurance || []).find(x => String(x.name || '').startsWith(name));
  return r ? Number(r[key]) / 100 : fb;
};
/** 月額所得税マスタから税額を引く（社会保険料控除後の金額で判定） */
export function incomeTax(afterIns) {
  const t = (state.masters.taxMonthly || []).find(x => x.from != null && afterIns >= Number(x.from) && (!x.to || afterIns < Number(x.to)));
  return t ? Number(t.tax) : 0;
};

/** 日額所得税マスタ（丙欄）から税額を引く */
export function dailyTax(afterInsPerDay) {
  const t = (state.masters.taxDaily || []).find(x => x.from != null && afterInsPerDay >= Number(x.from) && (!x.to || afterInsPerDay < Number(x.to)));
  return t ? Number(t.tax) : 0;
}

export function calcPay(g, ym) {
  if (!g) g = { id: '', name: '', quals: [], rate: 0 };     // 隊員未登録でも呼べるようにする
  const months = payMonths();
  const month = ym && months.includes(ym) ? ym : months[months.length - 1] || '';
  const list = state.shifts.filter(s => s.guardId === g.id && s.date.startsWith(month));
  const a = list.reduce((t, sh) => {
    const w = wageOf(sh, g);
    return { work: t.work + w.workMin, night: t.night + w.nightMin, ot: t.ot + w.otMin, hol: t.hol + w.holMin,
      base: t.base + w.base, np: t.np + w.nightPay, op: t.op + w.otPay, hp: t.hp + w.holPay };
  }, { work: 0, night: 0, ot: 0, hol: 0, base: 0, np: 0, op: 0, hp: 0 });

  const days = new Set(list.map(s => s.date)).size;
  const base = a.base, night = a.np, hol = a.hp;

  // 労基法37条1項但書：1か月60時間を超える時間外は50%（＝通常の25%に25%を上乗せ）
  const OT60 = 3600;                                   // 60時間 = 3600分
  const ot60Min = Math.max(0, a.ot - OT60);
  // 労基法32条1項：週40時間超も時間外。日8時間で既に数えた分は二重計上しない
  let weekExtra = 0;
  const byWeek = {};
  // 週締めマスタの締め曜日から週の起算日を決める（未設定なら月曜起算）
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const closeRow = (state.masters.weekClose || [])[0];
  const startDow = closeRow ? (DOW.indexOf(closeRow.day) + 1) % 7 : 1;
  list.forEach(sh => {
    const d = new Date(sh.date + 'T00:00:00');
    const top = new Date(d); top.setDate(d.getDate() - ((d.getDay() - startDow + 7) % 7));
    const k = toKey(top);
    const w = wageOf(sh, g);
    byWeek[k] = byWeek[k] || { work: 0, ot: 0, hol: 0 };
    byWeek[k].work += w.workMin; byWeek[k].ot += w.otMin; byWeek[k].hol += w.holMin;
  });
  const LEGAL_WEEK_MIN = 2400;                         // 週40時間
  Object.values(byWeek).forEach(w => {
    const weekly = w.work - w.hol;                     // 法定休日労働は週40hの計算に含めない
    weekExtra += Math.max(0, (weekly - LEGAL_WEEK_MIN) - w.ot);  // 日8h超で既に数えた分を差し引く
  });

  // 手当・控除入力の値。未入力なら支払項目／控除項目マスタの既定額を使う
  const mine = (state.allowances[month] || {})[g.id] || {};
  const allowRows = (state.masters.payItem || []).filter(x => x.kind === '固定').map(x => ({
    name: x.name, amount: Number(mine['p:' + x.name] ?? x.amount) || 0, base: !!x.base,
  })).filter(x => x.amount > 0);
  const otherRows = (state.masters.dedItem || []).filter(x => x.kind === '任意').map(x => ({
    name: x.name, amount: Number(mine['d:' + x.name] ?? 0) || 0,
  })).filter(x => x.amount > 0);
  // 資格マスタ：隊員が持つ資格の手当を自動で加算する（最高額の1件のみ＝重複支給しない）
  const qm = state.masters.qual || [];
  const qAllow = (g.quals || []).map(q => Number((qm.find(x => x.name === q) || {}).allow) || 0);
  const qMax = qAllow.length ? Math.max(...qAllow) : 0;
  if (qMax > 0) {
    const name = (g.quals || []).find(q => Number((qm.find(x => x.name === q) || {}).allow) === qMax);
    const i = allowRows.findIndex(x => x.name === '資格手当');
    if (i >= 0) allowRows[i] = { name: `資格手当（${name}）`, amount: qMax, base: true };
    else allowRows.push({ name: `資格手当（${name}）`, amount: qMax, base: true });
  } else {
    const i = allowRows.findIndex(x => x.name === '資格手当');
    if (i >= 0) allowRows.splice(i, 1);          // 無資格者には資格手当を付けない
  }
  const allow = allowRows.reduce((t, x) => t + x.amount, 0);
  const other = otherRows.reduce((t, x) => t + x.amount, 0);

  // 労基則21条：家族・通勤・別居・子女教育・住宅・臨時・1か月超の期間ごとの手当は割増基礎から除外。
  // 支払項目マスタで「割増基礎に算入」ONの手当だけを月額按分して基礎単価に上乗せする
  const baseAllow = allowRows.filter(x => x.base).reduce((t, x) => t + x.amount, 0);
  const addRate = a.work > 0 ? baseAllow / (a.work / 60) : 0;   // 時間あたりの上乗せ単価
  const otExtra = Math.round(addRate * ((a.ot - ot60Min) / 60) * 0.25)
    + Math.round(addRate * (a.night / 60) * 0.25)
    + Math.round(addRate * (a.hol / 60) * 0.35);
  const rate = hourlyOf(g);
  const ot60 = Math.round(ot60Min / 60 * (rate + addRate) * 0.50);   // 60h超は50%（25%分は下で控除）
  const otWeek = Math.round(weekExtra / 60 * (rate + addRate) * 1.25);
  const ot = a.op - Math.round(ot60Min / 60 * rate * 0.25) + otExtra; // 60h超の25%は ot60 に付け替え

  const transport = days * 600;                       // 実費相当（通勤手当は非課税・割増基礎から除外）
  const gross = base + night + ot + ot60 + otWeek + hol + allow + transport;
  const taxableBase = gross - transport;              // 通勤手当（実費）は課税対象外

  const health = Math.round(taxableBase * rateOf('健康保険', 'emp', 0.0495));
  const pension = Math.round(taxableBase * rateOf('厚生年金', 'emp', 0.0915));
  const emp = Math.round(taxableBase * rateOf('雇用保険', 'emp', 0.0055));
  // 隊員区分が日雇いなら源泉徴収は日額表（丙欄）。1日あたりで引いて日数分を積む
  const daily = /日雇/.test(g.gtype || '');
  const afterIns = taxableBase - health - pension - emp;
  const tax = daily ? dailyTax(days ? afterIns / days : 0) * days : incomeTax(afterIns);
  const ded = health + pension + emp + tax + other;
  return {
    month, months, days, hours: a.work / 60, nightH: a.night / 60, otH: a.ot / 60, holH: a.hol / 60,
    ot60H: ot60Min / 60, otWeekH: weekExtra / 60, baseAllow, addRate,
    base, night, ot, ot60, otWeek, hol, allow, allowRows, other, otherRows, transport, dailyTaxUsed: daily,
    gross, health, pension, emp, tax, ded, net: gross - ded,
  };
}

export function payslipPrintHTML(g, ym) {
  const p = calcPay(g, ym);
  const tr = (k, v) => `<tr><td>${k}</td><td style="text-align:right">${yen(v)}</td></tr>`;
  return `
  <div class="payslip">
    <h1>給与支給明細書</h1>
    <p class="ps-meta">${p.month.replace('-', '年')}月度　／　${esc(coName())}</p>
    <p class="ps-name">${esc(g.code)}　${esc(g.name)} 殿</p>
    <table class="ps-table">
      <tr><th colspan="2">勤怠</th></tr>
      <tr><td>出勤日数</td><td style="text-align:right">${p.days}日</td></tr>
      <tr><td>総労働時間</td><td style="text-align:right">${hrs(p.hours * 60)}時間（深夜${hrs(p.nightH * 60)}h／残業${hrs(p.otH * 60)}h${p.holH ? `／法定休日${hrs(p.holH * 60)}h` : ''}）</td></tr>
      <tr><th colspan="2">支給</th></tr>
      ${tr('基本給', p.base)}${tr('深夜手当（25%）', p.night)}${tr('時間外手当（25%）', p.ot)}
      ${p.ot60 ? tr(`時間外手当（月60h超・50%／${hrs(p.ot60H * 60)}h）`, p.ot60) : ''}
      ${p.otWeek ? tr(`時間外手当（週40h超／${hrs(p.otWeekH * 60)}h）`, p.otWeek) : ''}
      ${p.hol ? tr('法定休日手当（35%）', p.hol) : ''}
      ${p.allowRows.map(x => tr(x.name, x.amount)).join('')}
      ${tr('交通費', p.transport)}
      ${tr('総支払額', p.gross)}
      <tr><th colspan="2">控除</th></tr>
      ${tr('所得税', p.tax)}${tr('健康保険', p.health)}${tr('厚生年金', p.pension)}${tr('雇用保険', p.emp)}
      ${p.otherRows.map(x => tr(x.name, x.amount)).join('')}
      ${tr('控除計', p.ded)}
      <tr class="ps-net"><td><b>差引支給額</b></td><td style="text-align:right"><b>${yen(p.net)}</b></td></tr>
    </table>
    <p class="ps-foot">本明細はデモデータにより自動生成されています。</p>
  </div>`;
}

// ---- 請求書 ----
export function invoiceHTML(siteId, date) {
  const site = state.sites.find(s => s.id === siteId);
  if (!site) return empty('請 求 書', '配置先が登録されていないため、請求書を作成できません。マスタ管理 → 配置先マスタ から登録してください。');
  const b = billOf(site, date);
  const amount = b.work, tax = b.tax, hours = b.hours;
  const list = { length: b.n };
  return `
  <div class="payslip">
    <h1>請　求　書</h1>
    <p class="ps-meta">発行日：${fmtMD(date)}　／　${esc(coName())}</p>
    <p class="ps-name">${esc(site.client)} 御中</p>
    <p>件名：${esc(site.name)}（${site.kind}警備業務）</p>
    <table class="ps-table">
      <tr><th>摘要</th><th style="text-align:right">金額</th></tr>
      <tr><td>${fmtMD(date)}　警備員 ${list.length}名 × ${hours}h × @${b.rate.toLocaleString()}円</td><td style="text-align:right">${yen(amount)}</td></tr>
      ${b.items.map(x => `<tr><td>${esc(x.name)}</td><td style="text-align:right">${yen(x.amount)}</td></tr>`).join('')}
      <tr><td>消費税（10%）</td><td style="text-align:right">${yen(tax)}</td></tr>
      <tr class="ps-net"><td><b>合計金額</b></td><td style="text-align:right"><b>${yen(b.total)}</b></td></tr>
    </table>
    <p>${co().payerBank && co().payerAcct ? `お振込先：${esc(co().payerBank)}（普）${esc(co().payerAcct)}　${esc(co().kana || co().name || '')}` : ''}</p>
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
    <p class="ps-meta">対象期間：${period}　／　${esc(coName())}</p>
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
    <p class="ps-meta">${esc(coName())}　／　作成日：自動生成</p>
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
    const wx = (state.weatherLog[date] || {})[site.id] || '—';
    return `<tr><td>${esc(site.name)}</td><td>${site.start}〜${site.end}</td><td style="text-align:right">${list.length}/${needOf(site, date)}名</td><td>${esc(wx)}</td><td>${esc(names)}</td></tr>`;
  }).join('');
  return `
  <div class="payslip">
    <h1>配置予定表</h1>
    <p class="ps-meta">${fmtMD(date)}　／　${esc(coName())}</p>
    <table class="ps-table">
      <tr><th>現場</th><th>時間</th><th>人数</th><th>天候</th><th>配置隊員</th></tr>
      ${rows}
    </table>
    <p class="ps-foot">本帳票はデモデータにより自動生成されています。</p>
  </div>`;
}

// ---- 実機メニューに対応する帳票群 ----
/** 対象データが無いときの帳票。白紙ではなく、次に何をすればよいかを刷る */
const empty = (title, msg) => `
  <div class="payslip">
    <h1>${title}</h1>
    <p class="ps-meta">${fmtMD(todayKey())}　／　${esc(coName())}</p>
    <p style="margin:28px 0;padding:18px;border:1px dashed #bbb;border-radius:6px;color:#666">${msg}</p>
  </div>`;

const P = (title, meta, head, rows, foot) => `
  <div class="payslip">
    <h1>${title}</h1>
    <p class="ps-meta">${meta}　／　${esc(coName())}</p>
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
    const dn = state.options.dayNight
      ? `<td>${esc(workKindOf(sh).dn || (st.night ? '夜' : '昼'))}</td>` : '';
    return `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td><td>${esc(st.name)}</td>${dn}
      <td>${fmtAbs(w.s)}–${fmtAbs(w.e)}</td>
      <td style="text-align:right">${hrs(w.workMin)}</td>
      <td style="text-align:right">${w.nightMin ? hrs(w.nightMin) : '—'}</td>
      <td style="text-align:right">${w.otMin ? hrs(w.otMin) : '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="7">対象データなし</td></tr>';
  return P('勤 務 実 績 表', fmtMD(date),
    ['コード', '氏名', '配置先', ...(state.options.dayNight ? ['昼夜'] : []), '勤務時間', '実働(h)', '深夜(h)', '残業(h)'], rows);
}

/** 作業所別／得意先別 請求印刷 */
export function billSheetHTML(by, date) {
  const keyOf = st => by === 'client' ? st.client : st.name;
  const map = new Map();
  state.sites.forEach(st => {
    const b = billOf(st, date);
    if (!b.n) return;
    const amt = b.sub;
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
  const m = state.guards.length ? calcPay(state.guards[0], ym).month : (ym || payMonths()[0]);
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
  const list = state.clients.length ? state.clients
    : state.sites.filter(s => !seen.has(s.client) && seen.add(s.client)).map(s => ({ name: s.client, addr: s.addrFull || s.addr }));
  if (!list.length) return empty('D M 印 刷（宛名一覧）', '得意先が登録されていません。マスタ管理 → 得意先マスタ から登録してください。');
  const rows = list.map(c =>
    `<tr><td>${esc((c.addr || '').slice(0, 3))}</td><td>${esc(c.addr || '')}</td>
     <td><b>${esc(c.name)}</b> ${esc(c.honor || '御中')}</td></tr>`).join('');
  return P('D M 印 刷（宛名一覧）', `${list.length}件`, ['都道府県', '住所', '宛名'], rows,
    'フリガナ順（五十音）で出力されます。実機では郵便番号バーコードにも対応します。');
}

/** コードブック印刷（各マスタのコード一覧） */
export function codebookHTML() {
  const parts = Object.entries(MASTERS_REF()).map(([id, m]) => {
    const rows = masterRows(id).slice(0, 12);
    if (!rows.length) return '';
    const f = m.fields.slice(0, 3);
    return `<h2 class="cb-h">${esc(m.name)}</h2>
      <table class="ps-table"><tr>${f.map(x => `<th>${esc(x.l)}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>${f.map(x => `<td>${esc(x.t === 'chk' ? (r[x.k] ? '✓' : '') : (r[x.k] ?? ''))}</td>`).join('')}</tr>`).join('')}</table>`;
  }).join('');
  return `<div class="payslip"><h1>コ ー ド ブ ッ ク</h1>
    <p class="ps-meta">${esc(coName())}</p>${parts}
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

// ---- 管制日報（警備業法施行規則63条の警備業務実施状況の記録）----
export function nippoHTML(date, band) {
  // オプション「日報を昼夜で分割」ON なら昼勤・夜勤を別ページで出す
  if (state.options.nippoSplit && !band)
    return nippoHTML(date, '昼') + '<div style="page-break-before:always"></div>' + nippoHTML(date, '夜');
  const rows = state.sites.filter(st => {
    if (!band) return true;
    const wk = (state.masters.work || []).find(w => w.name === st.work) || {};
    return (wk.dn || (st.night ? '夜' : '昼')) === band;
  }).map(st => {
    const list = state.shifts.filter(s => s.date === date && s.siteId === st.id);
    if (!list.length) return '';
    const wx = (state.weatherLog[date] || {})[st.id] || '—';
    const body = list.map(sh => {
      const g = state.guards.find(x => x.id === sh.guardId);
      const w = wageOf(sh, g);
      const evt = [...w.flags, ...w.notes].join('／') || '異常なし';
      return `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td>
        <td>${fmtAbs(w.s)}–${fmtAbs(w.e)}</td>
        <td style="text-align:right">${hrs(w.workMin)}h</td>
        <td>${esc(evt)}</td></tr>`;
    }).join('');
    return `<tr class="np-site"><td colspan="5"><b>${esc(st.name)}</b>　${st.start}〜${st.end}　天候：${esc(wx)}　
      配置 ${list.length}/${needOf(st, date)}名　${esc(st.addrFull || st.addr || '')}</td></tr>${body}`;
  }).join('') || '<tr><td colspan="5">この日の勤務はありません</td></tr>';
  return P(`管 制 日 報${band ? `（${band}勤）` : ''}`, fmtMD(date), ['コード', '隊員名', '上下番', '実働', '特記事項'], rows,
    '警備業法施行規則第63条の記録として、現場・時間帯・従事した警備員・特記事項を残します。');
}

// ---- 教育実施簿（警備業法21条／規則38条）----
export function eduSheetHTML() {
  if (!state.education.length) return empty('教 育 実 施 簿', '教育記録がまだ登録されていません。教育管理から実施状況を登録してください。');
  const rows = state.education.map(e => {
    const g = state.guards.find(x => x.name === e.guardName)
      || state.guards.find(x => x.id === e.guardId) || { name: e.guardName || '' };
    const short = Number(e.done) < Number(e.required);
    return `<tr><td>${esc(g.code || '')}</td><td>${esc(g.name || '')}</td><td>${esc(g.office || '')}</td>
      <td>${esc(e.type || '')}</td>
      <td>${esc(e.at || '')}</td>
      <td style="text-align:right">${Number(e.required) || 0}h</td>
      <td style="text-align:right">${Number(e.done) || 0}h</td>
      <td style="text-align:right">${short ? `<b>未了 ${Number(e.required) - Number(e.done)}h</b>` : '完了'}</td></tr>`;
  }).join('');
  const left = state.education.filter(e => Number(e.done) < Number(e.required)).length;
  return P('教 育 実 施 簿', `${todayKey().slice(0, 4)}年度　未了 ${left}名`,
    ['コード', '氏名', '所属', '区分', '直近実施日', '法定時間', '実施時間', '状況'], rows,
    '警備業法第21条・同施行規則第38条の教育記録。備付書類として3年間保存します。');
}

// ---- 賃金台帳（労基法108条・規則54条）----
export function chinginHTML(ym) {
  const rows = state.guards.map(g => {
    const p = calcPay(g, ym);
    return `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td>
      <td style="text-align:right">${p.days}</td>
      <td style="text-align:right">${p.hours.toFixed(1)}</td>
      <td style="text-align:right">${p.otH.toFixed(1)}</td>
      <td style="text-align:right">${p.nightH.toFixed(1)}</td>
      <td style="text-align:right">${p.holH.toFixed(1)}</td>
      <td style="text-align:right">${yen(p.base)}</td>
      <td style="text-align:right">${yen(p.ot + p.ot60 + p.otWeek + p.night + p.hol)}</td>
      <td style="text-align:right">${yen(p.allow + p.transport)}</td>
      <td style="text-align:right">${yen(p.gross)}</td>
      <td style="text-align:right">${yen(p.ded)}</td>
      <td style="text-align:right"><b>${yen(p.net)}</b></td></tr>`;
  }).join('');
  const m = state.guards.length ? calcPay(state.guards[0], ym).month : (ym || payMonths()[0]);
  return P('賃 金 台 帳', `${m.replace('-', '年')}月分`,
    ['コード', '氏名', '労働日数', '労働時間', '時間外', '深夜', '休日', '基本給', '割増賃金', '手当', '総支給', '控除', '差引支給'], rows,
    '労働基準法第108条・同施行規則第54条の必要記載事項を満たす様式です。第109条により3年間保存してください。');
}

// ---- 警備契約書（警備業法19条の書面交付）----
export function contractHTML(siteId) {
  const st = state.sites.find(s => s.id === siteId) || state.sites[0];
  if (!st) return empty('警 備 契 約 書', '配置先が登録されていないため、契約書を作成できません。マスタ管理 → 得意先マスタ、配置先マスタ の順に登録してください。');
  const cl = state.clients.find(c => c.name === st.client) || {};
  const kind = `${kindNo(st) || '1号'}警備契約書`;
  const tpl = (state.masters.contract || []).filter(x => x.kind === kind);
  // 契約書の雛形に、その配置先の実データを差し込む
  const fill = (item, body) => {
    if (/名称及び所在地|場所/.test(item)) return `${st.name}${st.addrFull || st.addr ? `（${st.addrFull || st.addr}）` : ''}`;
    if (/人員/.test(item)) return `${st.need}名${st.reqQual ? `（うち${st.reqQual}保有者1名以上）` : ''}`;
    if (/知識及び技能/.test(item) && st.reqQual) return `${st.reqQual}の合格者を1名以上配置`;
    if (/日及び時間帯/.test(item)) return `${st.start}〜${st.end}${st.night ? '（深夜帯を含む）' : ''}`;
    if (/料金/.test(item)) return `1人1時間あたり ${Number(billRateOf(st)).toLocaleString()}円（税別）。${cl.close || '月末'}締め、${cl.payDay || '月末'}${cl.payType || '振込'}`;
    return body || '（別途協議）';
  };
  const rows = tpl.map(x => `<tr><td style="width:34px;text-align:right">${esc(x.no)}</td>
    <td style="width:230px">${esc(x.item)}</td><td>${esc(fill(x.item, x.body))}</td></tr>`).join('')
    || '<tr><td colspan="3">警備契約書マスタに雛形がありません</td></tr>';
  return `
  <div class="payslip">
    <h1>${esc(kind)}</h1>
    <p class="ps-meta">${fmtMD(todayKey())}　／　警備業法第19条に基づく書面</p>
    <p class="ps-name">${esc(st.client)} ${esc(cl.honor || '御中')}</p>
    <p>下記のとおり警備業務の委託契約を締結します。</p>
    <table class="ps-table"><tr><th>項番</th><th>記載事項</th><th>内容</th></tr>${rows}</table>
    <p style="margin-top:18px">受託者：${esc(coName())}${co().permit ? '　' + esc(co().permit) : ''}</p>
    <p class="ps-foot">警備業法第19条は、契約締結前と締結時の2度の書面交付を義務づけています。本書はデモデータによる自動生成です。</p>
  </div>`;
}
