import { state, ui } from './store.js';
import {
  todayKey, addDays, fmtMD, esc, yen, parseHM, absMin, daysBetween,
  nightOverlap, nightBandsIn, subtractIntervals, fmtAbs, hrs, pad, fromKey,
  monthStart, daysInMonth, addMonths, fmtYM,
} from './util.js';

const guard = id => state.guards.find(g => g.id === id);
const site = id => state.sites.find(s => s.id === id);

// 現場の識別色。P型・D型色覚でも全ペアが識別できることを検証済み（ΔE基準クリア）
export const SITE_COLORS = ['#248fcc', '#9f4229', '#8e8b0f', '#764c9d', '#d77784'];
export const siteColor = id => {
  const i = state.sites.findIndex(s => s.id === id);
  return SITE_COLORS[(i < 0 ? 0 : i) % SITE_COLORS.length];
};

// 法定の割増率
const LEGAL_DAY_MIN = 480;   // 1日8時間
const OT_RATE = 0.25;        // 時間外 25%
const NIGHT_RATE = 0.25;     // 深夜 25%

/**
 * 1件のシフトについて、打刻から実働区間を組み立てる。
 * 戻り値の時刻はすべて「そのシフトの勤務日 0:00 からの絶対分」。
 * 打刻が無ければ予定時刻で代替し、source で区別する。
 */
export function workOf(sh) {
  const planS = parseHM(sh.start);
  let planE = parseHM(sh.end);
  if (planE <= planS) planE += 1440;            // 日跨ぎシフト

  // 打刻は絶対時刻なので日跨ぎは自然に1440超になる。補正は入れない
  const at = t => sh.punches.filter(x => x.type === t)
    .map(x => absMin(x.at, sh.date)).sort((a, b) => a - b);
  const ons = at('on'), offs = at('off');
  const on = ons.length ? ons[0] : null;                        // 最初の上番
  // 下番は「上番より後の最後のもの」。押し間違いで先に下番を押しても拾わない
  const later = on === null ? [] : offs.filter(m => m > on);
  const off = later.length ? later[later.length - 1] : null;

  const flags = [], notes = [];
  if (on !== null && offs.some(m => m <= on)) flags.push('上番より前の下番打刻あり');
  if (ons.length > 1) flags.push('上番の打刻が複数');
  if (later.length > 1) flags.push('下番の打刻が複数');

  let s, e, source;
  if (on !== null && off !== null) { s = on; e = off; source = 'actual'; }
  else if (on !== null) {                                       // 上番のみ＝勤務中
    s = on; e = Math.max(on, planE); source = 'partial';
    if (on > planE) flags.push('予定終了後の上番打刻');
  } else { s = planS; e = planE; source = 'plan'; }

  // 休憩開始／終了をペアにする
  const breaks = [];
  let open = null;
  sh.punches
    .filter(x => x.type === 'break_s' || x.type === 'break_e')
    .map(x => ({ t: x.type, m: absMin(x.at, sh.date) }))
    .sort((a, b) => a.m - b.m)
    .forEach(x => {
      if (x.t === 'break_s') { if (open === null) open = x.m; }
      else if (open !== null) { breaks.push([open, x.m]); open = null; }
    });
  if (open !== null) {
    if (source === 'actual') { breaks.push([open, e]); flags.push('休憩終了の打刻なし'); }
    else { e = Math.max(s, open); source = 'onbreak'; }         // 休憩中：開始までを実働として集計
  }

  // 打刻がまだ無い時間帯は、現場マスタの所定休憩を予定として差し引く
  const planned = state.sites.find(x => x.id === sh.siteId)?.brk || 0;
  if (planned && !breaks.length && source !== 'onbreak') {
    const mid = Math.round((planS + planE - planned) / 2 / 5) * 5;
    const b = [Math.max(s, mid), Math.min(e, mid + planned)];
    if (b[1] > b[0]) { breaks.push(b); notes.push(`所定休憩${planned}分を予定で控除（未打刻）`); }
  }

  const segs = subtractIntervals([[s, e]], breaks);
  return { s, e, planS, planE, segs, breaks, source, plannedBrk: planned, flags, notes };
}

