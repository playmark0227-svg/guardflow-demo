// 警備Pro のマスタ群をスキーマで定義し、1つの汎用エディタで全画面を賄う。
// fields: k=キー / l=見出し / t=型(text,num,yen,sel,chk,date,area) / w=列幅 / opt=選択肢 / req=必須 / hint=注記
export const MASTERS = {
  // 業務データそのものを編集するマスタ。store で state 直下のコレクションを指す
  client: {
    name: '得意先マスタ', key: 'name', store: 'clients', idPrefix: 'c',
    quickTitle: '得意先を追加', quick: ['name', 'kana', 'tel', 'close', 'tax'],
    note: '締日・請求日・課税方法は請求集計と請求書にそのまま使われます。得意先を追加すると配置先マスタの得意先欄から選べます',
    fields: [
      { k: 'code', l: '得意先番号', w: 100, hint: '6桁' }, { k: 'name', l: '得意先名', w: 240, req: true },
      { k: 'kana', l: 'フリガナ', w: 200 }, { k: 'abbr', l: '略称', w: 130 },
      { k: 'honor', l: '敬称', t: 'sel', opt: ['御中', '様', '殿'], w: 90 },
      { k: 'addr', l: '住所', w: 260 }, { k: 'tel', l: '代表TEL', w: 130 }, { k: 'fax', l: 'FAX', w: 130 },
      { k: 'tax', l: '課税方法', t: 'sel', opt: ['外税', '内税', '非課税'], w: 110 },
      { k: 'close', l: '締日', t: 'sel', opt: ['月末', '20日', '25日', '15日', '10日', '5日'], w: 100 },
      { k: 'payMonth', l: '請求（カ月後）', t: 'num', w: 120 },
      { k: 'payDay', l: '入金予定日', t: 'sel', opt: ['月末', '5日', '10日', '15日', '20日', '25日'], w: 120 },
      { k: 'payType', l: '入金区分', t: 'sel', opt: ['振込', '現金', '手形', '相殺'], w: 100 },
      { k: 'note', l: '請求書備考', w: 240 },
    ],
  },
  eduM: {
    name: '教育記録', key: 'guardName', store: 'education', idPrefix: 'e',
    quickTitle: '教育記録を追加', quick: ['guardName', 'type', 'required', 'done', 'at', 'content'],
    note: '警備業法21条の法定教育。新任20時間・現任は年度10時間が目安です。実施時間を入れると教育実施簿と未達アラートに反映されます',
    fields: [
      { k: 'guardName', l: '隊員', t: 'sel', optFrom: 'guards', w: 160, req: true },
      { k: 'type', l: '区分', t: 'sel', opt: ['新任', '現任'], w: 100 },
      { k: 'required', l: '法定時間(h)', t: 'num', w: 110 },
      { k: 'done', l: '実施時間(h)', t: 'num', w: 110 },
      { k: 'at', l: '直近の実施日', t: 'date', w: 140 },
      { k: 'content', l: '実施内容', w: 300 },
      { k: 'teacher', l: '指導教育責任者', t: 'sel', optFrom: 'staff', w: 170 },
    ],
  },
  siteM: {
    name: '配置先マスタ', key: 'name', store: 'sites', idPrefix: 's',
    quickTitle: '配置先を追加', quick: ['name', 'client', 'kind', 'work', 'start', 'end', 'brk', 'need', 'bill', 'reqQual'],
    note: '所定時間・所定休憩・必要人数は管制ボードと賃金計算の前提になります。単価は「配置先単価マスタ」が優先されます',
    fields: [
      { k: 'name', l: '配置先名', w: 240, req: true }, { k: 'abbr', l: '略称', w: 140 },
      { k: 'mark', l: '記号', w: 70, hint: '全角1字' },
      { k: 'client', l: '得意先', t: 'sel', optFrom: 'clients', w: 240, req: true },
      { k: 'kind', l: '警備業区分', t: 'sel', optFrom: 'bizType', w: 110 },
      { k: 'work', l: '既定の勤務', t: 'sel', optFrom: 'work', w: 130 },
      { k: 'start', l: '開始', w: 90, hint: 'HH:MM' }, { k: 'end', l: '終了', w: 90, hint: 'HH:MM' },
      { k: 'brk', l: '所定休憩(分)', t: 'num', w: 110 }, { k: 'need', l: '必要人数', t: 'num', w: 100 },
      { k: 'reqQual', l: '必要資格', t: 'sel', optFrom: 'qual', w: 190 },
      { k: 'bill', l: '請求単価(円/h)', t: 'yen', w: 130 },
      { k: 'night', l: '夜間現場', t: 'chk', w: 90 },
      { k: 'addrFull', l: '住所', w: 260 },
      { k: 'note', l: '集合の注意', w: 220 },
      { k: 'note1', l: '注意事項1', w: 240 }, { k: 'note2', l: '注意事項2', w: 240 },
    ],
  },
  guardM: {
    name: '隊員マスタ', key: 'name', store: 'guards', idPrefix: 'g',
    quickTitle: '隊員を追加', quick: ['name', 'kana', 'office', 'gtype', 'hiredAt', 'rate', 'quals'],
    note: '入社年月日は有給付与日数の判定に、単価ランクは時給に、カナ氏名と口座は振込データに使われます',
    fields: [
      { k: 'code', l: '隊員番号', w: 100, hint: '6桁' }, { k: 'name', l: '氏名', w: 150, req: true },
      { k: 'kana', l: 'カナ氏名', w: 150, hint: '半角カナ' },
      { k: 'office', l: '所属拠点', t: 'sel', optFrom: 'branch', w: 130 },
      { k: 'gtype', l: '隊員区分', t: 'sel', optFrom: 'guardType', w: 120 },
      { k: 'age', l: '年齢', t: 'num', w: 80 },
      { k: 'hiredAt', l: '入社年月日', t: 'date', w: 140 },
      { k: 'rateRank', l: '単価ランク', t: 'sel', opt: ['A', 'B', 'C', 'D'], w: 100 },
      { k: 'rate', l: '時給(円)', t: 'yen', w: 110 },
      { k: 'quals', l: '保有資格', t: 'multi', optFrom: 'qual', w: 170,
        emptyHint: '資格マスタに資格がありません' },
      { k: 'paidLeaveLeft', l: '有給残(日)', t: 'num', w: 100 },
      { k: 'bank', l: '銀行コード', w: 100 }, { k: 'branch', l: '支店コード', w: 100 },
      { k: 'acct', l: '口座番号', w: 120 },
      { k: 'pairNGNames', l: '相性NG（同一現場に置かない）', t: 'multi', optFrom: 'guards', w: 200,
        emptyHint: 'ほかに隊員が登録されていません' },
      { k: 'siteNGNames', l: '出入り禁止の配置先', t: 'multi', optFrom: 'sites', w: 190,
        emptyHint: '配置先が登録されていません' },
      { k: 'caution', l: '管制メモ', w: 280 },
    ],
  },
  // ===== マスタ管理 =====
  company: {
    name: '自社マスタ', single: true, key: 'code',
    fields: [
      { k: 'code', l: '自社コード', w: 90 }, { k: 'name', l: '会社名', w: 220, req: true },
      { k: 'zip', l: '郵便番号', w: 100 }, { k: 'addr', l: '住所', w: 260 },
      { k: 'tel', l: '電話番号', w: 130 }, { k: 'fax', l: 'FAX番号', w: 130 },
      { k: 'ceo', l: '代表者', w: 120 }, { k: 'permit', l: '認定番号', w: 190 },
      { k: 'kana', l: 'カナ社名', w: 190, hint: '半角カナ・振込データ用' },
      { k: 'payerCode', l: '委託者コード', w: 120, hint: '銀行から通知される10桁' },
      { k: 'payerBank', l: '振込元 銀行', t: 'sel', optFrom: 'bank', w: 160 },
      { k: 'payerAcct', l: '振込元 口座番号', w: 140 },
      { k: 'seal', l: '請求書に自社印を印字', t: 'chk', w: 150 },
    ],
    note: '会社名・認定番号は請求書・給与明細・警備員名簿・契約書などすべての帳票に印字されます。カナ社名と振込元口座は全銀データに使われます',
    seed: [{ code: '01', name: 'GuardFlow警備株式会社', zip: '231-0057', addr: '神奈川県横浜市中区曙町2-19-1', tel: '045-000-0000', fax: '045-000-0001', ceo: '守屋 健一', permit: '神奈川県公安委員会 第00000000号', kana: 'ｶ)ｶﾞｰﾄﾞﾌﾛｰｹｲﾋﾞ', payerCode: '0123456789', payerBank: '横浜銀行', payerAcct: '1234567', seal: true }],
  },
  branch: {
    name: '支店マスタ', key: 'code', quickTitle: '支店・営業所を追加', quick: ['code', 'name'],
    fields: [
      { k: 'code', l: '支店コード', w: 100, req: true }, { k: 'name', l: '支店名', w: 180, req: true },
      { k: 'zip', l: '郵便番号', w: 100 }, { k: 'addr', l: '住所', w: 280 },
      { k: 'tel', l: '電話番号', w: 140 }, { k: 'fax', l: 'FAX番号', w: 140 },
    ],
    seed: [
      { code: '01', name: '横浜本店', zip: '231-0057', addr: '神奈川県横浜市中区曙町2-19-1', tel: '045-000-0000', fax: '045-000-0001' },
      { code: '02', name: '川崎営業所', zip: '210-0007', addr: '神奈川県川崎市川崎区駅前本町11-2', tel: '044-000-0000', fax: '044-000-0001' },
      { code: '03', name: '都筑営業所', zip: '224-0032', addr: '神奈川県横浜市都筑区茅ケ崎中央32-1', tel: '045-100-0000', fax: '045-100-0001' },
    ],
  },
  staff: {
    name: '担当者マスタ', key: 'code', quickTitle: '担当者を追加', quick: ['code', 'name', 'branch', 'role'],
    fields: [
      { k: 'code', l: '担当者コード', w: 110, req: true }, { k: 'name', l: '氏名', w: 150, req: true },
      { k: 'branch', l: '所属支店', t: 'sel', optFrom: 'branch', w: 140 },
      { k: 'role', l: '権限', t: 'sel', opt: ['管理者', '管制', '事務', '閲覧のみ'], w: 120 },
      { k: 'tel', l: '内線', w: 90 },
    ],
    seed: [
      { code: '001', name: '守屋 健一', branch: '横浜本店', role: '管理者', tel: '101' },
      { code: '002', name: '大原 千夏', branch: '横浜本店', role: '管制', tel: '102' },
      { code: '003', name: '青木 拓也', branch: '川崎営業所', role: '管制', tel: '201' },
      { code: '004', name: '篠原 由紀', branch: '都筑営業所', role: '事務', tel: '301' },
    ],
  },
  authority: {
    name: '担当者権限マスタ', key: 'role',
    fields: [
      { k: 'role', l: '権限名', w: 120, req: true },
      { k: 'work', l: '勤務管理', t: 'chk', w: 90 }, { k: 'bill', l: '請求管理', t: 'chk', w: 90 },
      { k: 'deposit', l: '入金管理', t: 'chk', w: 90 }, { k: 'pay', l: '給与管理', t: 'chk', w: 90 },
      { k: 'master', l: 'マスタ管理', t: 'chk', w: 100 }, { k: 'maint', l: 'メンテナンス', t: 'chk', w: 110 },
    ],
    seed: [
      { role: '管理者', work: true, bill: true, deposit: true, pay: true, master: true, maint: true },
      { role: '管制', work: true, bill: false, deposit: false, pay: false, master: false, maint: false },
      { role: '事務', work: true, bill: true, deposit: true, pay: true, master: false, maint: false },
      { role: '閲覧のみ', work: false, bill: false, deposit: false, pay: false, master: false, maint: false },
    ],
  },
  zip: {
    name: '郵便番号マスタ', key: 'zip', bulk: 'サンプルを取り込む',
    note: '実運用では日本郵便が公開する全国データ（KEN_ALL）を取り込みます。このデモはブラウザ内保存のため容量に収まる範囲だけを扱います',
    fields: [{ k: 'zip', l: '郵便番号', w: 120, req: true }, { k: 'addr', l: '住所', w: 360 }],
    seed: [
      { zip: '231-0057', addr: '神奈川県横浜市中区曙町' }, { zip: '225-0002', addr: '神奈川県横浜市青葉区美しが丘' },
      { zip: '222-0033', addr: '神奈川県横浜市港北区新横浜' }, { zip: '220-0012', addr: '神奈川県横浜市西区みなとみらい' },
      { zip: '224-0041', addr: '神奈川県横浜市都筑区仲町台' }, { zip: '221-0056', addr: '神奈川県横浜市神奈川区金港町' },
    ],
  },
  bank: {
    name: '金融機関マスタ', key: 'code', quickTitle: '金融機関を追加', quick: ['code', 'name', 'bcode', 'bname'],
    note: '実運用では全銀協の金融機関コード一覧を取り込みます。ここには振込に使う銀行・支店を登録してください',
    fields: [
      { k: 'code', l: '銀行コード', w: 100, req: true }, { k: 'name', l: '銀行名', w: 180, req: true },
      { k: 'bcode', l: '支店コード', w: 100 }, { k: 'bname', l: '支店名', w: 160 },
    ],
    seed: [
      { code: '0138', name: '横浜銀行', bcode: '201', bname: '本店営業部' },
      { code: '0005', name: '三菱ＵＦＪ銀行', bcode: '253', bname: '横浜中央支店' },
      { code: '1280', name: '横浜信用金庫', bcode: '001', bname: '本店営業部' },
    ],
  },
  holiday: {
    name: '祝日設定マスタ', key: 'date', note: '国民の祝日は所定休日です。労基法35条の法定休日（週1日）に当たる日だけ「法定休日」をONにすると、その日の労働に35%割増が付きます',
    fields: [
      { k: 'date', l: '休日', t: 'date', w: 140, req: true },
      { k: 'kind', l: '休日区分', t: 'sel', opt: ['固定', '変動'], w: 100 },
      { k: 'name', l: '休日内容', w: 200, req: true },
      { k: 'legal', l: '法定休日', t: 'chk', w: 100, hint: 'ONの日だけ35%割増' },
    ],
    seed: [
      { date: '2026-08-11', kind: '固定', name: '山の日' }, { date: '2026-09-21', kind: '変動', name: '敬老の日' },
      { date: '2026-09-22', kind: '変動', name: '国民の休日' }, { date: '2026-09-23', kind: '固定', name: '秋分の日' },
      { date: '2026-10-12', kind: '変動', name: 'スポーツの日' },
    ],
  },
  workGroup: {
    name: '勤務グループマスタ', key: 'code', note: 'グループコードは2桁。明細書の勤務名がグループ名で表示されます',
    fields: [
      { k: 'code', l: 'グループコード', w: 120, req: true }, { k: 'name', l: 'グループ名', w: 200, req: true },
      { k: 'mark', l: 'グループ記号', w: 110 },
    ],
    seed: [
      { code: '01', name: '日勤資格無', mark: '日' }, { code: '02', name: '日勤資格有', mark: '有' },
      { code: '03', name: '夜勤', mark: '夜' }, { code: '04', name: '当務', mark: '当' },
    ],
  },
  work: {
    name: '勤務マスタ', key: 'name',
    note: '記号は勤務表・管制日報に印刷されます。当務＝報告時間を翌日と判断し最大24時間で計算。重複チェック＝同一日に同一隊員を複数配置できません',
    fields: [
      { k: 'name', l: '正式名称', w: 130, req: true, hint: '全角6文字' },
      { k: 'abbr', l: '略称', w: 90, hint: '全角4文字' }, { k: 'mark', l: '記号', w: 70, hint: '全角2文字' },
      { k: 'group', l: '勤務グループ', t: 'sel', optFrom: 'workGroup', w: 140 },
      { k: 'bill', l: '請求', t: 'chk', w: 70 }, { k: 'pay', l: '給与', t: 'chk', w: 70 },
      { k: 'dn', l: '昼夜区分', t: 'sel', opt: ['昼', '夜'], w: 90 },
      { k: 'duty', l: '当務', t: 'chk', w: 70 }, { k: 'hol', l: '休日勤務', t: 'chk', w: 90 },
      { k: 'dup', l: '重複チェック', t: 'chk', w: 110 }, { k: 'post', l: 'ポストカウント', t: 'chk', w: 120 },
    ],
    seed: [
      { name: '日勤資格無', abbr: '日勤無', mark: '日', group: '01 日勤資格無', bill: true, pay: true, dn: '昼', duty: false, hol: false, dup: true, post: true },
      { name: '日勤資格有', abbr: '日勤有', mark: '有', group: '02 日勤資格有', bill: true, pay: true, dn: '昼', duty: false, hol: false, dup: true, post: true },
      { name: '夜勤資格無', abbr: '夜無', mark: '夜', group: '03 夜勤', bill: true, pay: true, dn: '夜', duty: false, hol: false, dup: true, post: true },
      { name: '夜勤資格有', abbr: '夜有', mark: '夜', group: '03 夜勤', bill: true, pay: true, dn: '夜', duty: false, hol: false, dup: true, post: true },
      { name: '当務', abbr: '当務', mark: '当', group: '04 当務', bill: true, pay: true, dn: '昼', duty: true, hol: false, dup: true, post: true },
      { name: '巡回（昼）', abbr: '昼巡回', mark: '巡', group: '01 日勤資格無', bill: true, pay: true, dn: '昼', duty: false, hol: false, dup: false, post: false },
      { name: '災害日勤', abbr: '災日', mark: '災', group: '01 日勤資格無', bill: true, pay: true, dn: '昼', duty: false, hol: true, dup: true, post: true },
    ],
  },
  bizType: {
    name: '警備業区分マスタ', key: 'code',
    fields: [{ k: 'code', l: '警備業区分', w: 110, req: true }, { k: 'name', l: '警備業区分名', w: 260, req: true }],
    seed: [
      { code: '1', name: '1号（施設警備業務）' }, { code: '2', name: '2号（交通誘導・雑踏警備業務）' },
      { code: '3', name: '3号（貴重品運搬警備業務）' }, { code: '4', name: '4号（身辺警備業務）' },
    ],
  },
  guardType: {
    name: '隊員区分マスタ', key: 'code',
    fields: [{ k: 'code', l: '隊員区分', w: 100, req: true }, { k: 'name', l: '隊員区分名', w: 240, req: true }],
    seed: [
      { code: '01', name: '正社員' }, { code: '02', name: 'パート・アルバイト' },
      { code: '03', name: '嘱託' }, { code: '04', name: '外注' }, { code: '05', name: '内勤' },
      { code: '06', name: '日雇（源泉は日額表・丙欄）' },
    ],
  },
  qual: {
    name: '資格マスタ', key: 'name', quickTitle: '資格を追加', quick: ['name', 'kind', 'allow'],
    fields: [
      { k: 'name', l: '資格名', w: 220, req: true },
      { k: 'kind', l: '種別', t: 'sel', opt: ['検定1級', '検定2級', '指導教育責任者', '機械警備業務管理者', 'その他'], w: 160 },
      { k: 'allow', l: '資格手当（月額）', t: 'yen', w: 130 },
    ],
    seed: [
      { name: '交通誘導警備業務1級', kind: '検定1級', allow: 15000 },
      { name: '交通誘導警備業務2級', kind: '検定2級', allow: 8000 },
      { name: '施設警備業務2級', kind: '検定2級', allow: 8000 },
      { name: '警備員指導教育責任者(2号)', kind: '指導教育責任者', allow: 20000 },
    ],
  },
  weather: {
    name: '天候マスタ', key: 'name',
    fields: [{ k: 'name', l: '天候', w: 120, req: true }, { k: 'mark', l: '記号', w: 80 }],
    seed: [{ name: '晴', mark: '☀' }, { name: '曇', mark: '☁' }, { name: '雨', mark: '☂' }, { name: '雪', mark: '❄' }, { name: '強風', mark: '🌬' }],
  },
  contract: {
    name: '警備契約書マスタ', key: 'no', note: '警備業法第19条の書面交付に対応（1号・2号）',
    fields: [
      { k: 'no', l: '項番', w: 70, req: true },
      { k: 'kind', l: '種別', t: 'sel', opt: ['1号警備契約書', '2号警備契約書'], w: 150 },
      { k: 'item', l: '記載事項', w: 260, req: true },
      { k: 'body', l: '初期値（雛形）', t: 'area', w: 340 },
    ],
    seed: [
      { no: '1', kind: '1号警備契約書', item: '警備業務を行う期間', body: '契約日より1年間（自動更新）' },
      { no: '2', kind: '1号警備契約書', item: '警備業務を行う日及び時間帯', body: '毎日 08:00〜20:00' },
      { no: '3', kind: '1号警備契約書', item: '警備対象施設の名称及び所在地', body: '' },
      { no: '4', kind: '1号警備契約書', item: '警備人員及び担当業務', body: '2名（出入管理・巡回）' },
      { no: '5', kind: '1号警備契約書', item: '警備員が有する知識及び技能', body: '施設警備業務検定2級以上を1名以上配置' },
      { no: '6', kind: '1号警備契約書', item: '警備員が用いる服装', body: '当社指定制服（紺）・所属表示' },
      { no: '7', kind: '1号警備契約書', item: '使用する機器及び資機材', body: '警笛・懐中電灯・無線機' },
      { no: '8', kind: '1号警備契約書', item: '鍵の管理に関する事項', body: '施錠確認は警備日誌に記録し、鍵は施設管理者へ返却' },
      { no: '9', kind: '1号警備契約書', item: '盗難等の事故発生時の措置', body: '直ちに警察及び依頼者へ通報し、現場を保存する' },
      { no: '10', kind: '1号警備契約書', item: '報告の方法、頻度及び時期', body: '警備日報を翌営業日までに提出' },
      { no: '11', kind: '1号警備契約書', item: '警備料金・その他の費用', body: '別紙単価表のとおり。月末締め翌月末払い' },
      { no: '12', kind: '1号警備契約書', item: '契約の解除に関する事項', body: '解約は1か月前までの書面による申し入れとする' },
      { no: '13', kind: '1号警備契約書', item: '損害賠償に関する事項', body: '当社の責に帰すべき事由による損害は、契約金額を上限として賠償する' },
      { no: '1', kind: '2号警備契約書', item: '警備業務を行う期間', body: '工事期間中' },
      { no: '2', kind: '2号警備契約書', item: '警備業務を行う日及び時間帯', body: '工事稼働日 08:00〜17:00' },
      { no: '3', kind: '2号警備契約書', item: '警備業務を行う場所', body: '' },
      { no: '4', kind: '2号警備契約書', item: '警備人員及び担当業務', body: '' },
      { no: '5', kind: '2号警備契約書', item: '警備員が有する知識及び技能', body: '交通誘導警備業務検定2級以上を1名以上配置' },
      { no: '6', kind: '2号警備契約書', item: '警備員が用いる服装', body: '当社指定制服・保安帽・反射ベスト・所属表示' },
      { no: '7', kind: '2号警備契約書', item: '使用する機器及び資機材', body: '誘導灯・警笛・保安柵・回転灯（保安資材は元請が設置）' },
      { no: '8', kind: '2号警備契約書', item: '交通誘導の方法及び規制内容', body: '片側交互通行。規制帯の設置・撤去は元請の指示による' },
      { no: '9', kind: '2号警備契約書', item: '事故発生時の措置', body: '負傷者の救護を最優先し、直ちに119番・110番および元請へ通報する' },
      { no: '10', kind: '2号警備契約書', item: '報告の方法、頻度及び時期', body: '作業日報を当日中に元請へ提出' },
      { no: '11', kind: '2号警備契約書', item: '警備料金・その他の費用', body: '' },
      { no: '12', kind: '2号警備契約書', item: '契約の解除に関する事項', body: '工事中止の場合は前日までの連絡により無償で解除できる' },
      { no: '13', kind: '2号警備契約書', item: '損害賠償に関する事項', body: '当社の責に帰すべき事由による損害は、契約金額を上限として賠償する' },
    ],
  },

  // ===== マスタ管理（請求） =====
  siteRate: {
    name: '配置先単価マスタ', key: 'id', note: '時間外単価・時給単価は1時間あたりの金額です',
    fields: [
      { k: 'site', l: '配置先', t: 'sel', optFrom: 'sites', w: 200, req: true },
      { k: 'work', l: '勤務', t: 'sel', optFrom: 'work', w: 130 },
      { k: 'unit', l: '単価', t: 'yen', w: 100 }, { k: 'ot', l: '残業', t: 'yen', w: 90 },
      { k: 'dayOt', l: '昼残', t: 'yen', w: 90 }, { k: 'early', l: '早出', t: 'yen', w: 90 },
      { k: 'late', l: '遅刻', t: 'yen', w: 90 }, { k: 'hour', l: '時給', t: 'yen', w: 90 },
      { k: 'night', l: '深夜', t: 'yen', w: 90 }, { k: 'nightOt', l: '深残', t: 'yen', w: 90 },
    ],
    seed: [
      { site: '青葉台タワー 施設警備', work: '日勤資格有', unit: 28800, ot: 3000, dayOt: 2700, early: 2700, late: 2400, hour: 2400, night: 3000, nightOt: 3600 },
      { site: '環状2号線 道路改良工事', work: '日勤資格有', unit: 18900, ot: 2625, dayOt: 2363, early: 2363, late: 2100, hour: 2100, night: 2625, nightOt: 3150 },
      { site: 'みなとみらい夏祭り 雑踏警備', work: '夜勤資格無', unit: 13800, ot: 2875, dayOt: 2588, early: 2588, late: 2300, hour: 2300, night: 2875, nightOt: 3450 },
      { site: '港北物流センター 夜間警備', work: '当務', unit: 31200, ot: 3250, dayOt: 2925, early: 2925, late: 2600, hour: 2600, night: 3250, nightOt: 3900 },
      { site: '首都高 夜間補修規制', work: '夜勤資格有', unit: 16800, ot: 3500, dayOt: 3150, early: 3150, late: 2800, hour: 2800, night: 3500, nightOt: 4200 },
      { site: '第二京浜 舗装工事', work: '日勤資格有', unit: 18000, ot: 2500, dayOt: 2250, early: 2250, late: 2000, hour: 2000, night: 2500, nightOt: 3000 },
    ],
  },
  billItem: {
    name: '請求項目マスタ', key: 'name',
    fields: [
      { k: 'name', l: '請求項目名', w: 200, req: true },
      { k: 'kind', l: '区分', t: 'sel', opt: ['加算', '値引'], w: 100 },
      { k: 'tax', l: '課税', t: 'chk', w: 80 },
      { k: 'amount', l: '既定金額', t: 'yen', w: 120 },
    ],
    seed: [
      { name: '無線機代', kind: '加算', tax: true, amount: 3000 },
      { name: '資機材費', kind: '加算', tax: true, amount: 5000 },
      { name: '駐車場代', kind: '加算', tax: true, amount: 2000 },
      { name: '長期契約値引', kind: '値引', tax: true, amount: 10000 },
    ],
  },

  // ===== マスタ管理（給与） =====
  guardRate: {
    name: '隊員単価マスタ', key: 'rank', note: '隊員マスタの「隊員単価ランク」から参照されます',
    fields: [
      { k: 'rank', l: '単価ランク', w: 110, req: true },
      { k: 'work', l: '勤務', t: 'sel', optFrom: 'work', w: 130 },
      { k: 'unit', l: '単価', t: 'yen', w: 100 }, { k: 'ot', l: '時間外単価', t: 'yen', w: 110 },
      { k: 'hour', l: '時給単価', t: 'yen', w: 110 }, { k: 'night', l: '深夜単価', t: 'yen', w: 110 },
      { k: 'nightOt', l: '深夜残業単価', t: 'yen', w: 120 },
    ],
    seed: [
      { rank: 'A', work: '日勤資格有', unit: 12800, ot: 2000, hour: 1600, night: 2000, nightOt: 2400 },
      { rank: 'B', work: '日勤資格有', unit: 11600, ot: 1813, hour: 1450, night: 1813, nightOt: 2175 },
      { rank: 'C', work: '日勤資格無', unit: 10000, ot: 1563, hour: 1250, night: 1563, nightOt: 1875 },
      { rank: 'D', work: '夜勤資格無', unit: 10400, ot: 1625, hour: 1300, night: 1625, nightOt: 1950 },
    ],
  },
  payItem: {
    name: '支払項目マスタ', key: 'name',
    fields: [
      { k: 'name', l: '支払項目名', w: 180, req: true },
      { k: 'kind', l: '区分', t: 'sel', opt: ['固定', '変動'], w: 100 },
      { k: 'taxable', l: '課税対象', t: 'chk', w: 100 },
      { k: 'base', l: '割増基礎に算入', t: 'chk', w: 130, hint: '労基則21条の除外7種以外は算入必須' },
      { k: 'amount', l: '既定額', t: 'yen', w: 110 },
    ],
    seed: [
      { name: '基本給', kind: '変動', taxable: true, base: true, amount: 0 },
      { name: '資格手当', kind: '固定', taxable: true, base: true, amount: 8000 },
      { name: '精勤手当', kind: '固定', taxable: true, base: true, amount: 5000 },
      { name: '現場手当', kind: '変動', taxable: true, base: true, amount: 0 },
      { name: '通勤手当（実費）', kind: '変動', taxable: false, base: false, amount: 0 },
      { name: '家族手当（扶養人数連動）', kind: '固定', taxable: true, base: false, amount: 10000 },
    ],
  },
  dedItem: {
    name: '控除項目マスタ', key: 'name',
    fields: [
      { k: 'name', l: '控除項目名', w: 180, req: true },
      { k: 'kind', l: '区分', t: 'sel', opt: ['法定', '任意'], w: 100 },
      { k: 'rate', l: '料率(%)', t: 'num', w: 100 },
      { k: 'amount', l: '定額', t: 'yen', w: 110 },
    ],
    seed: [
      { name: '健康保険', kind: '法定', rate: 4.95, amount: 0 },
      { name: '厚生年金', kind: '法定', rate: 9.15, amount: 0 },
      { name: '雇用保険', kind: '法定', rate: 0.55, amount: 0 },
      { name: '所得税', kind: '法定', rate: 2.1, amount: 0 },
      { name: '住民税', kind: '法定', rate: 0, amount: 0 },
      { name: '寮費', kind: '任意', rate: 0, amount: 25000 },
      { name: '制服代（分割）', kind: '任意', rate: 0, amount: 3000 },
    ],
  },
  weekClose: {
    name: '週締めマスタ', key: 'name',
    fields: [
      { k: 'name', l: '締め名称', w: 150, req: true },
      { k: 'day', l: '締め曜日', t: 'sel', opt: ['日', '月', '火', '水', '木', '金', '土'], w: 110 },
      { k: 'payDay', l: '支払日', w: 160 },
    ],
    seed: [
      { name: '週払い（日締め）', day: '日', payDay: '翌週金曜' },
      { name: '週払い（土締め）', day: '土', payDay: '翌週水曜' },
    ],
  },
  insurance: {
    name: '社会保険情報・率マスタ', key: 'name',
    fields: [
      { k: 'name', l: '保険種別', w: 160, req: true },
      { k: 'emp', l: '被保険者負担(%)', t: 'num', w: 140 },
      { k: 'comp', l: '事業主負担(%)', t: 'num', w: 140 },
      { k: 'from', l: '適用開始', t: 'date', w: 130 },
    ],
    seed: [
      { name: '健康保険（神奈川）', emp: 4.95, comp: 4.95, from: '2026-04-01' },
      { name: '介護保険（40歳以上）', emp: 0.795, comp: 0.795, from: '2026-04-01' },
      { name: '厚生年金', emp: 9.15, comp: 9.15, from: '2026-04-01' },
      { name: '雇用保険（一般）', emp: 0.55, comp: 0.90, from: '2026-04-01' },
      { name: '子ども・子育て拠出金', emp: 0, comp: 0.36, from: '2026-04-01' },
    ],
  },
  taxDaily: {
    name: '日額所得税マスタ', key: 'from', note: '源泉徴収税額表（日額表・丙欄）',
    fields: [
      { k: 'from', l: '社会保険料等控除後の日額（以上）', t: 'yen', w: 220, req: true },
      { k: 'to', l: '（未満）', t: 'yen', w: 130 },
      { k: 'tax', l: '税額', t: 'yen', w: 110 },
    ],
    seed: [
      { from: 0, to: 2900, tax: 0 }, { from: 2900, to: 3000, tax: 3 }, { from: 3000, to: 3100, tax: 6 },
      { from: 3100, to: 3200, tax: 10 }, { from: 3200, to: 3400, tax: 13 }, { from: 3400, to: 3600, tax: 20 },
      { from: 3600, to: 3800, tax: 27 }, { from: 3800, to: 4000, tax: 34 }, { from: 4000, to: 5000, tax: 41 },
      { from: 5000, to: 6000, tax: 76 }, { from: 6000, to: 7000, tax: 111 }, { from: 7000, to: 8000, tax: 146 },
      { from: 8000, to: 9000, tax: 181 }, { from: 9000, to: 10000, tax: 216 }, { from: 10000, to: 0, tax: 251 },
    ],
  },
  taxMonthly: {
    name: '月額所得税マスタ', key: 'from', note: '源泉徴収税額表（月額表・甲欄／扶養0人）',
    fields: [
      { k: 'from', l: '社会保険料等控除後の月額（以上）', t: 'yen', w: 220, req: true },
      { k: 'to', l: '（未満）', t: 'yen', w: 130 },
      { k: 'tax', l: '税額', t: 'yen', w: 110 },
    ],
    seed: [
      { from: 0, to: 88000, tax: 0 }, { from: 88000, to: 89000, tax: 130 }, { from: 89000, to: 90000, tax: 180 },
      { from: 90000, to: 93000, tax: 230 }, { from: 93000, to: 96000, tax: 290 }, { from: 96000, to: 99000, tax: 390 },
      { from: 99000, to: 105000, tax: 480 }, { from: 105000, to: 110000, tax: 630 }, { from: 110000, to: 115000, tax: 780 },
      { from: 115000, to: 120000, tax: 930 }, { from: 120000, to: 125000, tax: 1080 }, { from: 125000, to: 130000, tax: 1240 },
      { from: 130000, to: 135000, tax: 1390 }, { from: 135000, to: 140000, tax: 1540 }, { from: 140000, to: 145000, tax: 1690 },
      { from: 145000, to: 150000, tax: 1840 }, { from: 150000, to: 155000, tax: 1990 }, { from: 155000, to: 160000, tax: 2140 },
      { from: 160000, to: 170000, tax: 2290 }, { from: 170000, to: 180000, tax: 2590 }, { from: 180000, to: 190000, tax: 2890 },
      { from: 190000, to: 200000, tax: 3190 }, { from: 200000, to: 220000, tax: 3490 }, { from: 220000, to: 240000, tax: 4090 },
      { from: 240000, to: 260000, tax: 4700 }, { from: 260000, to: 280000, tax: 5330 }, { from: 280000, to: 300000, tax: 5960 },
      { from: 300000, to: 0, tax: 6590 },
    ],
  },
  bonusTax: {
    name: '賞与税額算出率表', key: 'from', note: '賞与に対する源泉徴収税額の算出率の表（甲欄／扶養0人）',
    fields: [
      { k: 'from', l: '前月の社会保険料等控除後の給与（以上）', t: 'yen', w: 250, req: true },
      { k: 'to', l: '（未満）', t: 'yen', w: 130 },
      { k: 'rate', l: '賞与の金額に乗ずべき率(%)', t: 'num', w: 190 },
    ],
    seed: [
      { from: 0, to: 68000, rate: 0 }, { from: 68000, to: 79000, rate: 2.042 }, { from: 79000, to: 252000, rate: 4.084 },
      { from: 252000, to: 300000, rate: 6.126 }, { from: 300000, to: 334000, rate: 8.168 }, { from: 334000, to: 363000, rate: 10.21 },
      { from: 363000, to: 395000, rate: 12.252 }, { from: 395000, to: 426000, rate: 14.294 }, { from: 426000, to: 550000, rate: 16.336 },
      { from: 550000, to: 647000, rate: 18.378 }, { from: 647000, to: 0, rate: 20.42 },
    ],
  },

  // ===== 有給管理 =====
  paidGrant: {
    name: '有給付与マスタ', key: 'months', note: '労基法39条の法定付与日数（週所定労働日数5日以上／週30時間以上）',
    fields: [
      { k: 'months', l: '継続勤務年数', w: 140, req: true },
      { k: 'days', l: '付与日数', t: 'num', w: 110 },
      { k: 'note', l: '備考', w: 240 },
    ],
    seed: [
      { months: '6か月', days: 10, note: '出勤率8割以上が条件' }, { months: '1年6か月', days: 11, note: '' },
      { months: '2年6か月', days: 12, note: '' }, { months: '3年6か月', days: 14, note: '' },
      { months: '4年6か月', days: 16, note: '' }, { months: '5年6か月', days: 18, note: '' },
      { months: '6年6か月以上', days: 20, note: '上限' },
    ],
  },
};

/** マスタの初期データを state 用に生成する */
export function seedMasters() {
  const out = {};
  // store 指定のマスタは業務データ（state.clients など）が実体なので複製しない
  for (const [id, m] of Object.entries(MASTERS)) if (!m.store) out[id] = m.seed.map(r => ({ ...r }));
  return out;
}
