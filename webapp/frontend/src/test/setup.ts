import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// ---------------------------------------------------------------------------
// jsdom polyfills required by Mantine components under test.
// ---------------------------------------------------------------------------

// Mantine's color-scheme machinery and several components query matchMedia,
// which jsdom does not implement.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Some Mantine overlays (Popover/Menu/ScrollArea) construct a ResizeObserver.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// The toast provider mints ids with crypto.randomUUID(); guarantee it exists.
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID !== 'function') {
  let n = 0;
  const randomUUID = () =>
    `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { ...(globalThis.crypto ?? {}), randomUUID },
  });
}

// ---------------------------------------------------------------------------
// MSW lifecycle.
// ---------------------------------------------------------------------------

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });

  // The API client calls fetch('/api/...') with relative paths. Node's fetch
  // (which MSW patches) cannot parse a relative URL, so resolve it against the
  // jsdom origin before MSW sees it. Installed after listen() so this wrapper
  // sits outermost and hands MSW an absolute URL.
  const mswFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = new URL(input, window.location.origin).href;
    }
    return mswFetch(input, init);
  }) as typeof fetch;
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());
