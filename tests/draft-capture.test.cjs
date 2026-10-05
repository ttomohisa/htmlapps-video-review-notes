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
function fixture() {
  const images = [], timers = [], captures = [], elements = new Map(), listeners = new Map(), toasts = [];
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', addEventListener(type, callback) { this[type] = callback; }, focus() {}, scrollIntoView() {}
    });
    return elements.get(selector);
  };
  const video = {
    currentTime: 1, duration: 20, readyState: 2, videoWidth: 1920, videoHeight: 1080, seeking: false, paused: true,
    pause() { this.paused = true; },
    addEventListener(type, callback, options = {}) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ callback, once: options.once });
    },
    removeEventListener(type, callback) {
      listeners.set(type, (listeners.get(type) || []).filter(item => item.callback !== callback));
    }
  };
  const c = {
    $, video, phase: 'ready', sourceGeneration: 1, editingReviewId: '', activeReviewId: '',
    selectedReviewMode: 'point', selectedReviewType: 'fix', draftReviewTime: 1, draftRangeStart: null, draftRangeEnd: null,
    reviewComment: $('#comment'), reviews: [], annotationCanvas: {}, annotationContext: null,
    window: { setTimeout(callback) { timers.push(callback); return timers.length; } },
    AppToast: { show(options) { toasts.push(options); } }, announce() {}, t: key => key,
    updateReviewEditor() {}, renderReviews() {}, scheduleAutoSave() {}, normalizeAnnotationColor: color => color,
    jumpToReview(review) { video.pause(); video.currentTime = review.startTime; },
    crypto: { randomUUID: () => 'new-review' },
    Image: class { constructor() { this.naturalWidth = 720; this.naturalHeight = 405; images.push(this); } },
    document: {
      querySelectorAll: () => [],
      createElement(tag) {
        assert.equal(tag, 'canvas');
        let drawn;
        return {
          getContext() { return { drawImage() {
            if (c.failDraw) throw new Error('Frame unavailable');
            drawn = { time: video.currentTime, source: c.sourceGeneration };
            captures.push(drawn);
          } }; },
          toDataURL() { return `data:image/jpeg;test,source-${drawn.source}-frame-${drawn.time}`; }
        };
      }
    }
  };
  vm.createContext(c);
  const stateStart = source.indexOf('      let draftThumbnail =');
  const stateEnd = source.indexOf('      let detachedProject =', stateStart);
  vm.runInContext(source.slice(stateStart, stateEnd).replace(/^      let /gm, 'var '), c);
  const coreStart = source.indexOf('      function currentDraftTime()');
  const coreEnd = source.indexOf('      function annotationPoint(', coreStart);
  vm.runInContext(source.slice(coreStart, coreEnd), c);
  vm.runInContext(['resetDraftFrame','beginEditReview','saveReview','resetReviewEditor','reviewModeOf','reviewStartTime','reviewEndTime','newReviewId'].map(fn).join('\n'), c);
  // Canvas/image/event boundaries are controlled; capture, ownership, editing and saving run actual source functions.
  c.redrawAnnotationCanvas = () => {};
  c.updateAnnotationControls = () => {};
  const timingStart = source.indexOf("      $('#useCurrentTimeButton').addEventListener");
  const timingEnd = source.indexOf("      document.querySelectorAll('[data-annotation-tool]')", timingStart);
  vm.runInContext(source.slice(timingStart, timingEnd), c);
  return {
    c, $, video, images, captures, timers, toasts,
    tick() { timers.shift()?.(); },
    drain() { let limit = 100; while (timers.length && limit--) timers.shift()(); assert.ok(limit > 0, 'capture retry loop is bounded'); },
    emit(type) {
      const pending = [...(listeners.get(type) || [])];
      for (const item of pending) {
        if (item.once) video.removeEventListener(type, item.callback);
        item.callback();
      }
    },
    capture() { assert.equal(c.captureCurrentFrame(), true); images.at(-1).onload(); },
    annotate() { c.draftAnnotations = [{ type: 'rect', x: .1, y: .2, width: .3, height: .4, color: '#16624f' }]; }
  };
}
const frame = time => `data:image/jpeg;test,source-1-frame-${time}`;
const json = value => JSON.parse(JSON.stringify(value));

test('point at 1s switched to a range at 7s replaces the thumbnail and clears old annotations', () => {
  const f = fixture(); f.capture(); f.annotate(); f.video.currentTime = 7;
  f.c.setReviewMode('range');
  assert.equal(f.c.draftRangeStart, 7);
  assert.equal(f.c.draftThumbnail, frame(7));
  assert.deepEqual(json(f.c.draftAnnotations), []);
  assert.equal(f.c.draftFrameWidth, 720); assert.equal(f.c.draftFrameHeight, 405);
});

