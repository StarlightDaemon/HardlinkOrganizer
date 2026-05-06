import React, { useState, useEffect, useCallback } from 'react';
import { TextInput, Textarea, Checkbox, UnstyledButton, Loader } from '@mantine/core';
import { SectionHeader, DataTable, StatusBadge, ActionMenu, FormShell, type DataColumn, type ActionMenuItem } from '@fujin';
import { useToast } from '@fujin';
import tokens from '@tokens';
import { api } from '../api/client';
import type { DestinationEntry, DestinationCreate, DestinationValidateResponse } from '../api/types';

interface FormValues {
  label: string;
  path: string;
  tag: string;
  notes: string;
  enabled: boolean;
}

const EMPTY_FORM: FormValues = { label: '', path: '', tag: '', notes: '', enabled: true };

interface FormPanelProps {
  initial: FormValues;
  loading: boolean;
  error: string;
  submitLabel: string;
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
}

function FormPanel({ initial, loading, error, submitLabel, onSubmit, onCancel }: FormPanelProps) {
  const [v, setV] = useState<FormValues>(initial);
  const [pathValidation, setPathValidation] = useState<DestinationValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);

  async function handlePathBlur() {
    if (!v.path) { setPathValidation(null); return; }
    setValidating(true);
    try {
      const result = await api.validateDestination({ path: v.path });
      setPathValidation(result);
    } catch {
      setPathValidation(null);
    } finally {
      setValidating(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(v);
  }

  const inputStyles = {
    label: {
      fontFamily:    tokens.typography.fontFamily.base,
      fontSize:      tokens.typography.fontSize.xs,
      fontWeight:    tokens.typography.fontWeight.semibold,
      color:         'var(--fujin-text-muted)',
      letterSpacing: tokens.typography.letterSpacing.wide,
      textTransform: 'uppercase' as const,
    },
    input: {
      background:   'var(--fujin-bg-base)',
      border:       '1px solid var(--fujin-border-default)',
      color:        'var(--fujin-text-primary)',
      fontFamily:   tokens.typography.fontFamily.base,
      fontSize:     tokens.typography.fontSize.sm,
      borderRadius: 0,
    },
  };

  return (
    <FormShell
      onSubmit={handleSubmit}
      submitLabel={submitLabel}
      loading={loading}
      error={error || undefined}
      actions={
        <UnstyledButton
          onClick={onCancel}
          style={{
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-muted)',
            cursor:     'pointer',
          }}
        >
          Cancel
        </UnstyledButton>
      }
    >
      <TextInput
        required
        label="Label"
        value={v.label}
        onChange={e => setV(p => ({ ...p, label: e.currentTarget.value }))}
        radius={tokens.radius.default}
        styles={inputStyles}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.xs }}>
        <TextInput
          required
          label="Path"
          placeholder="/mnt/disk1/media"
          value={v.path}
          onChange={e => {
            setV(p => ({ ...p, path: e.currentTarget.value }));
            setPathValidation(null);
          }}
          onBlur={handlePathBlur}
          radius={tokens.radius.default}
          styles={{
            ...inputStyles,
            input: {
              ...inputStyles.input,
              fontFamily: tokens.typography.fontFamily.mono,
            },
          }}
        />
        {validating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.scale.xs }}>
            <Loader size={10} color="var(--fujin-text-muted)" />
            <span style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.xs,
              color:      'var(--fujin-text-muted)',
            }}>Validating…</span>
          </div>
        )}
        {pathValidation && !validating && (
          <div style={{
            borderLeft:  `4px solid ${pathValidation.valid ? 'var(--fujin-status-success)' : 'var(--fujin-status-danger)'}`,
            paddingLeft: tokens.spacing.scale.xs,
            display:     'flex',
            flexDirection: 'column',
            gap:         tokens.spacing.scale.xxs,
          }}>
            <span style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.xs,
              color:      pathValidation.valid ? 'var(--fujin-status-success)' : 'var(--fujin-status-danger)',
            }}>
              {pathValidation.valid ? 'Path valid' : pathValidation.errors[0] ?? 'Invalid path'}
            </span>
            {pathValidation.warnings.map((w, i) => (
              <span key={i} style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.xs,
                color:      'var(--fujin-status-warning)',
              }}>
                {w.message}
              </span>
            ))}
          </div>
        )}
      </div>

      <TextInput
        label="Tag (optional)"
        placeholder="movies, archive, …"
        value={v.tag}
        onChange={e => setV(p => ({ ...p, tag: e.currentTarget.value }))}
        radius={tokens.radius.default}
        styles={inputStyles}
      />

      <Textarea
        label="Notes (optional)"
        value={v.notes}
        onChange={e => setV(p => ({ ...p, notes: e.currentTarget.value }))}
        radius={tokens.radius.default}
        styles={inputStyles}
        autosize
        minRows={2}
      />

      <Checkbox
        label="Enabled"
        checked={v.enabled}
        onChange={e => setV(p => ({ ...p, enabled: e.currentTarget.checked }))}
        radius={tokens.radius.default}
        styles={{
          root: {
            '--checkbox-color':  'var(--fujin-interactive-active)',
            '--checkbox-radius': '0px',
          } as React.CSSProperties,
          label: {
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-secondary)',
            cursor:     'pointer',
          },
          input: {
            cursor:      'pointer',
            borderColor: 'var(--fujin-border-default)',
          },
        }}
      />
    </FormShell>
  );
}

