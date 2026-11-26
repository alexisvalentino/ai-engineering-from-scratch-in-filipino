const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const tierLabel = /\b(?:Backer|Bronze|Silver|Gold|Platinum|Diamond|Title Partner)\b/i;
const projectUrl = 'https://github.com/alexisvalentino/ai-engineering-from-scratch-in-filipino';
const profileUrl = 'https://github.com/alexisvalentino';

function between(text, start, end, file) {
  const section = text.split(start)[1];
  assert.ok(section, `${file} is missing ${start.trim()}`);
  const placement = section.split(end)[0];
  assert.notEqual(placement, section, `${file} is missing ${end.trim()}`);
  return placement;
}

function checkSponsorLink(text, file) {
  const htmlLink = text.match(/href="([^"]*SPONSORS\.md)">([^<]+)<\/a>/);
  const markdownLink = text.match(/\[([^\]]+)\]\(([^)]*SPONSORS\.md)\)/);
  const sponsorLink = htmlLink
    ? { target: htmlLink[1], label: htmlLink[2] }
    : markdownLink
      ? { target: markdownLink[2], label: markdownLink[1] }
      : null;
  assert.ok(sponsorLink, file);
  assert.equal(path.resolve(root, path.dirname(file), sponsorLink.target), path.join(root, 'SPONSORS.md'), file);
  assert.ok(sponsorLink.label.trim(), file);
  if (file === 'README.md') assert.equal(sponsorLink.label, 'Sponsorship status');
}

test('README highlights the Filipino repo and profile with one quiet source credit', () => {
  const readme = read('README.md');
  const placement = between(readme, '### Follow the project\n', '## Why build it from scratch', 'README.md');
  assert.ok(placement.includes(projectUrl));
  assert.ok(placement.includes(profileUrl));
  assert.match(readme, /original curriculum by Rohit Ghumare\./);
  assert.equal((readme.match(/Rohit Ghumare/g) || []).length, 1);
  assert.doesNotMatch(readme, /github\.com\/rohitg00|serpapi|See all sponsors and backers|114,584|181,995/);
  assert.doesNotMatch(readme, /STATS:START|STATS:END/);
  assert.doesNotMatch(readme, tierLabel);
});

test('sponsor and backer pages make the current status clear', () => {
  for (const file of ['README.md', 'SPONSORS.md']) {
    assert.match(read(file), /\[[^\]]+\]\(BACKERS\.md\)/, file);
  }
  const backers = read('BACKERS.md');
  assert.match(backers, /^# Backers\n/);
  assert.ok(backers.includes('currently has no sponsors or backers'));
  assert.ok(backers.includes(projectUrl));
  assert.doesNotMatch(backers, /SerpApi|CodeRabbit|Vercel Open Source Program/);
  for (const [, destination] of backers.matchAll(/\]\(([^)]+)\)/g)) {
    if (destination.startsWith('https://')) {
      assert.equal(new URL(destination).protocol, 'https:', destination);
    } else {
      assert.ok(fs.statSync(path.join(root, destination)).isFile(), destination);
    }
  }
});

