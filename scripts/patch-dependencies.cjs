// SDK53's Metro0.82.5 expects image-size's old callable CommonJS export.
// The patched image-size2 exposes imageSize by name and accepts bytes, while
// Metro also passes file paths. Adapt both calls, pinned to the upstream file
// hash; fail closed on any drift.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../frontend');
const file = path.join(root, 'node_modules/metro/src/Assets.js');
const before = 'afb0698f853774aa7a6274eeb50c3283c56c6ada7aeb799e6cae19dd7d43ce2b';
const after = 'cb1805ca5066e7c859e3e819cd5d97e94f879682ae9aaa923fa1ba2bb423f92a';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const metro = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/metro/package.json'), 'utf8'));
if (metro.version !== '0.82.5') throw new Error('Review the image-size compatibility patch for this Metro version.');
const source = fs.readFileSync(file, 'utf8');
if (hash(source) === after) {
  console.log('Metro image-size compatibility patch verified.');
} else {
  if (process.argv.includes('--check') || hash(source) !== before) throw new Error('Metro image-size patch is missing or the upstream source has changed.');
  const patched = source.replace('const getImageSize = require("image-size");', 'const { imageSize } = require("image-size");\nconst getImageSize = (input) => imageSize(typeof input === "string" ? fs.readFileSync(input) : input);');
  if (hash(patched) !== after) throw new Error('Metro image-size patch integrity check failed.');
  fs.writeFileSync(file, patched);
  console.log('Applied the pinned Metro image-size CommonJS import patch.');
}

// React Navigation6's query-string7 uses a callable CommonJS decoder. The
// security-patched decoder is ESM; adapt its import without changing routing.
const queryPackage = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/query-string/package.json'), 'utf8'));
if (queryPackage.version !== '7.1.3') throw new Error('Review the URI decoder compatibility patch for this query-string version.');
const queryFile = path.join(root, 'node_modules/query-string/index.js');
const querySource = fs.readFileSync(queryFile, 'utf8');
const queryBefore = 'caa3f2c8b45dfe1e91db22ae10743af68de8d96f26515132bb52485ec0f037fa';
const queryAfter = 'fc1ca6e1961ba005e554b1bc0de932d6454bf59bfaea03d02c7261dbdcafcdbd';
if (hash(querySource) === queryAfter) {
  console.log('Query decoder compatibility patch verified.');
} else {
  if (process.argv.includes('--check') || hash(querySource) !== queryBefore) throw new Error('Query decoder patch is missing or the upstream source has changed.');
  const patched = querySource.replace("const decodeComponent = require('decode-uri-component');", "const decodeComponent = require('decode-uri-component').default;");
  if (hash(patched) !== queryAfter) throw new Error('Query decoder patch integrity check failed.');
  fs.writeFileSync(queryFile, patched);
  console.log('Applied the pinned query-string decoder import patch.');
}