test('same-anchor point/range changes preserve the frame and annotations without recapture', () => {
  const f = fixture(); f.capture(); f.annotate(); const annotations = json(f.c.draftAnnotations), image = f.c.annotationBaseImage;
  f.c.setReviewMode('range'); f.c.setReviewMode('point');
  assert.equal(f.c.draftThumbnail, frame(1)); assert.equal(f.c.annotationBaseImage, image);
  assert.deepEqual(json(f.c.draftAnnotations), annotations); assert.equal(f.captures.length, 1);
});

test('Start here followed by point mode never attaches the range frame to a remembered point', () => {
  const f = fixture(); f.capture(); f.c.setReviewMode('range'); f.video.currentTime = 7;
  f.$('#setRangeStartButton').click(); f.annotate(); f.c.setReviewMode('point');
  assert.equal(f.c.currentDraftTime(), 1);
  assert.equal(f.video.currentTime, 1, 'an explicit mode change seeks back to its remembered start');
  assert.notEqual(f.c.draftThumbnail, frame(7)); assert.deepEqual(json(f.c.draftAnnotations), []);
  if (f.c.draftThumbnail) assert.equal(f.c.draftThumbnail, frame(1));
});

test('retry after moving playback cannot capture a frame at the wrong fixed draft time', () => {
  const f = fixture(); f.video.readyState = 1; f.c.captureFrameSoon();
  f.video.readyState = 2; f.video.currentTime = 7; f.tick();
  assert.equal(f.captures.some(capture => capture.time === 7), false);
  assert.equal(f.c.draftThumbnail, '');
  f.video.currentTime = 1; f.drain();
  assert.equal(f.captures.length, 0, 'returning later does not restart an abandoned request');
});

test('failed draw retries only at the selected start and keeps old-frame annotations discarded', () => {
  const f = fixture(); f.capture(); f.annotate(); f.video.currentTime = 7; f.c.failDraw = true;
  f.c.setReviewMode('range');
  assert.equal(f.c.draftThumbnail, ''); assert.deepEqual(json(f.c.draftAnnotations), []);
  f.c.failDraw = false; f.tick();
  assert.equal(f.c.draftThumbnail, frame(7)); assert.deepEqual(json(f.c.draftAnnotations), []);
  assert.equal(f.captures.at(-1).time, f.c.draftRangeStart);
});

test('mode change to a remembered start waits for native seek completion before capture', () => {
  const f = fixture(); f.capture(); f.c.setReviewMode('range'); f.video.currentTime = 7;
  f.$('#setRangeStartButton').click(); f.annotate();
  let position = f.video.currentTime;
  Object.defineProperty(f.video, 'currentTime', { get: () => position, set(value) { position = value; f.video.seeking = true; } });
  f.c.setReviewMode('point');
  assert.equal(f.video.currentTime, 1); assert.equal(f.c.draftThumbnail, '');
  assert.deepEqual(json(f.c.draftAnnotations), []);
  f.video.seeking = false; f.emit('seeked');
  assert.equal(f.c.draftThumbnail, frame(1)); assert.equal(f.captures.length, 3);
});

test('same-anchor saved frame remains usable after playback moves elsewhere', async () => {
  const f = fixture(); f.capture(); f.annotate(); f.video.currentTime = 7;
  f.c.reviewComment.value = 'Keep the marked original frame'; await f.c.saveReview();
  assert.equal(f.c.reviews[0].startTime, 1); assert.equal(f.c.reviews[0].thumbnail, frame(1));
  assert.equal(f.c.reviews[0].annotations.length, 1); assert.equal(f.captures.length, 1);
});

test('an in-progress seek cannot be synchronously captured by Save', async () => {
  const f = fixture(); f.video.seeking = true; f.c.reviewComment.value = 'Text remains usable';
  await f.c.saveReview();
  assert.equal(f.c.reviews.length, 1); assert.equal(f.c.reviews[0].comment, 'Text remains usable');
  assert.equal(f.c.reviews[0].thumbnail, ''); assert.equal(f.captures.length, 0);
  assert.equal(f.toasts.some(toast => toast.message === 'annotationCaptureFailed'), true);
});

