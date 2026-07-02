// @vitest-environment jsdom
/**
 * MEMBER-ENG-DETAIL UI wiring test (StaffPage pattern): the REAL page with the
 * REAL data seams mocked. Proves:
 *  - stages, documents (with status), and the required signing set render from
 *    the real wrapper fns (getMyEngagement / listRequiredDocuments /
 *    templateKeysById), keyed off the route param,
 *  - required-set rows show Signed / in-progress / Not started correctly by
 *    matching documents' template_id → template_key,
 *  - an engagement RLS filters away renders the not-yours branch,
 *  - MyEngagements (list) renders the member's engagements.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../test/render';

vi.mock('../../lib/ops/api-client', () => ({
  getMyEngagement: vi.fn(),
  templateKeysById: vi.fn(),
  listMyEngagements: vi.fn(),
}));
vi.mock('../../lib/ops/api-releases', () => ({ listRequiredDocuments: vi.fn() }));

import { getMyEngagement, templateKeysById, listMyEngagements } from '../../lib/ops/api-client';
import { listRequiredDocuments } from '../../lib/ops/api-releases';
import MyEngagementDetail from './MyEngagementDetail';
import MyEngagements from './MyEngagements';

const ENG = {
  id: 'eng-1', display_code: 'ENG-2026-000001', client_id: 'cli-1', assigned_staff_id: null,
  service_type: 'RIDING_LESSON', status: 'AWAITING_SIGNATURE', primary_horse_id: null,
  start_date: '2026-07-01', notes: null, created_at: '2026-07-01T00:00:00Z', updated_at: '',
};
const DETAIL = {
  ...ENG,
  stages: [{
    id: 'st-1', engagement_id: 'eng-1', stage: 'SEARCH' as const, retained_by: 'buyer',
    deal_side: 'BUY' as const, status: 'OPEN', fee_value_key: null,
    effective_from: '2026-07-01T00:00:00Z', created_at: '', updated_at: '',
  }],
  documents: [
    { id: 'doc-1', display_code: 'DOC-000001', engagement_id: 'eng-1', template_id: 'tpl-release',
      title: 'Participant Liability Release', merged_body: null, status: 'EXECUTED',
      generated_at: '2026-07-01T00:00:00Z', effective_date: '2026-07-01', created_at: '', updated_at: '' },
    { id: 'doc-2', display_code: 'DOC-000002', engagement_id: 'eng-1', template_id: 'tpl-rules',
      title: 'Facility Rules', merged_body: null, status: 'AWAITING_SIGNATURE',
      generated_at: '2026-07-01T00:00:00Z', effective_date: null, created_at: '', updated_at: '' },
  ],
  parties: [{ id: 'p-1', engagement_id: 'eng-1', contact_id: 'con-1', party_role: 'CLIENT' as const, is_signer: true, signer_order: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyEngagement).mockResolvedValue(DETAIL);
  vi.mocked(templateKeysById).mockResolvedValue({
    'tpl-release': 'RELEASE_PARTICIPANT', 'tpl-rules': 'FACILITY_RULES',
  });
  vi.mocked(listRequiredDocuments).mockResolvedValue([
    'FACILITY_RULES', 'HUMAN_EMERGENCY_MEDICAL', 'RELEASE_PARTICIPANT',
  ]);
});

const renderDetail = () =>
  renderWithRouter(<MyEngagementDetail />, {
    route: '/app/engagements/eng-1',
    path: '/app/engagements/:id',
  });

describe('MyEngagementDetail', () => {
  it('loads by the route param and renders stages + documents with status', async () => {
    renderDetail();
    expect(await screen.findByText('Riding Lesson')).toBeInTheDocument();
    expect(getMyEngagement).toHaveBeenCalledWith('eng-1');
    expect(listRequiredDocuments).toHaveBeenCalledWith('RIDING_LESSON');
    // stage
    expect(screen.getByText('Search')).toBeInTheDocument();
    // documents with status
    expect(screen.getByText('Participant Liability Release')).toBeInTheDocument();
    expect(screen.getAllByText('Facility Rules').length).toBeGreaterThan(0); // document title + required-set label
    expect(screen.getAllByText('Executed').length).toBeGreaterThan(0);
  });

  it('required signing set: Signed / in-progress / Not started per matrix key', async () => {
    renderDetail();
    await screen.findByText('Required signing set');
    // RELEASE_PARTICIPANT executed → Signed
    expect(screen.getByText('Release Participant')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
    // FACILITY_RULES exists but awaiting → its status label (within the required list too)
    expect(screen.getAllByText('Awaiting Signature').length).toBeGreaterThan(0);
    // HUMAN_EMERGENCY_MEDICAL has no document → Not started
    expect(screen.getByText('Human Emergency Medical')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('renders the not-yours branch when RLS returns nothing', async () => {
    vi.mocked(getMyEngagement).mockResolvedValue(null);
    renderDetail();
    expect(await screen.findByText(/doesn't exist or isn't yours/i)).toBeInTheDocument();
    expect(listRequiredDocuments).not.toHaveBeenCalled();
  });
});

describe('MyEngagements (list)', () => {
  it('renders the member\'s engagements from listMyEngagements', async () => {
    vi.mocked(listMyEngagements).mockResolvedValue([ENG]);
    renderWithRouter(<MyEngagements />);
    expect(await screen.findByText('Riding Lesson')).toBeInTheDocument();
    expect(screen.getByText(/ENG-2026-000001/)).toBeInTheDocument();
    expect(listMyEngagements).toHaveBeenCalledWith();
  });

  it('renders the empty state when the member has none', async () => {
    vi.mocked(listMyEngagements).mockResolvedValue([]);
    renderWithRouter(<MyEngagements />);
    expect(await screen.findByText(/no engagements yet/i)).toBeInTheDocument();
  });
});
