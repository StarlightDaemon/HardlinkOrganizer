# Prompt 50: IBM Carbon G100 UI Rebuild

**Governance Authority:** Starlight Carbon Architecture (github.com/StarlightDaemon/StarlightCarbonArchitecture)
**Builder Role:** Builder Agent — Reconstruction pass
**Strategy:** Radical Reconstruction (per agent-handoff-protocol.md v2.0.0)
**Recommended model:** Claude Sonnet 4.6 / Gemini 3.1 Pro
**Recommended mode:** planning off — execute directly

---

## 0. Governance Contract

You are a **Builder Agent** operating under the Starlight Carbon Architecture governance
system. The following rules are **inviolable**. They are not preferences.

| Rule | Requirement |
|---|---|
| Color values | **Forbidden:** hardcoded hex (`#5af2c8`, `rgba(90,…)`). **Required:** Carbon semantic tokens (`var(--cds-interactive)`, `var(--cds-support-success)`) |
| Spacing | 8px base unit. All margins and padding must be multiples of 8px or use Carbon spacing tokens (`$spacing-05 = 1rem`, `$spacing-07 = 2rem`) |
| Theme | IBM Carbon **G100** (dark) applied via `data-carbon-theme="g100"` on `<html>` |
| Typography | IBM Plex Sans (loaded by Carbon). IBM Plex Mono for code/paths. Remove the current Space Grotesk import |
| Approach | **Injection Strategy** — CDN-loaded Carbon CSS + CSS custom properties. No React build step required |
| Grid | 16-column Carbon grid (`cds--grid`, `cds--row`, `cds--col-*`) wherever layout decisions are made |
| Components | Map every current custom component to the nearest Carbon HTML component pattern. No new custom UI widgets |
| Accessibility | WCAG 2.1 AA — all interactive elements must be keyboard accessible, have visible focus rings, and meet 4.5:1 contrast for normal text |

Do not patch the existing CSS. Delete it and rebuild from Carbon tokens.

---

## 1. Repository

`/mnt/e/HardlinkOrganizer`

This is a Python/FastAPI (Jinja2) NAS tool called **Hardlink Organizer**.
It is a preview-first hardlink workflow: Scan → Browse → Destination → Preview → Execute → Verify.
No npm/node build exists. The frontend is pure vanilla JS + one HTML template + one CSS file.

---

## 2. What to Read First

Before touching any file:

1. `webapp/templates/index.html` — the only HTML template (Jinja2)
2. `webapp/static/style.css` — 1076 lines of custom CSS to be deleted and replaced
3. `webapp/static/app.js` — 938 lines of vanilla JS. Read every function. **Do not rewrite logic**, only update the HTML strings it emits.
4. `webapp/app.py` lines 64–100 — the template context variables (`sets_json`, `summaries_json`, `version`)

---

## 3. Current Frontend Inventory

### Template: `webapp/templates/index.html`

Structure (all to be rebuilt with Carbon markup):
- `<header class="app-header">` — brand + version badge + status indicator
- `<section class="hero-strip">` — marketing panel with kicker, title, pills, CTA row, 3-step flow cards, facts sidebar
- `<div class="step-bar">` — 5-step progress indicator (Source → Browse → Destination → Preview → Done)
- `<div class="content-grid">` — two-column layout: main workflow panel (left) + history sidebar (right)
- `<div class="toast-container">` — toast notification anchor

Jinja2 template variables that must survive the rebuild:
```
window.__SETS__      = {{ sets_json | safe }};
window.__SUMMARIES__ = {{ summaries_json | safe }};
window.__VERSION__   = {{ version | tojson }};
```
And: `v{{ version }}` appears in the header brand and hero facts.

### JavaScript: `webapp/static/app.js`

The JS manages 6 workflow steps by writing HTML strings into `#main-panel`:

| Step | `state.step` value | Key function |
|---|---|---|
| Source selection | `'source'` | `renderSourceStep()` — card grid of source sets |
| Browse inventory | `'browse'` | `renderBrowseStep()` — filterable list of file/dir entries with expand detail |
| Destination selection | `'dest'` | `renderDestStep()` — card grid of dest sets + subpath text input |
| Preview | `'preview'` | `renderPreviewStep()` — structured preview card, validation/warning blocks, dry-run toggle |
| Result | `'result'` | `renderResultStep()` — counts grid (linked/skipped/failed), collapsible file lists |
| Verification | `'verify'` | `renderVerifyStep()` — results table with filter select, export buttons |

