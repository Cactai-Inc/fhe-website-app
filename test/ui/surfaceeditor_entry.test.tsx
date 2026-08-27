// @vitest-environment jsdom
/**
 * TASK-SURFACEEDITOR — the entry page is a LIST OF SURFACES, and choosing one
 * opens that surface with its menus on it.
 *
 * No staff browser session exists in this environment, so this stands in for
 * clicking it, and it is deliberately about the things the owner's spec would
 * be broken by rather than about layout:
 *
 *  1. Surfaces are listed BY NAME — the name a person would use, no internal
 *     keys on screen (D25). A form key like INTAKE_HORSE_CLIPPING never renders.
 *  2. Choosing a form opens it IN PLACE. No navigation happens (CR-74).
 *  3. THE OWNER'S HEADLINE TEST: a field's MENU is reachable from the form, and
 *     saving it calls set_form_field_options for THAT form and THAT field. This
 *     is the whole point — the menu used to be on a different screen.
 *  4. Adding four choices is ONE save, so it is one version, not four.
 *  5. Every kind is listed: forms, documents, emails, shared lists.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const setFormFieldOptions = vi.fn(async () => {});

const FORM = {
  form_key: 'INTAKE_HORSE_CLIPPING',
  title: 'Horse Clipping Intake Form',
  audience: 'CLIENT',
  purpose: 'What we need before a clip',
  version: 1,
  schema: {
    sections: [{
      heading: 'The clip',
      fields: [
        { key: 'requested_service', label: 'Requested Service', type: 'select', required: true,
          options: ['Full Body Clip', 'Trace Clip'] },
        { key: 'notes', label: 'Anything else', type: 'longtext' },
      ],
    }],
  },
};

vi.mock('../../src/lib/admin', () => ({
  adminFormDefinitions: () => Promise.resolve([FORM]),
  setFormFieldOptions: (...a: unknown[]) => setFormFieldOptions(...(a as [])),
  setFormRequired: () => Promise.resolve(),
  addFormField: () => Promise.resolve(),
  editFormField: () => Promise.resolve(),
  removeFormField: () => Promise.resolve(),
  formVersionList: () => Promise.resolve([]),
  formVersionAt: () => Promise.resolve(null),
  restoreFormVersion: () => Promise.resolve(2),
  menuVocabularyValues: () => Promise.resolve([]),
  setMenuValue: () => Promise.resolve(),
  menuInventory: () => Promise.resolve([
    { source: 'vocabulary', menu_key: 'horse_breeds', label: 'Horse breed', used_by: 'horse records, intake, contracts', total: 40, active: 40 },
    { source: 'form', menu_key: 'INTAKE_HORSE_CLIPPING::requested_service', label: 'Requested Service', used_by: 'a form', total: 2, active: 2 },
  ]),
}));

vi.mock('../../src/lib/templateEditor', () => ({
  templateEditorList: () => Promise.resolve([{
    template_key: 'HORSE_LEASE_V2', title: 'Horse Lease (Standard)', short_label: null,
    version: 3, active: true, is_composed: true, clause_count: 164, draft_clause_count: 0,
    has_flat_draft: false, body_empty: false, has_unpublished: false,
    lockstep_keys: ['HORSE_LEASE_V2'], locked_reason: null, updated_at: '2026-08-26T00:00:00Z',
  }]),
  templateEditorClauses: () => Promise.resolve([]),
  templateEditorTokens: () => Promise.resolve([]),
  saveClauseDraft: () => Promise.resolve({ cleared: false, updated_keys: [], rows: 0 }),
  saveFlatDraft: () => Promise.resolve({ cleared: false }),
  discardTemplateDrafts: () => Promise.resolve({ keys: [], clause_drafts_discarded: 0, flat_drafts_discarded: 0 }),
  publishTemplate: () => Promise.resolve({ published_keys: [], clause_rows_published: 0, flat_bodies_published: 0, new_versions: {} }),
  flatTemplateBody: () => Promise.resolve(null),
}));

vi.mock('../../src/lib/surfaceEditor', () => ({
  emailTemplateList: () => Promise.resolve([{
    email_key: 'MAIL_INVITE', title: 'Your invitation', description: 'Sent when a client is invited',
    category: 'ONBOARDING', subject: 'Welcome', version: 4, active: true, transactional: true,
    recipient_note: 'the invited client', from_address_rule: 'tenant', reply_to_rule: 'none',
    has_unpublished: false, updated_at: '2026-08-26T00:00:00Z',
  }]),
  emailTemplateGet: () => Promise.resolve(null),
  emailTemplateSaveDraft: () => Promise.resolve({ email_key: '', has_unpublished: false }),
  emailTemplatePublish: () => Promise.resolve({ new_version: 5 }),
  emailTemplateDiscardDraft: () => Promise.resolve({}),
  emailVersionList: () => Promise.resolve([]),
  emailVersionAt: () => Promise.resolve(null),
  restoreEmailVersion: () => Promise.resolve(5),
  contractTemplateFields: () => Promise.resolve([]),
  contractMenuDependents: () => Promise.resolve({}),
  contractMenuSetActive: () => Promise.resolve({}),
  contractMenuRelabel: () => Promise.resolve({}),
  contractMenuAddValue: () => Promise.resolve({}),
  templateVersionList: () => Promise.resolve([]),
  templateVersionAt: () => Promise.resolve(null),
  restoreTemplateVersion: () => Promise.resolve(4),
}));

vi.mock('../../src/lib/api', () => ({ addLookupValue: () => Promise.resolve() }));

const { default: AdminEditorPage } = await import('../../src/pages/app/ops/admin/AdminEditorPage');

function renderPage() {
  return render(<MemoryRouter><AdminEditorPage /></MemoryRouter>);
}

describe('TASK-SURFACEEDITOR — the editor entry page', () => {
  beforeEach(() => { setFormFieldOptions.mockClear(); });
  afterEach(cleanup);

  it('lists every kind of surface, by the name the owner would use', async () => {
    renderPage();
    await screen.findByText('Horse Clipping Intake Form');
    for (const tab of ['Forms', 'Documents', 'Emails', 'Shared lists']) {
      expect(screen.getByRole('button', { name: new RegExp(tab, 'i') })).toBeInTheDocument();
    }
  });

  it('never shows an internal key on screen (D25)', async () => {
    const { container } = renderPage();
    await screen.findByText('Horse Clipping Intake Form');
    expect(container.textContent).not.toContain('INTAKE_HORSE_CLIPPING');
  });

  it('opens the form IN PLACE — the entry list is still there', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('Horse Clipping Intake Form'));
    // the form's own field is now on screen, and so is the page it opened from
    expect(await screen.findByTitle(/Requested Service · select/)).toBeInTheDocument();
    // the entry page itself is still on screen — nothing navigated away (CR-74)
    expect(screen.getByPlaceholderText('Search by name…')).toBeInTheDocument();
    expect(screen.getByText('Horse Clipping Intake Form')).toBeInTheDocument();
  });

  it("THE OWNER'S TEST: the field's menu is on the form, and saving it names that form and that field", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('Horse Clipping Intake Form'));

    // the menu is reachable from the field itself, not from another screen
    await user.click(await screen.findByRole('button', { name: '2 choices' }));

    // add a choice and save — ONE call, so ONE version.
    // Scoped to the menu editor: the form's own "add a field" row also says Add.
    const menu = screen.getByLabelText('Add a choice').closest('div')!.parentElement!;
    await user.type(screen.getByLabelText('Add a choice'), 'Show Trim');
    await user.click(within(menu).getByRole('button', { name: /^Add$/ }));
    await user.click(within(menu).getByRole('button', { name: 'Save menu' }));

    await waitFor(() => expect(setFormFieldOptions).toHaveBeenCalledTimes(1));
    expect(setFormFieldOptions).toHaveBeenCalledWith(
      'INTAKE_HORSE_CLIPPING', 'requested_service',
      ['Full Body Clip', 'Trace Clip', 'Show Trim'],
      undefined,
    );
  });

  it('lists only the SHARED vocabularies flat — a form menu belongs on its form', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Shared lists/i }));
    const shared = await screen.findByText('Horse breed');
    expect(shared).toBeInTheDocument();
    // the form's own menu is NOT in the flat list — that is the whole ruling
    expect(within(shared.closest('div')!.parentElement!).queryByText('Requested Service')).toBeNull();
  });
});
