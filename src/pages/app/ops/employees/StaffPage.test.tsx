// @vitest-environment jsdom
/**
 * OPS-EMP-STAFF UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL StaffPage with the REAL api-employees fns mocked and proves:
 *  - module gate: with mod.employees OFF the page locks and NO data fn fires,
 *  - the staff table renders rows from listStaffProfiles,
 *  - the create flow calls createStaffProfile with the exact payload and
 *    refreshes the list,
 *  - a SCHEDULED assignment's Complete action calls
 *    updateServiceAssignmentStatus(id,'COMPLETED'),
 *  - a rejected create renders the inline error branch (modal stays open).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

vi.mock('../../../../lib/ops/useModules', () => ({ useModules: vi.fn() }));
vi.mock('../../../../lib/ops/api-employees', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-employees')>();
  return {
    ...real,
    listStaffProfiles: vi.fn(),
    createStaffProfile: vi.fn(),
    updateStaffProfile: vi.fn(),
    listProfileOptions: vi.fn(),
    listContactOptions: vi.fn(),
    listServiceAssignments: vi.fn(),
    createServiceAssignment: vi.fn(),
    updateServiceAssignmentStatus: vi.fn(),
    listEngagementOptions: vi.fn(),
    listServiceTypes: vi.fn(),
  };
});

import { useModules } from '../../../../lib/ops/useModules';
import {
  listStaffProfiles, createStaffProfile, listProfileOptions, listContactOptions,
  listServiceAssignments, updateServiceAssignmentStatus, listEngagementOptions, listServiceTypes,
} from '../../../../lib/ops/api-employees';
import { StaffPage } from './StaffPage';

const STAFF = {
  id: 'sp-1', org_id: 'org-1', profile_user_id: 'u-1', contact_id: null,
  title: 'Head Trainer', pay_type: 'SALARY', active: true,
  created_at: '', updated_at: '',
  profile: { user_id: 'u-1', first_name: 'Camille', last_name: 'Fournier', email: 'c@fhe.test' },
  contact: null,
};
const ASSIGNMENT = {
  id: 'sa-1', org_id: 'org-1', staff_profile_id: 'sp-1', engagement_id: null,
  service_type: 'RIDING_LESSON', scheduled_at: null, status: 'SCHEDULED' as const,
  created_at: '', updated_at: '',
  staff: { id: 'sp-1', title: 'Head Trainer', profile: { user_id: 'u-1', first_name: 'Camille', last_name: 'Fournier' } },
  engagement: null,
  service: { code: 'RIDING_LESSON', display_name: 'Riding Lesson' },
};

function modulesOn(on: boolean) {
  vi.mocked(useModules).mockReturnValue({ 'mod.employees': on } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  modulesOn(true);
  vi.mocked(listStaffProfiles).mockResolvedValue([STAFF] as never);
  vi.mocked(listServiceAssignments).mockResolvedValue([ASSIGNMENT] as never);
  vi.mocked(listProfileOptions).mockResolvedValue([
    { user_id: 'u-1', first_name: 'Camille', last_name: 'Fournier', email: 'c@fhe.test' },
    { user_id: 'u-2', first_name: 'Rex', last_name: 'Barnes', email: 'r@fhe.test' },
  ] as never);
  vi.mocked(listContactOptions).mockResolvedValue([] as never);
  vi.mocked(listEngagementOptions).mockResolvedValue([] as never);
  vi.mocked(listServiceTypes).mockResolvedValue([] as never);
});

describe('StaffPage', () => {
  it('locks and fetches nothing with mod.employees off', () => {
    modulesOn(false);
    renderWithRouter(<StaffPage />);
    expect(listStaffProfiles).not.toHaveBeenCalled();
    expect(listServiceAssignments).not.toHaveBeenCalled();
    expect(screen.queryByText('Camille Fournier')).not.toBeInTheDocument();
  });

  it('renders staff and assignments from the real list fns', async () => {
    renderWithRouter(<StaffPage />);
    expect((await screen.findAllByText('Camille Fournier')).length).toBeGreaterThan(0); // staff + assignments tables both show the name
    expect(screen.getByText('Head Trainer')).toBeInTheDocument();
    expect(screen.getByText('Riding Lesson')).toBeInTheDocument();
    expect(listStaffProfiles).toHaveBeenCalledWith();
  });

  it('creates a staff profile with the exact payload and refreshes', async () => {
    vi.mocked(createStaffProfile).mockResolvedValue(STAFF as never);
    renderWithRouter(<StaffPage />);
    await screen.findAllByText('Camille Fournier');

    await userEvent.click(screen.getByRole('button', { name: /add staff member/i }));
    await userEvent.selectOptions(screen.getByLabelText(/team member account/i), 'u-2');
    await userEvent.type(screen.getByLabelText(/title/i), 'Barn Manager');
    await userEvent.type(screen.getByLabelText(/pay type/i), 'HOURLY');
    await userEvent.click(screen.getByRole('button', { name: /create staff profile/i }));

    await waitFor(() => expect(createStaffProfile).toHaveBeenCalledWith({
      profile_user_id: 'u-2', contact_id: null, title: 'Barn Manager', pay_type: 'HOURLY',
    }));
    expect(listStaffProfiles).toHaveBeenCalledTimes(2); // initial + refresh
  });

  it("Complete transitions a SCHEDULED assignment via the real status fn", async () => {
    vi.mocked(updateServiceAssignmentStatus).mockResolvedValue({ ...ASSIGNMENT, status: 'COMPLETED' } as never);
    renderWithRouter(<StaffPage />);
    await screen.findByText('Riding Lesson');
    await userEvent.click(screen.getByRole('button', { name: /^complete$/i }));
    await waitFor(() => expect(updateServiceAssignmentStatus).toHaveBeenCalledWith('sa-1', 'COMPLETED'));
  });

  it('a rejected create renders the inline error and keeps the modal open', async () => {
    vi.mocked(createStaffProfile).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<StaffPage />);
    await screen.findAllByText('Camille Fournier');

    await userEvent.click(screen.getByRole('button', { name: /add staff member/i }));
    await userEvent.selectOptions(screen.getByLabelText(/team member account/i), 'u-2');
    await userEvent.click(screen.getByRole('button', { name: /create staff profile/i }));

    // The form error and AsyncButton's inline error both announce (re-throw path).
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('rls denied'))).toBe(true);
    expect(screen.getByRole('button', { name: /create staff profile/i })).toBeInTheDocument();
  });
});
