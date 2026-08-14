import { todayKey, addDays, fromKey, uid } from './util.js';
import { seedMasters } from './masters.js';

// デモ用データ。日付は常に「今日」を基準に生成する
export function demoData() {
  const D0 = todayKey();
  const D = n => addDays(D0, n);

  const guards = [
    { id: 'g1', code: '000001', hiredAt: '2019-04-01', office: '横浜本店', rateRank: 'B', name: '三浦 大輝', kana: 'ﾐｳﾗ ﾀﾞｲｷ', bank: '0138', branch: '201', acct: '1000001', age: 32, rate: 1400, quals: ['交通誘導警備業務2級'], june: { days: 21, hours: 168, night: 32, ot: 6 } },
    { id: 'g2', code: '000002', hiredAt: '2012-06-15', office: '横浜本店', rateRank: 'A', name: '佐藤 健一', kana: 'ｻﾄｳ ｹﾝｲﾁ', bank: '0138', branch: '201', acct: '1000002', age: 45, rate: 1500, quals: ['施設警備業務2級', '警備員指導教育責任者(2号)'], june: { days: 22, hours: 176, night: 0, ot: 4 } },
    { id: 'g3', code: '000003', hiredAt: '2023-09-01', office: '横浜本店', rateRank: 'C', name: '田中 実', kana: 'ﾀﾅｶ ﾐﾉﾙ', bank: '0138', branch: '201', acct: '1000003', age: 58, rate: 1250, quals: [], pairNG: ['g4'], june: { days: 20, hours: 160, night: 0, ot: 0 } },
    { id: 'g4', code: '000004', hiredAt: '2021-03-16', office: '横浜本店', name: '山口 剛', kana: 'ﾔﾏｸﾞﾁ ﾂﾖｼ', bank: '0138', branch: '201', acct: '1000004', age: 51, rate: 1250, quals: [], pairNG: ['g3'], caution: '遅刻傾向あり。前日夜に電話確認を推奨（2026/5 管制メモ）', june: { days: 18, hours: 144, night: 8, ot: 2 } },
    { id: 'g5', code: '000005', hiredAt: '2016-11-01', office: '川崎営業所', rateRank: 'D', name: '鈴木 一郎', kana: 'ｽｽﾞｷ ｲﾁﾛｳ', bank: '0138', branch: '201', acct: '1000005', age: 68, rate: 1300, quals: ['交通誘導警備業務2級'], siteNG: { s1: '2025年11月、服装の乱れにより現場監督より交代要請。以後配置禁止。' }, june: { days: 19, hours: 152, night: 40, ot: 0 } },
    { id: 'g6', code: '000006', hiredAt: '2020-07-01', office: '川崎営業所', name: '渡辺 直子', kana: 'ﾜﾀﾅﾍﾞ ﾅｵｺ', bank: '0138', branch: '201', acct: '1000006', age: 41, rate: 1350, quals: ['施設警備業務2級'], june: { days: 21, hours: 168, night: 0, ot: 5 } },
    { id: 'g7', code: '000007', hiredAt: '2014-02-01', office: '川崎営業所', name: '高橋 修', kana: 'ﾀｶﾊｼ ｵｻﾑ', bank: '0138', branch: '201', acct: '1000007', age: 72, rate: 1250, quals: [], june: { days: 16, hours: 128, night: 56, ot: 0 } },
    { id: 'g8', code: '000008', hiredAt: '2026-02-01', office: '川崎営業所', name: '伊藤 蓮', kana: 'ｲﾄｳ ﾚﾝ', bank: '0138', branch: '201', acct: '1000008', age: 24, rate: 1300, quals: [], rookie: true, june: { days: 15, hours: 120, night: 0, ot: 0 } },
    { id: 'g9', code: '000009', hiredAt: '2011-04-01', office: '都筑営業所', rateRank: 'A', name: '小林 誠', kana: 'ｺﾊﾞﾔｼ ﾏｺﾄ', bank: '0138', branch: '201', acct: '1000009', age: 49, rate: 1600, quals: ['交通誘導警備業務1級'], june: { days: 22, hours: 176, night: 12, ot: 10 } },
    { id: 'g10', code: '000010', hiredAt: '2022-05-09', office: '都筑営業所', name: '加藤 里奈', kana: 'ｶﾄｳ ﾘﾅ', bank: '0138', branch: '201', acct: '1000010', age: 29, rate: 1400, quals: ['施設警備業務2級'], june: { days: 20, hours: 160, night: 0, ot: 3 } },
    { id: 'g11', code: '000011', hiredAt: '2018-08-20', office: '都筑営業所', name: '中村 豊', kana: 'ﾅｶﾑﾗ ﾕﾀｶ', bank: '0138', branch: '201', acct: '1000011', age: 63, rate: 1250, quals: [], paidLeaveLeft: 0, june: { days: 21, hours: 168, night: 62, ot: 0 } },
    { id: 'g12', code: '000012', hiredAt: '2017-10-01', office: '都筑営業所', rateRank: 'B', name: '斎藤 悠人', kana: 'ｻｲﾄｳ ﾕｳﾄ', bank: '0138', branch: '201', acct: '1000012', age: 35, rate: 1450, quals: ['交通誘導警備業務2級'], june: { days: 22, hours: 176, night: 20, ot: 8 } },
  ];

  const sites = [
    { id: 's1', work: '日勤資格有', name: '青葉台タワー 施設警備', mark: '青', abbr: '青葉台タワー', kind: '1号', start: '08:00', end: '20:00', brk: 60, need: 2, reqQual: '施設警備業務2級', bill: 2400, addr: '横浜市青葉区', client: '青葉台タワーマネジメント株式会社', addrFull: '神奈川県横浜市青葉区青葉台1-2-3', note1: '防災センターに直行。入館証は警備室で受領', note2: '制服は施設Aタイプ' },
    { id: 's2', work: '日勤資格有', name: '環状2号線 道路改良工事', mark: '環', abbr: '環状2号線', kind: '2号', start: '08:00', end: '17:00', brk: 60, need: 4, reqQual: '交通誘導警備業務2級', bill: 2100, addr: '横浜市港北区', client: '株式会社ケイヒン道路建設', addrFull: '神奈川県横浜市港北区新横浜2-8-1 先', note1: '朝礼は7:45。ヘルメット持参', note2: '雨天時は現場監督の指示に従う' },
    { id: 's3', work: '日勤資格無', name: 'みなとみらい夏祭り 雑踏警備', mark: '祭', abbr: 'MM夏祭り', kind: '2号', start: '16:00', end: '22:00', brk: 0, need: 5, bill: 2300, addr: '横浜市西区', client: 'みなとみらいイベント実行委員会', addrFull: '神奈川県横浜市西区みなとみらい2-3', note1: '本部テント前に15:30集合', note2: '誘導灯は本部で貸与' },
    { id: 's4', work: '夜勤資格無', name: '港北物流センター 夜間警備', mark: '港', abbr: '港北物流(夜)', kind: '1号', start: '20:00', end: '08:00', brk: 60, need: 2, bill: 2600, addr: '横浜市都筑区', night: true, client: '港北ロジスティクス株式会社', addrFull: '神奈川県横浜市都筑区東方町180', note1: '夜間出入口は東側のみ', note2: '' },
    { id: 's5', work: '夜勤資格有', name: '首都高 夜間補修規制', mark: '首', abbr: '首都高(夜)', kind: '2号', start: '00:00', end: '06:00', brk: 0, need: 3, reqQual: '交通誘導警備業務2級', bill: 2800, addr: '横浜市神奈川区', night: true, note: '勤務日0:00開始・前夜集合', client: '首都高速道路メンテナンス株式会社', addrFull: '神奈川県横浜市神奈川区金港町3-1 先', note1: '規制帯設置は0:00ちょうど。前夜23:30に資材置場集合', note2: '保安資材はトラックで搬入済み' },
    { id: 's6', work: '日勤資格有', name: '第二京浜 舗装工事', kind: '2号', start: '09:00', end: '18:00', brk: 60, mark: '京', abbr: '第二京浜', need: 2, reqQual: '交通誘導警備業務2級', bill: 2000, addr: '横浜市鶴見区', client: '株式会社ケイヒン道路建設', addrFull: '神奈川県横浜市鶴見区生麦4-25 先', note1: '朝礼は8:45。第二京浜下り線', note2: '規制帯は元請が設置済み' },
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
    { g: 'g4',  s: 's6', off: [0, 3] },
    { g: 'g8',  s: 's6', off: [0, 3] },
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

  const clients = [
    { id: 'c1', code: '000001', name: '青葉台タワーマネジメント株式会社', kana: 'ｱｵﾊﾞﾀﾞｲﾀﾜｰﾏﾈｼﾞﾒﾝﾄ', abbr: '青葉台TM', honor: '御中',
      addr: '神奈川県横浜市青葉区青葉台1-2-3', tel: '045-981-0000', fax: '045-981-0001',
      tax: '外税', close: '月末', payMonth: 1, payDay: '月末', payType: '振込', note: '請求書は経理部宛' },
    { id: 'c2', code: '000002', name: '株式会社ケイヒン道路建設', kana: 'ｹｲﾋﾝﾄﾞｳﾛｹﾝｾﾂ', abbr: 'ケイヒン道路', honor: '御中',
      addr: '神奈川県横浜市港北区新横浜2-8-1', tel: '045-473-0000', fax: '045-473-0001',
      tax: '外税', close: '20日', payMonth: 1, payDay: '15日', payType: '振込', note: '現場ごとに明細を分ける' },
    { id: 'c3', code: '000003', name: 'みなとみらいイベント実行委員会', kana: 'ﾐﾅﾄﾐﾗｲｲﾍﾞﾝﾄｼﾞｯｺｳｲｲﾝｶｲ', abbr: 'MM実行委', honor: '御中',
      addr: '神奈川県横浜市西区みなとみらい2-3', tel: '045-222-0000', fax: '',
      tax: '内税', close: '月末', payMonth: 1, payDay: '月末', payType: '振込', note: 'スポット。前払いあり' },
    { id: 'c4', code: '000004', name: '港北ロジスティクス株式会社', kana: 'ｺｳﾎｸﾛｼﾞｽﾃｨｸｽ', abbr: '港北ロジ', honor: '御中',
      addr: '神奈川県横浜市都筑区東方町180', tel: '045-940-0000', fax: '045-940-0001',
      tax: '外税', close: '月末', payMonth: 2, payDay: '10日', payType: '振込', note: '' },
    { id: 'c5', code: '000005', name: '首都高速道路メンテナンス株式会社', kana: 'ｼｭﾄｺｳｿｸﾄﾞｳﾛﾒﾝﾃﾅﾝｽ', abbr: '首都高MT', honor: '御中',
      addr: '神奈川県横浜市神奈川区金港町3-1', tel: '045-451-0000', fax: '045-451-0001',
      tax: '外税', close: '月末', payMonth: 1, payDay: '月末', payType: '振込', note: '深夜作業。単価に深夜割増を含む' },
  ];
  return {
    ...emptyData(),
    masters: seedMasters(),        // デモは金額入りのマスタをそのまま使う（初期状態は0円）
    seedDate: D0, clients, guards, sites, shifts, education, notices, leaves,
    bonus: { date: D(20), name: '夏季賞与', amount: {} },
    demo: true,
  };
}

/** 契約直後の初期状態。
 *  製品が最初から持っているマスタ（法令の税額表・保険料率・有給付与日数、祝日、郵便番号、
 *  金融機関コード、警備業区分、資格名、勤務種別など）は入れたままにし、
 *  自社・支店・担当者・得意先・配置先・隊員・単価といった会社ごとの値だけを空にする。
 *  金額は会社ごとに違うので、項目名は残して金額は 0 にする（初期値のまま誤って請求・支給しないため）。 */
export function emptyData() {
  const m = seedMasters();
  ['branch', 'staff', 'siteRate', 'guardRate'].forEach(k => { m[k] = []; });
  m.company = [{}];                                  // 1件だけの自社マスタは空の行を残して入力させる
  ['qual', 'payItem', 'dedItem', 'billItem'].forEach(k =>
    (m[k] || []).forEach(r => { if ('allow' in r) r.allow = 0; if ('amount' in r) r.amount = 0; }));
  return {
    seedDate: todayKey(), offline: false, demo: false,
    clients: [], guards: [], sites: [], shifts: [], education: [], notices: [], leaves: [],
    avail: {}, deposits: {}, auditLog: [], weatherLog: {},
    masters: m,
    orders: {}, allowances: {}, bonus: { date: '', name: '', amount: {} },
    options: { nippoSplit: false, dayNight: true, taxIn: false, autoHour: true, blockPaid: true, warnRun: true },
  };
}

/** 起動時の既定は初期状態。デモは画面のボタンから入れる */
export const seedData = emptyData;
