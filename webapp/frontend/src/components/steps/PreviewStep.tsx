import { useState } from 'react';
import { Checkbox, Loader, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import tokens from '@tokens';
import { useAppState } from '../../state/AppState';
import { api } from '../../api/client';
import { useToast } from '@fujin';
import type { PreviewWarning } from '../../api/types';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xxs }}>
      <span style={{
        fontFamily:    tokens.typography.fontFamily.base,
        fontSize:      tokens.typography.fontSize.xs,
        color:         'var(--fujin-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: tokens.typography.letterSpacing.wide,
        fontWeight:    tokens.typography.fontWeight.semibold,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: tokens.typography.fontFamily.mono,
        fontSize:   tokens.typography.fontSize.sm,
        color:      'var(--fujin-text-primary)',
        wordBreak:  'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}

function WarningBlock({ w }: { w: PreviewWarning }) {
  const [open, { toggle }] = useDisclosure(false);
  return (
    <div style={{
      borderLeft: '4px solid var(--fujin-status-warning)',
      paddingLeft: tokens.spacing.scale.sm,
      display:     'flex',
      flexDirection: 'column',
      gap:         tokens.spacing.scale.xs,
    }}>
      <UnstyledButton
        onClick={toggle}
        style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color:      'var(--fujin-status-warning)',
          cursor:     'pointer',
          textAlign:  'left',
        }}
      >
        {open ? '▾' : '▸'} {w.title}
      </UnstyledButton>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xs }}>
          <span style={{
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-secondary)',
          }}>
            {w.detail}
          </span>
          {w.recommendation && (
            <span style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.xs,
              color:      'var(--fujin-text-muted)',
              fontStyle:  'italic',
            }}>
              Recommendation: {w.recommendation}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PreviewStep() {
  const {
    preview, entry, executing,
    setResult, setExecuting, refreshHistory,
  } = useAppState();
  const { show } = useToast();
  const [dryRun, setDryRun] = useState(false);

  async function handleExecute() {
    if (!preview || !entry) return;
    setExecuting(true);
    try {
      const result = await api.execute({
        source_set:   entry.source_set,
        entry_id:     entry.id,
        dest_set:     preview.dest_set,
        dest_subpath: preview.dest_subpath,
        dry_run:      dryRun,
      });
      setResult(result);
      await refreshHistory();
      if (result.success) {
        show({
          status: 'success',
          title: dryRun ? 'Dry run complete' : 'Links created',
          message: `${result.linked} file(s) linked.`,
        });
      } else {
        show({ status: 'danger', title: 'Execution failed', message: result.errors[0] ?? 'Unknown error.' });
      }
    } catch (err) {
      show({ status: 'danger', message: `Execute failed: ${(err as Error).message}` });
    } finally {
      setExecuting(false);
    }
  }

  if (!preview) {
    return (
      <div style={{
        fontFamily: tokens.typography.fontFamily.base,
        fontSize:   tokens.typography.fontSize.sm,
        color:      'var(--fujin-text-muted)',
      }}>
        No preview available. Go back and generate a link plan.
      </div>
    );
  }

  const hasErrors = !preview.valid || preview.errors.length > 0;
  const statusColor = hasErrors ? 'var(--fujin-status-danger)' : 'var(--fujin-status-success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.lg }}>
      {/* Validation status block */}
      <div style={{
        borderLeft:  `4px solid ${statusColor}`,
        paddingLeft: tokens.spacing.scale.sm,
        display:     'flex',
        flexDirection: 'column',
        gap:         tokens.spacing.scale.xs,
      }}>
        <span style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.semibold,
          color:      statusColor,
        }}>
          {hasErrors ? 'Plan invalid' : preview.previously_linked ? 'Previously linked — re-link?' : 'Plan valid'}
        </span>
        {preview.errors.map((e, i) => (
          <span key={i} style={{
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-status-danger)',
          }}>
            {e}
          </span>
        ))}
      </div>

      {/* Detail grid */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 tokens.spacing.scale.md,
      }}>
        <DetailRow label="Source Path" value={preview.source_path} />
        <DetailRow label="Destination" value={preview.dest_full} />
        <DetailRow label="Entry Type" value={preview.entry_type} />
        <DetailRow label="Dest Set" value={preview.dest_set} />
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.sm }}>
          {preview.warnings.map((w, i) => <WarningBlock key={i} w={w} />)}
        </div>
      )}

      {/* Dry-run toggle */}
      <Checkbox
        label="Dry run (simulate without creating links)"
        checked={dryRun}
        onChange={e => setDryRun(e.currentTarget.checked)}
        styles={{
          label: {
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-secondary)',
            cursor:     'pointer',
          },
        }}
      />

      {/* Execute button */}
      <UnstyledButton
        onClick={handleExecute}
        disabled={executing}
        style={{
          padding:    `${tokens.spacing.scale.sm}px ${tokens.spacing.scale.lg}px`,
          background: executing
            ? 'var(--fujin-interactive-disabled)'
            : hasErrors
              ? 'var(--fujin-status-danger)'
              : 'var(--fujin-interactive-default)',
          color:      'var(--fujin-text-primary)',
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          cursor:     executing ? 'not-allowed' : 'pointer',
          opacity:    executing ? tokens.opacity.loading : 1,
          display:    'flex',
          alignItems: 'center',
          gap:        tokens.spacing.scale.xs,
          alignSelf:  'flex-start',
        }}
      >
        {executing
          ? <><Loader size={12} color="var(--fujin-text-muted)" /> Executing…</>
          : dryRun ? 'Run Dry Run' : 'Execute'
        }
      </UnstyledButton>
    </div>
  );
}

export function validatePreviewStep(preview: unknown): true | string {
  if (!preview) return 'Generate a preview first.';
  return true;
}
