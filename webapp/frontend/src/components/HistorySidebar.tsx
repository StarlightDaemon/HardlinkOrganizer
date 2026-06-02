import { useState } from 'react';
import { UnstyledButton, Loader } from '@mantine/core';
import { SectionHeader, StatusBadge } from '@fujin';
import { useToast } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../state/AppState';
import { api } from '../api/client';
import type { HistoryEntry } from '../api/types';

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const { setStep, setVerifyRun } = useAppState();
  const { show } = useToast();
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    try {
      const { run_id } = await api.triggerVerify({ mode: 'link_history', link_history_id: entry.id });
      const run = await api.getVerifyRun(run_id);
      setVerifyRun(run);
      setStep('verify');
    } catch (err) {
      show({ status: 'danger', message: `Verify failed: ${(err as Error).message}` });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{
      padding:       `${tokens.spacing.scale.sm}px ${tokens.spacing.scale.md}px`,
      borderBottom:  '1px solid var(--fujin-border-subtle)',
      display:       'flex',
      flexDirection: 'column',
      gap:           tokens.spacing.scale.xs,
    }}>
      <div style={{
        fontFamily:  tokens.typography.fontFamily.base,
        fontSize:    tokens.typography.fontSize.sm,
        fontWeight:  tokens.typography.fontWeight.medium,
        color:       'var(--fujin-text-primary)',
        wordBreak:   'break-word',
      }}>
        {entry.display_name ?? entry.real_name}
      </div>

      <div style={{
        fontFamily: tokens.typography.fontFamily.base,
        fontSize:   tokens.typography.fontSize.xs,
        color:      'var(--fujin-text-muted)',
        wordBreak:  'break-word',
      }}>
        {entry.source_set} → {entry.dest_set}
      </div>

      <div style={{
        fontFamily: tokens.typography.fontFamily.base,
        fontSize:   tokens.typography.fontSize.xs,
        color:      'var(--fujin-text-muted)',
      }}>
        {formatTime(entry.linked_at)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.scale.xs }}>
        {entry.dry_run && <StatusBadge status="neutral" label="Dry run" />}
        {entry.linked_count > 0 && (
          <StatusBadge status="success" label={`${entry.linked_count} linked`} />
        )}
        {entry.failed_count > 0 && (
          <StatusBadge status="danger" label={`${entry.failed_count} failed`} />
        )}
      </div>

      <UnstyledButton
        onClick={handleVerify}
        disabled={verifying}
        style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.xs,
          color:      verifying ? 'var(--fujin-text-muted)' : 'var(--fujin-text-primary)',
          cursor:     verifying ? 'not-allowed' : 'pointer',
          border:     '1px solid var(--fujin-border-subtle)',
          padding:    `${tokens.spacing.scale.xxs}px ${tokens.spacing.scale.xs}px`,
          display:    'flex',
          alignItems: 'center',
          gap:        tokens.spacing.scale.xs,
          alignSelf:  'flex-start',
        }}
      >
        {verifying ? <><Loader size={10} color="var(--fujin-text-muted)" /> Verifying…</> : 'Verify'}
      </UnstyledButton>
    </div>
  );
}

export function HistorySidebar() {
  const {
    history, refreshHistory,
    detailEntry, detailData, loadingDetail,
    setDetailEntry, setDetailData,
  } = useAppState();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await refreshHistory(); } finally { setRefreshing(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Link detail panel — shown when user clicks a "Linked (disk)" badge in Browse */}
      {detailEntry !== null && (
        <div style={{
          borderBottom: '1px solid var(--fujin-border-default)',
          padding:      `${tokens.spacing.scale.md}px`,
          display:      'flex',
          flexDirection: 'column',
          gap:          `${tokens.spacing.scale.sm}px`,
          flexShrink:   0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color:      'var(--fujin-text-primary)',
              wordBreak:  'break-word',
              flex:       1,
              marginRight: tokens.spacing.scale.xs,
            }}>
              {detailEntry.display_name}
            </span>
            <UnstyledButton
              onClick={() => { setDetailEntry(null); setDetailData(null); }}
              style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.xs,
                color:      'var(--fujin-text-muted)',
                cursor:     'pointer',
                flexShrink: 0,
              }}
            >
              ✕
            </UnstyledButton>
          </div>

          {loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.spacing.scale.xs}px` }}>
              <Loader size={12} color="var(--fujin-text-muted)" />
              <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)' }}>
                Loading…
              </span>
            </div>
          ) : detailData && (
            <>
              <div style={{
                fontFamily: tokens.typography.fontFamily.mono,
                fontSize:   tokens.typography.fontSize.xs,
                color:      'var(--fujin-text-muted)',
                wordBreak:  'break-all',
              }}>
                Inode: {detailData.inode ?? 'N/A'}<br />
                Hard links: {detailData.nlink ?? 'N/A'}<br />
                Device: {detailData.device_id ?? 'N/A'}
              </div>

              <div>
                <div style={{
                  fontFamily:   tokens.typography.fontFamily.base,
                  fontSize:     tokens.typography.fontSize.xs,
                  fontWeight:   tokens.typography.fontWeight.medium,
                  color:        'var(--fujin-text-primary)',
                  marginBottom: `${tokens.spacing.scale.xs}px`,
                }}>
                  HLO Link History
                </div>
                {detailData.hlo_links.length === 0 ? (
                  <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)' }}>
                    Not managed by HLO — linked externally.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.spacing.scale.xs}px` }}>
                    {detailData.hlo_links.map(link => (
                      <div key={link.id} style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-secondary)', wordBreak: 'break-all' }}>
                        {link.dest_full}<br />
                        <span style={{ color: 'var(--fujin-text-muted)' }}>{link.linked_at}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{
                  fontFamily:   tokens.typography.fontFamily.base,
                  fontSize:     tokens.typography.fontSize.xs,
                  fontWeight:   tokens.typography.fontWeight.medium,
                  color:        'var(--fujin-text-primary)',
                  marginBottom: `${tokens.spacing.scale.xs}px`,
                }}>
                  Hardlink Peers
                </div>
                {detailData.inode_peers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.spacing.scale.xs}px` }}>
                    {detailData.inode_peers.map(peer => (
                      <div key={peer.id} style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-secondary)', wordBreak: 'break-all' }}>
                        {peer.display_name}
                      </div>
                    ))}
                  </div>
                ) : detailEntry.entry_type === 'dir' ? (
                  <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)' }}>
                    Not available for directories.
                  </span>
                ) : (
                  <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-muted)' }}>
                    No peers in this source set.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Recent operations history */}
      <div style={{ padding: `${tokens.spacing.scale.md}px ${tokens.spacing.scale.md}px 0` }}>
        <SectionHeader
          title="Recent Operations"
          action={
            <UnstyledButton
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.xs,
                color:      refreshing ? 'var(--fujin-text-muted)' : 'var(--fujin-text-primary)',
                cursor:     refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              {refreshing ? <Loader size={10} color="var(--fujin-text-muted)" /> : '↻'}
            </UnstyledButton>
          }
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginTop: tokens.spacing.scale.md }}>
        {history.length === 0 ? (
          <div style={{
            padding:    tokens.spacing.scale.md,
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.sm,
            color:      'var(--fujin-text-muted)',
          }}>
            No operations yet.
          </div>
        ) : (
          history.map(entry => <HistoryItem key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
