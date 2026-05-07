import { useState } from 'react';
import { TextInput, UnstyledButton, Loader } from '@mantine/core';
import { StatusBadge } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../../state/AppState';
import { api } from '../../api/client';
import { useToast } from '@fujin';

export function DestStep() {
  const {
    sets, entry, destSet, destSubpath,
    setDestSet, setDestSubpath, setPreview,
  } = useAppState();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    if (!sets || !entry || !destSet) return;
    setLoading(true);
    try {
      const result = await api.preview({
        source_set:   entry.source_set,
        entry_id:     entry.id,
        dest_set:     destSet,
        dest_subpath: destSubpath || null,
      });
      setPreview(result);
      if (result.warnings.length > 0) {
        show({ status: 'warning', title: 'Warnings', message: result.warnings[0].title });
      }
    } catch (err) {
      show({ status: 'danger', message: `Preview failed: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  if (!sets) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacing.scale.xl }}>
        <Loader size={tokens.spacing.scale.lg} color="var(--fujin-text-muted)" />
      </div>
    );
  }

  const destNames = Object.keys(sets.dest_sets);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.lg }}>
      {entry && (
        <div style={{
          padding:    tokens.spacing.scale.sm,
          background: 'var(--fujin-bg-elevated)',
          border:     '1px solid var(--fujin-border-subtle)',
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          color:      'var(--fujin-text-muted)',
        }}>
          Linking: <span style={{ color: 'var(--fujin-text-primary)', fontWeight: tokens.typography.fontWeight.medium }}>
            {entry.display_name}
          </span>
        </div>
      )}

      <div>
        <div style={{
          fontFamily:   tokens.typography.fontFamily.base,
          fontSize:     tokens.typography.fontSize.xs,
          fontWeight:   tokens.typography.fontWeight.semibold,
          color:        'var(--fujin-text-muted)',
          letterSpacing: tokens.typography.letterSpacing.wide,
          textTransform: 'uppercase',
          marginBottom: tokens.spacing.scale.sm,
        }}>
          Destination Set
        </div>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap:                 tokens.spacing.scale.sm,
        }}>
          {destNames.map(name => {
            const isSelected = destSet === name;
            return (
              <UnstyledButton
                key={name}
                onClick={() => setDestSet(name)}
                style={{
                  background:    isSelected ? 'var(--fujin-bg-elevated)' : 'var(--fujin-bg-surface)',
                  border:        `1px solid ${isSelected ? 'var(--fujin-border-strong)' : 'var(--fujin-border-subtle)'}`,
                  padding:       tokens.spacing.scale.md,
                  display:       'flex',
                  flexDirection: 'column',
                  gap:           tokens.spacing.scale.xs,
                  cursor:        'pointer',
                  textAlign:     'left',
                  width:         '100%',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: tokens.typography.fontFamily.base,
                    fontSize:   tokens.typography.fontSize.md,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color:      'var(--fujin-text-primary)',
                  }}>
                    {name}
                  </span>
                  {isSelected && <StatusBadge status="success" label="Selected" />}
                </div>
                <span style={{
                  fontFamily: tokens.typography.fontFamily.mono,
                  fontSize:   tokens.typography.fontSize.xs,
                  color:      'var(--fujin-text-muted)',
                  wordBreak:  'break-all',
                }}>
                  {sets.dest_sets[name]}
                </span>
              </UnstyledButton>
            );
          })}
        </div>
      </div>

      <TextInput
        label="Subpath (optional)"
        placeholder="e.g. Movies/Action or leave blank for auto-suggestion"
        value={destSubpath}
        onChange={e => setDestSubpath(e.currentTarget.value)}
        radius={tokens.radius.default}
        styles={{
          label: {
            fontFamily:  tokens.typography.fontFamily.base,
            fontSize:    tokens.typography.fontSize.xs,
            fontWeight:  tokens.typography.fontWeight.semibold,
            color:       'var(--fujin-text-muted)',
            letterSpacing: tokens.typography.letterSpacing.wide,
            textTransform: 'uppercase',
          },
          input: {
            background:   'var(--fujin-bg-base)',
            border:       '1px solid var(--fujin-border-default)',
            color:        'var(--fujin-text-primary)',
            fontFamily:   tokens.typography.fontFamily.mono,
            fontSize:     tokens.typography.fontSize.sm,
            borderRadius: 0,
          },
        }}
      />

      <UnstyledButton
        onClick={handlePreview}
        disabled={!destSet || loading}
        style={{
          padding:     `${tokens.spacing.scale.sm}px ${tokens.spacing.scale.lg}px`,
          background:  !destSet || loading ? 'var(--fujin-interactive-disabled)' : 'var(--fujin-interactive-default)',
          color:       'var(--fujin-text-primary)',
          fontFamily:  tokens.typography.fontFamily.base,
          fontSize:    tokens.typography.fontSize.sm,
          fontWeight:  tokens.typography.fontWeight.medium,
          cursor:      !destSet || loading ? 'not-allowed' : 'pointer',
          opacity:     !destSet || loading ? tokens.opacity.disabled : 1,
          display:     'flex',
          alignItems:  'center',
          gap:         tokens.spacing.scale.xs,
          alignSelf:   'flex-start',
        }}
      >
        {loading ? <><Loader size={12} color="var(--fujin-text-muted)" /> Building preview…</> : 'Preview Link Plan'}
      </UnstyledButton>
    </div>
  );
}

export function validateDestStep(destSet: string | null, preview: unknown): true | string {
  if (!destSet) return 'Select a destination set.';
  if (!preview) return "Click 'Preview Link Plan' to generate a plan before continuing.";
  return true;
}
