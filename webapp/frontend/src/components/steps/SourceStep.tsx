import { Loader, UnstyledButton } from '@mantine/core';
import { StatusBadge } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../../state/AppState';
import { api } from '../../api/client';
import { useToast } from '@fujin';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SourceStep() {
  const {
    sets, sourceSet, scanning,
    setSourceSet, setScanning, refreshSets,
  } = useAppState();
  const { show } = useToast();

  async function handleScanSelect(name: string) {
    setScanning(true);
    try {
      await api.scan(name);
      await refreshSets();
      setSourceSet(name);
      show({ status: 'success', title: 'Scan complete', message: `${name} scanned successfully.` });
    } catch (err) {
      show({ status: 'danger', message: `Scan failed: ${(err as Error).message}` });
    } finally {
      setScanning(false);
    }
  }

  if (!sets) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacing.scale.xl }}>
        <Loader size={tokens.spacing.scale.lg} color="var(--fujin-text-muted)" />
      </div>
    );
  }

  const sourceSetNames = Object.keys(sets.source_sets);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.md }}>
      <div style={{
        fontFamily: tokens.typography.fontFamily.base,
        fontSize:   tokens.typography.fontSize.sm,
        color:      'var(--fujin-text-muted)',
      }}>
        Select a source set to scan and browse.
      </div>

      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap:                 tokens.spacing.scale.md,
      }}>
        {sourceSetNames.map(name => {
          const summary = sets.scan_summaries[name];
          const isSelected = sourceSet === name;
          const isScanned = !!summary?.scan_time;

          return (
            <div
              key={name}
              style={{
                background:  isSelected ? 'var(--fujin-bg-elevated)' : 'var(--fujin-bg-surface)',
                border:      `1px solid ${isSelected ? 'var(--fujin-border-strong)' : 'var(--fujin-border-subtle)'}`,
                padding:     tokens.spacing.scale.md,
                display:     'flex',
                flexDirection: 'column',
                gap:         tokens.spacing.scale.sm,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily:  tokens.typography.fontFamily.base,
                  fontSize:    tokens.typography.fontSize.md,
                  fontWeight:  tokens.typography.fontWeight.semibold,
                  color:       'var(--fujin-text-primary)',
                  wordBreak:   'break-all',
                }}>
                  {name}
                </span>
                <StatusBadge
                  status={isScanned ? 'success' : 'neutral'}
                  label={isScanned ? 'Scanned' : 'Not scanned'}
                />
              </div>

              <div style={{
                fontFamily: tokens.typography.fontFamily.mono,
                fontSize:   tokens.typography.fontSize.xs,
                color:      'var(--fujin-text-muted)',
                wordBreak:  'break-all',
              }}>
                {sets.source_sets[name]}
              </div>

              <div style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.xs,
                color:      'var(--fujin-text-muted)',
              }}>
                Last scan: {formatTime(summary?.scan_time)} ·{' '}
                {summary?.entry_count != null ? `${summary.entry_count} entries` : '—'}
              </div>

              <UnstyledButton
                onClick={() => handleScanSelect(name)}
                disabled={scanning}
                style={{
                  marginTop:   tokens.spacing.scale.xs,
                  padding:     `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
                  background:  scanning ? 'var(--fujin-interactive-disabled)' : 'var(--fujin-interactive-default)',
                  color:       'var(--fujin-text-primary)',
                  fontFamily:  tokens.typography.fontFamily.base,
                  fontSize:    tokens.typography.fontSize.sm,
                  fontWeight:  tokens.typography.fontWeight.medium,
                  cursor:      scanning ? 'not-allowed' : 'pointer',
                  opacity:     scanning ? tokens.opacity.disabled : 1,
                  display:     'flex',
                  alignItems:  'center',
                  gap:         tokens.spacing.scale.xs,
                  justifyContent: 'center',
                }}
              >
                {scanning
                  ? <><Loader size={12} color="var(--fujin-text-muted)" /> Scanning…</>
                  : 'Scan & Select'
                }
              </UnstyledButton>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function validateSourceStep(sourceSet: string | null): true | string {
  if (!sourceSet) return 'Select and scan a source set to continue.';
  return true;
}
