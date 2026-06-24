import { http, HttpResponse } from 'msw';
import type {
  SetsWithStatusResponse,
  ScanResponse,
  InventoryResponse,
  PreviewResponse,
  ExecuteResponse,
  HistoryResponse,
  HealthResponse,
} from '../../api/types';

// ---------------------------------------------------------------------------
// Shared fixtures — realistic NAS / homelab values that match the Pydantic
// model field names and types in webapp/models.py. Exported so tests can
// assert that rendered UI reflects exactly what the API returned.
// ---------------------------------------------------------------------------

export const SOURCE_SET = 'movies-incoming';
export const DEST_SET = 'media-library';

export const healthResponse: HealthResponse = {
  status: 'ok',
  version: '1.0.6',
  config_loaded: true,
  db_connected: true,
};

export const setsResponse: SetsWithStatusResponse = {
  source_sets: { [SOURCE_SET]: '/mnt/disk1/incoming/movies' },
  dest_sets: { [DEST_SET]: '/mnt/disk3/media/movies' },
  scan_summaries: {
    [SOURCE_SET]: {
      source_set: SOURCE_SET,
      scan_time: '2026-06-23T09:15:00Z',
      entry_count: 1,
    },
  },
};

export const scanResponse: ScanResponse = {
  scanned_sets: [SOURCE_SET],
  total_entries: 1,
  per_set: { [SOURCE_SET]: 1 },
};

export const inventoryResponse: InventoryResponse = {
  source_set: SOURCE_SET,
  entries: [
    {
      id: 1,
      source_set: SOURCE_SET,
      entry_type: 'dir',
      display_name: 'The Expanse S01 (2015)',
      real_name: 'the.expanse.s01.2015.1080p.bluray',
      full_path: '/mnt/disk1/incoming/movies/the.expanse.s01.2015.1080p.bluray',
      scan_time: '2026-06-23T09:15:00Z',
      size_bytes: 48318382080,
      device_id: 64769,
      linked: false,
      already_linked: false,
    },
  ],
  scan_time: '2026-06-23T09:15:00Z',
  from_db: true,
};

export const previewResponse: PreviewResponse = {
  source_set: SOURCE_SET,
  real_name: 'the.expanse.s01.2015.1080p.bluray',
  display_name: 'The Expanse S01 (2015)',
  entry_type: 'dir',
  source_path: '/mnt/disk1/incoming/movies/the.expanse.s01.2015.1080p.bluray',
  dest_set: DEST_SET,
  dest_root: '/mnt/disk3/media/movies',
  dest_subpath: 'The Expanse S01 (2015)',
  dest_full: '/mnt/disk3/media/movies/The Expanse S01 (2015)',
  valid: true,
  errors: [],
  warnings: [
    {
      code: 'unraid_user_share',
      severity: 'warn',
      title: 'Destination is on an Unraid user share',
      detail:
        'Linking into /mnt/user can fail with EXDEV at execution time even when ' +
        'preview passes, because the share hides the underlying disk layout.',
      recommendation: 'Prefer a disk-level mount such as /mnt/disk3/media/movies.',
    },
  ],
  previously_linked: false,
};

export const executeResponse: ExecuteResponse = {
  success: true,
  dry_run: false,
  linked: 1,
  skipped: 0,
  failed: 0,
  any_linked: true,
  linked_files: [
    '/mnt/disk3/media/movies/The Expanse S01 (2015)/the.expanse.s01e01.1080p.bluray.mkv',
  ],
  skipped_files: [],
  failed_files: [],
  errors: [],
  history_id: 7,
};

export const historyResponse: HistoryResponse = {
  history: [],
  total: 0,
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // Mount-time reads issued by AppStateProvider / step components.
  http.get('/health', () => HttpResponse.json(healthResponse)),
  http.get('/api/config/sets', () => HttpResponse.json(setsResponse)),
  http.get('/api/history', () => HttpResponse.json(historyResponse)),
  http.get('/api/inventory', () => HttpResponse.json(inventoryResponse)),

  // The three target workflow routes.
  http.post('/api/scan', () => HttpResponse.json(scanResponse)),
  http.post('/api/preview', () => HttpResponse.json(previewResponse)),
  http.post('/api/execute', () => HttpResponse.json(executeResponse)),
];
