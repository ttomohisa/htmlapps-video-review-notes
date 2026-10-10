// Source layout contracts; native geometry, wheel and focus require browser QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const source = fs.readFileSync(process.env.REVIEW_APP_SOURCE || 'src/index.template.html', 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
test('only an open native modal locks both page scroll roots', () => {
  assert.match(css, /html:has\(dialog:modal\)\s*,\s*body:has\(dialog:modal\)\s*\{\s*overflow:\s*hidden\s*;?\s*\}/);
});
test('narrow title and version wrap while header actions keep their width', () => {
  const narrow = css.split('@media (max-width: 420px)')[1]?.split('@media')[0];
  assert.ok(narrow, 'dedicated narrow header rule');
  assert.match(narrow, /\.brand-name\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*white-space:\s*normal;[^}]*overflow:\s*visible/);
  assert.match(narrow, /\.version-badge\s*\{[^}]*flex:\s*0 0 auto;[^}]*margin-left:\s*0;[^}]*white-space:\s*nowrap/);
  assert.match(narrow, /\.header-actions\s*\{[^}]*flex-shrink:\s*0/);
});
test('existing Help keeps its fixed header and inner scrolling allocation', () => {
  assert.match(css, /#helpDialog\[open\]\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
  assert.match(css, /\.dialog-header\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.dialog-body\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain/);
});
test('privacy shield remains decorative and separate from brand artwork', () => {
  const badge = source.match(/<div class="local-badge"[\s\S]*?<\/div>/)?.[0];
  assert.ok(badge);
  assert.match(badge, /aria-hidden="true"/);
  assert.match(badge, /M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z/);
  assert.match(source, /id="appBrandIcon"/);
});
