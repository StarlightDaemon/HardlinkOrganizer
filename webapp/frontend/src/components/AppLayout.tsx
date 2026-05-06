import React from 'react';
import { UnstyledButton } from '@mantine/core';
import tokens from '@tokens';
import { useAppState } from '../state/AppState';

const HEADER_HEIGHT = 48;
const SIDEBAR_WIDTH = 320;

interface AppLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  const { view, setView, healthOk } = useAppState();

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      minHeight:      '100vh',
      background:     'var(--fujin-bg-base)',
      fontFamily:     tokens.typography.fontFamily.base,
    }}>
      {/* Fixed header */}
      <div style={{
        position:       'fixed',
        top:            0,
        left:           0,
        right:          0,
        height:         HEADER_HEIGHT,
        zIndex:         100,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        `0 ${tokens.spacing.scale.xl}px`,
        background:     'var(--fujin-bg-surface)',
        borderBottom:   '1px solid var(--fujin-border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.scale.md }}>
          {/* Status dot */}
          <div style={{
            width:        8,
            height:       8,
            borderRadius: 0,
            background:   healthOk ? 'var(--fujin-status-success)' : 'var(--fujin-text-muted)',
            flexShrink:   0,
          }} />
          <span style={{
            fontFamily:  tokens.typography.fontFamily.base,
            fontWeight:  tokens.typography.fontWeight.semibold,
            fontSize:    tokens.typography.fontSize.lg,
            color:       'var(--fujin-text-primary)',
            letterSpacing: tokens.typography.letterSpacing.tight,
          }}>
            Hardlink Organizer
          </span>
          <span style={{
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.xs,
            color:      'var(--fujin-text-muted)',
          }}>
            v0.3.0
          </span>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.scale.md }}>
          <NavTab
            label="Workflow"
            active={view === 'workflow'}
            onClick={() => setView('workflow')}
          />
          <NavTab
            label="Destination Registry"
            active={view === 'destinations'}
            onClick={() => setView('destinations')}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{
        display:   'flex',
        flexDirection: 'row',
        marginTop: HEADER_HEIGHT,
        flex:      1,
        minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
      }}>
        {/* Main content */}
        <main style={{
          flex:       1,
          overflowY:  'auto',
          padding:    tokens.spacing.scale.xl,
          minWidth:   0,
        }}>
          {children}
        </main>

        {/* History sidebar */}
        <aside style={{
          width:        SIDEBAR_WIDTH,
          flexShrink:   0,
          borderLeft:   '1px solid var(--fujin-border-subtle)',
          overflowY:    'auto',
          background:   'var(--fujin-bg-surface)',
        }}>
          {sidebar}
        </aside>
      </div>
    </div>
  );
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        fontFamily:    tokens.typography.fontFamily.base,
        fontSize:      tokens.typography.fontSize.sm,
        fontWeight:    active ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular,
        color:         active ? 'var(--fujin-text-primary)' : 'var(--fujin-text-muted)',
        padding:       `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
        borderBottom:  active ? '2px solid var(--fujin-border-strong)' : '2px solid transparent',
        cursor:        'pointer',
        transition:    `color ${tokens.transition.duration.base} ${tokens.transition.easing.default}`,
      }}
    >
      {label}
    </UnstyledButton>
  );
}