test('supporter navigation survives translated README headings', () => {
  const translations = fs.readdirSync(path.join(root, 'i18n'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join('i18n', entry.name, 'README.md'));
  assert.ok(translations.length > 0);
  for (const file of ['README.md', ...translations]) {
    const text = read(file);
    assert.ok(text.includes('href="#supporters"') || text.includes('](#supporters)'), file);
    assert.ok(text.includes('<a id="supporters"></a>'), file);
    checkSponsorLink(text, file);
    const sources = [...text.matchAll(/<source media="\(min-width: 768px\)" srcset="([^"]+)" width="48%">/g)];
    if (file === 'README.md') {
      assert.equal(sources.length, 0, file);
    } else {
      assert.equal(sources.length, 1, file);
      for (const [, src] of sources) {
        assert.ok(fs.statSync(path.resolve(root, path.dirname(file), src)).isFile(), file);
        assert.ok(text.includes(`<img src="${src}"`), file);
      }
    }
    if (file !== 'README.md') {
      assert.doesNotMatch(
        text,
        /Thank you to our sponsors\.|Your support keeps every lesson free and open source\.|See all supporters|SerpApi\. Web Search API|## Sponsor the work|Free, MIT-licensed, 523 lessons\.|See all sponsors and backers|Want to support the work\?/
      );
    }
  }
});

test('sponsor navigation accepts translated labels without accepting broken targets', () => {
  const file = 'i18n/he/README.md';
  checkSponsorLink('<a href="../../SPONSORS.md">Become a sponsor</a>', file);
  checkSponsorLink('<a href="../../SPONSORS.md">תמכו בפרויקט</a>', file);
  assert.throws(() => checkSponsorLink('<a href="SPONSORS.md">תמכו בפרויקט</a>', file));
  assert.throws(() => checkSponsorLink('<a href="../../SPONSORS.md"> </a>', file));
});

test('sponsors page is rendered from SPONSORS.md at build time', () => {
  const { renderSponsorsMarkdown } = require('./build.js');
  const page = read('site/sponsors.html');
  const generated = between(page, '<!-- GENERATED:SPONSORS:START -->\n', '\n          <!-- GENERATED:SPONSORS:END -->', 'site/sponsors.html');
  assert.equal(generated, renderSponsorsMarkdown(read('SPONSORS.md')));
  assert.ok(generated.startsWith('<h1 id="sponsorship">Sponsorship</h1>'));
  for (const anchor of ['hardware-lab-partner', 'hard-rules', 'pricing-anchors']) {
    assert.ok(generated.includes(`id="${anchor}"`), anchor);
    assert.ok(generated.includes(`href="#${anchor}"`), anchor);
  }
  assert.ok(generated.includes('None listed for the Filipino edition.'));
  assert.ok(generated.includes('historical reference'));
  assert.doesNotMatch(generated, /SerpApi/);
  assert.ok(generated.includes('href="https://github.com/alexisvalentino/ai-engineering-from-scratch-in-filipino/blob/main/BACKERS.md" target="_blank" rel="noopener"'));
  assert.ok(generated.includes('<td class="align-right">521,690</td>'));
  assert.ok(generated.includes('<td class="align-right">280,632</td>'));
  assert.ok(generated.includes('<td class="align-right">65,223</td>'));
  assert.ok(generated.includes('<td class="align-right">11,000+</td>'));
  assert.ok(generated.includes('<li><strong>Open-source baseline</strong>'));
  const howTo = between(generated, '<h2 id="how-to-sponsor">', '<h2 ', 'site/sponsors.html');
  assert.ok(howTo.includes('github.com/alexisvalentino/ai-engineering-from-scratch-in-filipino'));
  assert.ok(howTo.includes('No billing, receipts, invoices, or payment are currently handled through this page.'));
  assert.doesNotMatch(generated, /ghumare64@gmail\.com|github\.com\/sponsors\/rohitg00/);
  const steps = between(generated, '<h2 id="becoming-a-sponsor">', '</ol>', 'site/sponsors.html');
  assert.ok(steps.includes('No payment or sponsor placement is accepted until an active channel and written terms are published here.'));
  assert.doesNotMatch(generated, /\n\s*\[Babel\]/);
});

test('sponsor markdown keeps only allowlisted HTML and safe links', () => {
  const { renderSponsorsMarkdown } = require('./build.js');
  const html = renderSponsorsMarkdown([
    '<img src="https://example.com/logo.svg" onerror="alert(1)" alt="Logo" width="120">',
    '<script>alert(1)</script> <a href="javascript:alert(1)">bad</a>',
    '[plain](javascript:alert) [parent](../secret.md) [anchor](#tiers)',
    '[mail](mailto:billing@example.com) [bad mail](mailto:a@b.com?bcc=c@d.com)',
  ].join('\n'));
  assert.ok(html.includes('<img src="https://example.com/logo.svg" alt="Logo" width="120">'));
  assert.doesNotMatch(html, /<script|<a href="javascript|onerror|href="[^"]*\.\./);
  assert.equal((html.match(/<a /g) || []).length, (html.match(/<\/a>/g) || []).length);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('bad&lt;/a&gt;'));
  assert.ok(html.includes('plain parent <a href="#tiers">anchor</a>'));
  assert.ok(html.includes('<a href="mailto:billing@example.com">mail</a> bad mail'));
});

test('the hamburger menu and every page footer link to the sponsors page', () => {
  const pages = fs.readdirSync(path.join(root, 'site')).filter(name => name.endsWith('.html'));
  let footers = 0;
  for (const page of pages) {
    const text = read(path.join('site', page));
    if (!text.includes('<div class="footer-links">')) continue;
    footers++;
    const links = between(text, '<div class="footer-links">', '</div>', page);
    assert.ok(links.includes('<a href="sponsors.html">Sponsor us</a>'), page);
  }
  assert.ok(footers >= 13);
  assert.ok(read('site/header.js').includes("ensureNavigationLink(nav, 'sponsors.html', 'Sponsor us', 'header-mobile-only');"));
  assert.ok(JSON.parse(read('site/ui-strings.json')).keys.includes('Sponsor us'));
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/sponsors' && rule.has && rule.destination === '/agent-pages/sponsors.md'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/sponsors' && !rule.has && rule.destination === '/sponsors.html'));
  assert.equal(require('../lib/agent-content').PAGES['/sponsors'], 'sponsors.html');
});

test('sponsor changes are reserved for maintainers', () => {
  for (const file of ['CONTRIBUTING.md', 'SPONSORS.md']) {
    const text = read(file).replace(/\s+/g, ' ');
    assert.ok(text.includes('Sponsorship changes are not accepted through contributor pull requests.'), file);
    assert.ok(text.includes('names, logos, links, and tier assignments are managed by the maintainer.'), file);
  }
});
