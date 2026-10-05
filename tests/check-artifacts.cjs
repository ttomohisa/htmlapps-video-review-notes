// Run after check-repository.ps1. This verifies bytes and the same behavior suite;
// it is not a browser or media-decoding test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const readable = fs.readFileSync('dist/index.html');
const loader = fs.readFileSync('dist/index.self-extract.html', 'utf8');
const match = loader.match(/<script id="self-extract-payload" type="application\/octet-stream">([\s\S]*?)<\/script>/);
assert.ok(match, 'self-extract payload exists');
const restored = gunzipSync(Buffer.from(match[1].trim(), 'base64'));
assert.deepEqual(restored, readable, 'self-extract restores exact readable bytes');
const normalizeBuildTime = html => html.replace(/("generatedAtUtc"\s*:\s*")[^"]*(")/g, '$1BUILD_TIME$2');
assert.equal(normalizeBuildTime(fs.readFileSync('video-review-notes.html','utf8')), normalizeBuildTime(readable.toString('utf8')), 'tracked download matches current generated build except build time');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'video-review-artifacts-'));
try {
  const restoredPath = path.join(temporary, 'restored.html');
  fs.writeFileSync(restoredPath, restored);
  const tests = fs.readdirSync('tests').filter(name => name.endsWith('.test.cjs')).map(name => path.join('tests', name));
  for (const source of ['src/index.template.html','dist/index.html','video-review-notes.html',restoredPath]) {
    console.log(`\nBehavior suite: ${source}`);
    const result = spawnSync(process.execPath, ['--test', ...tests], { stdio:'inherit', env:{...process.env, REVIEW_APP_SOURCE:source} });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `behavior suite passes: ${source}`);
  }
} finally { fs.rmSync(temporary, { recursive:true, force:true }); }