export function DestRegistry() {
  const [destinations, setDestinations] = useState<DestinationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<'none' | 'add' | 'edit'>('none');
  const [editTarget, setEditTarget] = useState<DestinationEntry | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { show } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.listDestinations();
      setDestinations(resp.destinations);
    } catch (err) {
      show({ status: 'danger', message: `Failed to load destinations: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(v: FormValues) {
    setFormLoading(true);
    setFormError('');
    try {
      await api.createDestination({
        label:   v.label,
        path:    v.path,
        tag:     v.tag || null,
        enabled: v.enabled,
        notes:   v.notes || null,
      } as DestinationCreate);
      await load();
      setFormMode('none');
      show({ status: 'success', message: 'Destination added.' });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit(v: FormValues) {
    if (!editTarget) return;
    setFormLoading(true);
    setFormError('');
    try {
      await api.updateDestination(editTarget.id, {
        label:   v.label,
        path:    v.path,
        tag:     v.tag || null,
        enabled: v.enabled,
        notes:   v.notes || null,
      });
      await load();
      setFormMode('none');
      setEditTarget(null);
      show({ status: 'success', message: 'Destination updated.' });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(dest: DestinationEntry) {
    try {
      await api.deleteDestination(dest.id);
      await load();
      show({ status: 'success', message: `${dest.label} deleted.` });
    } catch (err) {
      show({ status: 'danger', message: `Delete failed: ${(err as Error).message}` });
    }
  }

  async function handleToggleEnabled(dest: DestinationEntry) {
    try {
      await api.updateDestination(dest.id, { enabled: !dest.enabled });
      await load();
    } catch (err) {
      show({ status: 'danger', message: `Update failed: ${(err as Error).message}` });
    }
  }

  function openEdit(dest: DestinationEntry) {
    setEditTarget(dest);
    setFormMode('edit');
    setFormError('');
  }

  const columns: DataColumn<DestinationEntry>[] = [
    {
      key: 'label',
      label: 'Label',
      sortable: true,
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color:      'var(--fujin-text-primary)',
        }}>
          {row.label}
        </span>
      ),
    },
    {
      key: 'path',
      label: 'Path',
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.mono,
          fontSize:   tokens.typography.fontSize.xs,
          color:      'var(--fujin-text-muted)',
          wordBreak:  'break-all',
        }}>
          {row.path}
        </span>
      ),
    },
    {
      key: 'tag',
      label: 'Tag',
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.xs,
          color:      'var(--fujin-text-muted)',
        }}>
          {row.tag ?? '—'}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: 'Enabled',
      render: (row) => (
        <StatusBadge status={row.enabled ? 'success' : 'neutral'} label={row.enabled ? 'Enabled' : 'Disabled'} />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.lg }}>
      <SectionHeader
        title="Destination Registry"
        description="Managed destination paths for hardlinking"
        action={
          formMode === 'none' ? (
            <UnstyledButton
              onClick={() => { setFormMode('add'); setFormError(''); }}
              style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.sm,
                color:      'var(--fujin-text-primary)',
                cursor:     'pointer',
              }}
            >
              + Add Destination
            </UnstyledButton>
          ) : null
        }
      />

      {formMode !== 'none' && (
        <div style={{
          background: 'var(--fujin-bg-surface)',
          border:     '1px solid var(--fujin-border-subtle)',
          padding:    tokens.spacing.scale.lg,
        }}>
          <div style={{
            fontFamily:  tokens.typography.fontFamily.base,
            fontSize:    tokens.typography.fontSize.sm,
            fontWeight:  tokens.typography.fontWeight.semibold,
            color:       'var(--fujin-text-primary)',
            marginBottom: tokens.spacing.scale.md,
          }}>
            {formMode === 'add' ? 'Add Destination' : `Edit — ${editTarget?.label}`}
          </div>
          <FormPanel
            initial={formMode === 'edit' && editTarget ? {
              label:   editTarget.label,
              path:    editTarget.path,
              tag:     editTarget.tag ?? '',
              notes:   editTarget.notes ?? '',
              enabled: editTarget.enabled,
            } : EMPTY_FORM}
            loading={formLoading}
            error={formError}
            submitLabel={formMode === 'add' ? 'Add' : 'Save'}
            onSubmit={formMode === 'add' ? handleAdd : handleEdit}
            onCancel={() => { setFormMode('none'); setEditTarget(null); setFormError(''); }}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={destinations}
        rowKey="id"
        loading={loading}
        pageSize={20}
        emptyMessage="No destinations registered."
        rowActions={(row) => (
          <ActionMenu
            items={[
              { label: 'Edit',                           onClick: () => openEdit(row) },
              { label: row.enabled ? 'Disable' : 'Enable', onClick: () => handleToggleEnabled(row) },
              { label: 'Delete', danger: true,           onClick: () => handleDelete(row) },
            ] as ActionMenuItem[]}
          />
        )}
      />
    </div>
  );
}
