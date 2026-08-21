import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { BrandProvider } from '../../src/contexts/BrandProvider';
import ContractPage from '../../src/pages/app/ContractPage';
import payloads from '../ui/fixtures/contractsend-rpc-payloads.json';

const docId = (payloads as { contract_document_detail: { document: { document_id: string } } })
  .contract_document_detail.document.document_id;

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[`/app/contracts/${docId}`]}>
      <AuthProvider>
        <BrandProvider>
          <Routes><Route path="/app/contracts/:id" element={<ContractPage />} /></Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>
  </HelmetProvider>,
);
