import { useEffect, useState } from 'react';
import { TextInput, UnstyledButton, Loader } from '@mantine/core';
import { DataTable, SectionHeader, StatusBadge, type DataColumn } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../../state/AppState';
import { api } from '../../api/client';
import { useToast } from '@fujin';
import type { InventoryEntry, InventoryDetailResponse } from '../../api/types';

function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function BrowseStep() {
  const {
    sourceSet, inventory, entry, scanning,
    searchQuery, setInventory, setEntry, setSearchQuery, setScanning,
  } = useAppState();
  const { show } = useToast();
  const [hideLinked, setHideLinked] = useState(false);
  const [detailEntry, setDetailEntry] = useState<InventoryEntry | null>(null);
  const [detailData, setDetailData] = useState<InventoryDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function handleDetailClick(row: InventoryEntry) {
    if (detailEntry?.id === row.id) {
      setDetailEntry(null);
      setDetailData(null);
      return;
    }
    setDetailEntry(row);
    setDetailData(null);
    setLoadingDetail(true);
    try {
      const result = await api.getInventoryDetail(sourceSet!, row.full_path);
      setDetailData(result);
    } catch (err) {
      show({ status: 'danger', message: `Failed to load detail: ${(err as Error).message}` });
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    if (!sourceSet || inventory.length > 0) return;
    api.getInventory(sourceSet).then(r => setInventory(r.entries)).catch(err => {
      show({ status: 'danger', message: `Failed to load inventory: ${(err as Error).message}` });
    });
  }, [sourceSet]);

  async function handleRescan() {
    if (!sourceSet) return;
    setScanning(true);
    try {
      await api.scan(sourceSet);
      const r = await api.getInventory(sourceSet);
      setInventory(r.entries);
      show({ status: 'success', message: `${sourceSet} re-scanned.` });
    } catch (err) {
      show({ status: 'danger', message: `Re-scan failed: ${(err as Error).message}` });
    } finally {
      setScanning(false);
    }
  }

  const filtered = inventory.filter(e =>
    (searchQuery === '' ||
    e.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.real_name.toLowerCase().includes(searchQuery.toLowerCase())) &&
    !(hideLinked && (e.linked || e.already_linked))
  );

  const columns: DataColumn<InventoryEntry>[] = [
    {
      key: 'display_name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.base,
          fontSize:   tokens.typography.fontSize.sm,
          color:      'var(--fujin-text-primary)',
        }}>
          {row.display_name}
        </span>
      ),
    },
    {
      key: 'entry_type',
      label: 'Type',
      render: (row) => (
        <StatusBadge
          status={row.entry_type === 'file' ? 'info' : 'neutral'}
          label={row.entry_type}
        />
      ),
    },
    {
      key: 'size_bytes',
      label: 'Size',
      sortable: true,
      render: (row) => (
        <span style={{
          fontFamily: tokens.typography.fontFamily.mono,
          fontSize:   tokens.typography.fontSize.xs,
          color:      'var(--fujin-text-muted)',
        }}>
          {formatBytes(row.size_bytes)}
        </span>
      ),
    },
    {
      key: 'linked',
      label: 'Status',
      render: (row) => (
        row.linked
          ? <StatusBadge status='success' label='Linked (HLO)' />
          : row.already_linked
            ? (
              <UnstyledButton
                onClick={() => handleDetailClick(row)}
                style={{ cursor: 'pointer', display: 'inline-flex' }}
              >
                <StatusBadge
                  status={detailEntry?.id === row.id ? 'info' : 'warning'}
                  label='Linked (disk)'
                />
              </UnstyledButton>
            )
            : <StatusBadge status='neutral' label='Not linked' />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.md }}>
      <SectionHeader
        title={`Inventory — ${sourceSet ?? ''}`}
        description={`${inventory.length} entries`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.scale.sm }}>
            <UnstyledButton
              onClick={() => setHideLinked(v => !v)}
              style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.sm,
                color:      hideLinked ? 'var(--fujin-status-success)' : 'var(--fujin-text-primary)',
                cursor:     'pointer',
              }}
            >
              {hideLinked ? 'Show linked' : 'Hide linked'}
            </UnstyledButton>
            <UnstyledButton
              onClick={handleRescan}
              disabled={scanning}
              style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.sm,
                color:      scanning ? 'var(--fujin-text-muted)' : 'var(--fujin-text-primary)',
                cursor:     scanning ? 'not-allowed' : 'pointer',
                display:    'flex',
                alignItems: 'center',
                gap:        tokens.spacing.scale.xs,
              }}
            >
              {scanning ? <><Loader size={12} color="var(--fujin-text-muted)" /> Scanning…</> : 'Re-scan'}
            </UnstyledButton>
          </div>
        }
      />

      <TextInput
        placeholder="Search entries…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.currentTarget.value)}
        radius={tokens.radius.default}
        styles={{
          input: {
            background:  'var(--fujin-bg-base)',
            border:      '1px solid var(--fujin-border-default)',
            color:       'var(--fujin-text-primary)',
            fontFamily:  tokens.typography.fontFamily.base,
            fontSize:    tokens.typography.fontSize.sm,
            borderRadius: 0,
          },
        }}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey="id"
        loading={scanning && inventory.length === 0}
        pageSize={25}
        emptyMessage="No entries match your search."
        rowActions={(row) => (
          <UnstyledButton
            onClick={() => setEntry(row)}
            style={{
              fontFamily:  tokens.typography.fontFamily.base,
              fontSize:    tokens.typography.fontSize.xs,
              color:       row.id === entry?.id ? 'var(--fujin-status-success)' : 'var(--fujin-text-primary)',
              fontWeight:  tokens.typography.fontWeight.medium,
              cursor:      'pointer',
              padding:     `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
              border:      `1px solid ${row.id === entry?.id ? 'var(--fujin-status-success)' : 'var(--fujin-border-subtle)'}`,
            }}
          >
            {row.id === entry?.id ? '✓ Selected' : 'Select'}
          </UnstyledButton>
        )}
      />

      {detailEntry !== null && (
        <div style={{
          border:      '1px solid var(--fujin-border-default)',
          background:  'var(--fujin-bg-surface)',
          padding:     `${tokens.spacing.scale.md}px`,
          display:     'flex',
          flexDirection: 'column',
          gap:         `${tokens.spacing.scale.sm}px`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontFamily: tokens.typography.fontFamily.base,
              fontSize:   tokens.typography.fontSize.md,
              fontWeight: tokens.typography.fontWeight.semibold,
              color:      'var(--fujin-text-primary)',
            }}>
              {detailEntry.display_name} — Link Detail
            </span>
            <UnstyledButton
              onClick={() => { setDetailEntry(null); setDetailData(null); }}
              style={{
                fontFamily: tokens.typography.fontFamily.base,
                fontSize:   tokens.typography.fontSize.sm,
                color:      'var(--fujin-text-muted)',
                cursor:     'pointer',
              }}
            >
              ✕ Close
            </UnstyledButton>
          </div>

          {loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.spacing.scale.xs}px` }}>
              <Loader size={14} color="var(--fujin-text-muted)" />
              <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-muted)' }}>
                Loading…
              </span>
            </div>
          ) : detailData && (
            <>
              <div style={{
                fontFamily: tokens.typography.fontFamily.mono,
                fontSize:   tokens.typography.fontSize.xs,
                color:      'var(--fujin-text-muted)',
              }}>
                Inode: {detailData.inode ?? 'N/A'} | Hard links: {detailData.nlink ?? 'N/A'} | Device: {detailData.device_id ?? 'N/A'}
              </div>

              <div>
                <div style={{
                  fontFamily: tokens.typography.fontFamily.base,
                  fontSize:   tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color:      'var(--fujin-text-primary)',
                  marginBottom: `${tokens.spacing.scale.xs}px`,
                }}>
                  HLO Link History
                </div>
                {detailData.hlo_links.length === 0 ? (
                  <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-muted)' }}>
                    Not managed by HLO — linked by an external process.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.spacing.scale.xs}px` }}>
                    {detailData.hlo_links.map(link => (
                      <div key={link.id} style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-secondary)' }}>
                        {link.dest_full}  ({link.linked_at})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{
                  fontFamily: tokens.typography.fontFamily.base,
                  fontSize:   tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color:      'var(--fujin-text-primary)',
                  marginBottom: `${tokens.spacing.scale.xs}px`,
                }}>
                  Hardlink Peers
                </div>
                {detailData.inode_peers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.spacing.scale.xs}px` }}>
                    {detailData.inode_peers.map(peer => (
                      <div key={peer.id} style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--fujin-text-secondary)' }}>
                        {peer.display_name}  ({peer.full_path})
                      </div>
                    ))}
                  </div>
                ) : detailEntry.entry_type === 'dir' ? (
                  <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-muted)' }}>
                    Peer grouping not available for directory entries.
                  </span>
                ) : (
                  <span style={{ fontFamily: tokens.typography.fontFamily.base, fontSize: tokens.typography.fontSize.sm, color: 'var(--fujin-text-muted)' }}>
                    No peers found in this source set.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function validateBrowseStep(entry: InventoryEntry | null): true | string {
  if (!entry) return 'Select an entry to continue.';
  return true;
}
