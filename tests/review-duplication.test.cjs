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
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.style = { setProperty(k, v) { this[k] = v; } }; this.listeners = {}; this.attrs = {}; this.value = ''; this.disabled = false; this.textContent = ''; this.classList = { toggle() {}, add() {}, remove() {} }; }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, cb) { this.listeners[k] = cb; }
  click() { return this.listeners.click?.({ stopPropagation() {} }); }
  focus() { this.focused = true; }
  scrollIntoView() {}
  select() { this.selected = true; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
function review(id, type = 'fix', status = 'open', startTime = 1, extra = {}) {
  return { id, type, status, mode: 'point', time: startTime, startTime, endTime: null, comment: `Comment ${id}`, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', annotations: [], thumbnail: '', ...extra };
}
function fixture(items = [review('a'), review('b', 'note', 'resolved', 2)], language = 'en') {
  const elements = new Map(), writes = [], toasts = [], announcements = [], downloads = [];
  const $ = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
  const document = { body: new Element('body'), querySelectorAll: () => [], createElementNS: (ns, tag) => new Element(tag), createElement: tag => new Element(tag), execCommand: () => true };
  const context = { $, document, navigator: { clipboard: { writeText: async text => writes.push(text) } }, reviews: structuredClone(items), language, reviewTypeFilter: 'all', reviewStatusFilter: 'all', currentFile: { name: 'Sample.mp4', size: 100, type: 'video/mp4', lastModified: 1 }, detachedProject: null, activeReviewId: '', editingReviewId: '', selectedReviewMode: 'point', selectedReviewType: 'fix', draftReviewTime: null, draftRangeStart: null, draftRangeEnd: null, draftThumbnail: '', draftFrameWidth: 0, draftFrameHeight: 0, draftAnnotations: [], annotationColor: '#16624f', reviewComment: new Element('textarea'), phase: 'ready', sourceGeneration: 1, workspaceGeneration: 1, sourceEventController: null, currentObjectUrl: '', seekRange: new Element(), speedSelect: new Element(), volumeRange: new Element(), video: { currentTime: 0, duration: 10, videoWidth: 640, videoHeight: 360, volume: 1, playbackRate: 1, muted: false, dataset: {}, pause() {}, load() {}, removeAttribute() {} }, AppToast: { show: options => toasts.push(options), dismiss() { context.dismissed = true; } }, AppConfirm: { ask: async () => true }, announce: text => announcements.push(text), renderTimeline() {}, updateReviewEditor() {}, resetDraftFrame() {}, updatePlayButton() {}, updateMuteButton() {}, setPhase(value) { context.phase = value; }, scheduleAutoSave() {}, ensureDraftFrame() { return true; }, Blob, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} }, blobUrls: new Set(), outputFilename: new Element(), window: { setTimeout: callback => callback() }, PROJECT_SCHEMA_VERSION: 1, PROJECT_RECORD_ID: 'current', APP_CONFIG: { version: '1.0.0' }, crypto: { randomUUID: () => `new-id-${++context.uuidSequence}` } };
  context.uuidSequence = 0; context.autosaves = 0; context.scheduleAutoSave = () => context.autosaves++;
  context.clearTimeout = () => {}; context.autosaveTimer = 0; context.pendingResume = null; context.ensureOutputFilename = () => {}; context.formatBytes = String; context.bindSourceEvents = () => {}; context.renderDetachedProject = () => {}; context.suppressAutosave = false; context.projectDbDelete = async () => {}; context.projectDbPut = async () => {}; context.projectStatus = () => {};
  vm.createContext(context);
  const translationStart = source.indexOf('      const translations = {');
  const translationEnd = source.indexOf('\n      };', translationStart) + 9;
  vm.runInContext(source.slice(translationStart, translationEnd), context);
  const functions = ['t','formatTime','reviewTypeLabel','reviewStatusLabel','reviewModeOf','reviewStartTime','reviewEndTime','reviewTimeText','getSortedReviews','getFilteredReviews','buildClipboardExport','setExportStatus','updateExportUi','copyReviewsToClipboard','reviewTotalText','renderReviewFilters','renderReviews','setReviewFilter','clearReviewFilters','deleteReview','clearReviewState','resetReviewEditor','saveReview','currentDraftTime','hasValidRange','newReviewId','cloneAnnotations','clamp01','normalizeAnnotationColor','normalizedAnnotation','normalizedReview','normalizeProject','buildProjectSnapshot','reviewExportSnapshot','csvCell','buildCsvExport','buildMarkdownExport','safeJsonForScript','buildStandaloneReviewHtml','sanitizeOutputStem','defaultOutputStem','currentOutputStem','projectFilename','downloadProjectJson','resetPlayerState','revokeCurrentObjectUrl','clearSource','loadFile','isVideoLike','resetWorkspaceForDetachedProject','resetCurrentProject','importProjectFile','invalidateWorkspace','duplicateReview','removeVideo','annotationSvg','annotationCountText','timelineShownText','timelineLanes','timelineMarkerLabel'];
  vm.runInContext(functions.map(fn).join('\n'), context);
  context.reviewTimelineMarkers = new Element();
  vm.runInContext(fn('renderTimeline'), context);
  return { c: context, $, writes, toasts, announcements, downloads, document };
}

