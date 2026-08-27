import { SupersededEditor } from '../../../../components/ops/editor/SupersededEditor';

/**
 * FORMS (/app/ops/admin/forms) — superseded by TASK-SURFACEEDITOR, 2026-08-26.
 *
 * This screen was the proving ground for the version spine: it is where "save
 * mints v2, open v1, edit it, and the list reads v3 · from v1" was first true.
 * Its card, its version chip and its history modal are not gone — they moved to
 * `src/components/ops/editor/`, and the Editor renders them for every form, with
 * each field's MENU now on the field instead of on a separate screen.
 *
 * The route is kept so an existing bookmark still lands somewhere true (D32).
 */
export default function AdminFormsPage() {
  return (
    <SupersededEditor
      was="Forms"
      now="Every form is in the Editor now, under Forms — the same questions and required toggles, plus the choices each question offers, which used to be on the Menus screen."
    />
  );
}
