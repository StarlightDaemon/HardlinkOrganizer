import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from './render';
import { App } from '../App';
import { DEST_SET, inventoryResponse, previewResponse } from './msw/handlers';

/**
 * End-to-end UI test of the Source → Browse → Destination → Preview → Result
 * workflow. The real component tree (App + Mantine Stepper steps) drives the
 * flow; every HTTP call is served by MSW. No module mocks.
 */
describe('scan → preview → execute workflow', () => {
  it('scans, previews the link plan, executes, and shows success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    // --- Step 1: Source — scan + select the source set ----------------------
    // Card (and its "Scan & Select" button) appears once GET /api/config/sets
    // resolves.
    await user.click(await screen.findByRole('button', { name: 'Scan & Select' }));
    // The scan-complete toast fires right after sourceSet is committed, so its
    // presence is a reliable signal that POST /api/scan finished.
    await screen.findByText('Scan complete');

    await user.click(screen.getByRole('button', { name: /Next/ }));

    // --- Step 2: Browse — inventory loads, select the entry -----------------
    const entryName = inventoryResponse.entries[0].display_name;
    await screen.findByText(entryName); // rendered from GET /api/inventory
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await user.click(screen.getByRole('button', { name: /Next/ }));

    // --- Step 3: Destination — pick dest set, build the preview -------------
    await user.click(await screen.findByRole('button', { name: new RegExp(DEST_SET) }));
    await user.click(screen.getByRole('button', { name: 'Preview Link Plan' }));
    // POST /api/preview returns a warning; DestStep raises a "Warnings" toast on
    // success, confirming the preview resolved into state.
    await screen.findByText('Warnings');

    await user.click(screen.getByRole('button', { name: /Next/ }));

    // --- Assert: the preview/link plan reflects the MSW /api/preview payload -
    expect(await screen.findByText('Plan valid')).toBeInTheDocument();
    expect(screen.getByText(previewResponse.dest_full)).toBeInTheDocument();

    // --- Step 4: Preview — confirm execution --------------------------------
    await user.click(screen.getByRole('button', { name: 'Execute' }));
    // Success toast confirms POST /api/execute resolved into a result.
    await screen.findByText('Links created');

    await user.click(screen.getByRole('button', { name: /Next/ }));

    // --- Assert: the completion/success state is visible --------------------
    expect(await screen.findByText('Execution Result')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  }, 20000);
});
