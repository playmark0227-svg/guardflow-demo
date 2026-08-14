#!/usr/bin/env node
// 配信キャッシュ対策。GitHub Pages は js/*.js を max-age=600 で返すため、
// 新しい index.html と古い JS が混ざると「ボタンを押しても何も起きない」状態になる。
// 全ての相対 import に同じ ?v= を付け、HTML と JS を必ず同じ世代で揃える。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const html = join(app, 'index.html');
const cur = (readFileSync(html, 'utf8').match(/js\/app\.js\?v=(\d+)/) || [, '0'])[1];
const v = String(Number(cur) + 1);

let n = 0;
const stamp = (file, re) => {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(re, (_, pre, path) => `${pre}${path}?v=${v}`);
  if (after !== before) { writeFileSync(file, after); n += (after.match(/\?v=/g) || []).length; }
};
stamp(html, /(src=")(\.\/js\/[\w.-]+\.js|js\/[\w.-]+\.js)(?:\?v=\d+)?/g);
for (const f of readdirSync(join(app, 'js')).filter(x => x.endsWith('.js')))
  stamp(join(app, 'js', f), /(from ')(\.\/[\w.-]+\.js)(?:\?v=\d+)?/g);

console.log(`?v=${v} を ${n} 箇所に付与しました`);
