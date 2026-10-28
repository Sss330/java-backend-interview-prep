// Usage: node scripts/check-translations.cjs <path-to-@iarna/toml> [--questions]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const toml = require(process.argv[2] || '@iarna/toml');
const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'data/tech-questions');
const translatedDir = path.join(root, 'data/translations/en/tech-questions');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
const files = walk(sourceDir).filter(file => file.endsWith('.toml'));
let total = 0;
const warnings = [];
for (const file of files) {
  const relative = path.relative(sourceDir, file);
  const source = toml.parse(fs.readFileSync(file, 'utf8'));
  const english = toml.parse(fs.readFileSync(path.join(translatedDir, relative), 'utf8'));
  assert.equal(english.category.id, source.category.id, relative);
  // Popularity is always rendered from the live Russian data, not translations.
  assert.deepEqual(english.questions.map(q => q.id), source.questions.map(q => q.id), relative);
  if (process.argv.includes('--questions')) console.log('\n' + relative);
  for (let i = 0; i < source.questions.length; i++) {
    const original = source.questions[i], translated = english.questions[i];
    const label = `${relative} #${original.id}`;
    const expectedHash = crypto.createHash('sha256').update(original.question + '\n' + original.answer).digest('hex');
    assert.equal(translated.source_hash, expectedHash, `Stale translation: ${label}`);
    assert.ok(translated.question.trim(), label);
    if (original.answer.trim()) assert.ok(translated.answer.trim(), label);
    assert.doesNotMatch(translated.question + translated.answer, /ZXQ\d*QXZ|ZXQITEM/, label);
    assert.doesNotMatch(translated.question + translated.answer, /[А-Яа-яЁё]/, `Untranslated text: ${label}`);
    if (!relative.endsWith('collections.toml')) {
      const fences = text => (text.match(/^\s*```/gm) || []).length;
      assert.equal(fences(translated.answer), fences(original.answer), `Code blocks changed: ${label}`);
      for (const url of original.answer.match(/https?:\/\/[^\s)<>]+/g) || []) {
        assert.ok(translated.answer.includes(url), `Missing URL ${url}: ${label}`);
      }
      const rowWidths = text => text.split('\n').filter(line => /^\s*\|/.test(line)).map(line => line.split(/(?<!\\)\|/).length);
      assert.deepEqual(rowWidths(translated.answer), rowWidths(original.answer), `Table grid changed: ${label}`);
      // API names inside inline code must survive translation.
      for (const code of original.answer.match(/`[^`\n]+`/g) || []) {
        // Correct two API-name typos present in the original answer.
        const expected = code.replace('AutoClosable', 'AutoCloseable').replace('Closable', 'Closeable');
        if (!/[А-Яа-яЁё]/.test(code) && !translated.answer.includes(expected)) warnings.push(`${label}: missing inline code ${code}`);
      }
    }
    if (process.argv.includes('--questions')) console.log(`${translated.id}. ${translated.question}`);
    total++;
  }
}
for (const warning of warnings) console.warn(warning);
assert.equal(warnings.length, 0, 'Inline-code audit failed');
console.log(`PASS: ${total} questions across ${files.length} categories; IDs, source hashes, translations, links, tables, and code blocks checked.`);