The JS also:
- Manages the `#history-list` sidebar (rendered by `renderHistory()`)
- Controls the step bar active/done states (via `updateStepIndicator()`)
- Emits toasts (via `toast(msg, type)`) into `#toast-container`
- Shows a loading spinner and updates `#status-dot` / `#status-text` in the header

### CSS: `webapp/static/style.css`

Current custom design system — **delete entirely**. Replace with Carbon tokens.
Notable non-standard elements you must re-solve in Carbon:
- Hero strip with gradient overlays and grid pattern decoration (simplify to Carbon `Tile` or a plain `cds--grid` section; do not reproduce CSS art)
- Animated signal bars in the hero facts panel (remove; Carbon has no equivalent)
- History sidebar `cnt-badge` (linked/skipped/failed) → Carbon `Tag` with green/yellow/red semantic
- Step connector lines between step numbers → Carbon `ProgressIndicator` handles this natively
- `.validation-block.ok/.fail/.warn` → Carbon `InlineNotification` (success/error/warning)
- Toast notifications → Carbon `ToastNotification` structure

---

## 4. API Contracts (Do Not Change)

The following API endpoints are called by `app.js`. The backend is complete and must not be modified. The JS already handles the responses correctly — you only need to update the HTML it emits.

```
GET  /api/config/sets           → { source_sets, dest_sets, scan_summaries }
POST /api/scan                  → { scanned_sets, total_entries, per_set }
GET  /api/inventory?source_set= → { source_set, entries[], scan_time, from_db }
POST /api/preview               → { valid, errors[], warnings[], dest_full, ... }
POST /api/execute               → { success, linked, skipped, failed, linked_files[], ... }
GET  /api/history               → { history[], total }
POST /api/verify                → { run_id }
GET  /api/verify/{id}           → { run_id, results[], verified_count, ... }
GET  /api/verify/{id}/export.json
GET  /api/verify/{id}/export.csv
GET  /api/destinations          → { destinations[], total }
POST /api/destinations/validate → { valid, checks{}, warnings[], errors[] }
```

---

## 5. Carbon CDN Setup

Since there is no npm build, load Carbon via CDN. Add these to `<head>` in `index.html`:

```html
<!-- IBM Carbon G100 dark theme -->
<link rel="stylesheet"
      href="https://unpkg.com/@carbon/styles@1/css/styles.min.css">

<!-- IBM Plex fonts (Carbon standard) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
      rel="stylesheet">
```

Apply the theme on `<html>`:
```html
<html lang="en" data-carbon-theme="g100">
```

Remove the current Space Grotesk font import entirely.

For any layout gaps Carbon CSS alone cannot close, write a `webapp/static/carbon-overrides.css`
that uses **only** Carbon CSS custom properties:
```css
/* ALLOWED */
.hlo-path-value { color: var(--cds-text-secondary); font-family: 'IBM Plex Mono', monospace; }

/* FORBIDDEN */
.hlo-path-value { color: #a5b4c3; }
```

---

## 6. Component Mapping

Map every current custom element to the Carbon HTML equivalent below.
The `cds--` prefix is the Carbon v11 prefix (from `@carbon/styles@1`).

### Header
```html
<!-- Current: .app-header / .header-inner / .header-brand -->
<!-- Carbon: -->
<header class="cds--header" role="banner">
  <a class="cds--header__name" href="/">
    <span class="cds--header__name--prefix">⛓</span> Hardlink Organizer
  </a>
  <div class="cds--header__global">
    <!-- version tag + status indicator go here as header actions -->
  </div>
</header>
<!-- Spacer below fixed header -->
<div class="cds--content">...</div>
```

### Grid Layout
```html
<div class="cds--grid cds--grid--full-width">
  <div class="cds--row">
    <main class="cds--col-lg-12" id="main-panel">...</main>
    <aside class="cds--col-lg-4" id="history-panel">...</aside>
  </div>
</div>
```

