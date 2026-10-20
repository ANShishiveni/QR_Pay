const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../docs/implementation');
const progress = JSON.parse(fs.readFileSync(path.join(base, 'progress.json'), 'utf8'));
const lines = ['# NamPay 2.0 implementation progress', '', `Branch: \`${progress.branch}\` · Baseline: \`${progress.baselineCommit}\``, '',
  'Machine-readable source: [progress.json](progress.json). Tasks become Done only after their evidence and acceptance criteria are verified.', '',
  `Updated: ${progress.updatedAt}`, ''];
for (const phase of progress.phases) {
  lines.push(`## Phase ${phase.phase} — ${phase.title}`, '', `Status: **${phase.status}**`, '', '| Task | Status | Evidence | Commit / PR | Next action |', '| --- | --- | --- | --- | --- |');
  for (const task of phase.tasks) lines.push(`| ${task.id} | ${task.status} | ${task.evidence.join('; ') || 'Not verified'} | ${task.commit || 'Working tree'} | ${task.nextAction || 'None'} |`);
  lines.push('');
}
lines.push('## Current limitations', '', ...progress.limitations.map(item => `- ${item}`), '');
fs.writeFileSync(path.join(base, 'PROGRESS.md'), lines.join('\n'));
