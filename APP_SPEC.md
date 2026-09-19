# APP_SPEC.md

## 1. Product identity

- **Name:** Video Review Notes
- **Japanese name:** 動画レビュー付箋
- **Repository:** `ttomohisa/htmlapps-video-review-notes`
- **Current development version:** `v1.0.0`
- **One-sentence purpose:** Open a local video, attach point or range reviews with captured frame annotations, autosave the review project locally, and export portable review deliverables without uploading or embedding the source video.
- **Primary users:** People reviewing videos before publication or handoff, including editors, reviewers, internal teams, educators, and creators.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Product goal

Video Review Notes will become a local-first video review tool for point reviews, range reviews, frame annotations, status tracking, and standalone review reports.

The v1.0 definition is:

> Open a video in the browser, attach time-based point or range reviews and visual annotations, manage open/resolved status, and export the review as a self-contained HTML report or other portable formats without uploading the source video.

`v1.0.0` is the first stable release. It promotes the v0.9.0 release-candidate feature set without expanding scope, after final regression across playback, point/range reviews, colored frame annotations, autosave/restore, exports, bilingual UI, mobile layouts, CSP, offline behavior, and generated single-HTML artifacts. No new cloud, editing, transcoding, or collaboration scope is introduced. The original video file and video bytes are never persisted or embedded in the shareable HTML.

## 3. v1.0.0 core flow

1. Open the page locally or through static hosting.
2. Select or drag one video file into the page.
3. The app creates a Blob URL; it must not read the entire video into an ArrayBuffer.
4. Play, pause, seek, and inspect the video with the review-oriented player.
5. Pause at a moment and choose **This moment** for a point review, or choose **Range** for a start/end review.
6. For a range review, set **Start here**, move through the video, then set **End here**; end must be later than start.
7. The app captures a resized frame thumbnail at the point-review time or range start.
8. Choose Fix / Question / Check / Good / Note, write a comment, and optionally draw a rectangle, arrow, or freehand annotation over the captured frame.
9. Save the review; the thumbnail and annotation overlay appear in the review card.
10. See point reviews as timeline pins and range reviews as timeline bars.
11. Select a timeline pin/bar or review card to pause and jump to the review start time; selected state stays synchronized.
12. Filter the review list and timeline together by review type and by Open / Resolved status.
13. Edit review timing, comment, type, thumbnail annotations, and Open / Resolved status, or delete with confirmation and Undo.
14. Replace or remove the video without reloading the application; if reviews exist, confirm before clearing them.
15. Choose an output filename and export the current reviews as Standalone Review HTML, Markdown, CSV, review JSON, or copied plain text.
16. The Standalone Review HTML works offline, includes thumbnails and annotation vectors, supports type/status filters, thumbnail zoom, and keyboard previous/next review navigation, and does not embed the source video.

## 4. v1.0.0 functional requirements