### Step Progress Indicator
```html
<!-- Current: .step-bar -->
<!-- Carbon: -->
<ul class="cds--progress" data-progress data-progress-current>
  <li class="cds--progress-step cds--progress-step--current" id="step-1">
    <svg><!-- Carbon checkmark icon --></svg>
    <p class="cds--progress-label">Source</p>
    <span class="cds--progress-line"></span>
  </li>
  <!-- repeat for Browse, Destination, Preview, Done -->
</ul>
```

### Tiles (Source / Destination cards)
```html
<!-- Current: .card.card-grid -->
<!-- Carbon: -->
<div class="cds--grid">
  <div class="cds--row">
    <div class="cds--col-md-4">
      <button class="cds--tile cds--tile--clickable" type="button">
        <h3 class="cds--tile__title">movies</h3>
        <p class="cds--tile__description">/mnt/data/movies</p>
      </button>
    </div>
  </div>
</div>
```

### Buttons
```html
<!-- Current: .btn .btn-primary / .btn-secondary / .btn-danger / .btn-sm -->
<!-- Carbon: -->
<button class="cds--btn cds--btn--primary" type="button">Scan &amp; Select</button>
<button class="cds--btn cds--btn--secondary" type="button">Back</button>
<button class="cds--btn cds--btn--danger" type="button">Delete</button>
<button class="cds--btn cds--btn--sm cds--btn--ghost" type="button">↺</button>
```

### Text Input
```html
<!-- Current: .inventory-search / .subpath-input -->
<!-- Carbon: -->
<div class="cds--text-input-wrapper">
  <label class="cds--label" for="search-input">Filter entries</label>
  <input id="search-input" class="cds--text-input" type="text" placeholder="Search…">
</div>
```

### Notifications (Validation Blocks and Toasts)
```html
<!-- Current: .validation-block.ok / .fail / .warn -->
<!-- Carbon inline notification: -->
<div class="cds--inline-notification cds--inline-notification--success" role="status">
  <div class="cds--inline-notification__details">
    <svg class="cds--inline-notification__icon">...</svg>
    <div class="cds--inline-notification__text-wrapper">
      <p class="cds--inline-notification__title">Ready to link</p>
      <p class="cds--inline-notification__subtitle">Plan is valid.</p>
    </div>
  </div>
</div>

<!-- error: cds--inline-notification--error -->
<!-- warning: cds--inline-notification--warning -->

<!-- Current: .toast (in #toast-container) -->
<!-- Carbon toast notification: -->
<div class="cds--toast-notification cds--toast-notification--success" role="alert">
  <div class="cds--toast-notification__details">
    <h3 class="cds--toast-notification__title">Success</h3>
    <p class="cds--toast-notification__subtitle">3 files linked.</p>
  </div>
  <button class="cds--toast-notification__close-button" type="button">×</button>
</div>
```

### Tags (Badges)
```html
<!-- Current: .badge-linked / .badge-dir / .cnt-badge.linked / .cnt-badge.failed -->
<!-- Carbon: -->
<span class="cds--tag cds--tag--green">Linked</span>
<span class="cds--tag cds--tag--blue">Dir</span>
<span class="cds--tag cds--tag--red">Failed</span>
<span class="cds--tag cds--tag--yellow">Skipped</span>
<span class="cds--tag cds--tag--teal">Dry run</span>
```

### Structured List (Preview rows + History entries)
```html
<!-- Current: .preview-row / .preview-label / .preview-value -->
<!-- Carbon: -->
<div class="cds--structured-list">
  <div class="cds--structured-list-tbody">
    <div class="cds--structured-list-row">
      <div class="cds--structured-list-td cds--structured-list-content--nowrap">Source</div>
      <div class="cds--structured-list-td">/mnt/data/movies/Film.mkv</div>
    </div>
  </div>
</div>
```

