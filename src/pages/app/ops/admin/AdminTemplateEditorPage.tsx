import { SupersededEditor } from '../../../../components/ops/editor/SupersededEditor';

/**
 * TEMPLATE EDITOR (/app/ops/admin/templates/:templateKey) — superseded by
 * TASK-SURFACEEDITOR, 2026-08-26. Its clause cards, token picker and publish
 * dialog were reproduced in `components/ops/editor/DocumentSurface.tsx` against
 * the same `templateEditor.ts` calls, so there is one document editor rather than
 * two screens that will drift.
 *
 * The route is kept, parameter and all, so a bookmarked template still lands
 * somewhere true (D32).
 */
export default function AdminTemplateEditorPage() {
  return (
    <SupersededEditor
      was="The template editor"
      now="Every template is in the Editor now, under Documents. Open one and it expands in place — clause by clause, with the menus each clause asks for and its version history."
    />
  );
}