const notes = [review('a', 'fix', 'resolved', 1, {thumbnail: 'data:image/jpeg;base64,AA==', frameWidth: 640, frameHeight: 360, annotations: [{type:'freehand', color:'#ff0000', points:[{x:.1,y:.2},{x:.3,y:.4}]}]}), review('b','note','open',8)];
for (const mode of ['point','range']) for (const language of ['ja','en']) test(`${language}: duplicate ${mode} preserves exact data independently, current draft, filters and playback`, () => {
  const f=fixture(notes,language),c=f.c; if(mode==='range'){c.reviews[0].mode='range';c.reviews[0].endTime=4.25;}
  c.setReviewFilter('type','fix'); c.setReviewFilter('status','resolved');
  c.reviewComment.value='Keep draft';c.editingReviewId='b';c.draftReviewTime=5;c.draftThumbnail='draft-image';c.draftAnnotations=[{type:'rect',x:.2}];c.video.currentTime=6;c.video.paused=false;c.video.pause=()=>{throw Error('must not pause');};
  const original=JSON.stringify(c.reviews[0]); const beforeDraft=JSON.stringify([c.reviewComment.value,c.editingReviewId,c.draftReviewTime,c.draftThumbnail,c.draftAnnotations]);
  c.renderReviews();const card=f.$('#reviewList').children[0];const button=card.children.at(-1).children.find(el=>el.textContent===(language==='ja'?'レビューを複製':'Duplicate review')); assert.ok(button);assert.equal(button.tag,'button');assert.equal(button.disabled,false);button.click();
  const duplicate=c.reviews.at(-1);assert.notEqual(duplicate.id,'a');assert.equal(JSON.stringify(c.reviews[0]),original);
  for(const key of ['type','status','mode','time','startTime','endTime','comment','thumbnail','frameWidth','frameHeight','annotations'])assert.equal(JSON.stringify(duplicate[key]),JSON.stringify(c.reviews[0][key]),key);
  assert.notEqual(duplicate.createdAt,c.reviews[0].createdAt);assert.equal(duplicate.createdAt,duplicate.updatedAt);
  assert.equal(beforeDraft,JSON.stringify([c.reviewComment.value,c.editingReviewId,c.draftReviewTime,c.draftThumbnail,c.draftAnnotations]));assert.equal(c.video.currentTime,6);assert.equal(c.video.paused,false);assert.equal(c.reviewTypeFilter,'fix');assert.equal(c.reviewStatusFilter,'resolved');
  assert.equal(f.$('#reviewTotal').textContent,c.reviewTotalText(3));assert.equal(f.$('#resolvedReviewCount').textContent,'2');assert.equal(c.reviewTimelineMarkers.children.length,2);assert.equal(c.activeReviewId,duplicate.id);assert.ok(f.$('#reviewList').children.at(-1).focused);assert.ok(c.autosaves>=3);
  assert.equal(c.getFilteredReviews().length,2);assert.equal((c.buildClipboardExport(c.getFilteredReviews()).match(/Comment a/g)||[]).length,2);assert.equal(c.reviewExportSnapshot().reviews.length,3);assert.equal(c.buildMarkdownExport().includes('Comment b'),true);assert.equal(c.buildCsvExport().includes('Comment b'),true);
  duplicate.annotations[0].points[0].x=.9;assert.equal(c.reviews[0].annotations[0].points[0].x,.1);c.reviews[0].annotations[0].points[1].y=.8;assert.equal(duplicate.annotations[0].points[1].y,.4);
});
test('repeated duplicates create distinct IDs and Undo removes only the latest, retaining later edits and notes',()=>{
  const f=fixture(notes),c=f.c;c.duplicateReview('a');const first=c.reviews.at(-1).id;c.duplicateReview('a');const second=c.reviews.at(-1).id;assert.notEqual(first,second);const undo=f.toasts.at(-1).onAction;
  c.reviews[0].comment='Later edit';c.reviews.push(review('later'));c.editingReviewId='b';c.reviewComment.value='Other unsaved draft';undo();undo();
  assert.equal(c.reviews.map(r=>r.id).join(','),`a,b,${first},later`);assert.equal(c.reviews[0].comment,'Later edit');assert.equal(c.reviewComment.value,'Other unsaved draft');assert.equal(c.editingReviewId,'b');
});
test('duplicate is inert for missing notes or non-ready workspace and card action is disabled',()=>{
  const f=fixture(notes),c=f.c;c.duplicateReview('missing');assert.equal(c.reviews.length,2);for(const phase of ['empty','loading','error']){c.phase=phase;c.duplicateReview('a');c.renderReviews();assert.equal(c.reviews.length,2);assert.ok(f.$('#reviewList').children[0].children.at(-1).children.find(el=>el.textContent==='Duplicate review').disabled);}assert.equal(f.toasts.length,0);
});
for(const action of ['delete','duplicate']) for(const boundary of ['load','clear','reset','import']) test(`${action} Undo cannot mutate a ${boundary} replacement workspace`,async()=>{
 const f=fixture(notes),c=f.c;if(action==='delete')await c.deleteReview('a');else c.duplicateReview('a');const undo=f.toasts.at(-1).onAction;
 if(boundary==='load')c.loadFile({name:'Other.mp4',type:'video/mp4'});else if(boundary==='clear')c.clearSource();else if(boundary==='reset')await c.resetCurrentProject();else await c.importProjectFile({text:async()=>JSON.stringify(c.buildProjectSnapshot())});
 c.reviews=[review('new-workspace')];const before=JSON.stringify(c.reviews);undo();assert.equal(JSON.stringify(c.reviews),before);assert.ok(c.dismissed);
});
test('delete confirmation completing after replacement cannot delete a new note',async()=>{
 const f=fixture(notes),c=f.c;let confirm;c.AppConfirm.ask=()=>new Promise(r=>confirm=r);const deleting=c.deleteReview('a');c.clearReviewState();c.reviews=[review('replacement')];confirm(true);await deleting;assert.equal(c.reviews[0].id,'replacement');assert.equal(f.toasts.length,0);
});
test('Cancel deletion preserves notes and offers no Undo',async()=>{const f=fixture(notes);f.c.AppConfirm.ask=async()=>false;await f.c.deleteReview('a');assert.equal(f.c.reviews.length,2);assert.equal(f.toasts.length,0);});
test('same-workspace delete Undo retains later additions, order and is single-use',async()=>{const f=fixture([review('a'),review('b'),review('c')]),c=f.c;await c.deleteReview('b');c.reviews.push(review('d'));const undo=f.toasts.at(-1).onAction;undo();undo();assert.equal(c.reviews.map(r=>r.id).join(','),'a,b,c,d');});
test('normal edit retains identity, creation time and resolved status',async()=>{const {c}=fixture(notes);c.editingReviewId='a';c.selectedReviewType='question';c.reviewComment.value='Changed';c.draftReviewTime=4;await c.saveReview();assert.equal(c.reviews[0].id,'a');assert.equal(c.reviews[0].createdAt,notes[0].createdAt);assert.equal(c.reviews[0].status,'resolved');assert.equal(c.reviews[0].startTime,4);});
test('cloneAnnotations isolates nested freehand points',()=>{const {c}=fixture(notes);const copy=c.cloneAnnotations(notes[0].annotations);copy[0].points[0].x=.9;assert.equal(notes[0].annotations[0].points[0].x,.1);});
test('filtering clears hidden selection without changing editor or backing order',()=>{const {c}=fixture(notes);c.activeReviewId='b';c.editingReviewId='b';c.reviewComment.value='Unsaved';c.setReviewFilter('type','fix');assert.equal(c.activeReviewId,'');assert.equal(c.editingReviewId,'b');assert.equal(c.reviewComment.value,'Unsaved');assert.equal(c.reviews.map(r=>r.id).join(','),'a,b');});
test('invalid range save is inert',async()=>{const {c}=fixture(notes);c.reviewComment.value='Draft';c.selectedReviewMode='range';c.draftRangeStart=3;c.draftRangeEnd=2;const before=JSON.stringify(c.reviews);await c.saveReview();assert.equal(JSON.stringify(c.reviews),before);assert.equal(c.reviewComment.value,'Draft');});
test('duplicate survives serialization and re-link resume with annotations and status',()=>{const {c}=fixture(notes);c.duplicateReview('a');const project=c.normalizeProject(JSON.parse(JSON.stringify(c.buildProjectSnapshot())));const duplicate=project.reviews.at(-1);assert.equal(duplicate.status,'resolved');assert.equal(duplicate.annotations[0].points[1].y,.4);assert.equal(duplicate.thumbnail,notes[0].thumbnail);assert.notEqual(duplicate.id,'a');});
for(const boundary of ['load','import','pagehide']) test(`remove-video Undo is invalid after ${boundary}`,async()=>{
 const f=fixture(notes),c=f.c;await c.removeVideo();const undo=f.toasts.at(-1).onAction;
 if(boundary==='load')c.loadFile({name:'Other.mp4',type:'video/mp4'});else if(boundary==='import')await c.importProjectFile({text:async()=>JSON.stringify({schemaVersion:1,video:{name:'Imported.mp4'},reviews:[]})});else c.invalidateWorkspace();
 const source=c.currentFile, pending=c.pendingResume;undo();assert.equal(c.currentFile,source);assert.equal(c.pendingResume,pending);
});
test('remove-video Undo still restores its own removed source and review snapshot',async()=>{const f=fixture(notes),c=f.c;const original=c.currentFile;await c.removeVideo();f.toasts.at(-1).onAction();assert.equal(c.currentFile,original);assert.equal(c.pendingResume.reviews.length,2);assert.equal(c.pendingResume.reviews[0].status,'resolved');});

