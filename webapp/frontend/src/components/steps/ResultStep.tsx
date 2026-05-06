import React from 'react';
import { UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { DataCard, StatusBadge } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../../state/AppState';

function FileList({ files, label }: { files: string[]; label: string }) {
  const [open, { toggle }] = useDisclosure(false);
  if (files.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xs }}>
      <UnstyledButton
        onClick={toggle}
        style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          color:      'var(--fujin-text-primary)',
          cursor:     'pointer',
          textAlign:  'left',
        }}
      >
        {open ? '▾' : '▸'} {label} ({files.length})
      </UnstyledButton>
      {open && (
        <div style={{
          display:    'flex',
          flexDirection: 'column',
          gap:        tokens.spacing.scale.xxs,
          paddingLeft: tokens.spacing.scale.md,
          maxHeight:  240,
          overflowY:  'auto',
        }}>
          {files.map((f, i) => (
            <span key={i} style={{
              fontFamily: tokens.typography.fontFamily.mono,
              fontSize:   tokens.typography.fontSize.xs,
              color:      'var(--fujin-text-muted)',
              wordBreak:  'break-all',
            }}>
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultStep() {
  const { result, reset, setStep } = useAppState();

  if (!result) {
    return (
      <div style={{
        fontFamily: tokens.typography.fontFamily.base,
        fontSize:   tokens.typography.fontSize.sm,
        color:      'var(--fujin-text-muted)',
      }}>
        No result yet. Complete the previous steps to execute.
      </div>
    );
  }

  const badgeStatus = result.failed > 0 ? 'danger' : result.skipped > 0 ? 'warning' : 'success';
  const badgeLabel  = result.failed > 0 ? 'Failed' : result.skipped > 0 ? 'Partial' : result.dry_run ? 'Dry Run OK' : 'Success';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.lg }}>
      <DataCard
        title={result.dry_run ? 'Dry Run Result' : 'Execution Result'}
        badge={<StatusBadge status={badgeStatus} label={badgeLabel} />}
        detail={
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.sm }}>
            <FileList files={result.linked_files} label="Linked files" />
            <FileList files={result.skipped_files} label="Skipped files" />
            <FileList files={result.failed_files} label="Failed files" />
            {result.errors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xs }}>
                {result.errors.map((e, i) => (
                  <span key={i} style={{
                    fontFamily: tokens.typography.fontFamily.base,
                    fontSize:   tokens.typography.fontSize.sm,
                    color:      'var(--fujin-status-danger)',
                  }}>
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        }
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: tokens.spacing.scale.md,
        }}>
          {[
            { label: 'Linked',  value: result.linked,  color: 'var(--fujin-status-success)' },
            { label: 'Skipped', value: result.skipped, color: 'var(--fujin-status-warning)' },
            { label: 'Failed',  value: result.failed,  color: 'var(--fujin-status-danger)'  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.base }}>
              <span style={{
                fontFamily:    tokens.typography.fontFamily.base,
                fontSize:      tokens.typography.fontSize.xxl,
                fontWeight:    tokens.typography.fontWeight.bold,
                color,
              }}>
                {value}
              </span>
              <span style={{
                fontFamily:    tokens.typography.fontFamily.base,
                fontSize:      tokens.typography.fontSize.xs,
                color:         'var(--fujin-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: tokens.typography.letterSpacing.wide,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </DataCard>

      <div style={{ display: 'flex', gap: tokens.spacing.scale.md }}>
        <UnstyledButton
          onClick={() => setStep('dest')}
          style={{
            padding:    `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.md}px`,
            border:     '1px solid var(--fujin-border-subtle)',
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-primary)',
            cursor:     'pointer',
          }}
        >
          Link Another
        </UnstyledButton>
        <UnstyledButton
          onClick={reset}
          style={{
            padding:    `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.md}px`,
            border:     '1px solid var(--fujin-border-subtle)',
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-muted)',
            cursor:     'pointer',
          }}
        >
          Start Over
        </UnstyledButton>
      </div>
    </div>
  );
}
