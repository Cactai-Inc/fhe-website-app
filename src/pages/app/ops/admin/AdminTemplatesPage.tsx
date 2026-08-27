import { SupersededEditor } from '../../../../components/ops/editor/SupersededEditor';

/**
 * TEMPLATES (/app/ops/admin/templates) — superseded by TASK-SURFACEEDITOR,
 * 2026-08-26. The list of templates and the wording editor behind it are now the
 * Documents tab of the Editor, which renders the same clause bodies through the
 * same RPCs (`template_editor_*`) and adds two things this pair could not do:
 * the menus each clause asks for, edited in place, and the version history the
 * wording has been writing since TASK-VERSIONSPINE with nothing to read it back.
 *
 * The route is kept so an existing bookmark still lands somewhere true (D32).
 */
export default function AdminTemplatesPage() {
  return (
    <SupersededEditor
      was="Templates"
      now="Document wording is in the Editor now, under Documents — the same clause-by-clause drafts and the same Publish, plus the menus each clause asks for and the version history."
    />
  );
}
