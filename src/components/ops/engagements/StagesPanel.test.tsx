// @vitest-environment jsdom
/**
 * OPS-ENG-STAGES UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL StagesPanel inside a route with an engagement id, mocks the
 * REAL data fns (listEngagementStages → [rows], createEngagementStage → row),
 * and proves the wiring:
 *   - existing stages render with a StatusBadge,
 *   - adding a stage fires createEngagementStage with
 *     {engagement_id (from prop), stage, retained_by, deal_side} EXACTLY, and
 *     the new row appears,
 *   - the error branch renders on rejection and nothing is appended,
 *   - ModuleGate-off (mod.brokerage disabled) locks the panel and hides the form
 *     so createEngagementStage never fires.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

vi.mock('../../../lib/api', () => ({
  listEngagementStages: vi.fn(),
  createEngagementStage: vi.fn(),
}));

// StagesPanel calls useModules() for its default gate; keep it enabled by
// default so tests that don't inject a map still render the form. Gating is
// exercised explicitly via the injected `modules` prop below.
vi.mock('../../../lib/ops/useModules', () => ({
  useModules: () => ({ 'mod.brokerage': true }),
}));

import { listEngagementStages, createEngagementStage } from '../../../lib/api';
import { StagesPanel } from './StagesPanel';
import type { EngagementStage } from '../../../lib/ops/types';

const listMock = vi.mocked(listEngagementStages);
const createMock = vi.mocked(createEngagementStage);

const ENGAGEMENT_ID = 'eng-77';
const ROUTE = `/app/ops/engagements/${ENGAGEMENT_ID}`;
const PATH = '/app/ops/engagements/:id';

const ON = { 'mod.brokerage': true };
const OFF = { 'mod.brokerage': false };

function makeStage(over: Partial<EngagementStage>): EngagementStage {
  return {
    id: 'stg-1',
    engagement_id: ENGAGEMENT_ID,
    stage: 'SEARCH',
    retained_by: 'buyer',
    deal_side: 'BUY',
    status: 'ACTIVE',
    fee_value_key: null,
    effective_from: '2026-07-01T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  createMock.mockResolvedValue(makeStage({ id: 'stg-new', stage: 'EVALUATION', status: 'ACTIVE' }));
});

describe('StagesPanel (OPS-ENG-STAGES)', () => {
  it('loads stages for the engagement on mount', async () => {
    renderWithRouter(<StagesPanel engagementId={ENGAGEMENT_ID} modules={ON} />, {
      route: ROUTE,
      path: PATH,
    });
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(ENGAGEMENT_ID));
  });

  it('renders existing stages with a StatusBadge', async () => {
    listMock.mockResolvedValueOnce([
      makeStage({ id: 'stg-a', stage: 'SEARCH', status: 'EXECUTED', fee_value_key: 'FEE.search' }),
    ]);
    renderWithRouter(<StagesPanel engagementId={ENGAGEMENT_ID} modules={ON} />, {
      route: ROUTE,
      path: PATH,
    });

    expect(await screen.findByText('SEARCH')).toBeInTheDocument();
    // StatusBadge renders the status text.
    expect(screen.getByText('EXECUTED')).toBeInTheDocument();
    expect(screen.getByText('FEE.search')).toBeInTheDocument();
  });

  it('adds a stage: createEngagementStage called with {engagement_id,stage,retained_by,deal_side} EXACTLY, then the row appears', async () => {
    const user = userEvent.setup();
    renderWithRouter(<StagesPanel engagementId={ENGAGEMENT_ID} modules={ON} />, {
      route: ROUTE,
      path: PATH,
    });
    await screen.findByText('No stages yet');

    await user.selectOptions(screen.getByLabelText('Stage'), 'EVALUATION');
    await user.selectOptions(screen.getByLabelText('Retained by'), 'seller');
    await user.selectOptions(screen.getByLabelText('Deal side'), 'SELL');
    await user.click(screen.getByRole('button', { name: 'Add stage' }));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      engagement_id: ENGAGEMENT_ID,
      stage: 'EVALUATION',
      retained_by: 'seller',
      deal_side: 'SELL',
    });

    // Success branch: the created stage now shows in the table.
    await waitFor(() => expect(screen.getByText('EVALUATION')).toBeInTheDocument());
  });

  it('renders the error branch on rejection and appends nothing', async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValueOnce(new Error('new row violates row-level security'));
    renderWithRouter(<StagesPanel engagementId={ENGAGEMENT_ID} modules={ON} />, {
      route: ROUTE,
      path: PATH,
    });
    await screen.findByText('No stages yet');

    await user.click(screen.getByRole('button', { name: 'Add stage' }));

    expect(createMock).toHaveBeenCalledWith({
      engagement_id: ENGAGEMENT_ID,
      stage: 'SEARCH',
      retained_by: 'buyer',
      deal_side: 'BUY',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'new row violates row-level security',
    );
    // Nothing was appended — still empty.
    expect(screen.getByText('No stages yet')).toBeInTheDocument();
  });

  it('ModuleGate-off: panel is locked and the add form is hidden (createEngagementStage never fires)', async () => {
    renderWithRouter(<StagesPanel engagementId={ENGAGEMENT_ID} modules={OFF} />, {
      route: ROUTE,
      path: PATH,
    });

    expect(await screen.findByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add stage' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Stage')).not.toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });
});
