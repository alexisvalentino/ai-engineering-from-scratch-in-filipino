const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { publishTagalogTranslations } = require('./build.js');

test('the site build publishes only Tagalog UI and lesson translation files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-tl-publish-'));
  const sourceDir = path.join(temp, 'source');
  const destinationDir = path.join(temp, 'site', 'i18n', 'tl');
  const lesson = path.join(sourceDir, 'phases', '00-setup-and-tooling', '01-dev-environment', 'docs');
  fs.mkdirSync(lesson, { recursive: true });
  fs.mkdirSync(path.join(sourceDir, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'ui.json'), '{"strings":{"Catalog":"Kurikulum"}}\n');
  fs.writeFileSync(path.join(lesson, 'tl.md'), '# Pamagat\n');
  fs.writeFileSync(path.join(lesson, 'en.md'), '# English source\n');
  fs.writeFileSync(path.join(sourceDir, 'STYLE.md'), 'Editor guidance\n');
  fs.writeFileSync(path.join(sourceDir, 'README.md'), 'Contributor README\n');
  fs.writeFileSync(path.join(sourceDir, '.cache', 'phase.json'), '{}\n');

  try {
    assert.equal(publishTagalogTranslations({ sourceDir, destinationDir }), 2);
    assert.equal(fs.readFileSync(path.join(destinationDir, 'ui.json'), 'utf8'), '{"strings":{"Catalog":"Kurikulum"}}\n');
    assert.equal(
      fs.readFileSync(path.join(destinationDir, 'phases', '00-setup-and-tooling', '01-dev-environment', 'docs', 'tl.md'), 'utf8'),
      '# Pamagat\n'
    );
    assert.equal(fs.existsSync(path.join(destinationDir, 'STYLE.md')), false);
    assert.equal(fs.existsSync(path.join(destinationDir, 'README.md')), false);
    assert.equal(fs.existsSync(path.join(destinationDir, '.cache')), false);
    assert.equal(fs.existsSync(path.join(destinationDir, 'phases', '00-setup-and-tooling', '01-dev-environment', 'docs', 'en.md')), false);
  } finally {
    const resolvedTemp = path.resolve(temp);
    const allowedTempRoot = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolvedTemp.startsWith(allowedTempRoot));
    assert.ok(path.basename(resolvedTemp).startsWith('aiefs-tl-publish-'));
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
});

test('the lesson reader uses the local Tagalog document while other languages keep the published branch', () => {
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  assert.match(lessonHtml, /var translatedUrl = lang === 'tl'\s*\? 'i18n\/tl\/' \+ path \+ '\/docs\/tl\.md'/);
  assert.match(lessonHtml, /raw\.githubusercontent\.com\/rohitg00\/ai-engineering-from-scratch\/translations\/i18n\//);
});

test('the Tagalog UI dictionary is served from the local site output', () => {
  const i18n = require('./ui-i18n.js');
  assert.equal(i18n.dictionaryUrl('tl'), 'i18n/tl/ui.json');
  assert.equal(i18n.dictionaryUrl('fr'), `${i18n.TRANSLATIONS_BASE}fr/ui.json`);
});
