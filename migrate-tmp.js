const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Han123456', database: 'wangpan'
  });
  for (const sql of [
    'ALTER TABLE resources ADD COLUMN meta JSON DEFAULT NULL',
    'ALTER TABLE topics ADD COLUMN field_schema JSON DEFAULT NULL',
  ]) {
    try { await conn.execute(sql); console.log('Added:', sql.slice(13,50)); }
    catch (e) { if (e.code === 'ER_DUP_FIELDNAME') console.log('Already exists, skip'); else throw e; }
  }
  const schema = JSON.stringify([
    { key: 'subject', label: '科目', type: 'select', options: ['语文','数学','英语','物理','化学','生物','政治','历史','地理','文综','理综','技术'] },
    { key: 'year',    label: '年份', type: 'select', options: ['2025','2024','2023','2022','2021','2020','2019','2018','2017','2016'] },
    { key: 'region',  label: '地区', type: 'select', options: ['全国','北京','上海','天津','重庆','广东','江苏','浙江','山东','四川','湖南','湖北','河南','河北','福建','陕西','辽宁','安徽','黑龙江','吉林','山西','云南','贵州','广西','内蒙古','宁夏','新疆','西藏','海南','青海','甘肃','江西'] }
  ]);
  await conn.execute('UPDATE topics SET field_schema = ? WHERE slug = ?', [schema, 'gaokaozhenti']);
  const [rows] = await conn.query('SELECT slug, JSON_LENGTH(field_schema) as fields FROM topics WHERE slug = ?', ['gaokaozhenti']);
  console.log('OK:', JSON.stringify(rows));
  await conn.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