- Accept one local video at a time.
- Support file picker and drag-and-drop.
- Use browser-native `<video>` decoding. Do not add FFmpeg/WASM in v1.0.0.
- Main test targets: browser-playable MP4/H.264/AAC and WebM.
- Display a useful unsupported-media error instead of raw `MediaError` text.
- Use a dedicated review-oriented player, not the browser's default controls.
- Provide play/pause, seek, millisecond time display, 5-second jumps, keyboard 5/10-second jumps, volume/mute, 0.25x–2x speed, and fullscreen where supported.
- Clicking the video preview toggles play/pause in normal view and in element fullscreen; native browser fullscreen controls remain available where the platform uses native video fullscreen.
- The main transport button must show a pause icon while video playback is active and a play icon otherwise.
- The review editor must visually explain the sequence: review position, required review content, optional frame annotation.
- Comment is required; the disabled Add review state must include visible text explaining why it is disabled.
- Show loaded-video metadata: filename, size, duration, resolution, MIME type.
- Preserve Japanese/English UI selection in local storage.
- Do **not** persist the video file or video bytes.
- Revoke obsolete Blob URLs on source replacement, removal, and page exit.
- Use a monotonically increasing source generation token so late events from an old source cannot overwrite a newly selected source.
- Explicit video phases: `empty`, `loading`, `ready`, `error`.
- Add point reviews at `HH:MM:SS.mmm` playback positions.
- Add range reviews with `startTime` and `endTime`; `endTime` must be later than `startTime`.
- The review editor exposes explicit **This moment / Range** modes.
- Range creation uses **Start here** and **End here** actions based on the current video position.
- Existing point review behavior remains unchanged and point/range mode can be changed while editing.
- Capture a review thumbnail from the browser-decoded video frame when a review point / range start is fixed.
- Limit the captured frame to a 720px maximum dimension and JPEG-compress it so review data stays much smaller than the source video.
- Frame capture failure must not make review text unusable; report a friendly warning and allow the review to continue without a thumbnail.
- Annotation tools: rectangle, arrow, freehand.
- Annotation color is selectable per drawn vector from the provided palette; color is stored with each annotation and preserved in cards, JSON/autosave, and Standalone Review HTML.
- Existing annotations without a stored color remain compatible and default to Browser Kitty green.
- Annotation input supports Pointer Events so mouse, pen, and touch can use the same path.
- Annotation coordinates are normalized to `0..1` relative to the captured frame; do not burn annotation vectors into the stored base thumbnail.
- Provide annotation Undo (latest mark) and Clear all.
- Review cards show the captured thumbnail and render stored annotations as an overlay.
- Editing an existing review restores its thumbnail and annotations for further editing.
- If a review time / range start is explicitly changed, capture the new frame and clear annotations tied to the old frame.
- Review types: `fix`, `question`, `check`, `good`, `note`.
- Review status: `open`, `resolved`.
- Review list is sorted by video time.
- Render visible point reviews as timeline pins and range reviews as timeline bars positioned from review start/end divided by video duration.
- Timeline pins and range bars support keyboard focus and localized accessible labels.
- Open and resolved timeline items must be visually distinguishable without relying on color alone.
- Selecting a review card highlights the corresponding timeline pin or range bar.
- Selecting a timeline pin/range bar pauses/seeks the video to the review start, selects the corresponding review, scrolls it into view, and moves keyboard focus to that review card.
- The playback playhead is shown on the review timeline and follows the current playback position.
- Filter both the review list and timeline by review type: All / Fix / Question / Check / Good / Note.
- Filter both the review list and timeline by status: All / Open / Resolved.
- Filters combine using AND semantics.
- Review counts continue to describe all reviews, not only the filtered subset.
- When filters match no reviews, show an explicit empty state with a Clear filters action.
- Editing can change type, comment, mode, point time, and range start/end positions.
- Starting comment input pauses playback and freezes the draft review time.
- Review delete requires confirmation and offers Undo.
- Changing/removing the video while reviews exist requires confirmation. Removing the video also removes the browser autosave unless the user immediately restores the workspace with Undo.
- Export controls remain disabled until at least one review exists.
- Output filename editing is separate from file extensions; filenames are sanitized and `.html`, `.md`, `.csv`, or `.video-review.json` is applied as appropriate.
- Standalone Review HTML contains review metadata, comments, derived thumbnails, and vector annotations but never source-video bytes.
- Standalone Review HTML must work offline with `connect-src 'none'`, no external assets, and no runtime network access.
- Standalone Review HTML supports type/status filters, review counts, thumbnail zoom, and ArrowLeft / ArrowRight navigation between visible reviews.
- Markdown export contains ordered review timecodes, type/status, and comments.
- CSV export uses UTF-8 with BOM and includes No, Type, Status, Start, End, Comment, CreatedAt, UpdatedAt.
- Clipboard export provides a plain-text review handoff suitable for chat or email.

## 5. Data and privacy

- The selected video remains on the user's device.
- The source video is exposed to the page only through a local File object / Blob URL.
- No video upload, API call, analytics, telemetry, external font, CDN asset, or runtime network request.
- Runtime CSP keeps `connect-src 'none'`.
- No source video data is written to localStorage or IndexedDB.
- Reviews, resized thumbnails, annotations, type/status filters, and playback settings are autosaved in IndexedDB.
- Captured thumbnails are derived data only; the source video itself is never persisted.
- The user must reselect the source video to resume an autosaved project.
- Saved project metadata includes filename, size, MIME type, lastModified, duration, and dimensions for re-link checks.
- Project JSON uses `schemaVersion: 1` independently of the app version.
- JSON import validates/sanitizes project structure before use.
- Language preference remains in localStorage.

## 6. Performance expectations