/** シフト1件の賃金。基礎賃金は全実働に、割増は該当分にのみ加算する（労基法の積み上げ方式）。
 *  端数はこの1箇所だけで丸めるので、各列を足すと必ず支給額と一致する */
export function wageOf(sh, g = guard(sh.guardId)) {
  const w = workOf(sh);
  const workMin = w.segs.reduce((t, [a, b]) => t + (b - a), 0);
  const breakMin = (w.e - w.s) - workMin;
  const nightMin = w.segs.reduce((t, [a, b]) => t + nightOverlap(a, b), 0);
  const otMin = Math.max(0, workMin - LEGAL_DAY_MIN);
  const base = Math.round(workMin / 60 * g.rate);
  const otPay = Math.round(otMin / 60 * g.rate * OT_RATE);
  const nightPay = Math.round(nightMin / 60 * g.rate * NIGHT_RATE);

  // 労基法34条：6時間超は45分以上、8時間超は60分以上の休憩が必要
  const need = workMin > 480 ? 60 : workMin > 360 ? 45 : 0;
  const flags = [...w.flags];
  if (need && breakMin < need) flags.push(`休憩不足（${Math.floor(workMin / 60)}h勤務に${need}分必要／${breakMin}分）`);

  return { ...w, g, flags, notes: w.notes, workMin, breakMin, nightMin, otMin, base, otPay, nightPay, total: base + otPay + nightPay };
}

/** 表示単位。day14/day7 は日単位ボード、hour は1日の時間軸ガント */
export const UNITS = {
  month: { label: '月単位（1か月）' },
  day14: { label: '日単位（14日間）', days: 14 },
  day7: { label: '日単位（7日間）', days: 7 },
  hour: { label: '時間単位（1日）', days: 1 },
};

export function ganttPeriod() {
  const unit = UNITS[ui.ganttUnit] ? ui.ganttUnit : 'day14';
  if (unit === 'month') {
    const from = monthStart(ui.boardDate);
    return { from, days: daysInMonth(ui.boardDate), unit, week: true };
  }
  return { from: ui.boardDate, days: UNITS[unit].days, unit, week: UNITS[unit].days > 1 };
}

/** 絞り込み後の隊員リスト（拠点フィルタ） */
export const visibleGuards = () =>
  state.guards.filter(g => !ui.ganttOffice || g.office === ui.ganttOffice);

/** 期間内の全シフトを、隊員ごとにまとめて返す */
export function periodRows() {
  const { from, days } = ganttPeriod();
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const set = new Set(dates);
  const ok = new Set(visibleGuards().map(g => g.id));
  const byGuard = new Map();
  state.shifts
    .filter(sh => set.has(sh.date) && ok.has(sh.guardId) && (!ui.ganttSite || sh.siteId === ui.ganttSite))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .forEach(sh => {
      if (!byGuard.has(sh.guardId)) byGuard.set(sh.guardId, []);
      // ガント上の位置は「期間の初日0:00」を原点にそろえる
      const offset = daysBetween(from, sh.date) * 1440;
      byGuard.get(sh.guardId).push({ sh, offset, w: wageOf(sh) });
    });
  return { from, days, dates, byGuard, unit: ganttPeriod().unit };
}