test('Save at another playback position does not substitute that frame for the fixed draft start', async () => {
  const f = fixture(); f.video.currentTime = 7; f.c.reviewComment.value = 'Text at the original point';
  await f.c.saveReview();
  assert.equal(f.c.reviews.length, 1); assert.equal(f.c.reviews[0].startTime, 1);
  assert.equal(f.c.reviews[0].thumbnail, ''); assert.equal(f.captures.length, 0);
  assert.equal(f.toasts.some(toast => toast.message === 'annotationCaptureFailed'), true);
});

test('obsolete seek completion after changing a draft cannot replace the current frame', () => {
  const f = fixture(); f.video.seeking = true; f.c.captureFrameSoon();
  f.video.seeking = false; f.video.currentTime = 7; f.c.draftReviewTime = 7; f.c.captureFrameSoon();
  const captures = f.captures.length; f.emit('seeked');
  assert.equal(f.c.draftThumbnail, frame(7)); assert.equal(f.captures.length, captures);
});

test('source generation changes reject pending timer and seek callbacks even before a draft reset', () => {
  for (const seeking of [false, true]) {
    const f = fixture(); f.video.readyState = 1; f.video.seeking = seeking; f.c.captureFrameSoon();
    f.c.sourceGeneration += 1; f.video.readyState = 2; f.video.seeking = false;
    f.emit('seeked'); f.drain();
    assert.equal(f.c.draftThumbnail, ''); assert.equal(f.captures.length, 0);
  }
});

for (const callback of ['onload', 'onerror']) test(`obsolete Image.${callback} cannot affect a newer draft thumbnail`, () => {
  const f = fixture(); f.c.captureCurrentFrame(); const old = f.images.at(-1);
  f.video.currentTime = 7; f.c.draftReviewTime = 7; f.c.captureFrameSoon();
  const current = f.images.at(-1); current.onload(); f.annotate(); old[callback]();
  assert.equal(f.c.draftThumbnail, frame(7)); assert.equal(f.c.annotationBaseImage, current);
  assert.equal(f.c.draftAnnotations.length, 1);
});

for (const callback of ['onload', 'onerror']) test(`source replacement rejects Image.${callback} without touching replacement draft state`, () => {
  const f = fixture(); f.c.captureCurrentFrame(); const old = f.images.at(-1);
  f.c.sourceGeneration += 1; f.c.annotationBaseImage = null; f.c.draftThumbnail = 'replacement';
  old[callback]();
  assert.equal(f.c.draftThumbnail, 'replacement'); assert.equal(f.c.annotationBaseImage, null);
});

test('opening an edit invalidates pending capture even when the edited review has the same start', () => {
  const f = fixture(); f.video.readyState = 1; f.c.captureFrameSoon();
  f.c.reviews = [{ id: 'edit', type: 'fix', mode: 'point', startTime: 1, comment: 'Saved', thumbnail: 'saved-frame', frameWidth: 640, frameHeight: 360, annotations: [] }];
  f.c.beginEditReview('edit'); const image = f.images.at(-1); image.onload();
  f.video.readyState = 2; f.drain();
  assert.equal(f.c.draftThumbnail, 'saved-frame'); assert.equal(f.c.annotationBaseImage, image);
  assert.equal(f.captures.length, 0);
});

test('failed thumbnail decoding clears orphaned annotations before a later capture retry', () => {
  const f = fixture(); f.c.loadDraftThumbnail('bad-image', 640, 360); f.annotate();
  f.images.at(-1).onerror();
  assert.equal(f.c.draftThumbnail, ''); assert.equal(f.c.draftFrameWidth, 0); assert.equal(f.c.draftFrameHeight, 0);
  assert.deepEqual(json(f.c.draftAnnotations), []);
  assert.equal(f.c.ensureDraftFrame(), true); assert.equal(f.c.draftThumbnail, frame(1));
  assert.deepEqual(json(f.c.draftAnnotations), []);
});

test('a late success after thumbnail failure cannot restore the rejected base image', () => {
  const f = fixture(); f.c.loadDraftThumbnail('bad-image', 640, 360); const image = f.images.at(-1);
  image.onerror(); image.onload();
  assert.equal(f.c.draftThumbnail, ''); assert.equal(f.c.annotationBaseImage, null);
});