- Do not call `file.arrayBuffer()` for the source video.
- Multi-GB files should not be duplicated in JavaScript memory by design.
- UI updates driven by playback must remain lightweight.
- Thumbnail capture occurs only when review timing is fixed/changed; do not capture frames continuously during playback.
- Timeline item rendering occurs on review/filter/language/duration changes, not every playback frame.
- Replacing a video must promptly revoke the old Blob URL.

## 7. UX / accessibility

- Desktop and smartphone are first-class.
- On smartphones, the video, seek control, review timeline, and transport controls remain adjacent.
- No horizontal scrolling at 320px width.
- Touch targets should be comfortably tappable.
- Timeline pins and range bars are real buttons with focus styling and localized `aria-label` text.
- Filter chips expose pressed state through `aria-pressed`.
- All icon-only buttons require accessible labels and localized titles.
- Visible keyboard focus is required.
- Status and error changes use `aria-live`.
- Motion honors `prefers-reduced-motion`.
- The help dialog must remain scrollable to its final item on short smartphone viewports.
- Use SVG icons rather than emoji.

## 8. Error and recovery behavior

- Wrong/non-video file: explain that a video file is required and retain the previous source if the file was rejected before replacement.
- Browser cannot decode the selected video: move to `error`, keep the filename visible, and offer another selection.
- Source replacement: invalidate the previous generation, revoke its Blob URL, clear old metadata/playback/review/filter state, and then load the new source.
- Fullscreen unsupported: disable or gracefully fall back; do not show a fatal error.
- IndexedDB unavailable/write failure: keep the in-page review usable, show a friendly autosave warning, and keep manual JSON backup available.
- Saved project on reload: show a detached-project state and require explicit source-video selection before restoring the review workspace.
- Source mismatch: if filename / size / modification time differs from the saved metadata, require confirmation before attaching the saved reviews to that video.
- JSON import: reject malformed or unsupported schema files with a friendly message; never silently merge them into the current project.

## 9. Non-goals for v1.0.0

- Embedding the source video inside Standalone Review HTML.
- Editing reviews inside the exported Standalone Review HTML.
- Cloud project storage or sync.
- Storing the source video in IndexedDB.
- Video conversion or transcoding.
- Cloud collaboration or sharing.

## 10. Acceptance criteria for v1.0.0

- App source is based on the current Browser Kitty template and keeps its build placeholders/contracts intact.
- `dependencies.json` remains empty.
- `src/index.template.html` has the canonical favicon/header icon placeholders exactly twice.
- Runtime CSP includes `connect-src 'none'`.
- The readable standalone output contains no external runtime script/style/frame/module/image/font URL.
- Video selection does not call `File.arrayBuffer()` or `FileReader` for the source video.
- Replacing/removing the video revokes the previous Blob URL.
- A point review can be added, edited, jumped to, resolved/reopened, and deleted.
- A range review can be created with start/end positions, edited, jumped to, resolved/reopened, and deleted.
- Invalid or incomplete ranges cannot be saved.
- Fixing a review time captures a resized thumbnail when the browser exposes a drawable video frame.
- Clicking the video preview toggles playback without interfering with annotation editing or the separate transport controls.
- The play button visibly changes to pause while playback is active.
- Review-position guidance makes it clear that the paused/current playback position is used and that the update action is only needed after moving to another position.
- Empty comments visibly explain why Add review is disabled; entering a valid comment updates the action-ready state.
- Rectangle, arrow, and freehand annotations can be created with pointer input and are stored with normalized coordinates.
- Annotation colors can be selected before drawing and remain correct after edit, autosave/JSON restore, review-card rendering, and Standalone Review HTML export.
- Annotation Undo and Clear work before saving; editing restores saved thumbnails and annotations.
- Review cards render saved thumbnails and visual annotation overlays.
- Visible point reviews have timeline pins and visible range reviews have timeline bars at the corresponding relative positions.
- Timeline pin/bar selection and review-card selection remain synchronized.
- The timeline playhead follows the current video position.
- Type and status filters update both list and timeline.
- Combined filters and no-result filter state work in Japanese and English.
- Delete confirmation and Undo continue to work.
- Existing reviews are not silently discarded when changing/removing the source video.
- Japanese and English fit at 360px without horizontal scrolling; 320px is also checked for layout overflow.
- The app can be opened via `file://` and play a user-selected local file.