/** 隊員の期間内サマリ：勤務日数・実働・賃金・最大連勤 */
function summarize(list, dates) {
  const worked = new Set(list.map(({ sh }) => sh.date));
  let run = 0, maxRun = 0;
  for (const d of dates) { run = worked.has(d) ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  const t = list.reduce((a, { w }) => ({
    work: a.work + w.workMin, night: a.night + w.nightMin,
    ot: a.ot + w.otMin, pay: a.pay + w.total,
  }), { work: 0, night: 0, ot: 0, pay: 0 });
  return { ...t, days: worked.size, maxRun, flags: [...new Set(list.flatMap(({ w }) => w.flags))] };
}

// ===================== 描画 =====================

const MIN_LANE = { day: 760, week: 1560 };   // レーンの最小幅（これを超えると横スクロール）

const WD = ['日', '月', '火', '水', '木', '金', '土'];

// 状態は「配置がどこまで進んだか」。凡例とバー色はこの1箇所で決まる
const STATE = {
  plan: ['予定', 'dg-plan'],       // 配置確定・打刻前
  work: ['勤務中', 'dg-work'],     // 上番済み
  brk: ['休憩中', 'dg-brk'],
  done: ['完了', 'dg-done'],       // 下番済み
  leave: ['休暇', 'dg-leave'],
};
const stateOf = w => w.source === 'actual' ? 'done'
  : w.source === 'onbreak' ? 'brk'
  : w.source === 'partial' ? 'work' : 'plan';

/** 「この日、誰がどこへ行くか」を一目で見るパネル。出発の早い順に並べる */
function todayPanel() {
  const date = ui.boardDate, isToday = date === todayKey();
  const guards = visibleGuards();
  const ok = new Set(guards.map(g => g.id));

  const list = state.shifts
    .filter(sh => sh.date === date && ok.has(sh.guardId) && (!ui.ganttSite || sh.siteId === ui.ganttSite))
    .map(sh => ({ sh, g: guard(sh.guardId), st: site(sh.siteId), w: wageOf(sh) }))
    .sort((a, b) => parseHM(a.sh.start) - parseHM(b.sh.start) || a.g.name.localeCompare(b.g.name, 'ja'));

  const onLeave = state.leaves.filter(l => l.date === date && l.status === 'approved' && ok.has(l.guardId));
  const busy = new Set([...list.map(x => x.g.id), ...onLeave.map(l => l.guardId)]);
  const free = guards.filter(g => !busy.has(g.id));
  const siteCount = new Set(list.map(x => x.sh.siteId)).size;

  const cards = list.map(({ sh, g, st, w }) => {
    const [label, cls] = STATE[stateOf(w)];
    return `<div class="tp-card" style="--c:${siteColor(sh.siteId)}" title="${esc(st.addrFull || st.addr)}">
      <div class="tp-top">
        <b class="tp-name">${esc(g.name)}</b>
        <span class="tp-st ${cls}">${label}</span>
      </div>
      <div class="tp-site">${esc(st.name)}${st.night ? ' 🌙' : ''}</div>
      <div class="tp-time">🕐 ${sh.start}〜${sh.end}${w.flags.length ? ' <span class="tp-warn">⚠</span>' : ''}</div>
      <div class="tp-addr">📍 ${esc(st.addr)}</div>
    </div>`;
  }).join('');

  return `<div class="pc-card tp">
    <div class="tp-head">
      <b>${fmtMD(date)} の行き先</b>
      ${isToday ? '<span class="pc-chip-today">今日</span>' : ''}
      <span class="tp-meta">出勤 ${list.length}名 ／ ${siteCount}現場${onLeave.length ? ` ・ 休暇 ${onLeave.length}名` : ''}${free.length ? ` ・ 未配置 ${free.length}名` : ''}</span>
    </div>
    <div class="tp-grid">${cards || '<span class="pc-muted">この日の配置はありません</span>'}</div>
    ${onLeave.length || free.length ? `<div class="tp-foot">
      ${onLeave.map(l => `<span class="tp-chip tp-chip-leave">休暇 ${esc(guard(l.guardId).name)}</span>`).join('')}
      ${free.map(g => `<span class="tp-chip">未配置 ${esc(g.name)}</span>`).join('')}
    </div>` : ''}
  </div>`;
}

/** 参照UI（貸渡予約表）と同じ構成の日単位ボード。行＝隊員、列＝日 */
function dayBoardView() {
  const { from, days, dates, byGuard, unit } = periodRows();
  const D0 = todayKey();
  const guards = visibleGuards();
  const compact = days > 20;          // 月表示：1文字マークで詰めて描く

  // 承認済みの休暇も帯として出す（人の予定表なので「働かない日」が見えることが重要）
  const leaveOf = new Map();
  state.leaves.filter(l => l.status === 'approved').forEach(l => {
    if (!leaveOf.has(l.guardId)) leaveOf.set(l.guardId, new Set());
    leaveOf.get(l.guardId).add(l.date);
  });

  const headCells = dates.map(d => {
    const dt = fromKey(d), w = dt.getDay();
    return `<div class="dg-h ${d === D0 ? 'dg-today' : ''} ${w === 0 ? 'dg-sun' : w === 6 ? 'dg-sat' : ''}">
      <b>${compact ? dt.getDate() : `${dt.getMonth() + 1}/${dt.getDate()}`}</b><span>${WD[w]}</span></div>`;
  }).join('');

  // 拠点ごとにグループ化して描く
  const offices = [...new Set(guards.map(g => g.office))];
  const groups = offices.map(office => {
    const rows = guards.filter(g => g.office === office).map(g => {
      const list = byGuard.get(g.id) || [];
      const sm = summarize(list, dates);

      const bg = dates.map(d => {
        const w = fromKey(d).getDay();
        return `<div class="dg-c ${d === D0 ? 'dg-today' : ''} ${w === 0 ? 'dg-sun' : w === 6 ? 'dg-sat' : ''}"></div>`;
      }).join('');

      // 休暇バー（配置より先に敷く）
      const lv = [...(leaveOf.get(g.id) || [])].filter(d => dates.includes(d)).map(d => {
        const col = daysBetween(from, d) + 2;
        return `<span class="dg-bar dg-leave" style="grid-column:${col}/span 1" title="${fmtMD(d)} 休暇（承認済）">${compact ? '休' : '休暇'}</span>`;
      }).join('');

      // 配置バー。日跨ぎ夜勤は2日ぶんに伸ばす
      const bars = list.map(({ sh, w }) => {
        const st = site(sh.siteId);
        const col = daysBetween(from, sh.date) + 2;
        const span = Math.min(Math.max(1, Math.ceil(w.planE / 1440)), days - col + 2);
        const [label, cls] = STATE[stateOf(w)];
        const tip = `${fmtMD(sh.date)} ${st.name}\n${sh.start}〜${sh.end}（${label}）\n`
          + `実働 ${hrs(w.workMin)}h`
          + (w.nightMin ? ` / 深夜 ${hrs(w.nightMin)}h` : '')
          + (w.otMin ? ` / 残業 ${hrs(w.otMin)}h` : '')
          + `\n賃金 ${yen(w.total)}`
          + (w.flags.length ? `\n⚠ ${w.flags.join(' / ')}` : '');
        return `<span class="dg-bar ${cls}" style="grid-column:${col}/span ${span};--c:${siteColor(sh.siteId)}"
          title="${esc(tip)}">${compact ? esc(st.mark || '●') : `${w.flags.length ? '⚠ ' : ''}${esc(st.abbr || st.name)}${st.night ? ' 🌙' : ''}`}</span>`;
      }).join('');

      const over = sm.maxRun >= 6;
      return `<div class="dg-row${compact ? ' dg-compact' : ''}" style="--days:${days}">
        <div class="dg-name">
          <b>${esc(g.name)}</b>
          <span class="dg-sub">${esc(g.code)} ／ ${yen(g.rate)}/h${g.quals.length ? ' ・ ' + esc(g.quals[0]) : ''}</span>
        </div>
        ${bg}${lv}${bars}
        <div class="dg-sum ${over ? 'dg-sum-warn' : ''}">
          <b>${sm.days}日</b>
          <span>${hrs(sm.work)}h${over ? ` ・ ${sm.maxRun}連勤 ⚠` : ''}</span>
          <span class="dg-pay">${yen(sm.pay)}</span>
        </div>
      </div>`;
    }).join('');

    return `<div class="dg-group${compact ? ' dg-compact' : ''}" style="--days:${days}">📍 ${esc(office)}</div>${rows}`;
  }).join('');

  return `
    ${toolbar()}
    ${todayPanel()}
    <div class="dg-legend">
      <span class="dg-lg-t">凡例:</span>
      ${Object.values(STATE).map(([l, c]) => `<span class="dg-lg"><i class="${c}"></i>${l}</span>`).join('')}
      ${compact
        ? `<span class="dg-lg dg-lg-sep">現場:</span>` + state.sites.map(s2 =>
            `<span class="dg-lg"><i class="dg-mk" style="background:${siteColor(s2.id)}">${esc(s2.mark)}</i>${esc(s2.abbr || s2.name)}</span>`).join('')
        : `<span class="dg-lg dg-lg-sep"><i class="dg-lg-night">🌙</i>日跨ぎ夜勤（2日にまたがって表示）</span>`}
    </div>
    <div class="dg-wrap">
      <div class="dg-table">
        <div class="dg-row dg-head${compact ? ' dg-compact' : ''}" style="--days:${days}">
          <div class="dg-name">隊員</div>${headCells}<div class="dg-sum">勤務 / 賃金</div>
        </div>
        ${groups || '<div class="gt-empty">該当する隊員がいません</div>'}
      </div>
    </div>`;
}

export function ganttView() {
  // 日単位（14日/7日）は参照UIと同じ日ボード、時間単位は1日の時間軸ガント
  if (ganttPeriod().unit !== 'hour') return dayBoardView() + wageTable();
  return hourGanttView() + wageTable();
}

/** 1日ぶんの時間軸ガント（予定と実働を上下に重ねて予実比較する） */
function hourGanttView() {
  const { from, days, dates, byGuard } = periodRows();
  const week = days > 1;

  // 時間軸の範囲を、実際に入っている勤務が全部収まるように決める。
  // 日跨ぎ夜勤で右に伸びるほか、前夜集合の打刻で左（負）にも伸びる
  let minStart = 0, maxEnd = days * 1440;
  byGuard.forEach(list => list.forEach(({ offset, w }) => {
    maxEnd = Math.max(maxEnd, offset + Math.max(w.e, w.planE));
    minStart = Math.min(minStart, offset + Math.min(w.s, w.planS));
  }));
  const t0 = Math.floor(minStart / 60) * 60;
  const t1 = Math.ceil(maxEnd / 60) * 60;
  const span = t1 - t0;

  // 位置は%で持つ。レーンは可変幅なので、軸の右端まで必ず画面内に収まる
  const x = m => ((m - t0) / span * 100).toFixed(3);
  const wpc = n => (n / span * 100).toFixed(3);

  // 目盛り：日表示は2時間ごと、週表示は日境界＋12:00のみ（潰れ防止）
  const step = week ? 720 : 120;
  const ticks = [];
  for (let m = Math.ceil(t0 / step) * step; m <= t1; m += step) {
    const dayIdx = Math.floor(m / 1440);
    const isDayStart = ((m % 1440) + 1440) % 1440 === 0;
    // 両端の目盛りは中央寄せだと見切れるので端に寄せる
    const edge = m === t0 ? ' gt-tick-first' : (m + step > t1 ? ' gt-tick-last' : '');
    ticks.push(`<span class="gt-tick${isDayStart ? ' gt-tick-day' : ''}${edge}" style="left:${x(m)}%">${
      isDayStart && dates[dayIdx] ? `<b>${fmtMD(dates[dayIdx])}</b>` : `${pad(Math.floor((((m % 1440) + 1440) % 1440) / 60))}:00`
    }</span>`);
  }
  const nightBg = nightBandsIn(t0, t1)
    .map(([a, b]) => `<span class="gt-night" style="left:${x(a)}%;width:${wpc(b - a)}%"></span>`).join('');
  const dayLines = Array.from({ length: days + 1 }, (_, i) =>
    `<span class="gt-dayline" style="left:${x(i * 1440)}%"></span>`).join('');

  // 隊員行
  const rows = visibleGuards()
    .filter(g => byGuard.has(g.id))
    .map(g => {
      const list = byGuard.get(g.id);
      const sum = list.reduce((a, { w }) => ({
        work: a.work + w.workMin, night: a.night + w.nightMin,
        ot: a.ot + w.otMin, pay: a.pay + w.total,
      }), { work: 0, night: 0, ot: 0, pay: 0 });

      const bars = list.map(({ sh, offset, w }) => {
        const st = site(sh.siteId), c = siteColor(sh.siteId);
        const tip = `${fmtMD(sh.date)} ${st.name}\n予定 ${sh.start}〜${sh.end}\n`
          + (w.source === 'plan' ? '打刻なし（予定で計算）' :
            `実績 ${fmtAbs(w.s)}〜${fmtAbs(w.e)}`
            + (w.source === 'partial' ? '（勤務中・予定終了で計算）' : w.source === 'onbreak' ? '（休憩中）' : ''))
          + (w.flags.length ? `\n⚠ ${w.flags.join(' / ')}` : '')
          + (w.notes.length ? `\nℹ ${w.notes.join(' / ')}` : '')
          + `\n実働 ${hrs(w.workMin)}h`
          + (w.breakMin ? ` / 休憩 ${w.breakMin}分` : '')
          + (w.nightMin ? ` / 深夜 ${hrs(w.nightMin)}h` : '')
          + (w.otMin ? ` / 残業 ${hrs(w.otMin)}h` : '')
          + `\n賃金 ${yen(w.total)}`;
        // 予定バー（上段）
        const plan = `<span class="gt-plan" style="left:${x(offset + w.planS)}%;width:${wpc(w.planE - w.planS)}%;--c:${c}" title="${esc(tip)}"></span>`;
        // 実働バー（下段）：休憩で分割された区間ごとに描く
        const act = w.source === 'plan' ? '' : w.segs.map(([a, b]) =>
          `<span class="gt-act" style="left:${x(offset + a)}%;width:${wpc(b - a)}%;background:${c}" title="${esc(tip)}"></span>`).join('');
        // ラベルは幅に余裕があるときだけ（週表示は潰れるので出さない）
        const label = !week && (w.planE - w.planS) / span > 0.12
          ? `<span class="gt-label" style="left:${x(offset + w.planS)}%">${esc(st.name.slice(0, 12))}</span>` : '';
        return plan + act + label;
      }).join('');

      return `<div class="gt-row">
        <div class="gt-name">
          <b>${esc(g.name)}</b>
          <span class="gt-sub">${yen(g.rate)}/h ・ 実働 ${hrs(sum.work)}h</span>
        </div>
        <div class="gt-lane" style="min-width:${MIN_LANE[week ? 'week' : 'day']}px">${nightBg}${dayLines}${bars}</div>
        <div class="gt-total">${yen(sum.pay)}</div>
      </div>`;
    }).join('');

  const unassigned = visibleGuards().filter(g => !byGuard.has(g.id));

  return `
    ${toolbar()}
    <div class="pc-card gt-card">
      <div class="gt-legend">
        ${state.sites.map(s => `<span class="gt-lg"><i style="background:${siteColor(s.id)}"></i>${esc(s.name)}</span>`).join('')}
        <span class="gt-lg gt-lg-sep"><i class="lg-plan"></i>予定</span>
        <span class="gt-lg"><i class="lg-act"></i>実働（打刻）</span>
        <span class="gt-lg"><i class="lg-night"></i>深夜帯 22:00–5:00</span>
      </div>
      <div class="gt-wrap">
        <div class="gt-inner">
          <div class="gt-row gt-row-head">
            <div class="gt-name">隊員</div>
            <div class="gt-lane gt-axis" style="min-width:${MIN_LANE[week ? 'week' : 'day']}px">${nightBg}${dayLines}${ticks.join('')}</div>
            <div class="gt-total">賃金</div>
          </div>
          ${rows || '<div class="gt-empty">この期間に配置された勤務はありません</div>'}
        </div>
      </div>
      ${unassigned.length ? `<p class="pc-muted small gt-foot">未配置：${unassigned.map(g => esc(g.name)).join('、')}</p>` : ''}
    </div>`;
}

/** 参照UIと同じ並びのフィルタ行：表示開始日／表示単位／拠点／現場 */
function toolbar() {
  const { from, days, unit } = ganttPeriod();
  const offices = [...new Set(state.guards.map(g => g.office))];
  return `<div class="dg-toolbar">
    <label>${unit === 'month' ? '基準日' : '表示開始日'}
      <input type="date" id="gantt-from" value="${ui.boardDate}">
    </label>
    <label>表示単位
      <select id="gantt-unit">
        ${Object.entries(UNITS).map(([k, v]) => `<option value="${k}" ${k === unit ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
    </label>
    <label>拠点
      <select id="gantt-office">
        <option value="">全拠点</option>
        ${offices.map(o => `<option value="${esc(o)}" ${o === ui.ganttOffice ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select>
    </label>
    <label>現場
      <select id="gantt-site">
        <option value="">全現場</option>
        ${state.sites.map(s => `<option value="${s.id}" ${s.id === ui.ganttSite ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
    </label>
    <span class="dg-nav">
      <b class="dg-period">${unit === 'month' ? fmtYM(from) : `${fmtMD(from)} 〜 ${fmtMD(addDays(from, days - 1))}`}</b>
      <button class="pc-btn" data-action="gantt-nav" data-dir="-1">◀</button>
      <button class="pc-btn" data-action="gantt-nav" data-dir="0">今日</button>
      <button class="pc-btn" data-action="gantt-nav" data-dir="1">▶</button>
    </span>
    <button class="pc-btn-navy" data-action="report-out" data-report="wage">🖨 時給計算表</button>
  </div>`;
}

// ---- ガントの下に出す時給計算表 ----
function wageTable() {
  const { byGuard, days } = periodRows();
  let T = { work: 0, brk: 0, night: 0, ot: 0, base: 0, np: 0, op: 0, total: 0 };

  const rows = visibleGuards().filter(g => byGuard.has(g.id)).map(g => {
    const list = byGuard.get(g.id);
    const a = list.reduce((t, { w }) => ({
      work: t.work + w.workMin, brk: t.brk + w.breakMin, night: t.night + w.nightMin,
      ot: t.ot + w.otMin, base: t.base + w.base, np: t.np + w.nightPay, op: t.op + w.otPay,
      total: t.total + w.total,
    }), { work: 0, brk: 0, night: 0, ot: 0, base: 0, np: 0, op: 0, total: 0 });
    Object.keys(T).forEach(k => T[k] += a[k]);

    const planOnly = list.every(({ w }) => w.source === 'plan');
    const rowFlags = [...new Set(list.flatMap(({ w }) => w.flags))];
    // 14日など長い期間は1件ずつ並べると読めないので現場ごとの日数に畳む
    let detail;
    if (days > 7) {
      const byS = new Map();
      list.forEach(({ sh }) => byS.set(sh.siteId, (byS.get(sh.siteId) || 0) + 1));
      detail = [...byS].map(([sid, n]) =>
        `<span class="wg-chip" style="--c:${siteColor(sid)}">${esc(site(sid).abbr || site(sid).name)} ×${n}日</span>`).join('');
    } else {
      detail = list.map(({ sh, w }) => {
        const st = site(sh.siteId);
        const mark = w.source === 'onbreak' ? ' ☕休憩中' : w.source === 'partial' ? ' ⏱勤務中' : '';
        return `<span class="wg-chip${w.flags.length ? ' wg-chip-warn' : ''}" style="--c:${siteColor(sh.siteId)}">${days > 1 ? fmtMD(sh.date) + ' ' : ''}${esc(st.abbr || st.name)} ${fmtAbs(w.s)}–${fmtAbs(w.e)}${mark}</span>`;
      }).join('');
    }

    return `<tr>
      <td>
        <b>${esc(g.name)}</b>${planOnly ? '<span class="pc-chip-muted">予定</span>' : ''}
        ${rowFlags.length ? `<span class="pc-chip-warn" title="${esc(rowFlags.join(' / '))}">⚠ 要確認</span>` : ''}
        <div class="wg-detail">${detail}</div>
        ${rowFlags.length ? `<div class="wg-flags">⚠ ${esc(rowFlags.join(' ／ '))}</div>` : ''}
      </td>
      <td class="num">${yen(g.rate)}</td>
      <td class="num">${hrs(a.work)}</td>
      <td class="num">${a.brk ? a.brk + '分' : '—'}</td>
      <td class="num">${a.night ? hrs(a.night) : '—'}</td>
      <td class="num">${a.ot ? hrs(a.ot) : '—'}</td>
      <td class="num">${yen(a.base)}</td>
      <td class="num">${a.np ? yen(a.np) : '—'}</td>
      <td class="num">${a.op ? yen(a.op) : '—'}</td>
      <td class="num"><b>${yen(a.total)}</b></td>
    </tr>`;
  }).join('');

  // 打刻の異常・法34条の休憩不足をまとめて先頭に出す（無警告で金額がずれるのを防ぐ）
  const alerts = [];
  visibleGuards().filter(g => byGuard.has(g.id)).forEach(g => {
    const f = [...new Set(byGuard.get(g.id).flatMap(({ w }) => w.flags))];
    if (f.length) alerts.push(`${g.name}：${f.join('／')}`);
  });

  return `
    <div class="pc-sec-head" style="margin-top:18px"><h2 style="font-size:16px;margin:0">ガントに基づく時給計算</h2></div>
    ${alerts.length ? `<div class="pc-banner-warn">⚠ 打刻・休憩に確認が必要な勤務が <b>${alerts.length}件</b> あります。金額はこのまま計算していますが、実態と突き合わせてください。
      <ul class="wg-alerts">${alerts.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    <div class="pc-kpi-row">
      <div class="pc-kpi"><b>${hrs(T.work)}h</b><span>実働合計</span></div>
      <div class="pc-kpi"><b>${hrs(T.night)}h</b><span>うち深夜</span></div>
      <div class="pc-kpi"><b>${hrs(T.ot)}h</b><span>うち残業</span></div>
      <div class="pc-kpi"><b>${yen(T.np + T.op)}</b><span>割増合計</span></div>
      <div class="pc-kpi"><b>${yen(T.total)}</b><span>人件費合計</span></div>
    </div>
    <div class="pc-card pc-table-wrap"><table class="pc-table wg-table">
      <thead><tr>
        <th>隊員 / 勤務</th><th class="num">時給</th><th class="num">実働(h)</th><th class="num">休憩</th>
        <th class="num">深夜(h)</th><th class="num">残業(h)</th>
        <th class="num">基本給</th><th class="num">深夜25%</th><th class="num">残業25%</th><th class="num">支給額</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="10" class="pc-muted">対象データがありません</td></tr>'}</tbody>
      ${rows ? `<tfoot><tr class="wg-total">
        <td><b>合計</b></td><td class="num">—</td>
        <td class="num"><b>${hrs(T.work)}</b></td><td class="num">${T.brk ? T.brk + '分' : '—'}</td>
        <td class="num"><b>${hrs(T.night)}</b></td><td class="num"><b>${hrs(T.ot)}</b></td>
        <td class="num">${yen(T.base)}</td><td class="num">${yen(T.np)}</td><td class="num">${yen(T.op)}</td>
        <td class="num"><b>${yen(T.total)}</b></td>
      </tr></tfoot>` : ''}
    </table></div>
    <p class="pc-muted small">
      実働＝下番−上番−休憩。上番は最初の打刻、下番は<b>上番より後の最後の打刻</b>を採用します（押し間違い対策）。
      上番のみの勤務は予定終了まで、休憩中は休憩開始まで、打刻が無い勤務は予定時刻で計算します。
      深夜は22:00〜翌5:00に重なる実働へ25%、残業は1日8時間超へ25%を加算。両方に該当する時間は合計50%増です。
      <br><b>このデモで未計算の割増：</b>週40時間超／法定休日労働35%／<b>月60時間超の残業50%（法37条1項ただし書・2023年4月から中小企業も対象）</b>。
      また割増の基礎賃金を時給のみで計算しているため、<b>資格手当など労基則21条の除外対象でない手当は未算入</b>です。
    </p>`;
}
