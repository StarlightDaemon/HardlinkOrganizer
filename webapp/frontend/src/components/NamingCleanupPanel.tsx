import { useState, useEffect, useCallback } from 'react';
import { Checkbox, UnstyledButton, Loader } from '@mantine/core';
import { StatusBadge, useToast } from '@fujin';
import tokens from '@tokens';
import { api } from '../api/client';
import type {
  DestinationEntry,
  NamingPreviewResponse,
  NamingApplyResultItem,
} from '../api/types';

interface Props {
  dest: DestinationEntry;
  onClose: () => void;
  onApplied?: () => void;
}

const mono = tokens.typography.fontFamily.mono;
const base = tokens.typography.fontFamily.base;

/**
 * Destination-side naming cleanup.
 *
 * Preview-first and non-destructive by default: the panel loads a preview of
 * tidied names, the user picks which changed entries to clean, runs a dry-run
 * first, and only an explicit confirmed "Apply renames" writes to disk. Source
 * files are never touched — the backend refuses anything under a source set and
 * only performs the exact rename the preview proposed.
 */
export function NamingCleanupPanel({ dest, onClose, onApplied }: Props) {
  const [preview, setPreview] = useState<NamingPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<NamingApplyResultItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const { show } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setResults(null);
    setConfirmApply(false);
    try {
      const resp = await api.previewNaming(dest.id);
      setPreview(resp);
      // Default selection: every changed, non-blocked proposal.
      const eligible = resp.proposals
        .filter((p) => p.changed && !p.blocked)
        .map((p) => p.old_name);
      setSelected(new Set(eligible));
    } catch (err) {
      show({ status: 'danger', message: `Preview failed: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  }, [dest.id, show]);

  useEffect(() => { load(); }, [load]);

  function toggle(oldName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(oldName)) next.delete(oldName);
      else next.add(oldName);
      return next;
    });
    setConfirmApply(false);
  }

  function selectedItems() {
    if (!preview) return [];
    return preview.proposals
      .filter((p) => selected.has(p.old_name) && p.changed && !p.blocked)
      .map((p) => ({ old_name: p.old_name, new_name: p.new_name }));
  }

  async function run(dryRun: boolean) {
    const items = selectedItems();
    if (items.length === 0) {
      show({ status: 'info', message: 'No entries selected.' });
      return;
    }
    setBusy(true);
    try {
      const resp = await api.applyNaming(dest.id, { dry_run: dryRun, items });
      setResults(resp.results);
      if (!dryRun) {
        show({
          status: resp.error_count > 0 ? 'warning' : 'success',
          message: `Renamed ${resp.renamed_count}, skipped ${resp.skipped_count}, errors ${resp.error_count}.`,
        });
        setConfirmApply(false);
        onApplied?.();
        await load();
      }
    } catch (err) {
      show({ status: 'danger', message: `Apply failed: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  const changed = preview?.proposals.filter((p) => p.changed) ?? [];
  const resultByOld = new Map((results ?? []).map((r) => [r.old_name, r]));

  return (
    <div style={{
      padding:       tokens.spacing.scale.lg,
      border:        '1px solid var(--fujin-border-default)',
      display:       'flex',
      flexDirection: 'column',
      gap:           tokens.spacing.scale.md,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{
          fontFamily: base,
          fontSize:   tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.semibold,
          color:      'var(--fujin-text-primary)',
        }}>
          Name cleanup — {dest.label}
        </div>
        <UnstyledButton
          onClick={onClose}
          style={{ fontFamily: base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-muted)', cursor: 'pointer' }}
        >
          Close
        </UnstyledButton>
      </div>

      <div style={{ fontFamily: mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)', wordBreak: 'break-all' }}>
        {dest.path}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.scale.xs }}>
          <Loader size={12} color="var(--fujin-text-muted)" />
          <span style={{ fontFamily: base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)' }}>
            Building preview…
          </span>
        </div>
      )}

      {!loading && preview && !preview.valid && (
        <div style={{ fontFamily: base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-status-danger)' }}>
          {preview.errors[0] ?? 'Destination path is not usable for cleanup.'}
        </div>
      )}

      {!loading && preview?.warnings.map((w, i) => (
        <div key={i} style={{
          borderLeft:  `4px solid var(--fujin-status-info)`,
          paddingLeft: tokens.spacing.scale.xs,
          fontFamily:  base,
          fontSize:    tokens.typography.fontSize.xs,
          color:       'var(--fujin-text-secondary)',
        }}>
          {w.message}
        </div>
      ))}

      {!loading && preview?.valid && changed.length === 0 && (
        <div style={{ fontFamily: base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-secondary)' }}>
          All entries already have clean names. Nothing to do.
        </div>
      )}

      {!loading && preview?.valid && changed.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xs }}>
            {changed.map((p) => {
              const res = resultByOld.get(p.old_name);
              return (
                <div key={p.old_name} style={{
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          tokens.spacing.scale.sm,
                  padding:      `${tokens.spacing.scale.xs}px 0`,
                  borderBottom: '1px solid var(--fujin-border-subtle, var(--fujin-border-default))',
                  opacity:      p.blocked ? 0.55 : 1,
                }}>
                  <Checkbox
                    checked={selected.has(p.old_name)}
                    disabled={p.blocked}
                    onChange={() => toggle(p.old_name)}
                    styles={{
                      root:  { '--checkbox-color': 'var(--fujin-interactive-active)', '--checkbox-radius': '0px' } as React.CSSProperties,
                      input: { cursor: p.blocked ? 'not-allowed' : 'pointer', borderColor: 'var(--fujin-border-default)' },
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)', textDecoration: 'line-through', wordBreak: 'break-all' }}>
                      {p.old_name}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-primary)', wordBreak: 'break-all' }}>
                      {p.new_name}
                    </span>
                    {p.blocked && p.block_reason && (
                      <span style={{ fontFamily: base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-status-warning)' }}>
                        {p.block_reason}
                      </span>
                    )}
                  </div>
                  {res && (
                    <StatusBadge
                      status={res.status === 'renamed' ? 'success' : res.status === 'error' ? 'danger' : res.status === 'would_rename' ? 'info' : 'neutral'}
                      label={res.status}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: tokens.spacing.scale.md, alignItems: 'center', flexWrap: 'wrap' }}>
            <UnstyledButton
              onClick={() => run(true)}
              disabled={busy}
              style={{ fontFamily: base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-primary)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
            >
              Preview selected (dry run)
            </UnstyledButton>

            {!confirmApply ? (
              <UnstyledButton
                onClick={() => setConfirmApply(true)}
                disabled={busy || selectedItems().length === 0}
                style={{ fontFamily: base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-status-danger)', cursor: 'pointer', opacity: selectedItems().length === 0 ? 0.5 : 1 }}
              >
                Apply renames…
              </UnstyledButton>
            ) : (
              <div style={{ display: 'flex', gap: tokens.spacing.scale.sm, alignItems: 'center' }}>
                <span style={{ fontFamily: base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-secondary)' }}>
                  Rename {selectedItems().length} entr{selectedItems().length === 1 ? 'y' : 'ies'} on disk?
                </span>
                <UnstyledButton
                  onClick={() => run(false)}
                  disabled={busy}
                  style={{ fontFamily: base, fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: 'var(--fujin-status-danger)', cursor: 'pointer' }}
                >
                  Confirm
                </UnstyledButton>
                <UnstyledButton
                  onClick={() => setConfirmApply(false)}
                  style={{ fontFamily: base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-muted)', cursor: 'pointer' }}
                >
                  Cancel
                </UnstyledButton>
              </div>
            )}

            {busy && <Loader size={12} color="var(--fujin-text-muted)" />}
          </div>
        </>
      )}
    </div>
  );
}
