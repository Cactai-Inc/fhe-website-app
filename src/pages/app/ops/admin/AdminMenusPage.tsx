import { SupersededEditor } from '../../../../components/ops/editor/SupersededEditor';

/**
 * MENUS (/app/ops/admin/menus) — superseded by TASK-SURFACEEDITOR, 2026-08-26.
 *
 * ⚠️ THIS PAGE IS THE ONE THE OWNER RULED AGAINST BY NAME. It was a flat
 * inventory of 124 dropdown lists, and the objection was not its length:
 * *"a menu means nothing away from the thing it appears on — 'Front boots /
 * wraps' is only meaningful while looking at the equipment question on a lease."*
 *
 * Its WRITE SPINE is untouched and still the only way a menu changes
 * (`menu_inventory`, `menu_vocabulary_values`, `set_menu_value`,
 * `set_form_field_options`). What moved is where you reach it: a form's menus are
 * on the form, a contract's menus are on the clause that asks the question, and
 * the five SHARED lists — breed, colour, markings, registration organisation,
 * passport country — keep a flat list of their own in the Editor, because they
 * are used in several places at once and genuinely have no single home.
 */
export default function AdminMenusPage() {
  return (
    <SupersededEditor
      was="Menus"
      now="Menus are edited where they appear now. A form's choices are on the form, a contract's choices are on the clause that asks the question, and the five shared lists — breed, colour, markings, registration organisation, passport country — are in the Editor under Shared lists."
    />
  );
}
