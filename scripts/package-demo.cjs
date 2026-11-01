#!/usr/bin/env node
// Package only a completed Expo multi-platform export. This does not build an
// APK, install an app, contact the API, or establish native runtime acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolveApiHost } = require('../frontend/src/config/apiPolicy');

const repo = path.resolve(__dirname, '..');
const exportRoot = path.join(repo, 'frontend/dist-native');
const artifactRoot = path.join(repo, '.local/artifacts');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const bundlePattern = platform => new RegExp(`^_expo/static/js/${platform}/[A-Za-z0-9._-]+\\.${platform === 'web' ? 'js' : 'hbc'}$`);

function regularFile(relative) {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.split('/').some(part => ['..', '.', ''].includes(part)), 'Unsafe export path.');
  const file = path.join(exportRoot, relative);
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, `Expected a nonempty regular export file: ${relative}`);
  return fs.readFileSync(file);
}

function validateExport(apiOrigin) {
  assert.ok(fs.lstatSync(exportRoot).isDirectory() && !fs.lstatSync(exportRoot).isSymbolicLink(), 'A real frontend/dist-native export directory is required.');
  const metadata = JSON.parse(regularFile('metadata.json').toString('utf8'));
  assert.equal(metadata.version, 0, 'Unexpected Expo export metadata version; review before packaging.');
  assert.equal(metadata.bundler, 'metro');
  assert.deepEqual(Object.keys(metadata.fileMetadata).sort(), ['android', 'ios'], 'Both native platforms must be exported alongside the web entry.');
  const files = new Map([['metadata.json', regularFile('metadata.json')], ['index.html', regularFile('index.html')]]);
  const targets = {};
  for (const platform of ['android', 'ios']) {
    const entry = metadata.fileMetadata[platform];
    assert.ok(bundlePattern(platform).test(entry.bundle), `Expected the ${platform} Hermes bundle path.`);
    const bytes = regularFile(entry.bundle);
    assert.equal(bytes.subarray(0, 8).toString('hex'), 'c61fbc03c103191f', `Invalid ${platform} Hermes bytecode header.`);
    assert.ok(bytes.includes(Buffer.from(apiOrigin)), `The supplied API origin does not match the ${platform} export. Rebuild or pass the origin used for export.`);
    files.set(entry.bundle, bytes);
    targets[platform] = { bundle: entry.bundle, format: 'Hermes bytecode', installableApplication: false };
    assert.ok(Array.isArray(entry.assets), `Missing ${platform} asset metadata.`);
    for (const asset of entry.assets) {
      assert.match(asset.path, /^assets\/[a-f0-9]{32}$/, 'Unexpected native asset path.');
      const assetBytes = regularFile(asset.path);
      const magic = assetBytes.subarray(0, 4).toString('hex');
      const allowedMagic = { png: ['89504e47'], ttf: ['00010000', '74727565', '74746366'], otf: ['4f54544f'] };
      assert.ok(allowedMagic[asset.ext]?.includes(magic), `Unexpected asset format for ${asset.path}; review rather than packaging arbitrary files.`);
      files.set(asset.path, assetBytes);
    }
  }
  const html = files.get('index.html').toString('utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1].replace(/^\//, ''));
  assert.equal(scripts.length, 1, 'Expected one local Metro web entry script.');
  assert.ok(bundlePattern('web').test(scripts[0]), 'Web entry must reference the exported local Metro bundle.');
  const webBytes = regularFile(scripts[0]);
  assert.ok(webBytes.includes(Buffer.from(apiOrigin)), 'The supplied API origin does not match the web export.');
  files.set(scripts[0], webBytes);
  targets.web = { entry: 'index.html', bundle: scripts[0], format: 'static HTML and JavaScript', installableApplication: false };

  const directories = new Set(['assets', '_expo', '_expo/static', '_expo/static/js', ...['android', 'ios', 'web'].map(target => `_expo/static/js/${target}`)]);
  // Expo retains package-relative names for web font/image assets. These are
  // exported binary files, not a dependency tree. Admit only the two families
  // this app uses, and require byte-for-byte equality with a native asset.
  for (const folder of ['assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts',
    'assets/node_modules/@react-navigation/elements/lib/module/assets']) {
    if (!fs.existsSync(path.join(exportRoot, folder))) continue;
    for (let parent = folder; parent !== '.'; parent = path.posix.dirname(parent)) directories.add(parent);
    for (const entry of fs.readdirSync(path.join(exportRoot, folder), { withFileTypes: true })) {
      const match = /^[-A-Za-z0-9_]+\.([a-f0-9]{32})\.(ttf|png)$/.exec(entry.name);
      assert.ok(entry.isFile() && match, `Unexpected file in exported web assets: ${entry.name}`);
      const relative = `${folder}/${entry.name}`;
      const bytes = regularFile(relative);
      assert.ok(files.get(`assets/${match[1]}`)?.equals(bytes), `Web asset does not match native metadata: ${entry.name}`);
      files.set(relative, bytes);
    }
  }
  function checkDirectory(relative = '') {
    for (const entry of fs.readdirSync(path.join(exportRoot, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      assert.ok(!entry.isSymbolicLink(), `Symbolic links are not export artifacts: ${name}`);
      if (entry.isDirectory()) {
        assert.ok(directories.has(name), `Unexpected export directory: ${name}`);
        checkDirectory(name);
      } else assert.ok(entry.isFile() && files.has(name), `Unexpected or stale export file: ${name}`);
    }
  }
  checkDirectory();
  return { files, targets };
}

function assertFreshExport() {
  const completedAt = fs.statSync(path.join(exportRoot, 'metadata.json')).mtimeMs;
  const inputs = ['frontend/App.js', 'frontend/app.json', 'frontend/package.json', 'frontend/package-lock.json',
    'frontend/babel.config.js', 'frontend/metro.config.js', 'frontend/src', 'frontend/public', 'frontend/assets', 'scripts/patch-dependencies.cjs'];
  function visit(file) {
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), 'Unexpected symbolic link in source inputs.');
    if (stat.isDirectory()) fs.readdirSync(file).forEach(name => visit(path.join(file, name)));
    else assert.ok(stat.mtimeMs <= completedAt, `Source changed after the export: ${path.relative(repo, file)}. Re-export before packaging.`);
  }
  inputs.forEach(file => visit(path.join(repo, file)));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length && !['--check', '--help'].includes(args[0]) || args.length > 1) throw new Error('Use node scripts/package-demo.cjs [--check|--help].');
  if (args[0] === '--help') {
    console.log('After a successful all-platform export, set the same EXPO_PUBLIC_API_URL and run this script. --check validates without creating an archive. Source: frontend/dist-native only. Output: .local/artifacts/*.tar.gz + manifest.json. NOT an APK or native runtime verification.');
    return;
  }
  const apiOrigin = resolveApiHost(process.env.EXPO_PUBLIC_API_URL, { development: false });
  const { files, targets } = validateExport(apiOrigin);
  assertFreshExport();
  if (args[0] === '--check') {
    console.log(`PASS: ${files.size} export files, Android/iOS Hermes and web entry, matching HTTPS API origin; no archive created.`);
    return;
  }
  const app = readJson(path.join(repo, 'frontend/app.json')).expo;
  const packageVersion = readJson(path.join(repo, 'frontend/package.json')).version;
  assert.match(app.version, /^\d+\.\d+\.\d+$/);
  assert.match(packageVersion, /^\d+\.\d+\.\d+-demo\.\d+$/);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  assert.match(commit, /^[a-f0-9]{40}$/);
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim());
  const createdAt = new Date().toISOString();
  const placeholder = new URL(apiOrigin).hostname.endsWith('.invalid');
  const manifest = {
    schemaVersion: 1, appVersion: app.version, packageVersion, createdAt,
    buildType: 'Expo Metro multi-platform export; NOT an APK, IPA or installed native application',
    sourceAtPackaging: { commit, dirty, exportDirectory: 'frontend/dist-native' },
    api: { origin: apiOrigin, placeholder, limitation: placeholder
      ? 'Non-resolving compile-time placeholder. Rebuild with an authorized reachable HTTPS demo API before end-to-end use.'
      : 'Origin matched against exported bundles; this helper does not deploy or test API connectivity.' },
    targets, runtimeAcceptance: { android: 'unverified', ios: 'unverified', packagedWebAgainstConfiguredApi: 'unverified' },
    limitations: ['Simulated payments only; no real funds.', 'Export packaging does not satisfy the physical Android/emulator acceptance gate.',
      'No credentials, environment files, dependency package trees, source maps or unrelated export directories are packaged. Only validated binary web assets retain the Expo assets/node_modules path prefix.'],
    files: [...files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => ({ path: `export/${file}`, bytes: bytes.length, sha256: hash(bytes) })),
  };
  fs.mkdirSync(artifactRoot, { recursive: true });
  const stem = `nampay-${packageVersion}-export-${commit.slice(0, 8)}-${createdAt.replace(/[-:.]/g, '')}`;
  const archive = path.join(artifactRoot, `${stem}.tar.gz`);
  const sidecar = path.join(artifactRoot, `${stem}.manifest.json`);
  assert.ok(!fs.existsSync(archive) && !fs.existsSync(sidecar), 'Artifact name already exists.');
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nampay-export-package-'));
  try {
    for (const [file, bytes] of files) {
      const output = path.join(stage, 'export', file);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, bytes, { mode: 0o644, flag: 'wx' });
    }
    fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    const temporaryArchive = path.join(stage, 'package.tar.gz');
    execFileSync('tar', ['-czf', temporaryArchive, '-C', stage, 'manifest.json', 'export'], { stdio: 'pipe' });
    const bytes = fs.readFileSync(temporaryArchive);
    fs.writeFileSync(archive, bytes, { flag: 'wx' });
    fs.writeFileSync(sidecar, `${JSON.stringify({ ...manifest, archive: { filename: path.basename(archive), bytes: bytes.length, sha256: hash(bytes) } }, null, 2)}\n`, { flag: 'wx' });
    console.log(`Export archive: ${archive}`);
    console.log(`Manifest: ${sidecar}`);
    console.log(`SHA256: ${hash(bytes)}`);
    console.log('This archive contains web/JavaScript/Hermes assets, not an APK. Native runtime acceptance remains unverified.');
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}

try { main(); }
catch (error) { console.error(`Export packaging blocked: ${error.message}`); process.exitCode = 1; }
