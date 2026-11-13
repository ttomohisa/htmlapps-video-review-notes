const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync(process.env.REVIEW_APP_SOURCE||'src/index.template.html','utf8');
test('portrait preview fits its fixed frame',()=>assert.match(s,/\.video-frame video \{[^}]*position:\s*absolute[^}]*inset:\s*0/));
test('annotation canvas has no letterboxed content box',()=>assert.match(s,/\.annotation-canvas \{[^}]*width:\s*auto[^}]*max-width:\s*100%/));
test('review changes warn before leaving while persistence is pending',()=>{assert.match(s,/beforeunload/);assert.match(s,/autosaveRevision/)});
test('review thumbnail overlay is limited to displayed image',()=>assert.match(s,/\.review-card-thumb \{[^}]*width:\s*fit-content/));
