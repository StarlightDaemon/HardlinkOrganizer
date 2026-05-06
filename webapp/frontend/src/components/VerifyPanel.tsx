import React, { useState } from 'react';
import { UnstyledButton } from '@mantine/core';
import { SectionHeader, DataTable, StatusBadge, type DataColumn } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../state/AppState';
import type { VerificationResultItem } from '../api/types';

type Filter = 'all' | 'failures' | 'verified';

function statusToFujin(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'verified')  return 'success';
  if (status === 'failed')    return 'danger';
  if (status === 'missing')   return 'warning';
  return 'neutral';
}

export function VerifyPanel() {
  const { verifyRun, setStep } = useAppState();
  const [filter, setFilter] = useState<Filter>('all');

  if (!verifyRun) {
    return (
      <div style={{
        fontFamily: tokens.typography.fontFamily.base,
        fontSize:   tokens.typography.fontSize.sm,
        color:      'var(--fujin-text-muted)',
        padding:    tokens.spacing.scale.lg,
      }}>
        No verification run loaded.
      </div>
    );
  }

  const filtered = verifyRun.results.filter(r => {
    if (filter === 'failures') return r.status === 'failed' || r.status === 'missing';
    if (filter === 'verified') return r.status === 'verified';
    return true;
  });

  const columns: DataColumn<VerificationResultItem>[] = [
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <StatusBadge status={statusToFujin(row.status)} label={row.status} />
      ),
    },
    {
      key: 'source_path',
      label: 'Source',
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.mono,
          fontSize:   tokens.typography.fontSize.xs,
          color:      'var(--fujin-text-secondary)',
          wordBreak:  'break-all',
        }}>
          {row.source_path}
        </span>
      ),
    },
    {
      key: 'candidate_dest',
      label: 'Destination',
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.mono,
          fontSize:   tokens.typography.fontSize.xs,
          color:      'var(--fujin-text-secondary)',
          wordBreak:  'break-all',
        }}>
          {row.candidate_dest}
        </span>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.xs,
          color:      'var(--fujin-text-muted)',
        }}>
          {row.notes ?? '—'}
        </span>
      ),
    },
  ];

  const exportJsonUrl = `/api/verify/${verifyRun.run_id}/export.json`;
  const exportCsvUrl  = `/api/verify/${verifyRun.run_id}/export.csv`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.lg }}>
      <SectionHeader
        title="Verification Results"
        description={`Run #${verifyRun.run_id} · ${verifyRun.created_at}`}
        action={
          <UnstyledButton
            onClick={() => setStep('source')}
            style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.sm,
              color:      'var(--fujin-text-primary)',
              cursor:     'pointer',
            }}
          >
            ← Back
          </UnstyledButton>
        }
      />

      {/* Summary counts */}
      <div style={{ display: 'flex', gap: tokens.spacing.scale.lg }}>
        {[
          { label: 'Verified', value: verifyRun.verified_count, color: 'var(--fujin-status-success)' },
          { label: 'Failed',   value: verifyRun.failed_count,   color: 'var(--fujin-status-danger)' },
          { label: 'Missing',  value: verifyRun.missing_count,  color: 'var(--fujin-status-warning)' },
          { label: 'Errors',   value: verifyRun.error_count,    color: 'var(--fujin-text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xxs }}>
            <span style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.bold,
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

      {/* Filter toggles */}
      <div style={{ display: 'flex', gap: tokens.spacing.scale.sm }}>
        {(['all', 'failures', 'verified'] as Filter[]).map(f => (
          <UnstyledButton
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontFamily:  tokens.typography.fontFamily.base,
              fontSize:    tokens.typography.fontSize.xs,
              fontWeight:  filter === f ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular,
              color:       filter === f ? 'var(--fujin-text-primary)' : 'var(--fujin-text-muted)',
              padding:     `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
              border:      `1px solid ${filter === f ? 'var(--fujin-border-strong)' : 'var(--fujin-border-subtle)'}`,
              cursor:      'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </UnstyledButton>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey="id"
        pageSize={25}
        emptyMessage="No results match the selected filter."
      />

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: tokens.spacing.scale.sm }}>
        <a
          href={exportJsonUrl}
          download
          style={{
            fontFamily:    tokens.typography.fontFamily.base,
            fontSize:      tokens.typography.fontSize.xs,
            color:         'var(--fujin-text-primary)',
            padding:       `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
            border:        '1px solid var(--fujin-border-subtle)',
            textDecoration: 'none',
            display:       'inline-block',
          }}
        >
          Export JSON
        </a>
        <a
          href={exportCsvUrl}
          download
          style={{
            fontFamily:    tokens.typography.fontFamily.base,
            fontSize:      tokens.typography.fontSize.xs,
            color:         'var(--fujin-text-primary)',
            padding:       `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
            border:        '1px solid var(--fujin-border-subtle)',
            textDecoration: 'none',
            display:       'inline-block',
          }}
        >
          Export CSV
        </a>
      </div>
    </div>
  );
}