- Reviews, thumbnails, annotations, filters, and playback settings autosave to IndexedDB after review changes.
- Reloading the page reveals a saved-project state without persisting or auto-loading the source video.
- Selecting the matching source video restores reviews, annotations, filters, and playback settings.
- Selecting a mismatched source video requires explicit confirmation before restoring the saved reviews.
- Review JSON can be downloaded and loaded with `schemaVersion: 1`.
- Malformed JSON and newer unsupported schema versions are rejected with friendly messages.
- Autosave failure does not destroy the in-page review and points the user to JSON backup.
- Project reset clears reviews and browser autosave while leaving the selected source video open.
- The source video File / Blob bytes are never persisted to IndexedDB or JSON.
- Standalone Review HTML can be downloaded and opened offline with review counts, type/status filters, thumbnail zoom, and ArrowLeft / ArrowRight review navigation.
- Standalone Review HTML contains review metadata, derived thumbnails, and vector annotations but no source-video bytes.
- Standalone Review HTML has no external runtime dependency and keeps `connect-src 'none'`.
- Markdown export contains ordered timecodes, type/status labels, and comments.
- CSV export is UTF-8 with BOM and includes the documented columns.
- Plain-text clipboard export produces a readable review handoff.
- Output filename sanitation prevents path separators and reserved filename characters.
- Japanese and English desktop smoke tests complete with a real browser-playable MP4.
- Japanese and English smartphone layouts are checked at 360px and 320px with no horizontal overflow or fixed-UI overlap.
- Initial, empty, loading, ready, warning, error, filtered-empty, autosave-resume, and export-complete states are reviewed.
- The canonical `assets/favicon.svg`, header icon, and embedded favicon all use the supplied final release SVG.
- `dist/index.html` and `dist/index.self-extract.html` are regenerated from the source template and the self-extract payload restores byte-for-byte to the readable build.
- README / README.ja.md describe the actual stable-release behavior, privacy boundary, browser limitations, build flow, and GitHub Pages deployment without claiming unsupported features.

## 11. Planned milestones

- **v0.1.0 — Video Player / Foundation:** local source loading and review-oriented player.
- **v0.2.0 — Point Review:** five review types, comments, open/resolved, review list, jump-to-time.
- **v0.3.0 — Timeline:** review markers, filters, list/timeline synchronization.
- **v0.4.0 — Range Review:** start/end range reviews and range editing.
- **v0.5.0 — Frame Annotation:** thumbnail capture, rectangle, arrow, freehand, normalized coordinates.
- **v0.6.0 — Project / Persistence:** IndexedDB review data, JSON project backup/restore, source re-linking. Original video is still not persisted.
- **v0.7.0 — Export:** standalone review HTML, Markdown, CSV, JSON, clipboard.
- **v0.8.0 — Mobile / UX / Accessibility:** playback click behavior, play/pause state, clearer review-entry flow, required-comment feedback, colored annotations, and continued mobile/accessibility polish.
- **v0.9.0 — Release Candidate:** large-file, browser, state, CSP, output, bilingual regression tests.
- **v1.0.0 — Stable Release:** final README, screenshots, favicon, release regression, publication assets. **Current.**

## 12. v1.0 non-goals

- Video editing/transcoding.
- Cloud accounts or storage.
- Live collaboration or chat.
- Review URL sharing.
- AI-generated review comments.
- Premiere Pro / DaVinci Resolve integrations.
- Bundling the original multi-GB source video into the standalone review HTML.
- Version comparison (candidate for v1.1+).

## 13. In-app help contract

The help dialog must explain the actual stable release, not future features as if already available. In v1.0.0 it must cover:

- how to select/replace/remove a video;
- player controls and keyboard shortcuts;
- how to add, edit, resolve/reopen, jump to, and delete point reviews;
- how to create and edit range reviews using Start here / End here;
- how automatic frame capture works and how to use rectangle / arrow / freehand annotations, Undo, and Clear;
- timeline pin/range-bar selection and type/status filters;
- complete local-processing/privacy behavior;
- browser codec limitations;
- browser autosave behavior and the fact that the source video itself is not stored;
- how to resume by selecting the source video again;
- JSON project save/load and project reset;
- autosave failure fallback behavior;
- how to set an output filename and export Standalone Review HTML / Markdown / CSV / JSON or copy reviews;
- that the Standalone Review HTML contains review thumbnails/annotations but not the source video.