for (const pending of ['decode', 'capture']) test(`Undo of an edited duplicate preserves its draft and restarts pending ${pending}`, () => {
  const f = fixture(), c = f.c;
  vm.runInContext(fn('duplicateReview'), c);
  c.workspaceGeneration = 1; f.$('#reviewList').children = [];
  c.reviews = [{ id: 'original', type: 'fix', status: 'resolved', mode: 'point', time: 1, startTime: 1, endTime: null, comment: 'Saved', thumbnail: 'saved-frame', frameWidth: 640, frameHeight: 360, annotations: [{ type: 'rect', x: .1, y: .2, width: .3, height: .4 }], createdAt: '2026-10-01', updatedAt: '2026-10-01' }];
  c.duplicateReview('original'); const undo = f.toasts.at(-1).onAction;
  c.beginEditReview('new-review'); const originalDecode = f.images.at(-1);
  c.reviewComment.value = 'Draft changes stay';
  if (pending === 'capture') {
    f.video.currentTime = 7; c.draftReviewTime = 7; f.video.readyState = 1; c.captureFrameSoon();
  }
  const annotations = json(c.draftAnnotations);
  undo();
  assert.equal(c.editingReviewId, ''); assert.equal(c.reviews.length, 1);
  assert.equal(c.reviewComment.value, 'Draft changes stay'); assert.equal(c.draftReviewTime, pending === 'capture' ? 7 : 1);
  assert.deepEqual(json(c.draftAnnotations), annotations);
  if (pending === 'capture') { f.video.readyState = 2; f.drain(); }
  const currentDecode = f.images.at(-1); currentDecode.onload(); originalDecode.onerror();
  assert.equal(c.draftThumbnail, pending === 'capture' ? frame(7) : 'saved-frame');
  assert.equal(c.annotationBaseImage, currentDecode, 'retained draft must finish decoding under its new owner');
  assert.deepEqual(json(c.draftAnnotations), annotations);
});

test('editing a review with no thumbnail cannot attach its orphaned marks to a new capture', () => {
  const f = fixture(); f.annotate();
  f.c.reviews = [{ id: 'edit', type: 'fix', mode: 'point', startTime: 1, comment: 'Saved', thumbnail: '', annotations: json(f.c.draftAnnotations) }];
  f.c.beginEditReview('edit');
  assert.deepEqual(json(f.c.draftAnnotations), []);
  assert.equal(f.c.ensureDraftFrame(), true); assert.deepEqual(json(f.c.draftAnnotations), []);
});

test('capture failure at a changed anchor permits text save without the old frame or marks', async () => {
  const f = fixture(); f.capture(); f.annotate(); f.c.failDraw = true; f.video.currentTime = 7;
  f.c.setReviewMode('range'); f.c.draftRangeEnd = 9; f.c.reviewComment.value = 'Range text';
  await f.c.saveReview(); f.drain();
  assert.equal(f.c.reviews.length, 1); assert.equal(f.c.reviews[0].startTime, 7);
  assert.equal(f.c.reviews[0].thumbnail, ''); assert.deepEqual(json(f.c.reviews[0].annotations), []);
  assert.equal(f.c.draftThumbnail, '');
});

for (const language of ['en', 'ja']) for (const editing of [false, true]) test(`${language}: ${editing ? 'updating' : 'adding'} without a frame leaves the localized warning as final feedback`, async () => {
  const f = fixture(); f.c.language = language;
  const start = source.indexOf('      const translations = {');
  const end = source.indexOf('\n      };', start) + 9;
  vm.runInContext(source.slice(start, end) + '\n' + fn('t'), f.c);
  f.video.currentTime = 7; f.c.reviewComment.value = 'Text review';
  if (editing) {
    f.c.editingReviewId = 'existing';
    f.c.reviews = [{ id: 'existing', type: 'fix', status: 'resolved', mode: 'point', startTime: 1, createdAt: '2026-10-01' }];
  }
  await f.c.saveReview();
  assert.equal(f.c.reviews.length, 1); assert.equal(f.c.reviews[0].comment, 'Text review');
  assert.equal(f.c.reviews[0].thumbnail, '');
  const final = f.toasts.at(-1);
  assert.equal(final.tone, 'warning');
  assert.ok(final.message.includes(f.c.t(editing ? 'reviewUpdated' : 'reviewAdded')));
  assert.ok(final.message.includes(f.c.t('annotationCaptureFailed')));
});

test('reset rejects all delayed frame writes and discards the in-progress annotation pointer', () => {
  const f = fixture(); f.c.captureCurrentFrame(); const image = f.images.at(-1);
  f.c.annotationPointer = { id: 1 }; f.c.resetDraftFrame(); image.onload();
  assert.equal(f.c.annotationBaseImage, null, 'late load cannot transiently restore a reset frame');
  image.onerror(); f.drain();
  assert.equal(f.c.draftThumbnail, ''); assert.equal(f.c.annotationBaseImage, null); assert.equal(f.c.annotationPointer, null);
});
