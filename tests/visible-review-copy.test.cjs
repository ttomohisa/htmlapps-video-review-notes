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
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.listeners = {}; this.attrs = {}; this.value = ''; this.disabled = false; this.textContent = ''; this.classList = { toggle() {} }; }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, cb) { this.listeners[k] = cb; }
  click() { return this.listeners.click?.({ stopPropagation() {} }); }
  select() { this.selected = true; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
function review(id, type = 'fix', status = 'open', startTime = 1, extra = {}) {
  return { id, type, status, mode: 'point', time: startTime, startTime, endTime: null, comment: `Comment ${id}`, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', annotations: [], thumbnail: '', ...extra };
}
function fixture(items = [review('a'), review('b', 'note', 'resolved', 2)], language = 'en') {
  const elements = new Map(), writes = [], toasts = [], announcements = [], downloads = [];
  const $ = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
  const document = { body: new Element('body'), querySelectorAll: () => [], createElement: tag => new Element(tag), execCommand: () => true };
  const context = { $, document, navigator: { clipboard: { writeText: async text => writes.push(text) } }, reviews: structuredClone(items), language, reviewTypeFilter: 'all', reviewStatusFilter: 'all', currentFile: { name: 'Sample.mp4', size: 100, type: 'video/mp4', lastModified: 1 }, detachedProject: null, activeReviewId: '', editingReviewId: '', selectedReviewMode: 'point', selectedReviewType: 'fix', draftReviewTime: null, draftRangeStart: null, draftRangeEnd: null, draftThumbnail: '', draftFrameWidth: 0, draftFrameHeight: 0, draftAnnotations: [], annotationColor: '#16624f', reviewComment: new Element('textarea'), phase: 'ready', sourceGeneration: 1, workspaceGeneration: 1, sourceEventController: null, currentObjectUrl: '', seekRange: new Element(), speedSelect: new Element(), volumeRange: new Element(), video: { currentTime: 0, duration: 10, videoWidth: 640, videoHeight: 360, volume: 1, playbackRate: 1, muted: false, dataset: {}, pause() {}, load() {}, removeAttribute() {} }, AppToast: { show: options => toasts.push(options), dismiss() {} }, AppConfirm: { ask: async () => true }, announce: text => announcements.push(text), renderTimeline() {}, updateReviewEditor() {}, resetDraftFrame() {}, updatePlayButton() {}, updateMuteButton() {}, setPhase(value) { context.phase = value; }, scheduleAutoSave() {}, ensureDraftFrame() { return true; }, Blob, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} }, blobUrls: new Set(), outputFilename: new Element(), window: { setTimeout: callback => callback() }, PROJECT_SCHEMA_VERSION: 1, PROJECT_RECORD_ID: 'current', APP_CONFIG: { version: '1.0.0' }, crypto: { randomUUID: () => 'new-id' } };
  vm.createContext(context);
  const translationStart = source.indexOf('      const translations = {');
  const translationEnd = source.indexOf('\n      };', translationStart) + 9;
  vm.runInContext(source.slice(translationStart, translationEnd), context);
  const functions = ['t','formatTime','reviewTypeLabel','reviewStatusLabel','reviewModeOf','reviewStartTime','reviewEndTime','reviewTimeText','getSortedReviews','getFilteredReviews','buildClipboardExport','setExportStatus','updateExportUi','copyReviewsToClipboard','reviewTotalText','renderReviewFilters','renderReviews','setReviewFilter','clearReviewFilters','deleteReview','clearReviewState','resetReviewEditor','saveReview','currentDraftTime','hasValidRange','newReviewId','cloneAnnotations','clamp01','normalizeAnnotationColor','normalizedAnnotation','normalizedReview','normalizeProject','buildProjectSnapshot','reviewExportSnapshot','csvCell','buildCsvExport','buildMarkdownExport','safeJsonForScript','buildStandaloneReviewHtml','sanitizeOutputStem','defaultOutputStem','currentOutputStem','projectFilename','downloadProjectJson','resetPlayerState','revokeCurrentObjectUrl','clearSource','invalidateWorkspace'];
  vm.runInContext(functions.map(fn).join('\n'), context);
  return { c: context, $, writes, toasts, announcements, downloads, document };
}
const sample = [review('later', 'note', 'resolved', 8), review('range', 'fix', 'open', 2, { mode: 'range', endTime: 4.125, comment: 'First line\n<b>literal & safe</b>\n日本語' }), review('early', 'question', 'open', 1)];
for (const language of ['en', 'ja']) {
  test(`${language}: all filters preserve plain-text structure, full content, range and multiline literals`, async () => {
    const { c, writes } = fixture(sample, language);
    await c.copyReviewsToClipboard();
    const labels = language === 'en' ? ['Question', 'Fix', 'Note', 'Open', 'Resolved'] : ['質問', '修正', 'メモ', '未対応', '解決済み'];
    assert.equal(writes[0], `Video Review — Sample.mp4\n\n1. 00:00:01.000 · ${labels[0]} · ${labels[3]}\nComment early\n\n2. 00:00:02.000 – 00:00:04.125 · ${labels[1]} · ${labels[3]}\nFirst line\n<b>literal & safe</b>\n日本語\n\n3. 00:00:08.000 · ${labels[2]} · ${labels[4]}\nComment later`);
  });
  for (const type of ['all', 'fix', 'question', 'check', 'good', 'note']) for (const status of ['all', 'open', 'resolved']) {
    test(`${language}: clipboard follows ${type}/${status} and numbers only visible reviews`, async () => {
      const items = ['fix','question','check','good','note'].flatMap((type, i) => [review(`${type}-open`, type, 'open', 10-i), review(`${type}-resolved`, type, 'resolved', i)]);
      const { c, writes, $ } = fixture(items, language);
      c.setReviewFilter('type', type); c.setReviewFilter('status', status);
      const expected = items.filter(r => (type === 'all' || r.type === type) && (status === 'all' || r.status === status)).sort((a,b) => a.startTime-b.startTime);
      const before = JSON.stringify(c.reviews);
      await c.copyReviewsToClipboard();
      const copiedComments = writes[0].split('\n').filter(line => line.startsWith('Comment '));
      assert.deepEqual(copiedComments, expected.map(r => r.comment));
      assert.deepEqual(writes[0].match(/^\d+\./gm), expected.map((_, i) => `${i+1}.`));
      assert.equal(JSON.stringify(c.reviews), before);
      assert.deepEqual($('#reviewList').children.map(card => card.dataset.reviewId), expected.map(r => r.id));
    });
  }
}
test('equal time reviews use the same createdAt tie-break as the visible list', async () => {
  const { c, writes, $ } = fixture([review('newer', 'fix', 'open', 1, { createdAt: '2026-10-02' }), review('older', 'fix', 'open', 1, { createdAt: '2026-10-01' })]);
  c.renderReviews(); await c.copyReviewsToClipboard();
  assert.deepEqual($('#reviewList').children.map(card => card.dataset.reviewId), ['older','newer']);
  assert.deepEqual(writes[0].split('\n').filter(s => s.startsWith('Comment ')), ['Comment older','Comment newer']);
});
test('no matching reviews disables only copy and never writes; clearing filters restores copy', async () => {
  const { c, $, writes } = fixture();
  c.renderReviews(); assert.equal($('#copyReviewsButton').disabled, false);
  c.setReviewFilter('type', 'question');
  assert.equal($('#copyReviewsButton').disabled, true);
  for (const id of ['Html','Markdown','Csv','Json']) assert.equal($(`#export${id}Button`).disabled, false);
  await c.copyReviewsToClipboard(); assert.equal(writes.length, 0);
  c.clearReviewFilters(); assert.equal($('#copyReviewsButton').disabled, false);
  await c.copyReviewsToClipboard(); assert.equal(writes.length, 1);
});
test('resolving the last open match and reopening update copy availability', () => {
  const { c, $ } = fixture([review('a')]);
  c.setReviewFilter('status', 'open');
  $('#reviewList').children[0].children.at(-1).children[0].click();
  assert.equal($('#copyReviewsButton').disabled, true);
  c.setReviewFilter('status', 'resolved'); assert.equal($('#copyReviewsButton').disabled, false);
  $('#reviewList').children[0].children.at(-1).children[0].click();
  assert.equal($('#copyReviewsButton').disabled, true);
  c.setReviewFilter('status', 'open'); assert.equal($('#copyReviewsButton').disabled, false);
});
test('deleting the final match and Undo refresh both filtered-empty and total-empty states', async () => {
  for (const items of [[review('a')], [review('a'), review('b', 'note')]]) {
    const { c, $, toasts } = fixture(items);
    c.setReviewFilter('type', 'fix'); await c.deleteReview('a');
    assert.equal($('#copyReviewsButton').disabled, true);
    assert.equal($('#exportJsonButton').disabled, items.length === 1);
    toasts.at(-1).onAction(); assert.equal($('#copyReviewsButton').disabled, false);
    assert.equal($('#exportJsonButton').disabled, false);
  }
});
test('editing the last matching type removes it from clipboard and clearing filters restores it', async () => {
  const { c, $, writes } = fixture([review('a')]);
  c.setReviewFilter('type', 'fix'); c.editingReviewId = 'a'; c.selectedReviewType = 'note'; c.reviewComment.value = 'Edited';
  await c.saveReview(); assert.equal($('#copyReviewsButton').disabled, true);
  await c.copyReviewsToClipboard(); assert.equal(writes.length, 0);
  c.clearReviewFilters(); await c.copyReviewsToClipboard(); assert.match(writes[0], /Note.*\nEdited/);
});
test('source reset clears copy and all file-export availability', async () => {
  const { c, $, writes } = fixture(); c.renderReviews(); c.clearSource();
  for (const selector of ['#copyReviewsButton','#exportHtmlButton','#exportMarkdownButton','#exportCsvButton','#exportJsonButton']) assert.equal($(selector).disabled, true);
  await c.copyReviewsToClipboard(); assert.equal(writes.length, 0); assert.equal(c.currentFile, null);
});
test('native clipboard captures current filters at click time before asynchronous completion', async () => {
  const { c, writes } = fixture(); let finish;
  c.navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  c.setReviewFilter('type', 'fix'); const pending = c.copyReviewsToClipboard();
  c.setReviewFilter('type', 'note'); finish(); await pending;
  assert.match(writes[0], /Comment a/); assert.doesNotMatch(writes[0], /Comment b/);
  const second = c.copyReviewsToClipboard(); finish(); await second;
  assert.match(writes[1], /Comment b/); assert.doesNotMatch(writes[1], /Comment a/);
});
test('native clipboard rejection keeps the existing warning feedback', async () => {
  const { c, $, toasts, announcements, document } = fixture();
  c.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await c.copyReviewsToClipboard();
  assert.equal($('#exportStatus').textContent, 'Could not copy reviews'); assert.equal(toasts.at(-1).tone, 'warning'); assert.equal(announcements.at(-1), 'Could not copy reviews'); assert.equal(document.body.children.length, 0);
});
for (const result of ['success','false','throw']) test(`legacy clipboard ${result} uses filtered text and removes its temporary textarea`, async () => {
  const { c, document, $ } = fixture(); c.navigator.clipboard = undefined; c.reviewTypeFilter = 'fix'; let captured;
  document.execCommand = command => { assert.equal(command, 'copy'); captured = document.body.children[0].value; if (result === 'throw') throw new Error('denied'); return result === 'success'; };
  await c.copyReviewsToClipboard();
  assert.match(captured, /Comment a/); assert.doesNotMatch(captured, /Comment b/); assert.equal(document.body.children.length, 0);
  assert.equal($('#exportStatus').textContent, result === 'success' ? 'Reviews copied' : 'Could not copy reviews');
});
test('JSON backup, CSV, Markdown and HTML exports include all reviews under active filters', async () => {
  const { c, downloads } = fixture(sample); c.reviewTypeFilter = 'fix'; c.reviewStatusFilter = 'open';
  assert.equal(c.buildProjectSnapshot().reviews.length, 3);
  await c.downloadProjectJson(); const json = JSON.parse(await downloads[0].text()); assert.equal(json.reviews.length, 3);
  const csv = c.buildCsvExport(), markdown = c.buildMarkdownExport(), html = c.buildStandaloneReviewHtml();
  const payload = JSON.parse(html.match(/<script id="review-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(payload.reviews.length, 3);
  for (const review of sample) { assert.ok(csv.includes(review.comment)); assert.ok(markdown.includes(review.comment)); }
  c.clearReviewFilters(); assert.equal(c.buildCsvExport(), csv); assert.equal(c.buildMarkdownExport(), markdown);
});
for (const result of ['false','throw']) test(`legacy failure ${result} cleans its textarea even without filters`, async () => {
  const { c, document } = fixture(); c.navigator.clipboard = undefined;
  document.execCommand = () => { if (result === 'throw') throw new Error('denied'); return false; };
  await c.copyReviewsToClipboard(); assert.equal(document.body.children.length, 0);
});
