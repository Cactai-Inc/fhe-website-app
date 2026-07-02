// @vitest-environment jsdom
/**
 * OPS-DOC-GEN UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL GenerateDocumentModal, mocks the REAL data fns
 * (listContractTemplates → [templates], generateDocument → {document_id,
 * merged_body}), and proves the wiring end-to-end:
 *   - templates render (key + title),
 *   - the confirm control is DISABLED until a template is explicitly picked —
 *     no default template_key is ever sent to generate_document,
 *   - picking + confirming calls generateDocument(engagementId, chosenKey)
 *     EXACTLY,
 *   - the success branch surfaces the returned document_id (+ handoff to the
 *     viewer via onGenerated),
 *   - the error branch renders on rejection and the modal STAYS OPEN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

// Mock the real api module — the fns the modal actually imports and calls.
vi.mock('../../../lib/api', () => ({
  listContractTemplates: vi.fn(),
  generateDocument: vi.fn(),
}));
// …and the lane-owned requirements seam (contract_requirements matrix).
vi.mock('../../../lib/ops/api-releases', () => ({
  listRequiredDocuments: vi.fn(),
}));

import { listContractTemplates, generateDocument } from '../../../lib/api';
import { listRequiredDocuments } from '../../../lib/ops/api-releases';
import { GenerateDocumentModal } from './GenerateDocumentModal';
import type { ContractTemplate } from '../../../lib/ops/types';

const listMock = vi.mocked(listContractTemplates);
const genMock = vi.mocked(generateDocument);
const requiredMock = vi.mocked(listRequiredDocuments);

const ENGAGEMENT_ID = 'eng-123';

const TEMPLATES: ContractTemplate[] = [
  {
    id: 't1',
    template_key: 'purchase_agreement',
    title: 'Purchase Agreement',
    service_type: 'brokerage',
    party_namespaces: ['BUYER', 'SELLER'],
    version: 1,
    active: true,
  },
  {
    id: 't2',
    template_key: 'lease_agreement',
    title: 'Lease Agreement',
    service_type: 'brokerage',
    party_namespaces: ['LESSOR', 'LESSEE'],
    version: 1,
    active: true,
  },
];

const RELEASE_TEMPLATES: ContractTemplate[] = [
  ...TEMPLATES,
  {
    id: 't3',
    template_key: 'RELEASE_PARTICIPANT',
    title: 'Participant Liability Release',
    service_type: null,
    party_namespaces: ['PARTICIPANT', 'GUARDIAN', 'COMPANY'],
    version: 1,
    active: true,
  },
  {
    id: 't4',
    template_key: 'FACILITY_RULES',
    title: 'Facility Rules and Safety Acknowledgment',
    service_type: null,
    party_namespaces: ['CLIENT', 'COMPANY'],
    version: 1,
    active: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue(TEMPLATES);
  requiredMock.mockResolvedValue([]);
  genMock.mockResolvedValue({ document_id: 'DOC-9', merged_body: 'Merged body text' });
});

describe('GenerateDocumentModal (OPS-DOC-GEN)', () => {
  it('renders every template (key + title) once opened', async () => {
    renderWithRouter(
      <GenerateDocumentModal open onClose={vi.fn()} engagementId={ENGAGEMENT_ID} />,
    );

    expect(await screen.findByText('Purchase Agreement')).toBeInTheDocument();
    expect(screen.getByText('lease_agreement')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT send a default template_key: Generate is disabled until a pick', async () => {
    renderWithRouter(
      <GenerateDocumentModal open onClose={vi.fn()} engagementId={ENGAGEMENT_ID} />,
    );
    await screen.findByText('Purchase Agreement');

    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    expect(generateBtn).toBeDisabled();
    expect(genMock).not.toHaveBeenCalled();
  });

  it('picks a template + confirms → generateDocument(engagementId, chosenKey) EXACTLY, then surfaces document_id', async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    renderWithRouter(
      <GenerateDocumentModal
        open
        onClose={vi.fn()}
        engagementId={ENGAGEMENT_ID}
        onGenerated={onGenerated}
      />,
    );
    await screen.findByText('Lease Agreement');

    await user.click(screen.getByRole('radio', { name: /Lease Agreement/ }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    // The REAL data fn was called with the engagement id + the CHOSEN key, exactly.
    expect(genMock).toHaveBeenCalledTimes(1);
    expect(genMock).toHaveBeenCalledWith(ENGAGEMENT_ID, 'lease_agreement');

    // Success branch surfaces the returned document_id and hands it to the viewer.
    expect(await screen.findByText('DOC-9')).toBeInTheDocument();
    expect(onGenerated).toHaveBeenCalledWith('DOC-9');
  });

  it('renders the required signing set for the engagement service (On file vs Needed)', async () => {
    listMock.mockResolvedValue(RELEASE_TEMPLATES);
    // The matrix for the engagement's service_type (contract_requirements).
    requiredMock.mockResolvedValue(['FACILITY_RULES', 'RELEASE_PARTICIPANT']);

    renderWithRouter(
      <GenerateDocumentModal
        open
        onClose={vi.fn()}
        engagementId={ENGAGEMENT_ID}
        serviceType="RIDING_LESSON"
        // FACILITY_RULES (t4) already generated on the engagement; the release is not.
        existingTemplateIds={['t4']}
      />,
    );

    expect(
      await screen.findByText('Required signing set for this engagement'),
    ).toBeInTheDocument();
    expect(requiredMock).toHaveBeenCalledWith('RIDING_LESSON');

    // Both matrix docs render in the required section (they also appear once
    // more in the full list below — hence getAllByText).
    expect(screen.getAllByText('Participant Liability Release').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByText('Facility Rules and Safety Acknowledgment').length,
    ).toBeGreaterThanOrEqual(2);

    // Existence status: FACILITY_RULES is on file, the release is still needed.
    expect(screen.getByText('On file')).toBeInTheDocument();
    expect(screen.getByText('Needed')).toBeInTheDocument();

    // The full template list still renders below the required section.
    expect(screen.getByText('Purchase Agreement')).toBeInTheDocument();
  });

  it('renders NO required section when the matrix has no rows for the service', async () => {
    requiredMock.mockResolvedValue([]);

    renderWithRouter(
      <GenerateDocumentModal
        open
        onClose={vi.fn()}
        engagementId={ENGAGEMENT_ID}
        serviceType="HORSE_FINDER"
      />,
    );
    await screen.findByText('Purchase Agreement');

    expect(requiredMock).toHaveBeenCalledWith('HORSE_FINDER');
    expect(
      screen.queryByText('Required signing set for this engagement'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Needed')).not.toBeInTheDocument();
  });

  it('renders the error branch on rejection and keeps the modal OPEN', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    genMock.mockRejectedValueOnce(new Error('require_module: brokerage'));

    renderWithRouter(
      <GenerateDocumentModal open onClose={onClose} engagementId={ENGAGEMENT_ID} />,
    );
    await screen.findByText('Purchase Agreement');

    await user.click(screen.getByRole('radio', { name: /Purchase Agreement/ }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(genMock).toHaveBeenCalledWith(ENGAGEMENT_ID, 'purchase_agreement');

    // Error is not swallowed — it renders...
    expect(await screen.findByRole('alert')).toHaveTextContent('require_module: brokerage');
    // ...and the modal stays open (dialog + picker still present, onClose NOT called).
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('Purchase Agreement')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