### Data Table (Verification results)
```html
<!-- Current: custom verification results list in renderVerifyStep() -->
<!-- Carbon: -->
<div class="cds--data-table-container">
  <table class="cds--data-table cds--data-table--sort">
    <thead>
      <tr>
        <th scope="col"><div class="cds--table-header-label">Status</div></th>
        <th scope="col"><div class="cds--table-header-label">Source</div></th>
        <th scope="col"><div class="cds--table-header-label">Destination</div></th>
        <th scope="col"><div class="cds--table-header-label">Notes</div></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="cds--tag cds--tag--green">verified</span></td>
        <td class="cds--table-column-checkbox">/path/source</td>
        <td>/path/dest</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Loading Indicator
```html
<!-- Current: .spinner -->
<!-- Carbon: -->
<div class="cds--loading" aria-live="assertive">
  <svg class="cds--loading__svg" viewBox="-75 -75 150 150" aria-hidden="true">
    <circle class="cds--loading__background" cx="0" cy="0" r="37.5"/>
    <circle class="cds--loading__stroke" cx="0" cy="0" r="37.5"/>
  </svg>
</div>
<!-- Or for inline: cds--loading--small -->
```

### Select (Verification filter)
```html
<!-- Current: <select> for verification filter -->
<!-- Carbon: -->
<div class="cds--select">
  <label class="cds--label" for="verify-filter">Filter results</label>
  <div class="cds--select-input-wrapper">
    <select id="verify-filter" class="cds--select-input">
      <option value="all">All Results</option>
      <option value="failures">Failures &amp; Missing</option>
      <option value="verified">Verified Only</option>
    </select>
  </div>
</div>
```

---

## 7. Hero Strip — Simplified Approach

The current hero strip uses custom CSS art (radial gradients, grid overlays, animated signals).
Do not reproduce these. Replace with a clean Carbon tile section:

```html
<section class="cds--grid" aria-label="About Hardlink Organizer">
  <div class="cds--row" style="padding: var(--cds-spacing-07) 0;">
    <div class="cds--col-lg-10">
      <div class="cds--tile">
        <p style="color: var(--cds-text-secondary); text-transform: uppercase;
                  letter-spacing: .08em; font-size: .75rem;">Local sandbox</p>
        <h1 style="font-size: 2rem; font-weight: 600; margin-top: var(--cds-spacing-03);">
          Preview-first hardlinking for messy ingress folders.
        </h1>
        <p style="color: var(--cds-text-secondary); margin-top: var(--cds-spacing-05);">
          Scan a source set, choose an item, preview the plan, then link without
          touching the original payload.
        </p>
        <div style="display:flex; gap: var(--cds-spacing-03); margin-top: var(--cds-spacing-05); flex-wrap:wrap;">
          <span class="cds--tag cds--tag--cool-gray">Source-safe</span>
          <span class="cds--tag cds--tag--cool-gray">Preview-first</span>
          <span class="cds--tag cds--tag--cool-gray">Verification-ready</span>
        </div>
        <div style="margin-top: var(--cds-spacing-05); display:flex; gap: var(--cds-spacing-03); flex-wrap:wrap;">
          <a class="cds--btn cds--btn--primary" href="#main-panel">Open workflow</a>
          <a class="cds--btn cds--btn--secondary" href="#history-panel">View recent activity</a>
        </div>
      </div>
    </div>
    <div class="cds--col-lg-6">
      <div class="cds--tile" style="height:100%;">
        <!-- Facts: Version, Status, Target, Rhythm — as a structured list -->
        <div class="cds--structured-list cds--structured-list--condensed">
          <div class="cds--structured-list-tbody">
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td">Version</div>
              <div class="cds--structured-list-td">v{{ version }}</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td">Target</div>
              <div class="cds--structured-list-td">NAS / homelab workflows</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td">Rhythm</div>
              <div class="cds--structured-list-td">Scan → Preview → Link</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## 8. JavaScript Changes

`app.js` generates HTML strings for each step. You must update those strings
to use Carbon markup instead of the custom classes. The logic (API calls,
state machine, step routing) must not change.

Specific callsites that need HTML updates:

