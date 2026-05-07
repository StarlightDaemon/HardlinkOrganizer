import { UnstyledButton } from '@mantine/core';
import { ThemeMenu } from '@fujin';
import tokens from '@tokens';
import { useAppState } from '../state/AppState';

const HEADER_HEIGHT    = 48;
const STATUSBAR_HEIGHT = 28;
const SIDEBAR_WIDTH    = 320;

interface AppLayoutProps {
  children: React.ReactNode;
  sidebar:  React.ReactNode;
}

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  const { view, setView, healthOk } = useAppState();

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      minHeight:     '100vh',
      background:    'var(--fujin-bg-base)',
      fontFamily:    tokens.typography.fontFamily.base,
    }}>
      {/* Fixed header — uses chrome vars: dark in both light and dark mode */}
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
        background:     'var(--fujin-chrome-bg)',
        borderBottom:   '1px solid var(--fujin-chrome-border)',
      }}>
        <span style={{
          fontFamily:    tokens.typography.fontFamily.base,
          fontWeight:    tokens.typography.fontWeight.semibold,
          fontSize:      tokens.typography.fontSize.lg,
          color:         'var(--fujin-chrome-text)',
          letterSpacing: tokens.typography.letterSpacing.tight,
        }}>
          Hardlink Organizer
        </span>

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
        display:       'flex',
        flexDirection: 'row',
        marginTop:     HEADER_HEIGHT,
        marginBottom:  STATUSBAR_HEIGHT,
        flex:          1,
        minHeight:     `calc(100vh - ${HEADER_HEIGHT + STATUSBAR_HEIGHT}px)`,
      }}>
        {/* Main content */}
        <main style={{
          flex:      1,
          overflowY: 'auto',
          padding:   tokens.spacing.scale.xl,
          minWidth:  0,
        }}>
          {children}
        </main>

        {/* History sidebar — bg-elevated distinguishes it from main content */}
        <aside style={{
          width:      SIDEBAR_WIDTH,
          flexShrink: 0,
          borderLeft: '1px solid var(--fujin-chrome-border)',
          overflowY:  'auto',
          background: 'var(--fujin-bg-elevated)',
        }}>
          {sidebar}
        </aside>
      </div>

      {/* Fixed status bar — uses chrome vars: dark in both modes */}
      <div style={{
        position:       'fixed',
        bottom:         0,
        left:           0,
        right:          0,
        height:         STATUSBAR_HEIGHT,
        zIndex:         100,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        `0 ${tokens.spacing.scale.xl}px`,
        background:     'var(--fujin-chrome-bg)',
        borderTop:      '1px solid var(--fujin-chrome-border)',
      }}>
        {/* Left: health + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.scale.sm }}>
          <div style={{
            width:      6,
            height:     6,
            flexShrink: 0,
            background: healthOk ? 'var(--fujin-status-success)' : 'var(--fujin-chrome-text)',
            opacity:    healthOk ? 1 : 0.4,
          }} />
          <span style={{
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.xs,
            color:      'var(--fujin-chrome-text)',
            opacity:    0.7,
          }}>
            {healthOk ? 'connected' : 'disconnected'}
          </span>
          <span style={{
            fontFamily: tokens.typography.fontFamily.base,
            fontSize:   tokens.typography.fontSize.xs,
            color:      'var(--fujin-chrome-text)',
            opacity:    0.4,
          }}>
            v0.3.0
          </span>
        </div>

        {/* Right: theme menu */}
        <ThemeMenu />
      </div>
    </div>
  );
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        fontFamily:   tokens.typography.fontFamily.base,
        fontSize:     tokens.typography.fontSize.sm,
        fontWeight:   active ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular,
        color:        active ? 'var(--fujin-chrome-text)' : 'var(--fujin-chrome-text)',
        opacity:      active ? 1 : 0.55,
        padding:      `${tokens.spacing.scale.xs}px ${tokens.spacing.scale.sm}px`,
        borderBottom: active ? '2px solid var(--fujin-chrome-text)' : '2px solid transparent',
        cursor:       'pointer',
        transition:   `opacity ${tokens.transition.duration.base} ${tokens.transition.easing.default}`,
      }}
    >
      {label}
    </UnstyledButton>
  );
}
