const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../frontend');
const requireFrontend = createRequire(path.join(root, 'package.json'));
const metroAssets = requireFrontend('metro/src/Assets');
const requireMetro = createRequire(requireFrontend.resolve('metro/package.json'));
const imageSize = requireMetro('image-size');
const requireExpoMetro = createRequire(requireFrontend.resolve('@expo/metro-config/package.json'));
const postcss = requireExpoMetro('postcss');

(async () => {
  assert.equal(typeof imageSize.imageSize, 'function');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18"><rect width="24" height="18"/></svg>');
  // A minimal synthetic JPEG SOF header exercises the dimension-parser API.
  const jpeg = Buffer.from([255,216,255,224,0,2,255,192,0,17,8,0,20,0,10,3,1,17,0,2,17,0,3,17,0,255,217]);
  assert.deepEqual(metroAssets.getAssetSize('png', png, 'fixture.png'), { width: 1, height: 1 });
  assert.deepEqual(metroAssets.getAssetSize('svg', svg, 'fixture.svg'), { width: 24, height: 18 });
  assert.deepEqual(metroAssets.getAssetSize('jpg', jpeg, 'fixture.jpg'), { width: 10, height: 20 });
  assert.throws(() => metroAssets.getAssetSize('png', Buffer.alloc(0), 'empty.png'));
  assert.throws(() => metroAssets.getAssetSize('png', Buffer.from('not an image'), 'invalid.png'));
  const screenshotPath = path.resolve(__dirname, '../docs/design/screenshots/home-light-compact.png');
  const screenshot = fs.readFileSync(screenshotPath);
  assert.equal(metroAssets.getAssetSize('png', screenshot, 'home.png').width, 390);
  const asset = await metroAssets.getAssetData(screenshotPath, 'assets/home.png', [], 'android', '/assets');
  assert.equal(asset.width, 390);
  assert.ok(asset.hash && asset.files.includes(screenshotPath));
  const css = await postcss([{ postcssPlugin: 'fixture-color', Declaration(declaration) {
    if (declaration.prop === 'color') declaration.value = '#06796b';
  } }]).process('@media (min-width: 20rem) { .fixture { color: red; padding: 12px; } }',
    { from: 'fixture.css', to: 'fixture.out.css', map: { inline: false } });
  assert.match(css.css, /color: #06796b/);
  assert.ok(css.map.toJSON().sources.includes('fixture.css'));
  assert.equal(postcss.parse(css.css).nodes[0].name, 'media');
  const query = requireFrontend('query-string');
  assert.deepEqual({ ...query.parse('name=Namibia%20demo&amount=23.45&name=Second') }, { amount: '23.45', name: ['Namibia demo', 'Second'] });
  assert.equal(query.parse('reference=%E2%82%AC').reference, '€');
  assert.equal(query.stringify({ reference: 'a+b & c' }), 'reference=a%2Bb%20%26%20c');
  assert.doesNotThrow(() => query.parse('invalid=%E0%A4%A&percent=%ZZ'));
  const start = performance.now();
  query.parse(`value=${'%E0%A4%A'.repeat(2000)}`);
  assert.ok(performance.now() - start < 1000, 'Malformed URI decoding must stay bounded for this fixture');
  console.log('PASS: Metro PNG/JPEG/SVG buffer and path assets; invalid images; PostCSS transforms/maps; query parser Unicode/arrays/round-trip/malformed-input compatibility.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
