/* HARNESS ENTRY for /app/documents — TASK-FIX1 §D.
 *
 * The REAL DocumentsContent, in a real Chromium, so "the signing box is gone and
 * reading, PDF, email-a-copy and the deep-link all still work" is proven by
 * rendering it (D17 / WALK3 F-2), not by reading the flag off the source.
 *
 * The fixture is the state AR7 says makes this page a live hazard, and the only
 * state in which its box was ever going to sign anything: a member with a
 * WHEN_READY (non-wall) document they are a signer on and have not signed, plus
 * an executed one and a contract-engine one, so all four surviving capabilities
 * are on screen at once.
 */
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { BrandProvider } from '../../src/contexts/BrandProvider';
import { DocumentsContent } from '../../src/components/app/DocumentsContent';

/* camelCase deliberately, matching contract-page.tsx: react-refresh's
   only-export-components rule reads an UPPERCASE module-scope const in a .tsx
   file as a possible component and warns on every one of them. Five warnings
   for five fixture ids is noise on top of a documented lint baseline. */
const contactId = '00000000-0000-4000-8000-0000000000c1';
const unsignedId = '00000000-0000-4000-8000-0000000000d1';
const executedId = '00000000-0000-4000-8000-0000000000d2';
const contractId = '00000000-0000-4000-8000-0000000000d3';
const body = 'Participant Liability Release\n\nPrinted Name: Test Member\n\nSignature: ______';

window.__tables = {
  profiles: [{
    user_id: '00000000-0000-4000-8000-000000000001', role: 'CLIENT',
    org_id: '00000000-0000-4000-8000-0000000000aa',
    first_name: 'Test', last_name: 'Member', contact_id: contactId, is_suspended: false,
  }],
  document_parties: [
    { document_id: unsignedId, party_role: 'CLIENT' },
    { document_id: executedId, party_role: 'CLIENT' },
    { document_id: contractId, party_role: 'LESSEE' },
  ],
  documents: [
    { id: unsignedId, title: 'Participant Liability Release', status: 'AWAITING_SIGNATURE',
      merged_body: body, contract_id: null, executed_email_sent_at: null },
    { id: executedId, title: 'Company Policies', status: 'EXECUTED',
      merged_body: body, contract_id: null, executed_email_sent_at: null },
    { id: contractId, title: 'Horse Lease', status: 'AWAITING_SIGNATURE',
      merged_body: body, contract_id: '00000000-0000-4000-8000-0000000000e1',
      executed_email_sent_at: null },
  ],
  /* The executed document carries the member's own sealed signature — that is
     what makes it executed, and what puts the PDF and email-a-copy controls on
     its row. The other two carry none: they are the ones still awaiting her. */
  signatures: [
    { document_id: executedId, party_role: 'CLIENT', signed_at: '2026-08-01T00:00:00Z' },
  ],
};
window.__rpcFixtures = {
  my_documents: [
    { document_id: executedId, template_key: 'COMPANY_POLICIES', title: 'Company Policies',
      kind: 'executed', signed_at: '2026-08-01T00:00:00Z', superseded: false,
      current_status: 'signed', executed_email_sent_at: null },
  ],
};

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <MemoryRouter initialEntries={['/app/documents']}>
      <AuthProvider><BrandProvider>
        <Routes><Route path="/app/documents" element={<DocumentsContent />} /></Routes>
      </BrandProvider></AuthProvider>
    </MemoryRouter>
  </HelmetProvider>,
);
