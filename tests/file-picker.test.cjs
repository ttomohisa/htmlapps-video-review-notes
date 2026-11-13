const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync(process.env.REVIEW_APP_SOURCE||'src/index.template.html','utf8');
test('file picker offers unrestricted files for new, replacement and resume',()=>{assert.match(s,/<input id="videoFileInput" type="file" hidden>/);for(const id of ['chooseVideoFileButton','replaceVideoFileButton','resumeProjectFileButton'])assert.ok(s.includes(`id="${id}"`));assert.match(s,/videoFileInput\.addEventListener\('change'/)});
test('invalid replacement does not cancel pending autosave',()=>{const a=s.indexOf('function loadFile('), b=s.indexOf('sourceGeneration += 1;',a),part=s.slice(a,b);assert.ok(part.indexOf('clearTimeout(autosaveTimer)')>part.indexOf('if (!isVideoLike(file))'));});
test('bfcache pagehide preserves active media',()=>{assert.match(s,/addEventListener\('pagehide', event => \{\s*if \(event\.persisted\) return;/)});
