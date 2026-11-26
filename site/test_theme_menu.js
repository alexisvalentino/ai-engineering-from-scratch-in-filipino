const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const menu = require('./theme-menu.js');

const { MODES, LABELS, modeFrom, resolve, storageValue } = menu;
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

test('the site exposes light mode only', () => {
  assert.deepEqual(MODES, ['light']);
  assert.deepEqual(LABELS, { light: 'Light' });
});

test('saved preferences and system settings cannot select dark mode', () => {
  for (const value of ['light', 'dark', 'system', 'auto', null, undefined]) assert.equal(modeFrom(value), 'light');
  assert.equal(resolve('dark', true), 'light');
  assert.equal(resolve('system', true), 'light');
});

test('the light-only mode clears the previous theme preference', () => {
  assert.equal(storageValue('system'), null);
  assert.equal(storageValue('light'), null);
  assert.equal(storageValue('dark'), null);
});

test('the shared header loads the theme menu on every page', () => {
  const header = read('header.js');
  assert.match(header, /script\.src = 'theme-menu\.js\?v=' \+ THEME_MENU_VERSION/);
  assert.match(header, /ensureThemeMenu\(\);/);
  const pages = fs.readdirSync(__dirname).filter((name) => name.endsWith('.html') && read(name).includes('id="themeToggle"'));
  assert.ok(pages.length >= 20, `found ${pages.length} pages with the theme button`);
  for (const page of pages) assert.match(read(page), /header\.js/, `${page} loads header.js`);
  for (const builder of ['build-hubs.js', 'build-practice.js', 'build-manuals.js', 'build-cheatsheets.js', 'build-skills.js']) {
    const source = read(builder);
    if (source.includes('themeToggle')) assert.match(source, /header\.js/, `${builder} pages load header.js`);
  }
});

test('the theme control is hidden and the document is kept in light mode', () => {
  const source = read('theme-menu.js');
  assert.match(source, /function forceLight\(\)/);
  assert.match(source, /button\.hidden = true/);
  assert.match(source, /removeItem\('theme'\)/);
  assert.doesNotMatch(source, /prefers-color-scheme/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /attributeFilter: \['data-theme'\]/);
});

test('theme controls stay hidden while the lesson page starts in light mode', () => {
  assert.match(read('style.css'), /#themeToggle \{ display: none !important; \}/);
  assert.match(read('lesson.html'), /root\.setAttribute\('data-theme', 'light'\)/);
});

test('removed theme controls are no longer part of the translated UI', () => {
  const keys = JSON.parse(read('ui-strings.json')).keys;
  for (const key of ['Change theme', 'Theme', 'System', 'Light', 'Dark']) assert.ok(!keys.includes(key), key);
});

test('legacy query strings and local preferences cannot reactivate dark mode', () => {
  const source = read('theme-menu.js');
  assert.match(source, /function forceLight\(\)/);
  assert.match(source, /root\.localStorage\.removeItem\('theme'\)/);
  assert.match(source, /new root\.MutationObserver\(forceLight\)/);
  assert.doesNotMatch(source, /location\.search|prefers-color-scheme/);
});
