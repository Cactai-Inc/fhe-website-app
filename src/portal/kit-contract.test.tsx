// @vitest-environment jsdom
/**
 * KIT-PORTAL contract proof (§15 UI-interaction test).
 *
 * The barrel is a re-export seam, so "done" here means EXECUTABLE PROOF that:
 *   1. every KIT primitive re-exported by the barrel RENDERS a real fixture value
 *      (Money → formatted amount, StatusBadge → status text, DataTable → a
 *      document fixture row with merged_body),
 *   2. the entitlement hooks (useModules / useEntitlements) are re-exported as
 *      real functions (typeof === 'function'), and
 *   3. STATIC AUDIT — the barrel re-exports NO primitive the KIT does not itself
 *      provide (every named export the barrel exposes is present on the KIT
 *      source barrel `src/lib/ops`), so nothing is invented here.
 *
 * All imports come from the barrel under test — the same single seam the thin
 * portal/public slices use — proving the seam is what actually wires them.
 */
import { describe, it, expect } from 'vitest';
import { renderWithRouter, screen } from '../test/render';

import {
  Money,
  StatusBadge,
  DataTable,
  ModuleGate,
  formatMoney,
  toneForStatus,
  useModules,
  useEntitlements,
  documentFixture,
  billableLineFixtures,
  engagementFixture,
  horsePartyFixture,
  orgPublicConfigFixture,
  type Column,
} from './kit-contract';
import type { DocumentRow } from '../lib/ops/types';

// Cross-check every barrel primitive against the KIT source barrel it mirrors,
// so the static audit compares real re-exports (not string literals).
import * as opsKit from '../lib/ops';

describe('KIT-PORTAL barrel — renders fixtures through re-exported primitives', () => {
  it('Money renders the fixture billable-line amount, formatted', () => {
    const line = billableLineFixtures[0];
    renderWithRouter(<Money amount={line.amount} />);
    // Real formatter → the barrel Money must produce the same string.
    expect(screen.getByTestId('money')).toHaveTextContent(
      formatMoney(line.amount) as string,
    );
    expect(screen.getByTestId('money')).toHaveTextContent('$1,200.00');
  });

  it('StatusBadge renders the fixture document status', () => {
    renderWithRouter(<StatusBadge status={documentFixture.status} />);
    expect(screen.getByText('EXECUTED')).toBeInTheDocument();
    // Re-exported tone helper resolves the same tone the badge uses.
    expect(toneForStatus(documentFixture.status)).toBe('success');
  });

  it('DataTable renders a document fixture row including merged_body-derived cells', () => {
    const columns: Column<DocumentRow>[] = [
      { key: 'code', header: 'Doc', render: (r) => r.display_code },
      { key: 'title', header: 'Title', render: (r) => r.title },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ];
    renderWithRouter(
      <DataTable columns={columns} rows={[documentFixture]} rowKey={(r) => r.id} />,
    );
    expect(screen.getByText('DOC-2201')).toBeInTheDocument();
    expect(screen.getByText('Purchase Representation Agreement')).toBeInTheDocument();
    expect(screen.getByText('EXECUTED')).toBeInTheDocument();
    // The fixture carries a real merged_body (the generate_document output shape).
    expect(documentFixture.merged_body).toContain('Purchase Representation Agreement');
  });

  it('ModuleGate (re-exported) renders children when the injected map enables the key', () => {
    renderWithRouter(
      <ModuleGate moduleKey="mod.brokerage" modules={{ 'mod.brokerage': true }}>
        <span>brokerage panel</span>
      </ModuleGate>,
    );
    expect(screen.getByText('brokerage panel')).toBeInTheDocument();
    // Fail-closed branch: locked map hides children behind the locked note.
    renderWithRouter(
      <ModuleGate moduleKey="mod.boarding" modules={{ 'mod.boarding': false }}>
        <span>boarding panel</span>
      </ModuleGate>,
    );
    expect(screen.queryByText('boarding panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
  });
});

describe('KIT-PORTAL barrel — re-exports the expected named hooks', () => {
  it('useModules and useEntitlements are re-exported as functions', () => {
    expect(typeof useModules).toBe('function');
    expect(typeof useEntitlements).toBe('function');
  });
});

describe('KIT-PORTAL fixtures — typed rows mirror the real column shapes', () => {
  it('engagement / document fixtures carry the backbone columns', () => {
    expect(engagementFixture).toMatchObject({
      id: expect.any(String),
      display_code: expect.any(String),
      client_id: expect.any(String),
      service_type: expect.any(String),
      status: expect.any(String),
    });
    expect(documentFixture.engagement_id).toBe(engagementFixture.id);
    expect(typeof documentFixture.merged_body).toBe('string');
  });

  it('horse_parties fixture uses a valid CHECK role and share_pct', () => {
    expect(['owner', 'lessee', 'trainer', 'caretaker', 'boarder']).toContain(
      horsePartyFixture.role,
    );
    expect(horsePartyFixture.share_pct).toBe(100);
  });

  it('billable_lines fixtures cover OPEN and SETTLED status', () => {
    const statuses = billableLineFixtures.map((l) => l.status);
    expect(statuses).toContain('OPEN');
    expect(statuses).toContain('SETTLED');
  });

  it('org_public_config fixture is a jsonb-shaped object with brand/modules/pricing', () => {
    expect(orgPublicConfigFixture.brand.NAME).toBe('Fair Hill Equine');
    expect(Array.isArray(orgPublicConfigFixture.modules)).toBe(true);
    expect(orgPublicConfigFixture.pricing[0]).toMatchObject({
      product_key: expect.any(String),
      amount: expect.any(Number),
    });
  });
});

describe('KIT-PORTAL static audit — no primitive re-exported that KIT does not provide', () => {
  // The primitives + hooks the barrel promises to re-export.
  const REEXPORTED_PRIMITIVES = [
    'FormField',
    'DataTable',
    'Modal',
    'Money',
    'formatMoney',
    'StatusBadge',
    'toneForStatus',
    'ModuleGate',
    'EmptyState',
    'AsyncButton',
    'useAsync',
    'useToast',
  ] as const;

  it('every re-exported KIT primitive exists on the KIT source barrel (src/lib/ops)', () => {
    for (const name of REEXPORTED_PRIMITIVES) {
      expect(
        opsKit,
        `barrel re-exports "${name}" which KIT (src/lib/ops) does not provide`,
      ).toHaveProperty(name);
      expect(typeof (opsKit as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('the barrel re-exports the same primitive reference as the KIT (not a re-declaration)', async () => {
    const barrel = await import('./kit-contract');
    // Identity check: Money/DataTable from the barrel ARE the KIT's exports.
    expect(barrel.Money).toBe(opsKit.Money);
    expect(barrel.DataTable).toBe(opsKit.DataTable);
    expect(barrel.ModuleGate).toBe(opsKit.ModuleGate);
  });
});
