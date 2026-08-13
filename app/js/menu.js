// 警備Pro のメインメニュー構成を GuardFlow のレイアウトに載せる。
// kind: 'view'=既存画面 / 'master'=マスタ編集 / 'report'=帳票出力 / 'soon'=デモ未実装
export const GROUPS = [
  {
    id: 'g-work', ic: '🕐', name: '勤務管理',
    items: [
      { id: 'board', ic: '📋', name: '勤務予定入力', kind: 'view', sub: '管制ボードで配置' },
      { id: 'actual', ic: '✅', name: '勤務実績入力', kind: 'view', sub: '打刻の確認と修正' },
      { id: 'actual-list', ic: '📑', name: '勤務実績一覧入力', kind: 'view', sub: '日付×隊員で一括' },
      { id: 'actual-site', ic: '🏢', name: '現場別 勤務実績一覧入力', kind: 'view', sub: '現場ごとに一括' },
      { id: 'actual-guard', ic: '👤', name: '隊員別 勤務実績入力', kind: 'view', sub: '隊員ごとに一括' },
      { id: 'actual-client', ic: '💠', name: '得意先別 勤務実績入力', kind: 'view', sub: '得意先ごとに一括' },
      { id: 'holiday', ic: '🌴', name: '休日登録', kind: 'master', master: 'holiday' },
      { id: 'rep-work', ic: '🖨', name: '勤務実績表出力', kind: 'report', report: 'workreport' },
      { id: 'order', ic: '📝', name: '受注入力', kind: 'view', sub: '現場の必要人数を登録' },
      { id: 'gantt', ic: '📊', name: '配置予定入力', kind: 'view', sub: '勤務ガント' },
    ],
  },
  {
    id: 'g-bill', ic: '💴', name: '請求管理',
    items: [
      { id: 'billing', ic: '🧾', name: '請求集計・入力', kind: 'view' },
      { id: 'rep-bill-site', ic: '🖨', name: '作業所別請求印刷', kind: 'report', report: 'bill-site' },
      { id: 'rep-bill-client', ic: '🖨', name: '得意先別請求印刷', kind: 'report', report: 'bill-client' },
      { id: 'sales-forecast', ic: '📈', name: '売上高予測表', kind: 'view' },
      { id: 'pl-forecast', ic: '📉', name: '収支予測表', kind: 'view' },
      { id: 'bill-ref', ic: '🔄', name: '請求参照・更新', kind: 'view' },
      { id: 'finance', ic: '💹', name: '請求、給与実粗利確認表', kind: 'view' },
    ],
  },
  {
    id: 'g-deposit', ic: '🏦', name: '入金管理',
    items: [
      { id: 'deposit', ic: '💰', name: '入金入力', kind: 'view' },
      { id: 'rep-deposit', ic: '🖨', name: '入金一覧出力', kind: 'report', report: 'deposit-list' },
      { id: 'ledger', ic: '📒', name: '得意先元帳', kind: 'view' },
    ],
  },
  {
    id: 'g-pay', ic: '💰', name: '給与管理',
    items: [
      { id: 'allowance', ic: '➕', name: '手当・控除入力', kind: 'view' },
      { id: 'payroll', ic: '🧮', name: '給与集計・入力', kind: 'view' },
      { id: 'rep-payslip', ic: '🖨', name: '給与明細書印刷', kind: 'report', report: 'payslip-all' },
      { id: 'rep-paylist', ic: '🖨', name: '給与一覧帳票印刷', kind: 'report', report: 'paylist' },
      { id: 'bonus', ic: '🎁', name: '賞与入力', kind: 'view' },
      { id: 'bonus-list', ic: '📋', name: '賞与一覧入力', kind: 'view' },
      { id: 'zengin', ic: '🏧', name: '振込データ作成', kind: 'view', sub: '全銀フォーマット' },
    ],
  },
  {
    id: 'g-master', ic: '📚', name: 'マスタ管理',
    items: [
      { id: 'm-company', ic: '🏛', name: '自社マスタ', kind: 'master', master: 'company' },
      { id: 'm-branch', ic: '🏢', name: '支店マスタ', kind: 'master', master: 'branch' },
      { id: 'm-staff', ic: '👔', name: '担当者マスタ', kind: 'master', master: 'staff' },
      { id: 'm-auth', ic: '🔐', name: '担当者権限マスタ', kind: 'master', master: 'authority' },
      { id: 'm-zip', ic: '📮', name: '郵便番号マスタ', kind: 'master', master: 'zip' },
      { id: 'm-bank', ic: '🏦', name: '金融機関マスタ', kind: 'master', master: 'bank' },
      { id: 'm-holiday', ic: '🌴', name: '祝日設定マスタ', kind: 'master', master: 'holiday' },
      { id: 'm-wgroup', ic: '🗂', name: '勤務グループマスタ', kind: 'master', master: 'workGroup' },
      { id: 'm-work', ic: '🕘', name: '勤務マスタ', kind: 'master', master: 'work' },
      { id: 'm-biz', ic: '🛡', name: '警備業区分マスタ', kind: 'master', master: 'bizType' },
      { id: 'm-client', ic: '💠', name: '得意先マスタ', kind: 'master', master: 'client' },
      { id: 'm-site', ic: '📍', name: '配置先マスタ', kind: 'master', master: 'siteM' },
      { id: 'm-contract', ic: '📜', name: '警備契約書マスタ', kind: 'master', master: 'contract' },
      { id: 'm-gtype', ic: '🏷', name: '隊員区分マスタ', kind: 'master', master: 'guardType' },
      { id: 'm-guard', ic: '👥', name: '隊員マスタ', kind: 'master', master: 'guardM' },
      { id: 'm-qual', ic: '🎖', name: '資格マスタ', kind: 'master', master: 'qual' },
      { id: 'm-weather', ic: '☀️', name: '天候マスタ', kind: 'master', master: 'weather' },
    ],
  },
  {
    id: 'g-master-bill', ic: '📗', name: 'マスタ管理（請求）',
    items: [
      { id: 'm-siterate', ic: '💱', name: '配置先単価マスタ', kind: 'master', master: 'siteRate' },
      { id: 'm-billitem', ic: '📌', name: '請求項目マスタ', kind: 'master', master: 'billItem' },
    ],
  },
  {
    id: 'g-master-pay', ic: '📙', name: 'マスタ管理（給与）',
    items: [
      { id: 'm-grate', ic: '💱', name: '隊員単価マスタ', kind: 'master', master: 'guardRate' },
      { id: 'm-payitem', ic: '➕', name: '支払項目マスタ', kind: 'master', master: 'payItem' },
      { id: 'm-deditem', ic: '➖', name: '控除項目マスタ', kind: 'master', master: 'dedItem' },
      { id: 'm-week', ic: '📅', name: '週締めマスタ', kind: 'master', master: 'weekClose' },
      { id: 'm-ins', ic: '🏥', name: '社会保険情報・率マスタ', kind: 'master', master: 'insurance' },
      { id: 'm-taxd', ic: '📊', name: '日額所得税マスタ', kind: 'master', master: 'taxDaily' },
      { id: 'm-taxm', ic: '📊', name: '月額所得税マスタ', kind: 'master', master: 'taxMonthly' },
      { id: 'm-btax', ic: '⭐', name: '賞与税額算出率表', kind: 'master', master: 'bonusTax' },
    ],
  },
  {
    id: 'g-report', ic: '🖨', name: '帳票管理',
    items: [
      { id: 'rep-master', ic: '📄', name: 'マスタ一覧印刷', kind: 'view' },
      { id: 'rep-dm', ic: '✉️', name: 'DM印刷', kind: 'report', report: 'dm' },
      { id: 'rep-code', ic: '📕', name: 'コードブック印刷', kind: 'report', report: 'codebook' },
      { id: 'reports', ic: '🗂', name: 'その他の帳票', kind: 'view', sub: '名簿・配置予定表・賃金計算表' },
    ],
  },
  {
    id: 'g-maint', ic: '⚙️', name: 'メンテナンス管理',
    items: [
      { id: 'maint-data', ic: '🛠', name: 'データメンテナンス', kind: 'view' },
      { id: 'maint-del', ic: '🗑', name: 'データ削除', kind: 'view' },
      { id: 'maint-zip', ic: '📮', name: '郵便番号更新', kind: 'view' },
      { id: 'maint-opt', ic: '⚙️', name: 'オプション設定', kind: 'view' },
      { id: 'maint-bulk', ic: '🔁', name: '勤務一括更新', kind: 'view' },
      { id: 'maint-io', ic: '💾', name: 'エクスポートインポート', kind: 'view' },
    ],
  },
  {
    id: 'g-paid', ic: '🌴', name: '有給管理',
    items: [
      { id: 'paid-sum', ic: '🔍', name: '有給集計', kind: 'view' },
      { id: 'paid-guard', ic: '👤', name: '隊員別 有給状況確認', kind: 'view' },
      { id: 'paid-month', ic: '✔️', name: '付与月別 有給状況確認', kind: 'view' },
      { id: 'rep-paid', ic: '🖨', name: '有給関連印刷', kind: 'report', report: 'paid' },
      { id: 'm-paid', ic: '🗄', name: '有給付与マスタ', kind: 'master', master: 'paidGrant' },
      { id: 'leave', ic: '🔄', name: '休暇申請の承認', kind: 'view', sub: '隊員アプリからの申請' },
    ],
  },
];

// GuardFlow 独自の常用画面（サイドバー上部に固定）
export const PINNED = [
  { id: 'dash', ic: '🏠', name: 'ダッシュボード' },
  { id: 'gantt', ic: '📊', name: '勤務ガント' },
  { id: 'monitor', ic: '📡', name: '上下番モニター' },
  { id: 'board', ic: '👥', name: '管制ボード' },
];

const ITEM_INDEX = new Map();
GROUPS.forEach(g => g.items.forEach(it => ITEM_INDEX.set(it.id, { ...it, group: g })));
export const findItem = id => ITEM_INDEX.get(id);
export const findGroup = id => GROUPS.find(g => g.id === id);