test('duplicate autosave persists a complete independent project and reload/re-link retains it', async () => {
  const f=fixture(notes),c=f.c;let stored=null;
  c.projectDbPut=async project=>{stored=JSON.parse(JSON.stringify(project));};
  c.projectDbGet=async()=>stored;
  vm.runInContext(['persistProjectNow','loadStoredProject','resumeSnapshotFromProject'].map(fn).join('\n'),c);
  c.duplicateReview('a');await c.persistProjectNow();assert.equal(stored.reviews.length,3);const id=stored.reviews.at(-1).id;
  c.clearSource();await c.loadStoredProject();const resume=c.resumeSnapshotFromProject(c.detachedProject);c.loadFile({name:'Sample.mp4',type:'video/mp4'},resume);
  assert.equal(c.pendingResume.reviews.at(-1).id,id);assert.equal(c.pendingResume.reviews.at(-1).status,'resolved');assert.equal(c.pendingResume.reviews.at(-1).annotations[0].points[0].x,.1);
});
test('remove-video confirmation completing after replacement is inert',async()=>{const f=fixture(notes),c=f.c;let confirm;c.AppConfirm.ask=()=>new Promise(r=>confirm=r);const removing=c.removeVideo();const other={name:'Other.mp4',type:'video/mp4'};c.loadFile(other);confirm(true);await removing;assert.equal(c.currentFile,other);assert.equal(f.toasts.length,0);});
test('late remove-video storage cleanup cannot expose an Undo for a newer workspace',async()=>{const f=fixture(notes),c=f.c;let finish;c.projectDbDelete=()=>new Promise(r=>finish=r);const removing=c.removeVideo();await new Promise(setImmediate);const other={name:'Other.mp4',type:'video/mp4'};c.loadFile(other);finish();await removing;assert.equal(c.currentFile,other);assert.equal(f.toasts.length,0);});
test('new bilingual help and duplicate labels are present',()=>{for(const language of ['ja','en']){const {c}=fixture([],language);for(const key of ['duplicateReview','reviewDuplicated','reviewDuplicateUndone','helpDuplicate','helpFrameOwnership'])assert.notEqual(c.t(key),key);}});

test('replacement autosave is not lost while removal deletion settles', async () => {
  const f=fixture(), c=f.c;
  vm.runInContext([fn('scheduleAutoSave'),fn('persistProjectNow')].join('\n'),c);
  const timers=[]; c.window.setTimeout=cb=>{timers.push(cb);return timers.length};
  const statuses=[]; c.projectStatus=status=>statuses.push(status);
  let finishDelete; c.projectDbDelete=()=>new Promise(r=>finishDelete=r);
  const put=[]; c.projectDbPut=async p=>put.push(p);
  const removing=c.removeVideo(); await new Promise(setImmediate);
  assert.equal(c.suppressAutosave,true);
  c.loadFile({name:'Other.mp4',type:'video/mp4'}); c.phase='ready';
  c.reviews=[review('replacement')]; c.scheduleAutoSave();
  finishDelete(); await removing;
  while(timers.length) { timers.shift()(); await Promise.resolve(); }
  assert.equal(c.currentFile.name,'Other.mp4');
  assert.equal(put.length,1,'new workspace review must eventually reach autosave');
});
