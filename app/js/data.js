import { todayKey, addDays, fromKey, uid } from './util.js';
import { seedMasters } from './masters.js';

// デモ用シードデータ。日付は常に「今日」を基準に生成する
export function seedData() {
  const D0 = todayKey();
  const D = n => addDays(D0, n);

  const guards = [
    { id: 'g1', code: '000001', office: '横浜本店', name: '三浦 大輝', age: 32, rate: 1400, quals: ['交通誘導2級'], june: { days: 21, hours: 168, night: 32, ot: 6 } },
    { id: 'g2', code: '000002', office: '横浜本店', name: '佐藤 健一', age: 45, rate: 1500, quals: ['施設警備2級', '指導教育責任者(2号)'], june: { days: 22, hours: 176, night: 0, ot: 4 } },
    { id: 'g3', code: '000003', office: '横浜本店', name: '田中 実', age: 58, rate: 1250, quals: [], pairNG: ['g4'], june: { days: 20, hours: 160, night: 0, ot: 0 } },
    { id: 'g4', code: '000004', office: '横浜本店', name: '山口 剛', age: 51, rate: 1250, quals: [], pairNG: ['g3'], caution: '遅刻傾向あり。前日夜に電話確認を推奨（2026/5 管制メモ）', june: { days: 18, hours: 144, night: 8, ot: 2 } },
    { id: 'g5', code: '000005', office: '川崎営業所', name: '鈴木 一郎', age: 68, rate: 1300, quals: ['交通誘導2級'], siteNG: { s1: '2025年11月、服装の乱れにより現場監督より交代要請。以後配置禁止。' }, june: { days: 19, hours: 152, night: 40, ot: 0 } },
    { id: 'g6', code: '000006', office: '川崎営業所', name: '渡辺 直子', age: 41, rate: 1350, quals: ['施設警備2級'], june: { days: 21, hours: 168, night: 0, ot: 5 } },
    { id: 'g7', code: '000007', office: '川崎営業所', name: '高橋 修', age: 72, rate: 1250, quals: [], june: { days: 16, hours: 128, night: 56, ot: 0 } },
    { id: 'g8', code: '000008', office: '川崎営業所', name: '伊藤 蓮', age: 24, rate: 1300, quals: [], rookie: true, june: { days: 15, hours: 120, night: 0, ot: 0 } },
    { id: 'g9', code: '000009', office: '都筑営業所', name: '小林 誠', age: 49, rate: 1600, quals: ['交通誘導1級'], june: { days: 22, hours: 176, night: 12, ot: 10 } },
    { id: 'g10', code: '000010', office: '都筑営業所', name: '加藤 里奈', age: 29, rate: 1400, quals: ['施設警備2級'], june: { days: 20, hours: 160, night: 0, ot: 3 } },
    { id: 'g11', code: '000011', office: '都筑営業所', name: '中村 豊', age: 63, rate: 1250, quals: [], paidLeaveLeft: 0, june: { days: 21, hours: 168, night: 62, ot: 0 } },
    { id: 'g12', code: '000012', office: '都筑営業所', name: '斎藤 悠人', age: 35, rate: 1450, quals: ['交通誘導2級'], june: { days: 22, hours: 176, night: 20, ot: 8 } },
  ];

  const sites = [
    { id: 's1', name: '青葉台タワー 施設警備', mark: '青', abbr: '青葉台タワー', kind: '1号', start: '08:00', end: '20:00', brk: 60, need: 2, reqQual: '施設警備2級', bill: 2400, addr: '横浜市青葉区', client: '青葉台タワーマネジメント株式会社', addrFull: '神奈川県横浜市青葉区青葉台1-2-3', note1: '防災センターに直行。入館証は警備室で受領', note2: '制服は施設Aタイプ' },
    { id: 's2', name: '環状2号線 道路改良工事', mark: '環', abbr: '環状2号線', kind: '2号', start: '08:00', end: '17:00', brk: 60, need: 4, reqQual: '交通誘導2級', bill: 2100, addr: '横浜市港北区', client: '株式会社ケイヒン道路建設', addrFull: '神奈川県横浜市港北区新横浜2-8-1 先', note1: '朝礼は7:45。ヘルメット持参', note2: '雨天時は現場監督の指示に従う' },
    { id: 's3', name: 'みなとみらい夏祭り 雑踏警備', mark: '祭', abbr: 'MM夏祭り', kind: '2号', start: '16:00', end: '22:00', brk: 0, need: 5, bill: 2300, addr: '横浜市西区', client: 'みなとみらいイベント実行委員会', addrFull: '神奈川県横浜市西区みなとみらい2-3', note1: '本部テント前に15:30集合', note2: '誘導灯は本部で貸与' },
    { id: 's4', name: '港北物流センター 夜間警備', mark: '港', abbr: '港北物流(夜)', kind: '1号', start: '20:00', end: '08:00', brk: 60, need: 2, bill: 2600, addr: '横浜市都筑区', night: true, client: '港北ロジスティクス株式会社', addrFull: '神奈川県横浜市都筑区東方町180', note1: '夜間出入口は東側のみ', note2: '' },
    { id: 's5', name: '首都高 夜間補修規制', mark: '首', abbr: '首都高(夜)', kind: '2号', start: '00:00', end: '06:00', brk: 0, need: 3, reqQual: '交通誘導2級', bill: 2800, addr: '横浜市神奈川区', night: true, note: '勤務日0:00開始・前夜集合', client: '首都高速道路メンテナンス株式会社', addrFull: '神奈川県横浜市神奈川区金港町3-1 先', note1: '規制帯設置は0:00ちょうど。前夜23:30に資材置場集合', note2: '保安資材はトラックで搬入済み' },
  ];

  const shifts = [];
  const geo = () => ({ lat: +(35.44 + Math.random() * 0.03).toFixed(5), lng: +(139.6 + Math.random() * 0.05).toFixed(5), acc: 8 + Math.floor(Math.random() * 20) });
  // 打刻は「勤務日0:00からの絶対分」で渡す。1440を超える値は自動的に翌日の時刻になる
  const mk = (date, siteId, guardId, punches = []) => {
    const site = sites.find(s => s.id === siteId);
    const base = fromKey(date).getTime();
    shifts.push({
      id: uid('sh'), date, siteId, guardId, start: site.start, end: site.end,
      punches: punches.map(([type, m]) => ({ type, at: new Date(base + m * 60000).toISOString(), ...geo() })),
    });
  };

  // ---- 3週間ぶんの配置をローテーションで生成（前後2週間を見渡せるように） ----
  // off: 休みの曜日（0=日）／only: その曜日だけ稼働
  const plan = [
    { g: 'g2',  s: 's1', off: [0] },
    { g: 'g10', s: 's1', off: [6] },
    { g: 'g9',  s: 's2', off: [0] },
    { g: 'g12', s: 's2', off: [3] },
    { g: 'g3',  s: 's2', off: [0, 6] },
    { g: 'g5',  s: 's2', off: [2] },
    { g: 'g7',  s: 's4', off: [0, 1] },
    { g: 'g11', s: 's4', off: [2, 3] },
    { g: 'g1',  s: 's3', only: [3, 5, 6] },
    { g: 'g6',  s: 's3', only: [3, 5, 6] },
    { g: 'g4',  s: 's3', only: [5, 6] },
    { g: 'g8',  s: 's3', only: [5, 6] },
    { g: 'g1',  s: 's5', only: [4] },
    { g: 'g5',  s: 's5', only: [4] },
    { g: 'g12', s: 's5', only: [4] },
  ];
  // 打刻時刻の小さなブレを日付と隊員から決定的に作る（スクリーンショットを安定させる）
  const jit = (i, g, w) => Math.abs(i * 7 + g.charCodeAt(1) * 3) % w;

  for (let i = -14; i <= 14; i++) {
    const date = D(i), dow = fromKey(date).getDay();
    for (const p of plan) {
      if (p.off && p.off.includes(dow)) continue;
      if (p.only && !p.only.includes(dow)) continue;
      const st = sites.find(x => x.id === p.s);
      const sM = Number(st.start.slice(0, 2)) * 60 + Number(st.start.slice(3));
      const eM0 = Number(st.end.slice(0, 2)) * 60 + Number(st.end.slice(3));
      const eM = eM0 > sM ? eM0 : eM0 + 1440;        // 日跨ぎは1440を足した絶対分で扱う
      const brk = st.brk || 0;
      const mid = Math.round((sM + eM - brk) / 2 / 5) * 5;
      const onM = sM + jit(i, p.g, 5);               // 定刻〜4分後に上番
      const offM = eM - jit(i, p.g, 4);              // 定刻〜3分前に下番

      let punches = [];
      if (i < 0) {                                   // 過去：完了済み
        punches = [
          ['depart', sM - 60 - jit(i, p.g, 9)],
          ['on', onM],
          ...(brk ? [['break_s', mid], ['break_e', mid + brk]] : []),
          ['off', offM],
        ];
      } else if (i === 0 && sM < 720) {              // 今日の日勤：勤務中
        punches = [
          ['depart', sM - 60 - jit(i, p.g, 9)],
          ['on', onM],
          ...(brk ? [['break_s', mid], ['break_e', mid + brk]] : []),
        ];
      }
      mk(date, p.s, p.g, punches);
    }
  }
  // 今日の s1 は1名だけ未出発にして、上下番モニターのアラートを再現する
  const noShow = shifts.find(x => x.date === D0 && x.siteId === 's1' && x.guardId === 'g10');
  if (noShow) noShow.punches = [];
  // 昨日の1件は下番の打刻漏れ（チェック漏れのデモ）
  const miss = shifts.find(x => x.date === D(-1) && x.guardId === 'g3');
  if (miss) miss.punches = miss.punches.filter(x => x.type !== 'off');

  const education = [
    { guardId: 'g1', type: '現任', required: 10, done: 8 },
    { guardId: 'g2', type: '現任', required: 10, done: 10 },
    { guardId: 'g3', type: '現任', required: 10, done: 3 },
    { guardId: 'g4', type: '現任', required: 10, done: 6 },
    { guardId: 'g5', type: '現任', required: 10, done: 7 },
    { guardId: 'g6', type: '現任', required: 10, done: 9 },
    { guardId: 'g7', type: '現任', required: 10, done: 4 },
    { guardId: 'g8', type: '新任', required: 20, done: 12 },
    { guardId: 'g9', type: '現任', required: 10, done: 10 },
    { guardId: 'g10', type: '現任', required: 10, done: 8 },
    { guardId: 'g11', type: '現任', required: 10, done: 5 },
    { guardId: 'g12', type: '現任', required: 10, done: 6 },
  ];

  const notices = [
    { id: uid('n'), cat: '本社', title: '熱中症対策の徹底について', body: '7月中は1時間ごとの水分補給と塩分タブレットの携行を徹底してください。体調不良時は無理せず管制へ連絡を。', at: `${D(-1)}T09:00:00`, from: '本社' },
    { id: uid('n'), cat: 'バージョンアップのお知らせ', title: '隊員アプリ【Version 2.1.4】', body: '勤怠報告画面の安定性を改善しました。', at: `${D(-3)}T17:04:36`, from: 'システム' },
    { id: uid('n'), cat: '本社', title: '感謝状の贈呈について', body: '巡回中の隊員が遺失物を発見し、施設様より感謝状をいただきました。', at: `${D(-7)}T10:00:00`, from: '本社' },
  ];

  const leaves = [
    { id: uid('lv'), guardId: 'g6', date: D(4), reason: '私用のため', status: 'pending', at: `${D0}T08:30:00` },
    { id: uid('lv'), guardId: 'g1', date: D(9), reason: '通院のため', status: 'approved', at: `${D(-2)}T18:00:00` },
    { id: uid('lv'), guardId: 'g1', date: D(12), reason: '私用のため', status: 'nego', at: `${D(-1)}T12:00:00` },
  ];

  return {
    seedDate: D0, offline: false, guards, sites, shifts, education, notices, leaves,
    avail: {}, deposits: { s1: true, s2: true },
    masters: seedMasters(),
    orders: {}, allowances: {}, bonus: { date: D(20), name: '夏季賞与', amount: {} },
    options: { nippoSplit: false, dayNight: true, taxIn: false, autoHour: true, blockPaid: true, warnRun: true },
  };
}
