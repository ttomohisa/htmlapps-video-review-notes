// Source/DOM-boundary regressions; native dialog focus, layout and media decoding need browser QA.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.REVIEW_APP_SOURCE || 'src/index.template.html', 'utf8');
const config = JSON.parse(fs.readFileSync('app.config.json', 'utf8'));
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `runtime function ${name} exists`);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.slice(start, lineEnd).trimEnd().endsWith('}') ? lineEnd : source.indexOf('\n      }', lineEnd) + 8);
}
class Element {
  constructor() {
    this.dataset = {}; this.attrs = {}; this.children = []; this.listeners = {}; this.value = ''; this.textContent = '';
    this.style = { setProperty(key, value) { this[key] = value; } };
    this.classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  removeAttribute(key) { delete this.attrs[key]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  click(event = {}) { this.listeners.click?.(event); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  getBoundingClientRect() { return { left: 10, top: 10, right: 100, bottom: 100 }; }
}
function fixture(language = 'ja') {
  const elements = new Map(), nodes = [], writes = [];
  const $ = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
  const markup = source.slice(source.indexOf('<body>'), source.indexOf('      const translations = {'));
  for (const match of markup.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    const node = attrs.id ? $('#' + attrs.id) : new Element(); node.attrs = attrs; node.title = attrs.title || '';
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) node.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    node.className = attrs.class || ''; nodes.push(node);
  }
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      const data = selector.match(/^\[data-([\w-]+)\]$/);
      if (data) { const key = data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return nodes.filter(node => key in node.dataset); }
      if (selector.startsWith('.')) return nodes.filter(node => node.className.split(' ').includes(selector.slice(1)));
      throw new Error('Unexpected selector: ' + selector);
    },
    createElement: () => new Element(), createElementNS: () => new Element()
  };
  const c = {
    $, document, language, APP_CONFIG: config, storageKeys: { language: 'test-language' }, writeStorage: (key, value) => writes.push([key, value]),
    currentFile: null, phase: 'empty', reviews: [], detachedProject: null, autosaveFailed: false,
    selectedReviewMode: 'point', selectedReviewType: 'fix', editingReviewId: '', activeReviewId: '', reviewTypeFilter: 'all', reviewStatusFilter: 'all',
    draftReviewTime: null, draftRangeStart: null, draftRangeEnd: null, draftThumbnail: '', draftAnnotations: [], annotationTool: 'rect', annotationColor: '#16624f',
    video: { currentTime: 0, duration: 12, paused: true, ended: false, muted: false, volume: 1, playbackRate: 1 },
    reviewComment: $('#reviewComment'), saveReviewButton: $('#saveReviewButton'), rangeEditor: $('#rangeEditor'), rangeValidation: $('#rangeValidation'),
    annotationStage: $('#annotationStage'), annotationCanvas: $('#annotationCanvas'), annotationEmpty: $('#annotationEmpty'), reviewTimelineMarkers: $('#reviewTimelineMarkers')
  };
  vm.createContext(c);
  const translationStart = source.indexOf('      const translations = {');
  vm.runInContext(source.slice(translationStart, source.indexOf('\n      };', translationStart) + 9), c);
  const functions = ['t','applyLanguage','formatBytes','formatTime','updatePlayButton','updateMuteButton','updateReviewEditor','setReviewType','currentDraftTime','hasValidRange','rangeValidationMessage','updateAnnotationControls','setAnnotationTool','setAnnotationColor','normalizeAnnotationColor','annotationCountText','renderReviews','renderReviewFilters','getSortedReviews','getFilteredReviews','reviewTotalText','reviewTypeLabel','reviewStatusLabel','reviewModeOf','reviewStartTime','reviewEndTime','reviewTimeText','annotationSvg','cloneAnnotations','clamp01','renderTimeline','timelineLanes','timelineShownText','timelineMarkerLabel','updateExportUi','setExportStatus','renderDetachedProject','projectStatus'];
  vm.runInContext(functions.map(fn).join('\n'), c);
  const eventStart = source.indexOf("      $('#languageButton').addEventListener('click'");
  vm.runInContext(source.slice(eventStart, source.indexOf("      window.addEventListener('pagehide'", eventStart)), c);
  const versionStart = source.indexOf("      $('#versionBadge').textContent =");
  vm.runInContext(source.slice(versionStart, source.indexOf("      $('#builtAt')", versionStart)), c);
  return { c, $, nodes, document, writes };
}
for (const language of ['ja', 'en']) {
  test(`${language}: visible language target is the compact EN/JA code`, () => {
    const { c, $ } = fixture(language); c.applyLanguage();
    assert.equal($('#languageButton').textContent, language === 'ja' ? 'EN' : 'JA');
  });
  test(`${language}: language target has matching localized accessible label and tooltip`, () => {
    const { c, $ } = fixture(language); c.applyLanguage();
    const expected = language === 'ja' ? '英語に切り替え' : 'Switch to Japanese';
    assert.equal($('#languageButton').attrs['aria-label'], expected);
    assert.equal($('#languageButton').title, expected);
  });
  test(`${language}: privacy, localized Help controls and canonical version remain accurate`, () => {
    const { c, $, nodes, document } = fixture(language); c.applyLanguage();
    const help = language === 'ja' ? '使い方と注意事項' : 'How to use & notes';
    assert.equal(document.documentElement.lang, language);
    assert.equal(nodes.find(node => node.dataset.i18n === 'localBadge').textContent, language === 'ja' ? '完全ローカル処理' : 'Fully local processing');
    assert.equal($('#helpButton').title, help); assert.equal($('#helpButton').attrs['aria-label'], help);
    assert.equal($('#versionBadge').textContent, `v${config.version}`); assert.equal($('#buildVersion').textContent, config.version);
    $('#helpButton').click(); assert.equal($('#helpDialog').open, true);
    $('#helpDialog').click({ clientX: 20, clientY: 20 }); assert.equal($('#helpDialog').open, true);
    $('#closeHelpButton').click(); assert.equal($('#helpDialog').open, false);
    $('#helpButton').click(); $('#helpDialog').click({ clientX: 0, clientY: 0 }); assert.equal($('#helpDialog').open, false);
  });
}
for (const validRange of [false, true]) test(`JA → EN → JA preserves reviews, filters, playback, export name and ${validRange ? 'valid' : 'incomplete'} range draft`, () => {
  const { c, $, writes } = fixture();
  c.currentFile = { name: 'synthetic.mp4', size: 100 }; c.phase = 'ready';
  c.reviews = [{ id: 'a', type: 'fix', status: 'open', mode: 'range', startTime: 1, endTime: 3, comment: 'Saved review', annotations: [], createdAt: '2026-10-07' }, { id: 'b', type: 'note', status: 'resolved', mode: 'point', startTime: 4, comment: 'Other review', annotations: [] }];
  c.reviewTypeFilter = 'fix'; c.reviewStatusFilter = 'open'; c.activeReviewId = 'a'; c.editingReviewId = 'a';
  c.selectedReviewMode = 'range'; c.draftRangeStart = 1; c.draftRangeEnd = validRange ? 3 : null;
  c.draftThumbnail = 'data:image/jpeg;base64,draft'; c.draftAnnotations = [{ type: 'rect', x: .1, y: .2, width: .3, height: .4 }];
  c.reviewComment.value = 'Unsaved bilingual draft 日本語'; $('#outputFilename').value = 'custom-review';
  c.video.currentTime = 8; c.video.playbackRate = 1.5; c.video.volume = .4; c.video.muted = true;
  const snapshot = () => JSON.stringify({ reviews: c.reviews, file: c.currentFile, phase: c.phase, filters: [c.reviewTypeFilter, c.reviewStatusFilter], active: c.activeReviewId, edit: c.editingReviewId, mode: c.selectedReviewMode, type: c.selectedReviewType, start: c.draftRangeStart, end: c.draftRangeEnd, thumbnail: c.draftThumbnail, annotations: c.draftAnnotations, comment: c.reviewComment.value, filename: $('#outputFilename').value, video: c.video });
  const before = snapshot(); c.applyLanguage();
  for (const expected of ['en', 'ja']) {
    $('#languageButton').click(); assert.equal(c.language, expected); assert.equal(snapshot(), before);
    assert.deepEqual($('#reviewList').children.map(card => card.dataset.reviewId), ['a']);
    assert.deepEqual(c.reviewTimelineMarkers.children.map(marker => marker.dataset.reviewId), ['a']);
    assert.equal(c.saveReviewButton.disabled, !validRange); assert.equal($('#exportJsonButton').disabled, false); assert.equal($('#copyReviewsButton').disabled, false);
  }
  assert.deepEqual(writes, [['test-language', 'en'], ['test-language', 'ja']]);
});
test('Japanese initial markup exposes the same language target and canonical version', () => {
  const button = source.match(/<button\b[^>]*id="languageButton"[^>]*>EN<\/button>/)?.[0]; assert.ok(button);
  assert.match(button, /aria-label="英語に切り替え"/); assert.match(button, /title="英語に切り替え"/);
  assert.equal(source.match(/id="versionBadge">([^<]+)</)?.[1], `v${config.version}`);
});
