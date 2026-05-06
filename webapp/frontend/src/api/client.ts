import type {
  SetsWithStatusResponse,
  InventoryResponse,
  PreviewRequest,
  PreviewResponse,
  ExecuteRequest,
  ExecuteResponse,
  HistoryResponse,
  VerifyRequest,
  VerificationRunResponse,
  DestinationEntry,
  DestinationCreate,
  DestinationUpdate,
  DestinationListResponse,
  DestinationValidateRequest,
  DestinationValidateResponse,
  HealthResponse,
} from './types';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () =>
    request<HealthResponse>('GET', '/health'),

  getSets: () =>
    request<SetsWithStatusResponse>('GET', '/api/config/sets'),

  scan: (sourceSet: string) =>
    request<{ scanned_sets: string[]; total_entries: number; per_set: Record<string, number> }>(
      'POST', '/api/scan', { source_set: sourceSet }
    ),

  getInventory: (sourceSet: string) =>
    request<InventoryResponse>('GET', `/api/inventory?source_set=${encodeURIComponent(sourceSet)}`),

  preview: (body: PreviewRequest) =>
    request<PreviewResponse>('POST', '/api/preview', body),

  execute: (body: ExecuteRequest) =>
    request<ExecuteResponse>('POST', '/api/execute', body),

  getHistory: (limit = 50) =>
    request<HistoryResponse>('GET', `/api/history?limit=${limit}`),

  triggerVerify: (body: VerifyRequest) =>
    request<{ run_id: number }>('POST', '/api/verify', body),

  getVerifyRun: (runId: number) =>
    request<VerificationRunResponse>('GET', `/api/verify/${runId}`),

  listDestinations: () =>
    request<DestinationListResponse>('GET', '/api/destinations'),

  validateDestination: (body: DestinationValidateRequest) =>
    request<DestinationValidateResponse>('POST', '/api/destinations/validate', body),

  createDestination: (body: DestinationCreate) =>
    request<DestinationEntry>('POST', '/api/destinations', body),

  updateDestination: (id: number, body: DestinationUpdate) =>
    request<DestinationEntry>('PATCH', `/api/destinations/${id}`, body),

  deleteDestination: (id: number) =>
    request<void>('DELETE', `/api/destinations/${id}`),
};
