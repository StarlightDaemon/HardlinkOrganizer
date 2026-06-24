import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Node-side MSW server used by the vitest suite. Configured once and reused;
// lifecycle (listen/resetHandlers/close) is driven from src/test/setup.ts.
export const server = setupServer(...handlers);
