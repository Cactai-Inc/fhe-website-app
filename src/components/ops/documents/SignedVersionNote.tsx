/**
 * THE TELL — an executed document says which version of the template it was
 * signed against.
 *
 * TASK-SURFACEEDITOR's handoff: *"An executed document must visibly state the
 * version it was signed against, so it is obvious it is not following the
 * template — otherwise the first person to edit a lease template will assume
 * signed copies changed too."*
 *
 * ⚠️ THE FACT WAS ALWAYS TRUE AND WAS NEVER VISIBLE HERE. All 67 executed
 * documents carry `signed_template_version`, and `regenerate_contract_document`
 * returns the stored body without writing when the template has moved on — so a
 * template edit cannot reach signed paper, and D33 forbids ever asking a past
 * signer to re-affirm one. The ops documents QUEUE has shown the number since
 * TASK-DOCCOLS; the document itself did not, which is the surface a person
 * actually reads.
 *
 * Both numbers are shown when they differ, because "signed against v1" only
 * reads as a guarantee next to "the template is now v3".
 */
export function SignedVersionNote({ signedVersion, templateVersionNow }: {
  signedVersion: number | null | undefined;
  templateVersionNow: number | null | undefined;
}) {
  if (signedVersion == null) return null;
  const drifted = templateVersionNow != null && templateVersionNow !== signedVersion;
  return (
    <p className="text-[12px] text-muted mt-2" data-testid="signed-version-note">
      Signed against <strong className="text-green-900">v{signedVersion}</strong> of this template.
      {drifted
        ? ` The template has since moved to v${templateVersionNow} — this copy keeps the exact wording it was signed with and does not change with it.`
        : ' It keeps that exact wording permanently, whatever the template does later.'}
    </p>
  );
}
