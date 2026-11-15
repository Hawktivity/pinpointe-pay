// Seal a venue's voucher codes into a staff page, encrypted under the staff password.
//
// This repository is public, so the plain codes never go in it. The page carries them as
// AES-GCM ciphertext under a key derived from the password (PBKDF2-SHA-256), and decrypts
// them in the browser once someone types that password. Same Web Crypto calls as the page.
//
//   VOUCHER_PAGE_PASSWORD='...' node staff/seal-codes.mjs \
//     --csv path/to/codes.csv --page staff/rising-sun.html \
//     --venue "The Rising Sun" --minutes 15 --batch "The Rising Sun 15-minute tasters, 14 Nov 2026"
//
// The CSV is the one create_voucher_batch() produced: a "Code" header, then one code a line.
// Only the block between <script id="vault" ...> and </script> in the page is replaced.

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const ITERATIONS = 250000;

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0 || i + 1 >= process.argv.length) throw new Error(`missing --${name}`);
  return process.argv[i + 1];
}

const password = process.env.VOUCHER_PAGE_PASSWORD;
if (!password) throw new Error('set VOUCHER_PAGE_PASSWORD');

const codes = readFileSync(arg('csv'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !/^code$/i.test(line));
if (!codes.length) throw new Error('no codes in the CSV');
if (new Set(codes).size !== codes.length) throw new Error('the CSV repeats a code');

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const secret = { batch: arg('batch'), codes };
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(secret)));

const vault = {
  v: 1,
  venue: arg('venue'),
  minutes: Number(arg('minutes')),
  iter: ITERATIONS,
  salt: b64(salt),
  iv: b64(iv),
  ct: b64(new Uint8Array(ct)),
};

const pagePath = arg('page');
const page = readFileSync(pagePath, 'utf8');
const pattern = /(<script id="vault" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!pattern.test(page)) throw new Error('no vault block in the page');
writeFileSync(pagePath, page.replace(pattern, `$1${JSON.stringify(vault)}$2`));
console.log(`sealed ${codes.length} codes into ${pagePath}`);
