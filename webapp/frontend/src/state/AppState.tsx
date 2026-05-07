import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type {
  SetsWithStatusResponse,
  InventoryEntry,
  PreviewResponse,
  ExecuteResponse,
  HistoryEntry,
  VerificationRunResponse,
} from '../api/types';

export type AppStep = 'source' | 'browse' | 'dest' | 'preview' | 'result' | 'verify';
export type AppView = 'workflow' | 'destinations';

interface AppState {
  view: AppView;
  step: AppStep;
  sets: SetsWithStatusResponse | null;
  sourceSet: string | null;
  inventory: InventoryEntry[];
  entry: InventoryEntry | null;
  destSet: string | null;
  destSubpath: string;
  preview: PreviewResponse | null;
  result: ExecuteResponse | null;
  history: HistoryEntry[];
  verifyRun: VerificationRunResponse | null;
  scanning: boolean;
  executing: boolean;
  searchQuery: string;
  healthOk: boolean;
}

interface AppActions {
  setView: (v: AppView) => void;
  setStep: (s: AppStep) => void;
  setSourceSet: (name: string | null) => void;
  setInventory: (entries: InventoryEntry[]) => void;
  setEntry: (e: InventoryEntry | null) => void;
  setDestSet: (name: string | null) => void;
  setDestSubpath: (p: string) => void;
  setPreview: (p: PreviewResponse | null) => void;
  setResult: (r: ExecuteResponse | null) => void;
  setVerifyRun: (r: VerificationRunResponse | null) => void;
  setScanning: (b: boolean) => void;
  setExecuting: (b: boolean) => void;
  setSearchQuery: (q: string) => void;
  refreshHistory: () => Promise<void>;
  refreshSets: () => Promise<void>;
  reset: () => void;
}

type ContextValue = AppState & AppActions;

const AppContext = createContext<ContextValue | null>(null);

const INITIAL_STATE: AppState = {
  view: 'workflow',
  step: 'source',
  sets: null,
  sourceSet: null,
  inventory: [],
  entry: null,
  destSet: null,
  destSubpath: '',
  preview: null,
  result: null,
  history: [],
  verifyRun: null,
  scanning: false,
  executing: false,
  searchQuery: '',
  healthOk: false,
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const patch = useCallback((partial: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const refreshHistory = useCallback(async () => {
    const resp = await api.getHistory();
    patch({ history: resp.history });
  }, [patch]);

  const refreshSets = useCallback(async () => {
    const resp = await api.getSets();
    patch({ sets: resp });
  }, [patch]);

  useEffect(() => {
    api.health().then(h => patch({ healthOk: h.status === 'ok' })).catch(() => {});
    refreshSets().catch(() => {});
    refreshHistory().catch(() => {});
  }, [refreshSets, refreshHistory, patch]);

  const ctx: ContextValue = {
    ...state,
    setView: (v) => patch({ view: v }),
    setStep: (s) => patch({ step: s }),
    setSourceSet: (name) => patch({ sourceSet: name, inventory: [], entry: null, preview: null, result: null }),
    setInventory: (entries) => patch({ inventory: entries }),
    setEntry: (e) => patch({ entry: e, preview: null }),
    setDestSet: (name) => patch({ destSet: name, preview: null }),
    setDestSubpath: (p) => patch({ destSubpath: p, preview: null }),
    setPreview: (p) => patch({ preview: p }),
    setResult: (r) => patch({ result: r }),
    setVerifyRun: (r) => patch({ verifyRun: r }),
    setScanning: (b) => patch({ scanning: b }),
    setExecuting: (b) => patch({ executing: b }),
    setSearchQuery: (q) => patch({ searchQuery: q }),
    refreshHistory,
    refreshSets,
    reset: () => setState(INITIAL_STATE),
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useAppState(): ContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
