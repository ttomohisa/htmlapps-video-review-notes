const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "追加・保存後はコメント欄、対応状態の変更後は同じレビューの操作ボタンからキーボード操作を続けられます。絞り込みでレビューが隠れたときは、コメント欄または選択中の状態フィルターへ移ります。",
  "After adding or saving, keyboard focus continues in Comment. After resolving or reopening, it stays on that review’s status button. If a filter hides the review, focus moves to Comment or the selected status filter.",
  " ダイアログを開いている間は背面のページを固定し、閉じると通常のスクロールに戻ります。",
  " Dialogs keep the background page stationary; closing them restores normal page scrolling."
];
for (const file of ["src/index.template.html", "video-review-notes.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
