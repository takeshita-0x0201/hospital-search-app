/**
 * 診療科データ（厚生労働省 標準コード表：E-20）
 */
const SPECIALTIES = [
    { code: '010', name: '内科' },
    { code: '020', name: '小児科' },
    { code: '030', name: '精神科' },
    { code: '040', name: '神経科' },
    { code: '050', name: '呼吸器科' },
    { code: '060', name: '消化器科' },
    { code: '070', name: '循環器科' },
    { code: '080', name: 'アレルギー科' },
    { code: '090', name: 'リウマチ科' },
    { code: '100', name: '小児外科' },
    { code: '110', name: '外科' },
    { code: '120', name: '整形外科' },
    { code: '130', name: '形成外科' },
    { code: '140', name: '美容外科' },
    { code: '150', name: '脳神経外科' },
    { code: '160', name: '呼吸器外科' },
    { code: '170', name: '心臓血管外科' },
    { code: '180', name: '小児外科' },
    { code: '190', name: '皮膚泌尿器科' },
    { code: '200', name: '性病科' },
    { code: '210', name: 'ひ尿器科' },
    { code: '220', name: '産婦人科' },
    { code: '230', name: '産科' },
    { code: '240', name: '婦人科' },
    { code: '250', name: '眼科' },
    { code: '260', name: '耳鼻いんこう科' },
    { code: '270', name: '気管食道科' },
    { code: '280', name: '放射線科' },
    { code: '290', name: '麻酔科' },
    { code: '300', name: '治療科' },
    { code: '310', name: '臨床検査科' },
    { code: '320', name: '救急科' },
    { code: '330', name: 'リハビリテーション科' },
    { code: '340', name: '病理診断科' },
    { code: '350', name: '臨床検査科' },
    { code: '360', name: '矯正歯科' },
    { code: '370', name: '小児歯科' },
    { code: '380', name: '口腔外科' },
    { code: '390', name: '歯科' },
    { code: '400', name: '乳腺外科' },
    { code: '410', name: '内視鏡内科' },
    { code: '420', name: '人工透析科' },
    { code: '430', name: '疼痛緩和内科' },
    { code: '440', name: '疼痛緩和外科' },
    { code: '450', name: '老年内科' },
    { code: '460', name: '老年精神科' },
    { code: '470', name: '老年外科' },
    { code: '480', name: '老年歯科' },
    { code: '490', name: '炎症性腸疾患内科' },
    { code: '500', name: '炎症性腸疾患外科' },
    { code: '510', name: '臨床腫瘍科' },
    { code: '520', name: '感染症内科' },
    { code: '530', name: '感染症外科' },
    { code: '540', name: '糖尿病内科' },
    { code: '550', name: '糖尿病外科' },
    { code: '560', name: '内分泌内科' },
    { code: '570', name: '内分泌外科' },
    { code: '580', name: '脳神経内科' },
    { code: '590', name: '腫瘍内科' },
    { code: '600', name: '腫瘍外科' },
    { code: '610', name: '女性内科' },
    { code: '620', name: '女性外科' },
    { code: '630', name: '移植外科' }
];

// よく検索される診療科（クイックタグ用）
const COMMON_SPECIALTIES = [
    '010', // 内科
    '020', // 小児科
    '110', // 外科
    '120', // 整形外科
    '220', // 産婦人科
    '250', // 眼科
    '260', // 耳鼻いんこう科
    '390'  // 歯科
];

// コード→名前の変換辞書
const SPECIALTY_MAP = SPECIALTIES.reduce((map, specialty) => {
    map[specialty.code] = specialty.name;
    return map;
}, {});

// 名前→コードの変換辞書
const SPECIALTY_CODE_MAP = SPECIALTIES.reduce((map, specialty) => {
    map[specialty.name] = specialty.code;
    return map;
}, {});
