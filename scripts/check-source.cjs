#!/usr/bin/env node
/*
 * Local syntax and targeted security regression checks, never executing app code.
 * Requires the existing frontend @babel/parser installation; no network access.
 * This is not semantic lint, type checking, secret entropy detection, data-flow
 * analysis, or verification of permissions in a built native application.
 * Secret rules inspect source/configuration, not ignored files, history or images.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const requireFrontend = createRequire(path.join(ROOT, 'frontend/package.json'));
const parser = requireFrontend('@babel/parser');
const SOURCE = /\.(?:[cm]?js|jsx|ts|tsx)$/;
const CONFIG = /(?:\.(?:json|ya?ml|toml|ini|sh|html)|(?:^|\/)\.env(?:\.[^/]*)?|(?:^|\/)\.firebaserc)$/;
const TEST_FILE = /(?:^|\/)(?:__tests__|tests|fixtures)(?:\/|$)|(?:^|\/)[^/]*[.-](?:test|spec)\.[^/]+$|^scripts\/(?:[^/]*smoke\.[cm]?js|ci-[^/]+\.sh)$/;
const SECRET_NAME = /^(?:jwtsecret|qrsecret|twilioauthtoken|twilioaccountsid|stripesecretkey|firebaseprivatekey|privatekey|clientsecret|awssecretaccesskey|password|authtoken|accesstoken|refreshtoken)$/;
const normalize = value => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
const placeholder = value => /^(?:replace[-_]me|change[-_]me|your[-_].*|<[^>]+>|\$\{[^}]+\}|(?:test|demo|mock|example|placeholder)(?:[-_ ].*)?)$/i.test(value);
const syntheticFixture = (file, name, value) => TEST_FILE.test(file) && (normalize(name) === 'password' || value.length < 16 ||
  /(?:test|demo|mock|example|fixture|synthetic|smoke|local|not[-_ ](?:real|secret))/i.test(value) || /^(.)\1{15,}$/.test(value));
const lineAt = (source, offset) => source.slice(0, offset).split('\n').length;

function finding(file, line, rule, message) { return { file, line: line || 1, rule, message }; }
function nameOf(node) {
  if (!node) return '';
  if (['Identifier', 'JSXIdentifier'].includes(node.type)) return node.name;
  if (node.type === 'StringLiteral') return node.value;
  if (['MemberExpression', 'OptionalMemberExpression', 'JSXMemberExpression'].includes(node.type)) return nameOf(node.property);
  return '';
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function literal(node, constants = new Map()) {
  if (!node) return undefined;
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
  if (node.type === 'Identifier') return constants.get(node.name);
  return undefined;
}
function credentialLiterals(node) {
  if (node?.type === 'LogicalExpression') return credentialLiterals(node.right);
  if (node?.type === 'ConditionalExpression') return [...credentialLiterals(node.consequent), ...credentialLiterals(node.alternate)];
  const value = literal(node);
  return typeof value === 'string' && value ? [value] : [];
}

function scanSecrets(file, source) {
  const findings = [];
  const patterns = [
    ['PRIVATE_KEY', /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g],
    ['LIVE_STRIPE_KEY', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
    ['TWILIO_ACCOUNT_SID', /\bAC[a-fA-F0-9]{32}\b/g],
  ];
  for (const [rule, expression] of patterns) {
    for (const match of source.matchAll(expression)) {
      if (rule === 'TWILIO_ACCOUNT_SID' && TEST_FILE.test(file) && /^AC(.)\1{31}$/.test(match[0])) continue;
      findings.push(finding(file, lineAt(source, match.index), rule, 'Credential-shaped material must not be committed.'));
    }
  }
  if (/(?:^|\/)\.env(?:\.[^/]*)?$/.test(file) || /\.sh$/.test(file)) {
    source.split('\n').forEach((line, index) => {
      const assignment = /^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(['"]?)([^\r\n]*?)\2\s*(?:#.*)?$/.exec(line);
      if (!assignment || !SECRET_NAME.test(normalize(assignment[1]))) return;
      const value = assignment[3].replace(/\s+\\$/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value && !value.startsWith('$') && !placeholder(value) && !syntheticFixture(file, assignment[1], value)) {
        findings.push(finding(file, index + 1, 'HARDCODED_CREDENTIAL', 'Read credentials from the runtime environment.'));
      }
    });
  }
  return findings;
}

function scanAst(file, ast) {
  const findings = [];
  if (file === 'scripts/check-source.cjs') return findings;
  const constants = new Map();
  const unsafeStorage = new Set(['localStorage', 'sessionStorage', 'AsyncStorage']);
  walk(ast, node => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      const value = literal(node.init);
      if (value !== undefined) constants.set(node.id.name, value);
    }
    if (node.type === 'ImportDeclaration' && /(?:async-storage|utils\/asyncStorage)$/.test(node.source.value)) {
      node.specifiers.forEach(specifier => unsafeStorage.add(specifier.local.name));
    }
  });
  const add = (node, rule, message) => findings.push(finding(file, node.loc?.start.line, rule, message));
  const tokenName = value => /^(?:(?:auth|access|refresh|session)?token|jwt)$/.test(normalize(value)) || /(?:^|[._-])session(?:[._-]|$)/i.test(value);
  const isUnsafeStorage = node => node && (unsafeStorage.has(nameOf(node)) || (node.type === 'MemberExpression' && isUnsafeStorage(node.object)));
  const tokenReference = node => {
    let found = false;
    walk(node, child => {
      if ((child.type === 'Identifier' || child.type === 'MemberExpression') && tokenName(nameOf(child))) found = true;
    });
    return found;
  };
  walk(ast, node => {
    const assigned = node.type === 'VariableDeclarator' ? [nameOf(node.id), node.init]
      : node.type === 'ObjectProperty' ? [nameOf(node.key), node.value]
        : node.type === 'AssignmentExpression' ? [nameOf(node.left), node.right] : null;
    if (assigned) {
      const [name, expression] = assigned;
      const value = literal(expression);
      // Password validation maps commonly use conditional messages. Restrict the
      // generic password rule to literal assignments; explicit key names also
      // check literal fallback branches.
      const credentials = normalize(name) === 'password' ? (typeof value === 'string' && value ? [value] : []) : credentialLiterals(expression);
      if (SECRET_NAME.test(normalize(name)) && credentials.some(credential => !syntheticFixture(file, name, credential))) {
        add(node, 'HARDCODED_CREDENTIAL', 'Read credentials from the runtime environment.');
      }
      if (!TEST_FILE.test(file) && file.startsWith('frontend/') && /^(?:wallet)?balance$/i.test(name) && Number(value) > 0) {
        add(node, 'HARDCODED_BALANCE', 'A displayed balance must have an authoritative source.');
      }
    }
    if (TEST_FILE.test(file)) return;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && isUnsafeStorage(node.callee.object)) {
      const method = nameOf(node.callee);
      const pairs = method === 'multiSet' && node.arguments[0]?.type === 'ArrayExpression'
        ? node.arguments[0].elements.filter(Boolean).map(item => item.elements || [])
        : ['setItem', 'setItemAsync'].includes(method) ? [node.arguments] : [];
      if (pairs.some(([key, value]) => tokenName(literal(key, constants) || '') || tokenReference(value))) {
        add(node, 'PLAINTEXT_TOKEN_STORAGE', 'Use native SecureStore or the web HttpOnly session cookie.');
      }
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && isUnsafeStorage(node.left.object) &&
        (tokenName(nameOf(node.left)) || tokenReference(node.right))) {
      add(node, 'PLAINTEXT_TOKEN_STORAGE', 'Use native SecureStore or the web HttpOnly session cookie.');
    }
    if (!file.startsWith('frontend/')) return;
    if (node.type === 'VariableDeclarator' && node.id.type === 'ArrayPattern' && node.init?.type === 'CallExpression' && nameOf(node.init.callee) === 'useState') {
      const name = nameOf(node.id.elements[0]);
      if (/^(?:cardnumber|pan|cvv|cvc|securitycode)$/i.test(normalize(name))) {
        add(node, 'RAW_CARD_CAPTURE', 'Choose a predefined test instrument instead of collecting PAN/CVV.');
      }
      if (/^(?:wallet)?balance$/i.test(name) && Number(literal(node.init.arguments[0])) > 0) {
        add(node, 'HARDCODED_BALANCE', 'A displayed balance must have an authoritative source.');
      }
    }
    if (node.type === 'JSXOpeningElement' && /^(?:input|TextInput|AppInput|AppTextInput|TextField)$/.test(nameOf(node.name))) {
      const rawField = node.attributes.some(attribute => {
        if (attribute.type !== 'JSXAttribute' || !['name', 'label', 'placeholder', 'testID', 'value'].includes(nameOf(attribute.name))) return false;
        const expression = attribute.value?.type === 'JSXExpressionContainer' ? attribute.value.expression : attribute.value;
        const value = literal(expression) ?? nameOf(expression);
        return /^(?:cardnumber|creditcardnumber|pan|cvv|cvc|securitycode)$/.test(normalize(value));
      });
      if (rawField) add(node, 'RAW_CARD_CAPTURE', 'Choose a predefined test instrument instead of collecting PAN/CVV.');
    }
  });
  return findings;
}

function scanJsonCredentials(file, value, source) {
  const findings = [];
  const visit = object => {
    for (const [key, item] of Object.entries(object || {})) {
      if (SECRET_NAME.test(normalize(key)) && typeof item === 'string' && item && !syntheticFixture(file, key, item)) {
        findings.push(finding(file, lineAt(source, Math.max(0, source.indexOf(JSON.stringify(key)))), 'HARDCODED_CREDENTIAL', 'Read credentials from the runtime environment.'));
      }
      if (item && typeof item === 'object') visit(item);
    }
  };
  visit(value);
  return findings;
}

function parseSource(file, source) {
  try {
    return { ast: parser.parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: !file.startsWith('frontend/'),
      plugins: ['jsx', ...(/\.tsx?$/.test(file) ? ['typescript'] : [])] }), findings: [] };
  } catch (error) {
    return { findings: [finding(file, error.loc?.line, 'SYNTAX', 'Source did not parse; run the editor/parser for details.')] };
  }
}

function configurationChecks(read) {
  const findings = [];
  const load = file => {
    try { return JSON.parse(read(file)); } catch { findings.push(finding(file, 1, 'CONFIG_JSON', 'Required configuration is missing or invalid JSON.')); return null; }
  };
  const firebase = load('firebase.json');
  const project = load('.firebaserc');
  if (project && !/^demo-[a-z0-9-]+$/.test(project.projects?.default || '')) {
    findings.push(finding('.firebaserc', 1, 'FIREBASE_DEMO_PROJECT', 'The default Firebase project must be a demo project.'));
  }
  const rulesPath = firebase?.database?.rules;
  if (firebase && (typeof rulesPath !== 'string' || rulesPath !== 'backend/database.rules.json')) {
    findings.push(finding('firebase.json', 1, 'FIREBASE_RULES_PATH', 'Use the reviewed backend database rules.'));
  }
  const rules = load('backend/database.rules.json');
  let denied = rules?.rules?.['.read'] === false && rules?.rules?.['.write'] === false;
  const checkRules = object => {
    for (const [key, value] of Object.entries(object || {})) {
      if (['.read', '.write'].includes(key) && value !== false) denied = false;
      if (value && typeof value === 'object') checkRules(value);
    }
  };
  checkRules(rules?.rules);
  if (rules && !denied) findings.push(finding('backend/database.rules.json', 1, 'FIREBASE_CLIENT_ACCESS', 'All direct Firebase client reads and writes must remain denied.'));
  if (firebase) {
    const emulators = firebase.emulators || {};
    if (!['auth', 'database'].every(service => ['127.0.0.1', 'localhost', '::1'].includes(emulators[service]?.host)) ||
        Object.values(emulators).some(value => value?.host && !['127.0.0.1', 'localhost', '::1'].includes(value.host))) {
      findings.push(finding('firebase.json', 1, 'EMULATOR_LOOPBACK', 'Firebase emulators must bind to explicit loopback hosts.'));
    }
  }
  const appConfig = load('frontend/app.json');
  const app = appConfig?.expo;
  if (appConfig && !app) findings.push(finding('frontend/app.json', 1, 'EXPO_CONFIG', 'The required Expo configuration is missing.'));
  if (app) {
    const permission = value => value.replace(/^android\.permission\./, '');
    const forbidden = /^(?:RECORD_AUDIO|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_(?:AUDIO|IMAGES|VIDEO))$/;
    if ((app.android?.permissions || []).some(value => forbidden.test(permission(value))) || app.ios?.infoPlist?.NSMicrophoneUsageDescription) {
      findings.push(finding('frontend/app.json', 1, 'UNNECESSARY_PERMISSION', 'Audio and broad storage permissions are unnecessary for QR/photo selection.'));
    }
    const blocked = new Set((app.android?.blockedPermissions || []).map(permission));
    if (!['RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'].every(value => blocked.has(value))) {
      findings.push(finding('frontend/app.json', 1, 'PERMISSION_BLOCKLIST', 'Block transitive audio and broad storage permissions.'));
    }
    const camera = (app.plugins || []).find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-camera');
    if (camera?.[1]?.recordAudioAndroid !== false) {
      findings.push(finding('frontend/app.json', 1, 'CAMERA_AUDIO_DISABLED', 'The camera plugin must explicitly disable Android audio recording.'));
    }
  }
  return findings;
}

function run() {
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean))];
  const findings = [];
  let sources = 0;
  let configs = 0;
  for (const file of files) {
    if ((!SOURCE.test(file) && !CONFIG.test(file)) || !fs.existsSync(path.join(ROOT, file))) continue;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    findings.push(...scanSecrets(file, source));
    if (SOURCE.test(file)) {
      sources++;
      const result = parseSource(file, source);
      findings.push(...result.findings);
      if (result.ast) findings.push(...scanAst(file, result.ast));
      if (!file.startsWith('frontend/') && /\.[cm]?js$/.test(file)) {
        const checked = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
        if (checked.status !== 0) findings.push(finding(file, Number(checked.stderr?.match(/:(\d+)\r?\n/)?.[1]) || 1, 'NODE_SYNTAX', 'Node could not parse this server/tool script.'));
      }
    } else if (file.endsWith('.json') || file === '.firebaserc') {
      configs++;
      try { findings.push(...scanJsonCredentials(file, JSON.parse(source), source)); } catch { findings.push(finding(file, 1, 'JSON_SYNTAX', 'Configuration is not valid JSON.')); }
    }
  }
  findings.push(...configurationChecks(file => fs.readFileSync(path.join(ROOT, file), 'utf8')));
  const unique = [...new Map(findings.map(item => [`${item.file}:${item.line}:${item.rule}`, item])).values()];
  for (const item of unique) console.error(`${item.file}:${item.line} [${item.rule}] ${item.message}`);
  console.log(`Source check: ${sources} JavaScript/TypeScript files, ${configs} JSON configs, ${unique.length} finding(s).`);
  console.log('Scope: syntax and targeted static rules; semantic lint, type checks, runtime tests and built-native permission checks remain separate.');
  return unique.length ? 1 : 0;
}

function selfTest() {
  const assert = require('node:assert/strict');
  const rules = (source, file = 'frontend/src/example.js') => {
    const parsed = parseSource(file, source);
    return [...parsed.findings, ...scanSecrets(file, source), ...(parsed.ast ? scanAst(file, parsed.ast) : [])].map(item => item.rule);
  };
  assert.ok(rules('const x = <View />;').length === 0);
  assert.ok(rules('const x: number = 1;', 'frontend/src/example.ts').length === 0);
  assert.ok(rules('const x = ;').includes('SYNTAX'));
  assert.ok(rules("localStorage.setItem('authToken', response.token);").includes('PLAINTEXT_TOKEN_STORAGE'));
  assert.ok(rules("import Store from '@react-native-async-storage/async-storage'; Store.multiSet([['authToken', token]]);").includes('PLAINTEXT_TOKEN_STORAGE'));
  assert.ok(!rules("import * as SecureStore from 'expo-secure-store'; SecureStore.setItemAsync('authToken', token);").length);
  assert.ok(!rules("localStorage.setItem('theme', 'dark');").length);
  assert.ok(rules("const [cvv, setCvv] = useState('');").includes('RAW_CARD_CAPTURE'));
  assert.ok(rules('const field = <TextInput placeholder="Card number" />;').includes('RAW_CARD_CAPTURE'));
  assert.ok(rules('const [balance, setBalance] = useState(1000);').includes('HARDCODED_BALANCE'));
  assert.ok(!rules('const balance = server.balance;').length);
  assert.ok(rules("const jwtSecret = 'synthetic-credential-for-check';").includes('HARDCODED_CREDENTIAL'));
  assert.ok(rules("const jwtSecret = process.env.JWT_SECRET || 'fallback';").includes('HARDCODED_CREDENTIAL'));
  assert.ok(!rules("const jwtSecret = 'synthetic-credential-for-check';", 'backend/tests/example.test.js').length);
  assert.ok(rules("const jwtSecret = 'Ab12Cd34Ef56Gh78';", 'backend/tests/example.test.js').includes('HARDCODED_CREDENTIAL'));
  assert.ok(scanSecrets('backend/.env.example', 'JWT_SECRET=replace-me').length === 0);
  assert.ok(scanSecrets('backend/.env', 'JWT_SECRET=synthetic-credential-for-check').some(item => item.rule === 'HARDCODED_CREDENTIAL'));
  const credentialConfig = { jwtSecret: 'synthetic-credential-for-check' };
  assert.ok(scanJsonCredentials('backend/config.json', credentialConfig, JSON.stringify(credentialConfig)).some(item => item.rule === 'HARDCODED_CREDENTIAL'));
  for (const [value, rule] of [
    [['-----BEGIN', 'PRIVATE KEY-----'].join(' '), 'PRIVATE_KEY'],
    [['sk', 'live', 'Ab12'.repeat(8)].join('_'), 'LIVE_STRIPE_KEY'],
    ['AC' + 'a1b2'.repeat(8), 'TWILIO_ACCOUNT_SID'],
  ]) {
    const result = scanSecrets('backend/config/example.js', `const value = '${value}';`);
    assert.ok(result.some(item => item.rule === rule));
    assert.ok(!JSON.stringify(result).includes(value));
  }
  const configs = Object.fromEntries(['firebase.json', '.firebaserc', 'backend/database.rules.json', 'frontend/app.json'].map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]));
  const openRules = { ...configs, 'backend/database.rules.json': JSON.stringify({ rules: { '.read': false, '.write': false, users: { '.read': true } } }) };
  assert.ok(configurationChecks(file => openRules[file]).some(item => item.rule === 'FIREBASE_CLIENT_ACCESS'));
  const liveProject = { ...configs, '.firebaserc': JSON.stringify({ projects: { default: 'production-project' } }) };
  assert.ok(configurationChecks(file => liveProject[file]).some(item => item.rule === 'FIREBASE_DEMO_PROJECT'));
  const app = JSON.parse(configs['frontend/app.json']);
  app.expo.android.permissions.push('android.permission.RECORD_AUDIO');
  assert.ok(configurationChecks(file => file === 'frontend/app.json' ? JSON.stringify(app) : configs[file]).some(item => item.rule === 'UNNECESSARY_PERMISSION'));
  console.log('Source checker self-test passed: syntax, secret redaction, token storage, card capture, balances and configuration guards.');
}

if (require.main === module) {
  try {
    if (process.argv.includes('--self-test')) selfTest();
    else process.exitCode = run();
  } catch (error) {
    // Exception messages can include source/secret material; do not print them.
    console.error(`Source checker could not finish (${error.code || error.name}). Verify local installs, Git access and required configuration.`);
    process.exitCode = 1;
  }
}
module.exports = { scanSecrets, scanAst, parseSource, configurationChecks, run, selfTest };
