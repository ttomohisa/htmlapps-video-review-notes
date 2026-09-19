# Offline Verification — Video Review Notes

1. Run `build-standalone.bat` or `./build-standalone.ps1` on Windows.
2. Open `dist/index.html` directly with `file://`.
3. Open browser developer tools and clear the Network panel.
4. Enable offline mode or disconnect the device.
5. Reload the local HTML.
6. Select a browser-playable MP4 and confirm metadata, play/pause, seek, 5-second jumps, volume, mute, speed, and fullscreen behavior.
7. Replace the MP4 with a WebM and confirm metadata from the previous source is cleared before the new source becomes ready.
8. Remove the video and use Undo; confirm the source reopens and the previous playback settings are restored where possible.
9. Choose an unsupported or invalid file and confirm a user-facing error is shown instead of a raw browser error.
10. Add point reviews at several separated and nearby times; confirm timeline pins appear at the expected relative positions and the playhead follows playback.
11. Create a range review with Start here / End here; confirm an incomplete or reversed range cannot be saved.
12. Confirm the saved range appears as a timeline bar spanning the expected interval and the review card shows start – end time.
13. Select a timeline pin/range bar and confirm the matching review card is selected/focused; select a card and confirm the matching timeline item becomes active.
14. Edit a range start/end position and confirm the timeline bar updates.
15. Start a point review and confirm a frame thumbnail is captured at the review time. Repeat for a range review and confirm the captured frame represents the range start.
16. Draw rectangle, arrow, and freehand annotations; switch through Green / Red / Yellow / Blue / White / Black and confirm each saved mark keeps its selected color. Confirm Undo removes only the latest mark and Clear removes all marks.
17. Save an annotated review and confirm the review card shows the thumbnail and annotation overlay; edit it and confirm the frame and annotations are restored.
18. Change the review time/range start and confirm the frame is refreshed and annotations tied to the old frame are cleared.
19. Test type and status filters separately and together, including a no-results state and Clear filters.
20. Switch Japanese / English and confirm the interface remains usable at 360px and 320px widths without horizontal scrolling.
21. Add reviews with thumbnails/annotations, wait for the autosave status to become saved, then reload the app. Confirm the source video is not restored automatically and a saved-project card is shown instead.
22. Select the same source video and confirm reviews, thumbnails, annotations, filters, and playback settings are restored.
23. Reload again and choose a different filename/size; confirm a mismatch dialog appears before reviews are attached.
24. Save a review JSON, reset the project, then load that JSON and reselect the source video; confirm the project is restored.
25. Try malformed JSON and a JSON file with `schemaVersion` greater than 1; confirm both are rejected with friendly messages.
26. Confirm Project reset clears reviews and browser autosave but leaves the currently selected video open.
27. With at least one point review and one range review (including an annotated thumbnail), save Standalone Review HTML. Open it offline and confirm counts, type/status filters, thumbnail zoom, annotation overlays, and ArrowLeft / ArrowRight review navigation.
28. Inspect the exported HTML and confirm the source video bytes / Blob URL are not embedded and its CSP includes `connect-src 'none'`.
29. Save Markdown and confirm ordered timecodes, type/status, and comments are present.
30. Save CSV and confirm UTF-8 Japanese text opens correctly and the columns are No, Type, Status, Start, End, Comment, CreatedAt, UpdatedAt.
31. Copy reviews and confirm the clipboard contains a readable plain-text review list.
32. Confirm changing the output filename does not allow path separators or reserved filename characters into the downloaded filename.
33. Confirm the Network panel contains no external request, and the console contains no unexpected runtime error.
34. Confirm `assets/favicon.svg`, the header icon, and the embedded favicon all use the canonical release SVG.
35. Confirm `assets/screenshot.png` and `assets/screenshot-en.png` show the current v1.0.0 UI without dialogs, errors, or layout overflow.

For GitHub Pages / Azure Static Web Apps, the initial HTML request is expected. Clear the Network panel after the HTML has loaded, then repeat the complete video flow.

## Privacy-specific checks

- Confirm runtime CSP contains `connect-src 'none'`.
- Confirm no CDN, analytics, telemetry, external font, or API request has been added.
- Confirm source code does not call `File.arrayBuffer()` or `FileReader` for the selected source video.
- Confirm replacing/removing the source revokes its obsolete Blob URL.
- Confirm reloading the app does not restore the source video itself.
- Confirm IndexedDB contains review project metadata, reviews, resized thumbnails, annotations, filters, and playback settings, but no source File / Blob or source-video byte payload.
- Confirm JSON project files likewise contain only metadata, review data, derived thumbnails, annotations, and settings.
- Confirm Standalone Review HTML contains only review metadata / derived thumbnails / annotation data and does not contain source-video bytes.
- Confirm autosave failure leaves the in-page review usable and keeps the manual JSON backup action available.

## Self-extracting variant

Open `dist/index.self-extract.html` directly and confirm:

1. The loading screen appears and then restores the application.
2. The favicon matches the header brand icon from `assets/favicon.svg`.
3. The player flow works offline after unpacking.
4. No decompression or CSP error appears in the console.
5. `scripts/verify-self-extract.ps1` passes and confirms byte-for-byte restoration of the readable HTML.
