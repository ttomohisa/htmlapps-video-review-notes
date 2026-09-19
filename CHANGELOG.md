# Changelog

All notable changes to Video Review Notes are documented here.

## [1.0.0] - 2026-09-19

### Changed

- Promoted the v0.9.0 release candidate to the first stable release without expanding the reviewed feature scope.
- Updated the application version, README dependency notes, APP_SPEC release status, offline verification checklist, and generated single-HTML artifacts for v1.0.0.
- Refreshed Japanese and English release screenshots from the final v1.0.0 UI.

### Verified

- Final playback, point/range review, six-color annotation, timeline/filter, autosave/restore, JSON, export, undo, fullscreen, and bilingual regression paths.
- Desktop and smartphone layouts at 360px and 320px with no horizontal overflow in Japanese or English.
- Runtime network blocking, canonical icon embedding, unresolved placeholder checks, readable/self-extract integrity, and source-video non-persistence.

## [0.9.0] - 2026-09-19

### Changed

- Replaced the application icon and canonical `assets/favicon.svg` with the supplied ultralight Video Review Notes SVG.
- Rewrote `README.md` and `README.ja.md` to match the established Browser Kitty / PDF Organizer release README structure, including demo, features, usage, privacy, limitations, build, and GitHub Pages sections.
- Promoted the project to the v0.9.0 release-candidate milestone without expanding the v1.0 feature scope.

### Verified

- Full point/range review, annotation, timeline/filter, autosave/restore, JSON, and export regression paths.
- Japanese / English desktop and smartphone layouts, including 360px and 320px overflow checks.
- Runtime network blocking, standalone build placeholders, canonical icon embedding, and self-extract byte-for-byte restoration.

## [0.8.0] - 2026-09-19

### Added

- Click-to-play / click-to-pause behavior on the video preview, including element fullscreen.
- Six selectable frame-annotation colors stored per annotation and preserved in review cards, autosave/JSON, and Standalone Review HTML.
- Explicit three-step review-entry guidance: review position, required content, optional annotation.
- Required-comment badge and live save-readiness explanation.

### Changed

- The main play control now has a robust playing-state class and switches to the pause icon while playback is active.
- The old “Use current time” wording is replaced by a clearer “Update to this playback position” action; the paused position is used automatically for the normal review flow.
- The supplied Video Review Notes SVG is now used for both `assets/favicon.svg` and the embedded header/favicon icon.

## [0.7.0] - 2026-09-19

### Added

- Dedicated Export reviews panel with filename control and clear completion status.
- Standalone Review HTML export that embeds review data, thumbnails, annotation vectors, filters, counts, thumbnail zoom, and keyboard previous/next navigation without embedding the source video.
- Markdown export for portable text review handoff.
- UTF-8 BOM CSV export with review number, type, status, start/end time, comment, and timestamps.
- Plain-text review copy action for chat / email handoff.
- Review JSON export in the export panel while preserving the existing project-backup workflow.

### Changed

- Help and documentation now describe shareable exports as current functionality instead of a future milestone.
- Output filenames are sanitized and extensions are applied per export format.
- Export controls remain disabled until at least one review exists.

## [0.6.0] - 2026-09-19

### Added

- IndexedDB autosave for reviews, resized thumbnails, annotations, review filters, and playback settings.
- Detached saved-project state after reload; the source video must be selected again before reviews are restored.
- Source re-link checks using saved filename, size, modification time, duration, and dimensions metadata.
- `schemaVersion: 1` JSON project backup and restore.
- Friendly warning and manual JSON fallback when browser autosave is unavailable or fails.
- Project reset and saved-project discard actions.

### Changed

- The source video itself is still never persisted; only review data and derived thumbnails are stored.
- Replacing a video no longer deletes the previous autosave until the new video is successfully opened.
- Help and documentation now describe autosave, source re-linking, JSON backup/restore, and reset behavior.

## [0.5.0] - 2026-09-19

### Added

- Automatic frame capture when a review time or range start is fixed.
- Review thumbnails stored with each point or range review.
- Rectangle, arrow, and freehand annotation tools with touch / pointer support.
- Annotation Undo and Clear actions.
- Normalized annotation coordinates so drawings remain aligned when previews resize.
- Thumbnail previews with annotation overlays in the review list.

### Changed

- Review edit mode restores the captured frame and vector annotations for further editing.
- Video remove / Undo snapshots now preserve annotation arrays safely.
- Help and documentation now describe the v0.5.0 frame-annotation workflow.

## [0.4.0] - 2026-09-19

### Added

- Point / Range review mode switch in the review editor.
- Start-here / End-here workflow for creating start/end range reviews.
- Validation that prevents incomplete ranges and end positions at or before the start.
- Range time display in review cards and localized accessible labels.
- Timeline range bars alongside existing point-review pins.
- Range editing, including converting between point and range modes.

### Changed

- Review sorting, jumping, filtering, deletion/Undo, and source-change confirmation now support both point and range reviews.
- Timeline lane placement accounts for occupied range spans instead of only marker proximity.
- Help and documentation now describe the v0.4.0 range-review workflow.

## [0.3.0] - 2026-09-19

### Added

- Dedicated review timeline with one marker per visible point review.
- Timeline playhead synchronized with the current playback position.
- Bidirectional synchronization between timeline markers and review cards.
- Type filters for All / Fix / Question / Check / Good / Note.
- Status filters for All / Open / Resolved; type and status filters combine.
- Explicit filtered-empty state with a Clear filters action.
- Accessible marker buttons with localized labels and focus treatment.

### Changed

- Open and resolved markers use filled / hollow treatment in addition to opacity so state is not color-only.
- Help and documentation now describe the v0.3.0 timeline/filter workflow and current in-memory-only review state.

## [0.2.0] - 2026-09-19

### Added

- Time-based point reviews attached to the current video position.
- Five review types: Fix, Question, Check, Good, and Note.
- Open / Resolved status with live counts.
- Review list sorted by playback time; selecting a review jumps the player to that moment.
- Review editing, including an explicit “use current time” action.
- Review deletion confirmation using the template confirmation component, plus Undo after deletion.
- `M` keyboard shortcut to start reviewing the current position.
- Confirmation before changing or removing a video when unsaved in-page reviews exist.

### Changed

- Video information moved into a compact collapsible area under the review list so reviews are primary during playback.
- Help and privacy text now describe the actual v0.2.0 behavior and the current lack of review persistence.

## [0.1.0] - 2026-09-19

### Added

- Initial Video Review Notes repository based on the current Browser Kitty single-HTML template.
- Fully local single-video loading through `File` / `Blob URL`.
- Review-oriented custom video player with play/pause, seek, 5-second jumps, volume, mute, playback speed, and fullscreen support.
- Millisecond time-code display.
- Filename, size, duration, resolution, and MIME type display.
- Video replacement and reversible removal.
- Explicit `empty` / `loading` / `ready` / `error` source phases and source-generation invalidation.
- Japanese / English UI, responsive smartphone layout, help dialog, keyboard controls, and accessible labels.
- Runtime CSP with `connect-src 'none'` and no third-party runtime dependencies.

### Changed

- Restored the canonical current Browser Kitty template header sizing, spacing, version badge, and help-button treatment.
- Replaced generic implementation labels in the header with app-specific review features.
- Moved Build information to its own collapsed section at the bottom of the main content, matching current Browser Kitty app presentation.
