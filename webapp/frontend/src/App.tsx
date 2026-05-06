import React from 'react';
import { WorkflowStepper } from '@fujin';
import tokens from '@tokens';
import { AppStateProvider, useAppState } from './state/AppState';
import { AppLayout } from './components/AppLayout';
import { HistorySidebar } from './components/HistorySidebar';
import { VerifyPanel } from './components/VerifyPanel';
import { DestRegistry } from './components/DestRegistry';
import { SourceStep, validateSourceStep } from './components/steps/SourceStep';
import { BrowseStep, validateBrowseStep } from './components/steps/BrowseStep';
import { DestStep, validateDestStep } from './components/steps/DestStep';
import { PreviewStep, validatePreviewStep } from './components/steps/PreviewStep';
import { ResultStep } from './components/steps/ResultStep';

function WorkflowView() {
  const { step, sourceSet, entry, destSet, preview } = useAppState();

  if (step === 'verify') {
    return <VerifyPanel />;
  }

  return (
    <WorkflowStepper
      allowStepClick
      steps={[
        {
          label:    'Source',
          content:  <SourceStep />,
          validate: () => validateSourceStep(sourceSet),
        },
        {
          label:    'Browse',
          content:  <BrowseStep />,
          validate: () => validateBrowseStep(entry),
        },
        {
          label:    'Destination',
          content:  <DestStep />,
          validate: () => validateDestStep(destSet, preview),
        },
        {
          label:    'Preview',
          content:  <PreviewStep />,
          validate: () => validatePreviewStep(preview),
        },
        {
          label:   'Result',
          content: <ResultStep />,
        },
      ]}
    />
  );
}

function AppShell() {
  const { view } = useAppState();

  return (
    <AppLayout sidebar={<HistorySidebar />}>
      <div style={{
        maxWidth:  900,
        width:     '100%',
        display:   'flex',
        flexDirection: 'column',
        gap:       tokens.spacing.scale.xl,
      }}>
        {view === 'destinations' ? <DestRegistry /> : <WorkflowView />}
      </div>
    </AppLayout>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}
