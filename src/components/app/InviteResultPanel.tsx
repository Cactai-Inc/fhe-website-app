/**
 * The ONE panel every invite surface renders after a send (provision client,
 * client-detail resend, staff invite). It exists so no surface can quietly
 * claim "sent" for an invitation that was created but never delivered: a
 * failed send is red, names the recipient, and states the transport's own
 * reason. The activation link is always shown so staff can hand it over.
 */
export interface InviteResultPanelProps {
  /** The activation URL that is (or would have been) in their email. */
  url: string;
  emailed: boolean;
  /** The transport's reason for the failure. Present iff !emailed. */
  emailError?: string;
  /** Who it was addressed to, when the surface knows it. */
  email?: string;
  className?: string;
}

export function InviteResultPanel({ url, emailed, emailError, email, className }: InviteResultPanelProps) {
  return (
    <div className={`p-3 mt-3 text-sm rounded-lg border ${
      emailed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'} ${className ?? ''}`}>
      {emailed ? (
        <p className="text-green-800 mb-1.5">
          Invitation emailed{email ? <> to <strong>{email}</strong></> : null}.
        </p>
      ) : (
        <>
          <p className="text-red-800 mb-1.5" role="alert">
            <strong>Created but NOT emailed</strong>{email ? <> to {email}</> : null}.
          </p>
          <p className="text-red-700 text-xs mb-2">
            Reason: {emailError || 'unknown — check the function logs.'}
          </p>
          <p className="text-red-900/70 text-xs mb-1">Send them this link directly until delivery is fixed:</p>
        </>
      )}
      <code className={`block break-all text-xs bg-white p-2 rounded border ${
        emailed ? 'text-green-900 border-green-200' : 'text-red-900 border-red-200'}`}>
        {url}
      </code>
    </div>
  );
}
