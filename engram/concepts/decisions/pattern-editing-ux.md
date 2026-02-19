---
created: 2026-02-19
updated: 2026-02-19
---
# Pattern editing UX

Include/exclude file filtering patterns are edited as **newline-separated text in textareas**, converted to/from string arrays for the API.

**Why:** Simpler than a tag-style chip input. Matches how `.gitignore` files work, so the mental model is familiar. One pattern per line, easy to paste from existing ignore files.

**Where used:**
- Project creation wizard (step 5, collapsible "Advanced -- File Filtering" section)
- Project detail/edit page (Details section)

**Default:** Include defaults to `**/*` (match everything). Exclude is empty by default. Safety ignores always apply regardless of user patterns.

## History
- 2026-02-19: Initial decision during include/exclude patterns UI implementation