| Function | What to replace |
|---|---|
| `renderSourceStep()` | `.card-grid` + `.card` → Carbon `cds--grid` + `cds--tile--clickable` |
| `renderBrowseStep()` | `.entry-list` + `.entry-row` → Carbon structured list or expandable rows |
| `renderDestStep()` | `.card-grid` + `.subpath-block` + `.subpath-input` → tiles + `cds--text-input` |
| `renderPreviewStep()` | `.preview-card` + `.validation-block.warn/.ok/.fail` → `cds--structured-list` + `cds--inline-notification` |
| `renderResultStep()` | `.result-counts` + `.result-count-num` → Carbon number tiles or stat blocks |
| `renderVerifyStep()` | custom table → `cds--data-table` with Carbon tag status cells |
| `renderHistory()` | `.history-entry` entries → Carbon structured list items |
| `toast()` | `.toast.success/.error/.info/.warning` → `cds--toast-notification--*` |
| `updateStepIndicator()` | `.step-item.active/.done` class toggling → `cds--progress-step--current/--complete` |

Keep `escHtml()` in place. Do not introduce `innerHTML` with unescaped user data.

---

## 9. Files to Produce

| File | Action |
|---|---|
| `webapp/templates/index.html` | Rewrite — Carbon HTML structure, Jinja2 vars preserved |
| `webapp/static/style.css` | **Delete entirely** — all rules replaced by Carbon |
| `webapp/static/carbon-overrides.css` | New file — only Carbon CSS custom properties allowed |
| `webapp/static/app.js` | Update HTML string literals only; do not change logic |

Do **not** modify any file outside `webapp/templates/` and `webapp/static/`.

---

## 10. Validation Checklist

Before you finish, self-audit against these criteria:

- [ ] No hardcoded hex or rgba() color values anywhere in HTML or CSS files
- [ ] `data-carbon-theme="g100"` is set on `<html>`
- [ ] Space Grotesk import is removed; IBM Plex Sans is loaded instead
- [ ] All buttons use `cds--btn` Carbon classes
- [ ] Step progress bar uses `cds--progress` structure
- [ ] Validation blocks use `cds--inline-notification` (not `.validation-block`)
- [ ] Toasts use `cds--toast-notification` structure
- [ ] History sidebar entries use Carbon structured list or tile pattern
- [ ] Verification results use `cds--data-table`
- [ ] All inputs use `cds--text-input` with associated `<label>`
- [ ] `escHtml()` is still called wherever user-sourced strings enter the DOM
- [ ] Page is navigable by keyboard (focus rings visible on all interactive elements)
- [ ] Start the dev server and visually review at least steps: source → browse → dest → preview

---

## 11. Dev Server

To start the app for visual review after implementing:

```bash
# From /mnt/e/HardlinkOrganizer
mkdir -p /tmp/hlo-demo/{db,src/movies,src/shows,dst/movies,dst/shows}
touch /tmp/hlo-demo/src/movies/The.Dark.Knight.2008.mkv \
      /tmp/hlo-demo/src/movies/Oppenheimer.2023.mkv \
      /tmp/hlo-demo/src/shows/Severance.S01.mkv

cat > /tmp/hlo-demo/config.toml <<'EOF'
[paths]
index_json = "/tmp/hlo-demo/db/index.json"
index_tsv  = "/tmp/hlo-demo/db/index.tsv"
log_file   = "/tmp/hlo-demo/db/hlo.log"
db_file    = "/tmp/hlo-demo/db/state.db"
[settings]
include_hidden   = false
collision_policy = "skip"
[source_sets]
movies = "/tmp/hlo-demo/src/movies"
shows  = "/tmp/hlo-demo/src/shows"
[dest_sets]
movies = "/tmp/hlo-demo/dst/movies"
shows  = "/tmp/hlo-demo/dst/shows"
EOF

python3 webapp/run.py --config /tmp/hlo-demo/config.toml --host 127.0.0.1 --port 7700
```

Open `http://localhost:7700` and walk the full workflow: Scan → Browse → Dest → Preview → (dry run) Execute.

---

## 12. Remaining Gap After This Slice

This prompt covers the frontend only. The following are **not** in scope here and should
not be touched:

- Destination management UI (tab, modal, browse) — planned for a later slice
- Any backend routes or Python files
- Naming/rename cleanup features
- RAIDEN state files

---

## Provenance

- Written: 2026-05-03
- Project: Hardlink Organizer v0.3.0
- Governance ref: github.com/StarlightDaemon/StarlightCarbonArchitecture / agent-handoff-protocol.md v2.0.0
- Loop: LOOP-010 adjacent (frontend pass following destination registry backend)
