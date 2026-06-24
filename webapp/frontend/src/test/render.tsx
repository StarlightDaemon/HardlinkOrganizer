import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { FujinThemeProvider, FujinToastProvider } from '@fujin';

// Mirrors the provider tree wired in src/main.tsx so component tests receive
// the same MantineProvider (via FujinThemeProvider) and toast context the real
// app runs with. AppStateProvider is intentionally NOT included here — it is
// owned by <App /> itself.
function Providers({ children }: { children: ReactNode }) {
  return (
    <FujinThemeProvider preset="violet" defaultMode="dark">
      <FujinToastProvider>{children}</FujinToastProvider>
    </FujinThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
