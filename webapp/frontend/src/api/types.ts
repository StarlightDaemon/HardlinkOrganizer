// TypeScript interfaces mirroring webapp/models.py Pydantic models exactly.

export interface ScanSummary {
  source_set: string;
  scan_time: string | null;
  entry_count: number | null;
}

export interface SetsWithStatusResponse {
  source_sets: Record<string, string>;
  dest_sets: Record<string, string>;
  scan_summaries: Record<string, ScanSummary>;
}

export interface InventoryEntry {
  id: number;
  source_set: string;
  entry_type: string;
  display_name: string;
  real_name: string;
  full_path: string;
  scan_time: string;
  size_bytes: number;
  device_id: number;
  linked: boolean;
}

export interface InventoryResponse {
  source_set: string;
  entries: InventoryEntry[];
  scan_time: string | null;
  from_db: boolean;
}

export interface PreviewRequest {
  source_set: string;
  entry_id: number;
  dest_set: string;
  dest_subpath: string | null;
}

export interface PreviewWarning {
  code: string;
  severity: string;
  title: string;
  detail: string;
  recommendation: string;
}

export interface PreviewResponse {
  source_set: string;
  real_name: string;
  display_name: string;
  entry_type: string;
  source_path: string;
  dest_set: string;
  dest_root: string;
  dest_subpath: string;
  dest_full: string;
  valid: boolean;
  errors: string[];
  warnings: PreviewWarning[];
  previously_linked: boolean;
}

export interface ExecuteRequest {
  source_set: string;
  entry_id: number;
  dest_set: string;
  dest_subpath: string;
  dry_run: boolean;
}

export interface ExecuteResponse {
  success: boolean;
  dry_run: boolean;
  linked: number;
  skipped: number;
  failed: number;
  linked_files: string[];
  skipped_files: string[];
  failed_files: string[];
  errors: string[];
  history_id: number | null;
}

export interface HistoryEntry {
  id: number;
  source_set: string;
  real_name: string;
  full_path: string;
  dest_set: string;
  dest_root: string;
  dest_subpath: string;
  dest_full: string;
  linked_count: number;
  skipped_count: number;
  failed_count: number;
  dry_run: boolean;
  linked_at: string;
  notes: string | null;
}

export interface HistoryResponse {
  history: HistoryEntry[];
  total: number;
}

export interface VerifyRequest {
  mode: string;
  link_history_id: number;
}

export interface VerificationResultItem {
  id: number;
  source_path: string;
  candidate_dest: string;
  source_dev: number | null;
  source_inode: number | null;
  source_nlink: number | null;
  dest_dev: number | null;
  dest_inode: number | null;
  dest_nlink: number | null;
  status: string;
  notes: string | null;
}

export interface VerificationRunResponse {
  run_id: number;
  created_at: string;
  mode: string;
  source_set: string | null;
  dest_set: string | null;
  link_history_id: number | null;
  verified_count: number;
  failed_count: number;
  missing_count: number;
  error_count: number;
  notes: string | null;
  results: VerificationResultItem[];
}

export interface DestinationEntry {
  id: number;
  label: string;
  path: string;
  tag: string | null;
  enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DestinationCreate {
  label: string;
  path: string;
  tag: string | null;
  enabled: boolean;
  notes: string | null;
}

export interface DestinationUpdate {
  label?: string;
  path?: string;
  tag?: string | null;
  enabled?: boolean;
  notes?: string | null;
}

export interface DestinationListResponse {
  destinations: DestinationEntry[];
  total: number;
}

export interface DestinationValidateRequest {
  path: string;
}

export interface DestinationValidateChecks {
  exists: boolean;
  is_directory: boolean;
  is_writable: boolean | null;
  is_unsafe_root: boolean;
}

export interface DestinationValidateWarning {
  code: string;
  severity: string;
  message: string;
}

export interface DestinationValidateResponse {
  path: string;
  valid: boolean;
  checks: DestinationValidateChecks;
  warnings: DestinationValidateWarning[];
  errors: string[];
}

export interface HealthResponse {
  status: string;
  version: string;
  config_loaded: boolean;
  db_path: string | null;
}
