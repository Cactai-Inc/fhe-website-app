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

import { listContractTemplates, generateDocument } from '../../../lib/api';
import { GenerateDocumentModal } from './GenerateDocumentModal';
import type { ContractTemplate } from '../../../lib/ops/types';

const listMock = vi.mocked(listContractTemplates);
const genMock = vi.mocked(generateDocument);

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

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue(TEMPLATES);
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
