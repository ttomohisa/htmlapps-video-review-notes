// Production handlers with a controlled DOM lifecycle. Native focus/layout remains a browser gate.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.REVIEW_APP_SOURCE || 'src/index.template.html', 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `runtime function ${name} exists`);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.slice(start, lineEnd).trimEnd().endsWith('}') ? lineEnd : source.indexOf('\n      }', lineEnd) + 8);
}
function review(id = 'first', status = 'open') {
  return { id, type: 'fix', status, mode: 'point', time: 2, startTime: 2, endTime: null, comment: 'Saved comment', thumbnail: '', frameWidth: 0, frameHeight: 0, annotations: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
}
function fixture(items = [review()], language = 'en') {
  let document;
  const focusCalls = [], elements = new Map();
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.dataset = {}; this.attrs = {}; this.style = {}; this.listeners = {}; this.value = ''; this.hidden = false; this.inert = false; this.open = false; this._disabled = false; this.className = '';
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    get isConnected() { return this === document.documentElement || !!this.parentElement?.isConnected; }
    get disabled() { return this._disabled; }
    set disabled(value) { this._disabled = value; if (value && document?.activeElement === this) document.activeElement = document.body; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    replaceChildren(...children) { if (this.children.some(child => child.contains(document.activeElement))) document.activeElement = document.body; for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
    remove() { if (this.contains(document.activeElement)) document.activeElement = document.body; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) {
      if (key.startsWith('data-')) return this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
      if (['hidden', 'inert', 'open', 'disabled'].includes(key)) return this[key] ? '' : null;
      return this.attrs[key] ?? null;
    }
    matches(selector) {
      if (selector === ':disabled') return this.disabled || !!this.parentElement?.closest('fieldset[disabled]');
      const tag = selector.match(/^[a-z]+/i)?.[0]; if (tag && this.tagName !== tag.toUpperCase()) return false;
      const cls = selector.match(/^\.([\w-]+)/)?.[1]; if (cls && !this.className.split(' ').includes(cls)) return false;
      for (const [, key, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        const actual = this.getAttribute(key); if (actual === null || (value !== undefined && actual !== value)) return false;
      }
      return true;
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (selector.split(',').some(part => node.matches(part.trim()))) return node; return null; }
    getClientRects() { for (let node = this; node; node = node.parentElement) if (node.hidden || node.style.display === 'none') return []; return this.isConnected ? [{}] : []; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    click() { return this.listeners.click?.({ target: this, stopPropagation() {} }); }
    focus(options) { if (!this.isConnected || this.matches(':disabled') || this.closest('[hidden], [inert]') || !this.getClientRects().length) return; const changed = document.activeElement !== this; document.activeElement = this; focusCalls.push({ node: this, options }); if (changed) this.listeners.focus?.(); }
    scrollIntoView() {}
  }
  const root = new Element('html'), body = new Element('body');
  document = { documentElement: root, body, activeElement: body, createElement: tag => new Element(tag) }; root.append(body);
  const all = (node = root) => [node, ...node.children.flatMap(child => all(child))];
  document.querySelectorAll = selector => all().filter(node => {
    const parts = selector.split(/\s+/); if (!node.matches(parts.at(-1))) return false;
    return parts.length === 1 || !!node.parentElement?.closest(parts.slice(0, -1).join(' '));
  });
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  const $ = selector => {
    if (!elements.has(selector)) { const element = new Element(selector === '#reviewComment' ? 'textarea' : selector.endsWith('Button') ? 'button' : 'div'); element.attrs.id = selector.slice(1); body.append(element); elements.set(selector, element); }
    return elements.get(selector);
  };
  const statusFilters = ['all', 'open', 'resolved'].map(value => { const button = new Element('button'); button.dataset.filterStatus = value; body.append(button); return button; });
  const c = { $, document, HTMLElement: Element, CSS: { escape: value => value }, getComputedStyle: node => ({ visibility: node.style.visibility || 'visible' }), language, reviews: structuredClone(items), reviewTypeFilter: 'all', reviewStatusFilter: 'all', phase: 'ready', activeReviewId: '', editingReviewId: '', selectedReviewMode: 'point', selectedReviewType: 'fix', draftReviewTime: 2, draftRangeStart: null, draftRangeEnd: null, draftThumbnail: '', draftFrameWidth: 0, draftFrameHeight: 0, draftAnnotations: [], reviewComment: $('#reviewComment'), saveReviewButton: $('#saveReviewButton'), rangeEditor: $('#rangeEditor'), rangeValidation: $('#rangeValidation'), video: { currentTime: 2, pause() {} }, ensureDraftFrame: () => true, resetDraftFrame() {}, captureFrameSoon() {}, updateAnnotationControls() {}, renderTimeline() {}, updateExportUi() {}, scheduleAutoSave() {}, AppToast: { show() {} }, announce() {}, crypto: { randomUUID: () => 'added' } };
  vm.createContext(c);
  const start = source.indexOf('      const translations = {');
  vm.runInContext(source.slice(start, source.indexOf('\n      };', start) + 9), c);
  const functions = ['t', 'formatTime', 'reviewTypeLabel', 'reviewStatusLabel', 'reviewModeOf', 'reviewStartTime', 'reviewEndTime', 'reviewTimeText', 'getSortedReviews', 'getFilteredReviews', 'reviewTotalText', 'renderReviewFilters', 'renderReviews', 'setReviewFilter', 'updateReviewEditor', 'setReviewType', 'currentDraftTime', 'hasValidRange', 'rangeValidationMessage', 'saveReview', 'newReviewId', 'cloneAnnotations'];
  // The before snapshot has no helper; baseline must fail on behavior, not missing code.
  if (source.includes('      function restoreReviewActionFocus(')) functions.push('restoreReviewActionFocus');
  vm.runInContext(functions.map(fn).join('\n'), c);
  vm.runInContext(source.match(/      saveReviewButton\.addEventListener\('click', saveReview\);/)[0], c);
  const focusStart = source.indexOf("      reviewComment.addEventListener('focus',");
  vm.runInContext(source.slice(focusStart, source.indexOf("      $('#useCurrentTimeButton')", focusStart)), c);
  c.clearReviewFilters = () => {}; c.renderReviews(); c.updateReviewEditor();
  const card = (id = 'first') => $('#reviewList').children.find(node => node.dataset.reviewId === id);
  const statusButton = (id = 'first') => card(id)?.children.at(-1).children[0];
  const selectedFilter = () => statusFilters.find(button => button.attrs['aria-pressed'] === 'true');
  return { c, $, document, body, root, Element, focusCalls, card, statusButton, selectedFilter, statusFilters };
}
async function save(f, editing = false) {
  f.c.reviewComment.value = 'Updated comment'; if (editing) f.c.editingReviewId = 'first';
  f.c.updateReviewEditor(); f.c.saveReviewButton.focus(); f.focusCalls.length = 0;
  await f.c.saveReviewButton.click();
}
for (const language of ['ja', 'en']) {
  for (const editing of [false, true]) test(`${language}: ${editing ? 'update' : 'add'} continues in Comment with native reveal allowed after Save disables`, async () => {
    const f = fixture([review('first', 'resolved')], language); await save(f, editing);
    assert.equal(f.document.activeElement, f.c.reviewComment); assert.equal(f.c.saveReviewButton.disabled, true);
    assert.equal(f.c.reviewComment.value, ''); assert.equal(f.c.reviews.length, editing ? 1 : 2);
    assert.equal(f.c.reviews[0].status, 'resolved'); assert.equal(f.c.reviews.at(-1).comment, 'Updated comment');
    assert.equal(f.focusCalls.at(-1).options, undefined, 'native focus must be allowed to reveal an offscreen Comment');
  });
  for (const status of ['open', 'resolved']) test(`${language}: ${status === 'open' ? 'resolve' : 'reopen'} focuses the same review's rebuilt status action`, () => {
    const f = fixture([review('first', status)], language), old = f.statusButton(); old.focus(); f.focusCalls.length = 0; old.click();
    assert.equal(old.isConnected, false); assert.notEqual(f.statusButton(), old);
    assert.equal(f.document.activeElement, f.statusButton()); assert.equal(f.c.reviews[0].status, status === 'open' ? 'resolved' : 'open');
    assert.equal(f.c.reviews[0].comment, 'Saved comment'); assert.equal(f.c.reviews[0].startTime, 2);
  });
}
for (const status of ['open', 'resolved']) test(`status action disappearing under the ${status} filter continues in Comment with native reveal allowed`, () => {
  const f = fixture([review('first', status)]); f.c.setReviewFilter('status', status); f.statusButton().focus(); f.statusButton().click();
  assert.equal(f.card(), undefined); assert.equal(f.document.activeElement, f.c.reviewComment); assert.equal(f.c.reviewStatusFilter, status);
  assert.equal(f.focusCalls.at(-1).options, undefined, 'filtered-card fallback must allow native viewport reveal');
});
const unavailable = {
  hidden: node => { node.hidden = true; },
  disconnected: node => node.remove(),
  disabled: node => { node.disabled = true; },
  'display-none': node => { node.style.display = 'none'; },
  'visibility-hidden': node => { node.style.visibility = 'hidden'; },
  inert: node => { node.inert = true; },
  'hidden-ancestor': node => { node.parentElement.hidden = true; }
};
for (const [state, disable] of Object.entries(unavailable)) {
  test(`a ${state} rebuilt status action falls back to Comment`, () => {
    const f = fixture(); f.statusButton().focus(); f.c.scheduleAutoSave = () => disable(f.statusButton()); f.statusButton().click();
    assert.equal(f.document.activeElement, f.c.reviewComment);
  });
  test(`Save skips a ${state} Comment and uses the selected status filter`, async () => {
    const f = fixture();
    // Give Comment its own parent so hiding it does not hide the entire page.
    const wrapper = new f.Element(); f.c.reviewComment.remove(); f.body.append(wrapper); wrapper.append(f.c.reviewComment);
    f.c.scheduleAutoSave = () => disable(f.c.reviewComment); await save(f);
    assert.equal(f.document.activeElement, f.selectedFilter());
  });
}
test('a filtered-away card and hidden Comment fall back to the selected status filter', () => {
  const f = fixture(); f.c.setReviewFilter('status', 'open'); f.c.reviewComment.hidden = true; f.statusButton().focus(); f.statusButton().click();
  assert.equal(f.document.activeElement, f.selectedFilter()); assert.equal(f.selectedFilter().dataset.filterStatus, 'open');
});
for (const route of ['save', 'status']) {
  test(`${route} does not steal an existing meaningful visible focus`, async () => {
    const f = fixture(), other = f.$('#languageButton'); other.focus();
    f.c.reviewComment.value = 'Updated comment'; f.c.updateReviewEditor();
    if (route === 'save') await f.c.saveReviewButton.click(); else f.statusButton().click();
    assert.equal(f.document.activeElement, other);
  });
  test(`${route} does not steal newer focus taken during the continuation`, async () => {
    const f = fixture(), other = f.$('#outputFilename'); f.c.scheduleAutoSave = () => other.focus();
    if (route === 'save') await save(f); else { f.statusButton().focus(); f.statusButton().click(); }
    assert.equal(f.document.activeElement, other);
  });
  test(`${route} never moves focus behind a newly opened modal`, async () => {
    const f = fixture(), modal = new f.Element('dialog'); f.body.append(modal);
    f.c.scheduleAutoSave = () => { modal.open = true; f.document.activeElement = f.body; };
    if (route === 'save') await save(f); else { f.statusButton().focus(); f.statusButton().click(); }
    assert.equal(f.document.activeElement, f.body); assert.equal(modal.open, true);
  });
  test(`${route} leaves focus alone when all continuation targets are unavailable`, async () => {
    const f = fixture(); f.c.scheduleAutoSave = () => { f.c.reviewComment.disabled = true; f.statusFilters.forEach(node => { node.hidden = true; }); const status = f.statusButton(); if (status) status.hidden = true; };
    if (route === 'save') await save(f); else { f.statusButton().focus(); f.statusButton().click(); }
    assert.equal(f.document.activeElement, f.body);
  });
}
test('an invalid range save does not change the draft, reviews, or current focus', async () => {
  const f = fixture(); f.c.reviewComment.value = 'Keep draft'; f.c.selectedReviewMode = 'range'; f.c.draftRangeStart = 3; f.c.draftRangeEnd = 2;
  const other = f.$('#languageButton'); other.focus(); const before = JSON.stringify(f.c.reviews); await f.c.saveReview();
  assert.equal(f.document.activeElement, other); assert.equal(f.c.reviewComment.value, 'Keep draft'); assert.equal(JSON.stringify(f.c.reviews), before);
});
test('saving an edit that no longer matches the type filter continues in Comment', async () => {
  const f = fixture(); f.c.setReviewFilter('type', 'fix'); f.c.editingReviewId = 'first'; f.c.selectedReviewType = 'note'; f.c.reviewComment.value = 'Changed type'; f.c.updateReviewEditor(); f.c.saveReviewButton.focus(); await f.c.saveReviewButton.click();
  assert.equal(f.card(), undefined); assert.equal(f.c.reviews[0].type, 'note'); assert.equal(f.c.reviewTypeFilter, 'fix'); assert.equal(f.document.activeElement, f.c.reviewComment);
});
test('the bilingual Help includes keyboard continuation guidance', () => {
  assert.match(source, /<li data-i18n="helpReviewFocus">/);
  for (const language of ['ja', 'en']) { const { c } = fixture([], language); assert.notEqual(c.t('helpReviewFocus'), 'helpReviewFocus'); assert.ok(c.t('helpReviewFocus').length > 30); }
});
