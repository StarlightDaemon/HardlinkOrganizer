import { useEffect } from 'react';
import { TextInput, UnstyledButton, Loader } from '@mantine/core';
import { DataTable, SectionHeader, StatusBadge, type DataColumn } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../../state/AppState';
import { api } from '../../api/client';
import { useToast } from '@fujin';
import type { InventoryEntry } from '../../api/types';

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
    searchQuery === '' ||
    e.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.real_name.toLowerCase().includes(searchQuery.toLowerCase())
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
      label: 'Linked',
      render: (row) => (
        <StatusBadge
          status={row.linked ? 'success' : 'neutral'}
          label={row.linked ? 'Linked' : 'Not linked'}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.scale.md }}>
      <SectionHeader
        title={`Inventory — ${sourceSet ?? ''}`}
        description={`${inventory.length} entries`}
        action={
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
    </div>
  );
}

export function validateBrowseStep(entry: InventoryEntry | null): true | string {
  if (!entry) return 'Select an entry to continue.';
  return true;
}
