/**
 * Hardlink Organizer — Front-end State Machine
 * Vanilla JS, no build step. Manages the scan→browse→preview→execute workflow
 * via a single state object and API calls to the FastAPI backend.
 */

const App = (() => {
  'use strict';

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const state = {
    step:        'source',   // source | browse | dest | preview | result
    sets:        {},         // {source_sets:{}, dest_sets:{}}
    summaries:   {},         // {setName: {scan_time, entry_count}}
    sourceSet:   null,       // selected source set name
    inventory:   [],         // array of inventory entries (annotated)
    entry:       null,       // selected entry object
    destSet:     null,       // selected destination set name
    destSubpath: '',         // editable destination subpath
    preview:     null,       // PreviewResponse from /api/preview
    result:      null,       // ExecuteResponse from /api/execute
    history:     [],         // HistoryEntry[] from /api/history
    verifyRun:   null,       // VerificationRunResponse
    verifyFilter:'all',      // status filter
    scanning:    false,
    executing:   false,
    searchQuery: '',
  };

  // -------------------------------------------------------------------------
  // DOM helpers
  // -------------------------------------------------------------------------
  const $  = id => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls)  e.className   = cls;
    if (html) e.innerHTML   = html;
    return e;
  };

  function setStatus(text, type = '') {
    const dot  = $('status-dot');
    const span = $('status-text');
    if (!dot || !span) return;
    dot.className = 'hlo-status-dot' + (type ? ` ${type}` : '');
    span.textContent = text;
  }

  function fmtBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch { return iso; }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // -------------------------------------------------------------------------
  // Toast notifications
  // -------------------------------------------------------------------------
  function toast(msg, type = 'info', duration = 4000) {
    const kindMap = { success: 'success', error: 'error', info: 'info', warning: 'warning' };
    const kind = kindMap[type] || 'info';
    const c = $('toast-container');
    if (!c) return;
    const t = el('div', `cds--toast-notification cds--toast-notification--${kind}`);
    t.setAttribute('role', 'alert');
    t.innerHTML = `
      <div class="cds--toast-notification__details">
        <p class="cds--toast-notification__subtitle">${escHtml(msg)}</p>
      </div>
      <button class="cds--toast-notification__close-button" type="button" aria-label="Close notification">&#x2715;</button>`;
    t.querySelector('.cds--toast-notification__close-button').addEventListener('click', () => t.remove());
    c.prepend(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, duration);
  }

  // -------------------------------------------------------------------------
  // API helpers
  // -------------------------------------------------------------------------
  async function apiGet(path) {
    const res = await fetch(path);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // -------------------------------------------------------------------------
  // Step indicator
  // -------------------------------------------------------------------------
  const STEP_ORDER = ['source', 'browse', 'dest', 'preview', 'result'];

  function updateStepIndicator() {
    // Carbon progress: cds--progress-step--current / --complete
    const current = STEP_ORDER.indexOf(state.step);
    STEP_ORDER.forEach((s, i) => {
      const items = document.querySelectorAll('.cds--progress-step');
      if (!items[i]) return;
      items[i].classList.remove(
        'cds--progress-step--current',
        'cds--progress-step--complete',
        'cds--progress-step--incomplete'
      );

      if (current === -1) {
        items[i].removeAttribute('style');
        items[i].onclick = () => { state.step = s; renderStep(); };
        return;
      }

      if (i < current) {
        items[i].classList.add('cds--progress-step--complete');
        items[i].style.cursor = 'pointer';
        items[i].onclick = () => { state.step = s; renderStep(); };
      } else if (i === current) {
        items[i].classList.add('cds--progress-step--current');
        items[i].style.cursor = 'default';
        items[i].onclick = null;
      } else {
        items[i].classList.add('cds--progress-step--incomplete');
        items[i].style.cursor = 'default';
        items[i].onclick = null;
      }
    });
  }

  // -------------------------------------------------------------------------
  // STEP 1 — Source set selection
  // -------------------------------------------------------------------------
  function renderSourceStep() {
    const panel = $('main-panel');
    const src = state.sets.source_sets || {};

    let html = `
      <div class="hlo-panel-heading">
        <h1>Select a Source Set</h1>
        <p>Choose the ingress directory to scan for linkable content.</p>
      </div>
      <div class="hlo-card-grid" id="source-card-grid">`;

    for (const [name, path] of Object.entries(src)) {
      const sum = state.summaries[name] || {};
      const scanInfo = sum.scan_time
        ? `Last scan: ${escHtml(fmtTime(sum.scan_time))} &middot; ${sum.entry_count ?? '?'} entries`
        : 'Not yet scanned';

      html += `
        <div class="cds--tile cds--tile--clickable hlo-source-card" id="src-card-${escHtml(name)}"
             role="button" tabindex="0"
             onclick="App.selectSource('${escHtml(name)}')"
             onkeydown="if(event.key==='Enter'||event.key===' ')App.selectSource('${escHtml(name)}')">
          <div class="hlo-card-icon" aria-hidden="true">&#x1F4E5;</div>
          <div class="hlo-card-name">${escHtml(name)}</div>
          <div class="hlo-card-path">${escHtml(path)}</div>
          <div class="hlo-card-meta">${scanInfo}</div>
          <div class="hlo-card-actions">
            <button class="cds--btn cds--btn--sm cds--btn--secondary" onclick="event.stopPropagation(); App.scanAndSelect('${escHtml(name)}')">
              <span class="cds--loading cds--loading--small" style="display:none" id="scan-spinner-${escHtml(name)}" aria-label="Scanning">
                <svg class="cds--loading__svg" viewBox="-75 -75 150 150" aria-hidden="true">
                  <circle class="cds--loading__background" cx="0" cy="0" r="37.5"/>
                  <circle class="cds--loading__stroke" cx="0" cy="0" r="37.5"/>
                </svg>
              </span>
              Scan &amp; Select
            </button>
            <button class="cds--btn cds--btn--sm cds--btn--primary" onclick="event.stopPropagation(); App.selectSource('${escHtml(name)}')">
              Open
            </button>
          </div>
        </div>`;
    }

    if (!Object.keys(src).length) {
      html += `<div class="hlo-empty-state"><span class="hlo-empty-state-icon" aria-hidden="true">&#x2699;</span><p>No source sets are configured. Edit your config.toml to add [source_sets].</p></div>`;
    }

    html += `</div>`;
    panel.innerHTML = html;
  }

  async function selectSource(name) {
    state.sourceSet = name;
    state.entry = null;
    state.inventory = [];
    state.step = 'browse';
    renderStep();
    await loadInventory(name);
  }

  async function scanAndSelect(name) {
    const spinner = $(`scan-spinner-${name}`);
    if (spinner) spinner.style.display = 'inline-block';
    state.scanning = true;
    setStatus(`Scanning ${name}…`, 'busy');
    try {
      const res = await apiPost('/api/scan', { source_set: name });
      state.summaries[name] = { scan_time: new Date().toISOString(), entry_count: res.per_set[name] ?? 0 };
      toast(`Scanned ${name}: ${res.per_set[name] ?? 0} entries`, 'success');
      await selectSource(name);
    } catch (err) {
      toast(`Scan failed: ${err.message}`, 'error');
      setStatus('Ready');
    } finally {
      state.scanning = false;
      if (spinner) spinner.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------------
  // STEP 2 — Browse inventory
  // -------------------------------------------------------------------------
  async function loadInventory(sourceSet) {
    setStatus('Loading inventory…', 'busy');
    const panel = $('main-panel');
    panel.innerHTML = `<div class="hlo-loading-block"><div class="cds--loading cds--loading--small" aria-live="assertive"><svg class="cds--loading__svg" viewBox="-75 -75 150 150" aria-hidden="true"><circle class="cds--loading__background" cx="0" cy="0" r="37.5"/><circle class="cds--loading__stroke" cx="0" cy="0" r="37.5"/></svg></div> Loading inventory for <strong>${escHtml(sourceSet)}</strong>&hellip;</div>`;
    try {
      const res = await apiGet(`/api/inventory?source_set=${encodeURIComponent(sourceSet)}`);
      state.inventory = res.entries || [];
      state.step = 'browse';
      renderStep();
      setStatus('Ready');
    } catch (err) {
      toast(`Failed to load inventory: ${err.message}`, 'error');
      setStatus('Error', 'error');
      state.step = 'source';
      renderStep();
    }
  }

  function renderBrowseStep() {
    const panel = $('main-panel');
    const entries = state.inventory;

    let html = `
      <div class="hlo-panel-heading">
        <h1>Browse &mdash; <span style="color:var(--cds-link-primary)">${escHtml(state.sourceSet)}</span></h1>
        <p>${entries.length} entries &middot; Click an entry to select it for linking.</p>
      </div>
      <div class="hlo-toolbar">
        <div class="cds--text-input-wrapper" style="flex:1;min-width:200px;max-width:380px">
          <label class="cds--label" for="inv-search">Filter entries</label>
          <input id="inv-search" class="cds--text-input" type="text" placeholder="Filter by name&hellip;"
                 value="${escHtml(state.searchQuery)}" oninput="App.filterInventory(this.value)">
        </div>
        <div class="hlo-toolbar-actions">
          <button class="cds--btn cds--btn--sm cds--btn--secondary" onclick="App.rescan()">&#x21BB; Re-scan</button>
          <button class="cds--btn cds--btn--sm cds--btn--secondary" onclick="App.goTo('source')">&larr; Change Set</button>
        </div>
      </div>
      <div class="hlo-entry-list" id="entry-list">`;

    const query = (state.searchQuery || '').toLowerCase();
    const filtered = query
      ? entries.filter(e => e.display_name.toLowerCase().includes(query) || e.real_name.toLowerCase().includes(query))
      : entries;

    if (!filtered.length) {
      html += `<div class="hlo-empty-state"><span class="hlo-empty-state-icon" aria-hidden="true">${query ? '&#x1F50D;' : '&#x1F4ED;'}</span><p>${query ? 'No entries match your filter.' : 'No entries found. Try scanning this set first.'}</p></div>`;
    } else {
      for (const entry of filtered) {
        const icon = entry.entry_type === 'dir' ? '&#x1F4C1;' : '&#x1F4C4;';
        const typeBadge = entry.entry_type === 'dir'
          ? '<span class="cds--tag cds--tag--blue">Dir</span>'
          : '<span class="cds--tag cds--tag--cool-gray">File</span>';
        const linkedBadge = entry.linked ? '<span class="cds--tag cds--tag--green">&#x2713; Linked</span>' : '';
        const selected = state.entry && state.entry.id === entry.id ? ' hlo-entry--selected' : '';

        html += `
          <div class="hlo-entry-row${selected}" id="entry-${entry.id}">
            <div class="hlo-entry-main">
              <span class="hlo-entry-icon" aria-hidden="true">${icon}</span>
              <span class="hlo-entry-name">${escHtml(entry.display_name)}</span>
              <span class="hlo-entry-badges">${typeBadge}${linkedBadge}</span>
              <span class="hlo-entry-size hlo-mono">${escHtml(fmtBytes(entry.size_bytes))}</span>
              <button class="hlo-expand-btn" onclick="App.toggleDetail(${entry.id})" title="Show raw details" aria-label="Toggle details for ${escHtml(entry.display_name)}">&#x25BC;</button>
              <div>
                <button class="cds--btn cds--btn--sm cds--btn--primary" onclick="App.selectEntry(${entry.id})">Select</button>
              </div>
            </div>
            <div class="hlo-entry-detail" id="detail-${entry.id}">
              <div class="hlo-detail-label">Real name</div><div class="hlo-detail-value">${escHtml(entry.real_name)}</div>
              <div class="hlo-detail-label">Full path</div><div class="hlo-detail-value">${escHtml(entry.full_path)}</div>
              <div class="hlo-detail-label">Scanned</div><div class="hlo-detail-value">${escHtml(fmtTime(entry.scan_time))}</div>
              ${entry.linked ? '<div class="hlo-detail-label">Status</div><div class="hlo-detail-value" style="color:var(--cds-support-success)">Previously linked &#x2713;</div>' : ''}
            </div>
          </div>`;
      }
    }

    html += `</div>`;
    panel.innerHTML = html;
  }

  function toggleDetail(id) {
    const d = $(`detail-${id}`);
    if (d) d.classList.toggle('open');
  }

  function filterInventory(query) {
    state.searchQuery = query;
    renderBrowseStep();
    // Restore focus to the search input
    const input = $('inv-search');
    if (input) { input.focus(); input.setSelectionRange(query.length, query.length); }
  }

  async function rescan() {
    state.scanning = true;
    setStatus(`Re-scanning ${state.sourceSet}…`, 'busy');
    try {
      await apiPost('/api/scan', { source_set: state.sourceSet });
      toast(`Re-scan complete`, 'success');
      await loadInventory(state.sourceSet);
    } catch (err) {
      toast(`Re-scan failed: ${err.message}`, 'error');
      setStatus('Ready');
    } finally {
      state.scanning = false;
    }
  }

  function selectEntry(id) {
    const entry = state.inventory.find(e => e.id === id);
    if (!entry) return;
    state.entry = entry;
    state.destSubpath = entry.display_name;  // pre-fill from display name
    state.step = 'dest';
    renderStep();
  }

  // -------------------------------------------------------------------------
  // STEP 3 — Destination set + subpath
  // -------------------------------------------------------------------------
  function renderDestStep() {
    const panel = $('main-panel');
    const dst = state.sets.dest_sets || {};

    let html = `
      <div class="hlo-panel-heading">
        <h1>Choose Destination</h1>
        <p>Linking: <strong>${escHtml(state.entry?.display_name || '')}</strong></p>
      </div>
      <div class="hlo-card-grid" id="dest-card-grid">`;

    for (const [name, path] of Object.entries(dst)) {
      const selectedCls = state.destSet === name ? ' hlo-card--selected' : '';
      html += `
        <div class="cds--tile cds--tile--clickable hlo-dest-card${selectedCls}" id="dst-card-${escHtml(name)}"
             role="button" tabindex="0"
             onclick="App.selectDest('${escHtml(name)}')"
             onkeydown="if(event.key==='Enter'||event.key===' ')App.selectDest('${escHtml(name)}')">
          <div class="hlo-card-icon" aria-hidden="true">&#x1F4E4;</div>
          <div class="hlo-card-name">${escHtml(name)}</div>
          <div class="hlo-card-path">${escHtml(path)}</div>
        </div>`;
    }

    if (!Object.keys(dst).length) {
      html += `<div class="hlo-empty-state"><span class="hlo-empty-state-icon" aria-hidden="true">&#x2699;</span><p>No destination sets configured.</p></div>`;
    }
    html += `</div>`;

    html += `
      <div class="hlo-subpath-block hlo-mt-06">
        <div class="cds--text-input-wrapper">
          <label class="cds--label" for="dest-subpath">Destination folder name</label>
          <input class="cds--text-input" id="dest-subpath" type="text"
                 value="${escHtml(state.destSubpath)}"
                 placeholder="Folder name under destination root"
                 oninput="App.updateSubpath(this.value)">
        </div>
        <p class="hlo-subpath-hint">This folder will be created inside the selected destination root. Edit to override the suggested name.</p>
      </div>

      <div class="hlo-action-bar">
        <div class="hlo-action-bar-left">
          <button class="cds--btn cds--btn--secondary" onclick="App.goTo('browse')">&larr; Back</button>
        </div>
        <div class="hlo-action-bar-right">
          <button class="cds--btn cds--btn--primary" id="btn-preview" onclick="App.generatePreview()" ${!state.destSet ? 'disabled' : ''}>
            Preview Link Plan &rarr;
          </button>
        </div>
      </div>`;

    panel.innerHTML = html;
  }

  function selectDest(name) {
    state.destSet = name;
    // Mark card as selected visually
    document.querySelectorAll('#dest-card-grid .cds--tile').forEach(c => c.classList.remove('hlo-card--selected'));
    const card = $(`dst-card-${name}`);
    if (card) card.classList.add('hlo-card--selected');
    // Enable preview button
    const btn = $('btn-preview');
    if (btn) btn.disabled = false;
  }

  function updateSubpath(val) {
    state.destSubpath = val;
  }

  // -------------------------------------------------------------------------
  // STEP 4 — Preview & confirm
  // -------------------------------------------------------------------------
  async function generatePreview() {
    if (!state.destSet) { toast('Select a destination set first.', 'warning'); return; }
    if (!state.destSubpath.trim()) { toast('Destination folder name cannot be empty.', 'warning'); return; }

    setStatus('Building preview…', 'busy');
    const btn = $('btn-preview');
    if (btn) btn.disabled = true;

    try {
      const res = await apiPost('/api/preview', {
        source_set:   state.sourceSet,
        entry_id:     state.entry.id,
        dest_set:     state.destSet,
        dest_subpath: state.destSubpath,
      });
      state.preview = res;
      state.step = 'preview';
      renderStep();
      setStatus('Ready');
    } catch (err) {
      toast(`Preview failed: ${err.message}`, 'error');
      setStatus('Error', 'error');
      if (btn) btn.disabled = false;
    }
  }

  function renderPreviewStep() {
    const panel = $('main-panel');
    const p = state.preview;
    if (!p) { state.step = 'dest'; renderStep(); return; }

    let validationBlock = '';
    if (p.valid) {
      const validText = p.warnings?.length
        ? 'Core path and device checks passed, but the mount layout warning below should be resolved before relying on real execution.'
        : 'All checks passed. This operation is safe to execute.';
      validationBlock = `
        <div class="cds--inline-notification cds--inline-notification--success" role="status" style="margin-top:var(--cds-spacing-05)">
          <div class="cds--inline-notification__details">
            <div class="cds--inline-notification__text-wrapper">
              <p class="cds--inline-notification__title">Ready to link</p>
              <p class="cds--inline-notification__subtitle">${escHtml(validText)}</p>
            </div>
          </div>
        </div>`;
    } else {
      const errs = p.errors.map(e => `<li>${escHtml(e)}</li>`).join('');
      validationBlock = `
        <div class="cds--inline-notification cds--inline-notification--error" role="alert" style="margin-top:var(--cds-spacing-05)">
          <div class="cds--inline-notification__details">
            <div class="cds--inline-notification__text-wrapper">
              <p class="cds--inline-notification__title">Validation failed &mdash; cannot proceed.</p>
              <p class="cds--inline-notification__subtitle"><ul style="padding-left:1rem;margin-top:var(--cds-spacing-03)">${errs}</ul></p>
            </div>
          </div>
        </div>`;
    }

    let mountLayoutWarningBlock = '';
    if (p.warnings?.length) {
      const warnings = p.warnings.map(w => `
        <div class="hlo-preview-warning-item">
          <div class="hlo-preview-warning-title">${escHtml(w.title)}</div>
          <div class="hlo-preview-warning-detail">${escHtml(w.detail)}</div>
          <div class="hlo-preview-warning-recommendation">Recommended layout: ${escHtml(w.recommendation)}</div>
        </div>
      `).join('');

      mountLayoutWarningBlock = `
        <div class="cds--inline-notification cds--inline-notification--warning" role="status" style="margin-top:var(--cds-spacing-05)">
          <div class="cds--inline-notification__details">
            <div class="cds--inline-notification__text-wrapper">
              <p class="cds--inline-notification__title">Mount layout warning</p>
              <p class="cds--inline-notification__subtitle">Preview can still pass while real hardlink execution fails if these paths are mounted in a risky way.</p>
              ${warnings}
            </div>
          </div>
        </div>`;
    }

    let prevLinkedWarning = '';
    if (p.previously_linked) {
      prevLinkedWarning = `
        <div class="cds--inline-notification cds--inline-notification--warning" role="status" style="margin-top:var(--cds-spacing-05)">
          <div class="cds--inline-notification__details">
            <div class="cds--inline-notification__text-wrapper">
              <p class="cds--inline-notification__subtitle">This item has been linked before. Existing destination files will be skipped &mdash; no overwrites.</p>
            </div>
          </div>
        </div>`;
    }

    const executeDisabled = !p.valid ? 'disabled' : '';

    let html = `
      <div class="hlo-panel-heading">
        <h1>Link Plan Preview</h1>
        <p>Review the details below before executing. Destination files are never overwritten.</p>
      </div>

      <div class="hlo-preview-wrap">
        <div class="hlo-preview-header">
          <span style="font-size:1.3rem" aria-hidden="true">${p.entry_type === 'dir' ? '&#x1F4C1;' : '&#x1F4C4;'}</span>
          <span class="hlo-preview-header-title">${escHtml(p.display_name)}</span>
        </div>
        <div class="cds--structured-list" style="margin:0">
          <div class="cds--structured-list-tbody">
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap" style="width:140px">Display name</div>
              <div class="cds--structured-list-td"><strong>${escHtml(p.display_name)}</strong></div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap">Real name</div>
              <div class="cds--structured-list-td hlo-path-value">${escHtml(p.real_name)}</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap">Type</div>
              <div class="cds--structured-list-td">${escHtml(p.entry_type)}</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap">Source path</div>
              <div class="cds--structured-list-td hlo-path-value">${escHtml(p.source_path)}</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap">Dest set</div>
              <div class="cds--structured-list-td hlo-path-value">${escHtml(p.dest_set)} &rarr; ${escHtml(p.dest_root)}</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap">Dest folder</div>
              <div class="cds--structured-list-td hlo-accent-value">${escHtml(p.dest_subpath)}</div>
            </div>
            <div class="cds--structured-list-row">
              <div class="cds--structured-list-td cds--structured-list-content--nowrap">Full dest path</div>
              <div class="cds--structured-list-td hlo-path-value">${escHtml(p.dest_full)}</div>
            </div>
          </div>
        </div>
      </div>

      ${mountLayoutWarningBlock}
      ${validationBlock}
      ${prevLinkedWarning}

      <div class="hlo-dry-run-block">
        <input type="checkbox" id="dry-run-toggle" checked>
        <label for="dry-run-toggle">
          <strong>Dry run mode</strong> &mdash; preview what would happen without writing any files. Uncheck to perform the real operation.
        </label>
      </div>

      <div class="hlo-action-bar">
        <div class="hlo-action-bar-left">
          <button class="cds--btn cds--btn--secondary" onclick="App.goTo('dest')">&larr; Change Destination</button>
        </div>
        <div class="hlo-action-bar-right">
          <button class="cds--btn cds--btn--primary" id="btn-execute" ${executeDisabled} onclick="App.executeLink()">
            <span id="exec-spinner" class="cds--loading cds--loading--small" style="display:none" aria-label="Executing">
              <svg class="cds--loading__svg" viewBox="-75 -75 150 150" aria-hidden="true">
                <circle class="cds--loading__background" cx="0" cy="0" r="37.5"/>
                <circle class="cds--loading__stroke" cx="0" cy="0" r="37.5"/>
              </svg>
            </span>
            Execute
          </button>
        </div>
      </div>`;

    panel.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // Execute
  // -------------------------------------------------------------------------
  async function executeLink() {
    if (!state.preview?.valid) { toast('Cannot execute: validation failed.', 'error'); return; }
    if (state.executing) return;

    const dryRun = $('dry-run-toggle')?.checked ?? true;
    const btn = $('btn-execute');
    const spinner = $('exec-spinner');

    state.executing = true;
    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    setStatus(dryRun ? 'Running dry run…' : 'Executing hardlinks…', 'busy');

    try {
      const res = await apiPost('/api/execute', {
        source_set:   state.sourceSet,
        entry_id:     state.entry.id,
        dest_set:     state.destSet,
        dest_subpath: state.destSubpath,
        dry_run:      dryRun,
      });
      state.result = res;
      state.step = 'result';

      // Refresh link status in inventory
      const inv = state.inventory.find(e => e.id === state.entry.id);
      if (inv && !dryRun && res.linked > 0) inv.linked = true;

      // Refresh summaries
      const sum = await apiGet(`/api/config/sets`).catch(() => null);
      if (sum) state.summaries = {};

      await loadHistory();
      renderStep();

      const msg = dryRun
        ? `Dry run: ${res.linked} would be linked, ${res.skipped} skipped`
        : `Done: ${res.linked} linked, ${res.skipped} skipped, ${res.failed} failed`;
      toast(msg, res.success ? 'success' : 'warning');
      setStatus('Ready');
    } catch (err) {
      toast(`Execute failed: ${err.message}`, 'error');
      setStatus('Error', 'error');
      if (btn) btn.disabled = false;
    } finally {
      state.executing = false;
      if (spinner) spinner.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------------
  // STEP 5 — Result
  // -------------------------------------------------------------------------
  function renderResultStep() {
    const panel = $('main-panel');
    const r = state.result;
    if (!r) { state.step = 'source'; renderStep(); return; }

    const headerMod = r.failed > 0 ? '--error' : (r.success ? '--success' : '--warning');
    const prefix = r.dry_run ? '[DRY RUN] ' : '';

    const fileSection = (label, files, colorCls) => {
      if (!files || !files.length) return '';
      return `
        <details class="hlo-result-file-list">
          <summary>${label} (${files.length})</summary>
          <div class="hlo-result-files">
            ${files.map(f => `<div class="hlo-result-file hlo-result-file--${colorCls} hlo-mono">${escHtml(f)}</div>`).join('')}
          </div>
        </details>`;
    };

    let html = `
      <div class="hlo-panel-heading">
        <h1>Operation ${r.dry_run ? 'Preview' : 'Complete'}</h1>
        <p>${escHtml(prefix)}Hardlink operation for <strong>${escHtml(state.entry?.display_name || '')}</strong></p>
      </div>

      <div class="hlo-result-card">
        <div class="hlo-result-header hlo-result-header${headerMod}">
          <div class="hlo-result-title">${r.dry_run ? '&#x1F50D; Dry Run Result' : (r.success ? '&#x2713; Success' : r.failed > 0 ? '&#x26A0; Completed with failures' : '&#x2713; Done')}</div>
          <div class="hlo-result-subtitle">${escHtml(state.sourceSet)} &rarr; ${escHtml(state.destSet)} / ${escHtml(state.destSubpath)}</div>
        </div>
        <div class="hlo-result-counts">
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--linked">${r.linked}</div>
            <div class="hlo-result-label">${r.dry_run ? 'Would link' : 'Linked'}</div>
          </div>
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--skipped">${r.skipped}</div>
            <div class="hlo-result-label">Skipped</div>
          </div>
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--failed">${r.failed}</div>
            <div class="hlo-result-label">Failed</div>
          </div>
        </div>
        ${fileSection('Linked files',  r.linked_files,  'linked')}
        ${fileSection('Skipped files', r.skipped_files, 'skipped')}
        ${fileSection('Failed files',  r.failed_files,  'failed')}
      </div>

      <div class="hlo-action-bar">
        <div class="hlo-action-bar-left">
          <button class="cds--btn cds--btn--secondary" onclick="App.goTo('browse')">Link Another</button>
        </div>
        <div class="hlo-action-bar-right">
          <button class="cds--btn cds--btn--primary" onclick="App.startOver()">Start Over</button>
        </div>
      </div>`;

    panel.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // History sidebar
  // -------------------------------------------------------------------------
  async function loadHistory() {
    try {
      const res = await apiGet('/api/history?limit=40');
      state.history = res.history || [];
      renderHistory();
    } catch { /* silent */ }
  }

  function renderHistory() {
    const list = $('history-list');
    if (!list) return;

    if (!state.history.length) {
      list.innerHTML = `<div class="hlo-empty-state" style="padding: var(--cds-spacing-06) var(--cds-spacing-05)">No operations yet.</div>`;
      return;
    }

    list.innerHTML = state.history.map(h => {
      const dryTag = h.dry_run ? '<span class="cds--tag cds--tag--teal">dry</span>' : '';
      return `
        <div class="hlo-history-entry">
          <div class="hlo-history-name">${escHtml(h.real_name)}</div>
          <div class="hlo-history-meta">${escHtml(h.source_set)} &rarr; ${escHtml(h.dest_set)}</div>
          <div class="hlo-history-meta">${escHtml(fmtTime(h.linked_at))}</div>
          <div class="hlo-history-counts">
            ${dryTag}
            <span class="cds--tag cds--tag--green">${h.linked_count} linked</span>
            ${h.skipped_count ? `<span class="cds--tag cds--tag--yellow">${h.skipped_count} skip</span>` : ''}
            ${h.failed_count  ? `<span class="cds--tag cds--tag--red">${h.failed_count} fail</span>` : ''}
          </div>
          ${!h.dry_run
            ? `<button class="cds--btn cds--btn--sm cds--btn--secondary" style="width:100%;margin-top:var(--cds-spacing-03)" onclick="App.runVerification(${h.id}, '${escHtml(h.real_name).replace(/'/g, "\\'")}')" >Verify Link Integrity</button>`
            : `<div style="margin-top:var(--cds-spacing-03);font-size:0.72rem;color:var(--cds-text-helper)">No verification for dry runs.</div>`
          }
        </div>`;
    }).join('');
  }

  // -------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------
  async function runVerification(id, title) {
    state.step = 'verify';
    state.verifyRun = null;
    state.verifyFilter = 'all';
    renderStep();

    setStatus(`Verifying ${title}…`, 'busy');
    try {
      const init = await apiPost('/api/verify', { mode: 'link_history', link_history_id: id });
      const runId = init.run_id;
      const res = await apiGet(`/api/verify/${runId}`);
      state.verifyRun = Object.assign({ title }, res);
      renderStep();
      setStatus('Verification Complete', res.failed_count > 0 ? 'error' : 'success');
      toast('Verification completed', 'success');
    } catch (err) {
      toast(`Verification failed: ${err.message}`, 'error');
      setStatus('Error', 'error');
      const panel = $('main-panel');
        if (panel) {
          panel.innerHTML = `<div class="hlo-empty-state"><span class="hlo-empty-state-icon" aria-hidden="true">&#x26A0;</span><p>Verification failed: ${escHtml(err.message)}</p><button class="cds--btn cds--btn--secondary hlo-mt-05" onclick="App.startOver()">Start Over</button></div>`;
        }
    }
  }

  function filterVerification(status) {
    state.verifyFilter = status;
    renderStep();
  }

  function renderVerifyStep() {
    const panel = $('main-panel');
    const v = state.verifyRun;
    
    if (!v) {
      panel.innerHTML = `<div class="hlo-loading-block"><div class="cds--loading cds--loading--small" aria-live="assertive"><svg class="cds--loading__svg" viewBox="-75 -75 150 150" aria-hidden="true"><circle class="cds--loading__background" cx="0" cy="0" r="37.5"/><circle class="cds--loading__stroke" cx="0" cy="0" r="37.5"/></svg></div> <span>Running verification&hellip;<br><small style="color:var(--cds-text-helper)">This checks actual filesystem links and handles large scale counts gracefully. Please wait.</small></span></div>`;
      return;
    }

    const headerMod = v.failed_count > 0 || v.error_count > 0 ? '--error' : (v.missing_count > 0 ? '--warning' : '--success');

    let html = `
      <div class="hlo-panel-heading">
        <h1>Link Verification</h1>
        <p>Checking integrity of: <strong>${escHtml(v.title)}</strong></p>
      </div>

      <div class="hlo-result-card">
        <div class="hlo-result-header hlo-result-header${headerMod}">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--cds-spacing-04)">
            <div>
              <div class="hlo-result-title">${v.failed_count > 0 || v.error_count > 0 ? '&#x26A0; Anomalies Found' : '&#x2713; Fully Verified'}</div>
              <div class="hlo-result-subtitle">Run #${v.run_id} &middot; ${escHtml(fmtTime(v.created_at))} &middot; Mode: ${escHtml(v.mode)}</div>
            </div>
            <div class="hlo-verify-actions">
              <a href="/api/verify/${v.run_id}/export.json" download class="cds--btn cds--btn--sm cds--btn--secondary" title="Export JSON">Export JSON</a>
              <a href="/api/verify/${v.run_id}/export.csv" download class="cds--btn cds--btn--sm cds--btn--secondary" title="Export CSV">Export CSV</a>
            </div>
          </div>
        </div>
        <div class="hlo-result-counts" style="grid-template-columns: repeat(4, 1fr)">
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--linked">${v.verified_count}</div>
            <div class="hlo-result-label">Verified</div>
          </div>
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--skipped">${v.missing_count}</div>
            <div class="hlo-result-label">Missing</div>
          </div>
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--failed">${v.failed_count}</div>
            <div class="hlo-result-label">Failed</div>
          </div>
          <div class="hlo-result-count">
            <div class="hlo-result-num hlo-result-num--failed">${v.error_count}</div>
            <div class="hlo-result-label">Errors</div>
          </div>
        </div>
      </div>

      <div class="hlo-verify-toolbar hlo-mt-06">
        <div class="cds--select" style="max-width:220px">
          <label class="cds--label" for="verify-filter">Filter results</label>
          <div class="cds--select-input-wrapper">
            <select id="verify-filter" class="cds--select-input" onchange="App.filterVerification(this.value)">
              <option value="all" ${state.verifyFilter === 'all' ? 'selected' : ''}>All Results (${v.results.length})</option>
              <option value="failures" ${state.verifyFilter === 'failures' ? 'selected' : ''}>Failures &amp; Missing</option>
              <option value="verified" ${state.verifyFilter === 'verified' ? 'selected' : ''}>Verified Only</option>
            </select>
          </div>
        </div>
        <div class="hlo-verify-actions">
          <button class="cds--btn cds--btn--sm cds--btn--secondary" onclick="App.runVerification(${v.link_history_id}, '${escHtml(v.title).replace(/'/g, "\\'")}')">&#x21BB; Re-run</button>
        </div>
      </div>

      <div class="cds--data-table-container hlo-mt-05">
        <table class="cds--data-table">
          <thead>
            <tr>
              <th scope="col"><div class="cds--table-header-label">Status</div></th>
              <th scope="col"><div class="cds--table-header-label">Source path</div></th>
              <th scope="col"><div class="cds--table-header-label">Notes</div></th>
            </tr>
          </thead>
          <tbody>`;

    let rowsToRender = v.results || [];
    if (state.verifyFilter === 'failures') {
      rowsToRender = rowsToRender.filter(r => r.status !== 'verified_hardlinked');
    } else if (state.verifyFilter === 'verified') {
      rowsToRender = rowsToRender.filter(r => r.status === 'verified_hardlinked');
    }

    if (!rowsToRender.length) {
       html += `<tr><td colspan="3"><div class="hlo-empty-state">No items match this filter.</div></td></tr>`;
    } else {
      for (const r of rowsToRender) {
         const isOk = r.status === 'verified_hardlinked';
         const statusTag = isOk
           ? '<span class="cds--tag cds--tag--green">&#x2713; verified</span>'
           : '<span class="cds--tag cds--tag--red">&#x26A0; ' + escHtml(r.status) + '</span>';
         html += `
           <tr>
             <td>${statusTag}</td>
             <td class="hlo-mono" style="font-size:0.75rem;word-break:break-all">${escHtml(r.source_path)}</td>
             <td style="font-size:0.8125rem">${r.notes ? escHtml(r.notes) : '&mdash;'}</td>
           </tr>`;
      }
    }

    html += `
          </tbody>
        </table>
      </div>
      <div class="hlo-action-bar hlo-mb-06">
        <div class="hlo-action-bar-left">
          <button class="cds--btn cds--btn--primary" onclick="App.startOver()">Done</button>
        </div>
      </div>
    `;

    panel.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------
  function goTo(step) {
    state.step = step;
    renderStep();
  }

  function startOver() {
    state.step = 'source';
    state.sourceSet = null;
    state.entry = null;
    state.destSet = null;
    state.destSubpath = '';
    state.preview = null;
    state.result = null;
    state.inventory = [];
    state.searchQuery = '';
    state.verifyRun = null;
    state.verifyFilter = 'all';
    renderStep();
  }

  // -------------------------------------------------------------------------
  // Main render dispatcher
  // -------------------------------------------------------------------------
  function renderStep() {
    updateStepIndicator();
    switch (state.step) {
      case 'source':  renderSourceStep();  break;
      case 'browse':  renderBrowseStep();  break;
      case 'dest':    renderDestStep();    break;
      case 'preview': renderPreviewStep(); break;
      case 'result':  renderResultStep();  break;
      case 'verify':  renderVerifyStep();  break;
      default:        renderSourceStep();
    }
  }

  // -------------------------------------------------------------------------
  // Initialisation
  // -------------------------------------------------------------------------
  async function init() {
    state.sets      = window.__SETS__      || {};
    state.summaries = window.__SUMMARIES__ || {};

    renderStep();
    await loadHistory();
    setStatus('Ready');
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  return {
    selectSource,
    scanAndSelect,
    selectEntry,
    selectDest,
    updateSubpath,
    generatePreview,
    executeLink,
    toggleDetail,
    filterInventory,
    rescan,
    goTo,
    startOver,
    loadHistory,
    runVerification,
    filterVerification,
  };
})();
