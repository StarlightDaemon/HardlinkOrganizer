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
    dot.className = 'status-dot' + (type ? ` ${type}` : '');
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
    const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
    const c = $('toast-container');
    if (!c) return;
    const t = el('div', `toast ${type}`, `<span>${icons[type] || 'ℹ'}</span> ${escHtml(msg)}`);
    c.prepend(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, duration);
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
    // If we're in 'verify' step, we'll just clear the active state of all steps.
    const current = STEP_ORDER.indexOf(state.step);
    STEP_ORDER.forEach((s, i) => {
      const items = document.querySelectorAll('.step-item');
      if (!items[i]) return;
      const numEl = items[i].querySelector('.step-num');
      items[i].className = 'step-item';
      
      if (current === -1) {
        // verify step or similar external step
        if (numEl) numEl.textContent = i + 1;
        items[i].onclick = () => { state.step = s; renderStep(); };
        return;
      }

      if (i < current) {
        items[i].classList.add('done');
        if (numEl) numEl.textContent = '✓';
      } else if (i === current) {
        items[i].classList.add('active');
        if (numEl) numEl.textContent = i + 1;
      } else {
        if (numEl) numEl.textContent = i + 1;
      }
      // clicking on completed steps navigates back
      if (i < current) {
        items[i].onclick = () => { state.step = s; renderStep(); };
      } else {
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
      <div class="panel-heading">
        <h1>Select a Source Set</h1>
        <p>Choose the ingress directory to scan for linkable content.</p>
      </div>
      <div class="card-grid" id="source-card-grid">`;

    for (const [name, path] of Object.entries(src)) {
      const sum = state.summaries[name] || {};
      const scanInfo = sum.scan_time
        ? `Last scan: ${escHtml(fmtTime(sum.scan_time))} · ${sum.entry_count ?? '?'} entries`
        : 'Not yet scanned';

      html += `
        <div class="card" id="src-card-${escHtml(name)}" onclick="App.selectSource('${escHtml(name)}')">
          <div class="card-icon">📥</div>
          <div class="card-name">${escHtml(name)}</div>
          <div class="card-path">${escHtml(path)}</div>
          <div class="card-meta">${escHtml(scanInfo)}</div>
          <div class="card-actions">
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); App.scanAndSelect('${escHtml(name)}')">
              <span class="spinner" style="display:none" id="scan-spinner-${escHtml(name)}"></span>
              Scan &amp; Select
            </button>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); App.selectSource('${escHtml(name)}')">
              Open
            </button>
          </div>
        </div>`;
    }

    if (!Object.keys(src).length) {
      html += `<div class="empty-state"><div class="empty-state-icon">⚙</div><p>No source sets are configured. Edit your config.toml to add [source_sets].</p></div>`;
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
    panel.innerHTML = `<div class="loading-block"><span class="spinner"></span> Loading inventory for <strong>${escHtml(sourceSet)}</strong>…</div>`;
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
      <div class="panel-heading">
        <h1>Browse — <span style="color:var(--accent)">${escHtml(state.sourceSet)}</span></h1>
        <p>${entries.length} entries · Click an entry to select it for linking.</p>
      </div>
      <div class="inventory-toolbar">
        <input class="inventory-search" id="inv-search" type="text" placeholder="Filter by name…" value="${escHtml(state.searchQuery)}" oninput="App.filterInventory(this.value)">
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-secondary" onclick="App.rescan()">↻ Re-scan</button>
          <button class="btn btn-sm btn-secondary" onclick="App.goTo('source')">← Change Set</button>
        </div>
      </div>
      <div class="entry-list" id="entry-list">`;

    const query = (state.searchQuery || '').toLowerCase();
    const filtered = query
      ? entries.filter(e => e.display_name.toLowerCase().includes(query) || e.real_name.toLowerCase().includes(query))
      : entries;

    if (!filtered.length) {
      html += `<div class="empty-state"><div class="empty-state-icon">${query ? '🔍' : '📭'}</div><p>${query ? 'No entries match your filter.' : 'No entries found. Try scanning this set first.'}</p></div>`;
    } else {
      for (const entry of filtered) {
        const icon = entry.entry_type === 'dir' ? '📁' : '📄';
        const typeBadge = entry.entry_type === 'dir'
          ? '<span class="badge badge-dir">Dir</span>'
          : '<span class="badge badge-file">File</span>';
        const linkedBadge = entry.linked ? '<span class="badge badge-linked">✓ Linked</span>' : '';
        const selected = state.entry && state.entry.id === entry.id ? ' selected-entry' : '';

        html += `
          <div class="entry-row${selected}" id="entry-${entry.id}">
            <div class="entry-main">
              <span class="entry-type-icon">${icon}</span>
              <span class="entry-display-name">${escHtml(entry.display_name)}</span>
              <span class="entry-badges">${typeBadge}${linkedBadge}</span>
              <span class="entry-size">${escHtml(fmtBytes(entry.size_bytes))}</span>
              <button class="entry-expand-btn" onclick="App.toggleDetail(${entry.id})" title="Show raw details">▼</button>
              <div class="entry-actions">
                <button class="btn btn-sm btn-primary" onclick="App.selectEntry(${entry.id})">Select</button>
              </div>
            </div>
            <div class="entry-detail" id="detail-${entry.id}">
              <div class="detail-row"><div class="detail-label">Real name</div><div class="detail-value">${escHtml(entry.real_name)}</div></div>
              <div class="detail-row"><div class="detail-label">Full path</div><div class="detail-value">${escHtml(entry.full_path)}</div></div>
              <div class="detail-row"><div class="detail-label">Scanned</div><div class="detail-value">${escHtml(fmtTime(entry.scan_time))}</div></div>
              ${entry.linked ? '<div class="detail-row"><div class="detail-label">Status</div><div class="detail-value" style="color:var(--accent)">Previously linked ✓</div></div>' : ''}
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
      <div class="panel-heading">
        <h1>Choose Destination</h1>
        <p>Linking: <strong>${escHtml(state.entry?.display_name || '')}</strong></p>
      </div>
      <div class="card-grid" id="dest-card-grid">`;

    for (const [name, path] of Object.entries(dst)) {
      const selected = state.destSet === name ? ' selected' : '';
      html += `
        <div class="card${selected}" id="dst-card-${escHtml(name)}" onclick="App.selectDest('${escHtml(name)}')">
          <div class="card-icon">📤</div>
          <div class="card-name">${escHtml(name)}</div>
          <div class="card-path">${escHtml(path)}</div>
        </div>`;
    }

    if (!Object.keys(dst).length) {
      html += `<div class="empty-state"><div class="empty-state-icon">⚙</div><p>No destination sets configured.</p></div>`;
    }
    html += `</div>`;

    html += `
      <div class="subpath-block mt-16">
        <label class="subpath-label" for="dest-subpath">Destination folder name</label>
        <input class="subpath-input" id="dest-subpath" type="text" value="${escHtml(state.destSubpath)}"
          placeholder="Folder name under destination root"
          oninput="App.updateSubpath(this.value)">
        <div class="subpath-hint">This folder will be created inside the selected destination root. Edit to override the suggested name.</div>
      </div>

      <div class="action-bar">
        <div class="action-bar-left">
          <button class="btn btn-secondary" onclick="App.goTo('browse')">← Back</button>
        </div>
        <div class="action-bar-right">
          <button class="btn btn-primary" id="btn-preview" onclick="App.generatePreview()" ${!state.destSet ? 'disabled' : ''}>
            Preview Link Plan →
          </button>
        </div>
      </div>`;

    panel.innerHTML = html;
  }

  function selectDest(name) {
    state.destSet = name;
    // Mark card as selected visually
    document.querySelectorAll('#dest-card-grid .card').forEach(c => c.classList.remove('selected'));
    const card = $(`dst-card-${name}`);
    if (card) card.classList.add('selected');
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
        <div class="validation-block ok">
          <span class="validation-icon">✓</span>
          <div class="validation-text">${validText}</div>
        </div>`;
    } else {
      const errs = p.errors.map(e => `<li>${escHtml(e)}</li>`).join('');
      validationBlock = `
        <div class="validation-block fail">
          <span class="validation-icon">✗</span>
          <div class="validation-text">Validation failed — cannot proceed.
            <ul class="validation-errors">${errs}</ul>
          </div>
        </div>`;
    }

    let mountLayoutWarningBlock = '';
    if (p.warnings?.length) {
      const warnings = p.warnings.map(w => `
        <div class="preview-warning-item">
          <div class="preview-warning-title">${escHtml(w.title)}</div>
          <div class="preview-warning-detail">${escHtml(w.detail)}</div>
          <div class="preview-warning-recommendation">Recommended layout: ${escHtml(w.recommendation)}</div>
        </div>
      `).join('');

      mountLayoutWarningBlock = `
        <div class="validation-block warn preview-warning-block">
          <span class="validation-icon">⚠</span>
          <div class="validation-text">
            <strong>Mount layout warning</strong>
            <div class="preview-warning-copy">
              Preview can still pass while a real Unraid hardlink fails if these paths are mounted in a risky way.
            </div>
            ${warnings}
          </div>
        </div>`;
    }

    let prevLinkedWarning = '';
    if (p.previously_linked) {
      prevLinkedWarning = `
        <div class="validation-block warn" style="margin-top:10px">
          <span class="validation-icon">⚠</span>
          <div class="validation-text">This item has been linked before. Existing destination files will be skipped — no overwrites.</div>
        </div>`;
    }

    const executeDisabled = !p.valid ? 'disabled' : '';

    let html = `
      <div class="panel-heading">
        <h1>Link Plan Preview</h1>
        <p>Review the details below before executing. Destination files are never overwritten.</p>
      </div>

      <div class="preview-card">
        <div class="preview-header">
          <span style="font-size:1.3rem">${p.entry_type === 'dir' ? '📁' : '📄'}</span>
          <span class="preview-header-title">${escHtml(p.display_name)}</span>
        </div>
        <div class="preview-body">
          <div class="preview-row">
            <div class="preview-label">Display name</div>
            <div class="preview-value display">${escHtml(p.display_name)}</div>
          </div>
          <div class="preview-row">
            <div class="preview-label">Real name</div>
            <div class="preview-value">${escHtml(p.real_name)}</div>
          </div>
          <div class="preview-row">
            <div class="preview-label">Type</div>
            <div class="preview-value">${escHtml(p.entry_type)}</div>
          </div>
          <div class="preview-row">
            <div class="preview-label">Source path</div>
            <div class="preview-value">${escHtml(p.source_path)}</div>
          </div>
          <div class="preview-row">
            <div class="preview-label">Dest set</div>
            <div class="preview-value">${escHtml(p.dest_set)} → ${escHtml(p.dest_root)}</div>
          </div>
          <div class="preview-row">
            <div class="preview-label">Dest folder</div>
            <div class="preview-value" style="color:var(--accent)">${escHtml(p.dest_subpath)}</div>
          </div>
          <div class="preview-row">
            <div class="preview-label">Full dest path</div>
            <div class="preview-value">${escHtml(p.dest_full)}</div>
          </div>
        </div>
      </div>

      ${mountLayoutWarningBlock}
      ${validationBlock}
      ${prevLinkedWarning}

      <div class="dry-run-toggle mt-16">
        <input type="checkbox" id="dry-run-toggle" checked>
        <label for="dry-run-toggle">
          <strong>Dry run mode</strong> — preview what would happen without writing any files. Uncheck to perform the real operation.
        </label>
      </div>

      <div class="action-bar">
        <div class="action-bar-left">
          <button class="btn btn-secondary" onclick="App.goTo('dest')">← Change Destination</button>
        </div>
        <div class="action-bar-right">
          <button class="btn btn-primary" id="btn-execute" ${executeDisabled} onclick="App.executeLink()">
            <span id="exec-spinner" class="spinner" style="display:none"></span>
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

    const headerClass = r.failed > 0 ? 'failed' : (r.success ? 'success' : 'partial');
    const prefix = r.dry_run ? '[DRY RUN] ' : '';

    const fileSection = (label, files, colorClass) => {
      if (!files || !files.length) return '';
      return `
        <details class="result-file-list">
          <summary>${label} (${files.length})</summary>
          <div class="result-files">
            ${files.map(f => `<div class="result-file" style="color:var(--${colorClass})">${escHtml(f)}</div>`).join('')}
          </div>
        </details>`;
    };

    let html = `
      <div class="panel-heading">
        <h1>Operation ${r.dry_run ? 'Preview' : 'Complete'}</h1>
        <p>${prefix}Hardlink operation for <strong>${escHtml(state.entry?.display_name || '')}</strong></p>
      </div>

      <div class="result-card">
        <div class="result-header ${headerClass}">
          <div class="result-title">${r.dry_run ? '🔍 Dry Run Result' : (r.success ? '✓ Success' : r.failed > 0 ? '⚠ Completed with failures' : '✓ Done')}</div>
          <div class="result-subtitle">${escHtml(state.sourceSet)} → ${escHtml(state.destSet)} / ${escHtml(state.destSubpath)}</div>
        </div>
        <div class="result-counts">
          <div class="result-count">
            <div class="result-count-num linked">${r.linked}</div>
            <div class="result-count-label">${r.dry_run ? 'Would link' : 'Linked'}</div>
          </div>
          <div class="result-count">
            <div class="result-count-num skipped">${r.skipped}</div>
            <div class="result-count-label">Skipped</div>
          </div>
          <div class="result-count">
            <div class="result-count-num failed">${r.failed}</div>
            <div class="result-count-label">Failed</div>
          </div>
        </div>
        ${fileSection('Linked files',  r.linked_files,  'success')}
        ${fileSection('Skipped files', r.skipped_files, 'warning')}
        ${fileSection('Failed files',  r.failed_files,  'danger')}
      </div>

      <div class="action-bar">
        <div class="action-bar-left">
          <button class="btn btn-secondary" onclick="App.goTo('browse')">Link Another</button>
        </div>
        <div class="action-bar-right">
          <button class="btn btn-primary" onclick="App.startOver()">Start Over</button>
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
      list.innerHTML = `<div class="empty-state" style="padding:24px 18px">No operations yet.</div>`;
      return;
    }

    list.innerHTML = state.history.map(h => {
      const dryTag = h.dry_run ? '<span class="cnt-badge dryrun">dry</span>' : '';
      return `
        <div class="history-entry">
          <div class="history-name">${escHtml(h.real_name)}</div>
          <div class="history-meta">
            <span>${escHtml(h.source_set)} → ${escHtml(h.dest_set)}</span>
          </div>
          <div class="history-meta">${escHtml(fmtTime(h.linked_at))}</div>
          <div class="history-counts">
            ${dryTag}
            <span class="cnt-badge linked">${h.linked_count} linked</span>
            ${h.skipped_count ? `<span class="cnt-badge skipped">${h.skipped_count} skip</span>` : ''}
            ${h.failed_count  ? `<span class="cnt-badge failed">${h.failed_count} fail</span>` : ''}
          </div>
          ${!h.dry_run ? `<button class="btn btn-sm btn-secondary mt-8" style="width:100%" onclick="App.runVerification(${h.id}, '${escHtml(h.real_name).replace(/'/g, "\\'")}')">Verify Link Integrity</button>` : `<div class="mt-8 text-muted" style="font-size:0.75rem">No verification for dry runs.</div>`}
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
        panel.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><p>Verification failed: ${escHtml(err.message)}</p><button class="btn btn-secondary mt-16" onclick="App.startOver()">Start Over</button></div>`;
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
      panel.innerHTML = `<div class="loading-block"><span class="spinner"></span> <span>Running verification…<br><small style="color:var(--text-muted)">This checks actual filesystem links and handles large scale counts gracefully. Please wait.</small></span></div>`;
      return;
    }

    const headerClass = v.failed_count > 0 || v.error_count > 0 ? 'failed' : (v.missing_count > 0 ? 'partial' : 'success');

    let html = `
      <div class="panel-heading">
        <h1>Link Verification</h1>
        <p>Checking integrity of: <strong>${escHtml(v.title)}</strong></p>
      </div>

      <div class="result-card">
        <div class="result-header ${headerClass}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <div>
               <div class="result-title">${v.failed_count > 0 || v.error_count > 0 ? '⚠ Anomalies Found' : '✓ Fully Verified'}</div>
               <div class="result-subtitle">Run #${v.run_id} · ${escHtml(fmtTime(v.created_at))} · Mode: ${escHtml(v.mode)}</div>
             </div>
             <div style="display:flex; gap:8px">
               <a href="/api/verify/${v.run_id}/export.json" download class="btn btn-sm btn-secondary" title="Export JSON">Export JSON</a>
               <a href="/api/verify/${v.run_id}/export.csv" download class="btn btn-sm btn-secondary" title="Export CSV">Export CSV</a>
             </div>
          </div>
        </div>
        <div class="result-counts" style="grid-template-columns: repeat(4, 1fr);">
          <div class="result-count" style="border-bottom:none">
            <div class="result-count-num linked">${v.verified_count}</div>
            <div class="result-count-label">Verified</div>
          </div>
          <div class="result-count" style="border-bottom:none">
            <div class="result-count-num skipped">${v.missing_count}</div>
            <div class="result-count-label">Missing</div>
          </div>
          <div class="result-count" style="border-bottom:none">
            <div class="result-count-num failed">${v.failed_count}</div>
            <div class="result-count-label">Failed</div>
          </div>
          <div class="result-count" style="border-bottom:none">
            <div class="result-count-num failed">${v.error_count}</div>
            <div class="result-count-label">Errors</div>
          </div>
        </div>
      </div>

      <div class="inventory-toolbar mt-24">
        <select class="inventory-search" style="max-width: 200px" onchange="App.filterVerification(this.value)">
          <option value="all" ${state.verifyFilter === 'all' ? 'selected' : ''}>All Results (${v.results.length})</option>
          <option value="failures" ${state.verifyFilter === 'failures' ? 'selected' : ''}>Failures & Missing</option>
          <option value="verified" ${state.verifyFilter === 'verified' ? 'selected' : ''}>Verified Only</option>
        </select>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-secondary" onclick="App.runVerification(${v.link_history_id}, '${escHtml(v.title).replace(/'/g, "\\'")}')">↻ Re-run</button>
        </div>
      </div>

      <div class="entry-list">`;

    let rowsToRender = v.results || [];
    if (state.verifyFilter === 'failures') {
      rowsToRender = rowsToRender.filter(r => r.status !== 'verified_hardlinked');
    } else if (state.verifyFilter === 'verified') {
      rowsToRender = rowsToRender.filter(r => r.status === 'verified_hardlinked');
    }

    if (!rowsToRender.length) {
       html += `<div class="empty-state">No items match this filter.</div>`;
    } else {
      for (const r of rowsToRender) {
         const isOk = r.status === 'verified_hardlinked';
         const icon = isOk ? '✓' : '⚠';
         const color = isOk ? 'var(--success)' : 'var(--danger)';
         html += `
           <div class="entry-row">
             <div class="entry-main" style="align-items:start">
               <span class="entry-type-icon" style="color:${color}">${icon}</span>
               <div style="flex:1; width:100%">
                 <div class="entry-display-name" style="white-space:normal; font-family:var(--font-mono); font-size:0.75rem">${escHtml(r.source_path)}</div>
                 <div class="entry-size" style="margin-top:2px">Status: <strong style="color:${color}">${escHtml(r.status)}</strong> ${r.notes ? `— ${escHtml(r.notes)}` : ''}</div>
               </div>
             </div>
           </div>`;
      }
    }

    html += `
       </div>
       <div class="action-bar mb-32" style="margin-bottom: 32px">
         <div class="action-bar-left">
           <button class="btn btn-primary" onclick="App.startOver()">Done</button>
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
