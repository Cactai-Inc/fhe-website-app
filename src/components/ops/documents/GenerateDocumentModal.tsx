import { useEffect, useState } from 'react';
import { Modal } from '../../../lib/ops';
import { useAsync } from '../../../lib/ops';
import { listContractTemplates, generateDocument } from '../../../lib/api';
import type { ContractTemplate, GeneratedDocument } from '../../../lib/ops/types';
import { TemplatePicker } from './TemplatePicker';

/**
 * OPS-DOC-GEN — Generate-document modal.
 *
 * Flow: opened from an engagement detail → lists the global (world-read)
 * `contract_templates` → staff picks one → `generateDocument(engagementId,
 * templateKey)` calls `rpc('generate_document', …)`, which mints a DRAFT
 * `documents` row (config keyed to the engagement's own org_id). On success we
 * surface the returned `document_id`/preview link and hand it to `onGenerated`
 * so the caller can route to the viewer (OPS-DOC-VIEW). On rejection the error
 * renders inline and the modal STAYS OPEN so the staff user can retry.
 *
 * No default template_key is ever sent: the confirm control is disabled until a
 * template is explicitly chosen, so `generate_document` never fires blind.
 */
export interface GenerateDocumentModalProps {
  open: boolean;
  onClose: () => void;
  engagementId: string;
  /** Called with the new document_id after a successful generate (→ viewer). */
  onGenerated?: (documentId: string) => void;
}

export function GenerateDocumentModal({
  open,
  onClose,
  engagementId,
  onGenerated,
}: GenerateDocumentModalProps) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [loadError, setLoadError] = useState<Error | null>(null);
  const generate = useAsync<GeneratedDocument, [string, string]>(generateDocument);

  // Load the world-read template catalogue when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(null);
    listContractTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset transient state whenever the modal closes.
  useEffect(() => {
    if (open) return;
    setSelectedKey('');
    setLoadError(null);
    generate.reset();
  }, [open, generate]);

  const handleConfirm = async () => {
    if (!selectedKey) return;
    try {
      const result = await generate.run(engagementId, selectedKey);
      onGenerated?.(result.document_id);
    } catch {
      // Error surfaced via generate.error below; modal stays open for retry.
    }
  };

  const generated = generate.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate document"
      disableBackdropClose={generate.isPending}
      footer={
        !generated ? (
          <>
            <button
              type="button"
              className="px-4 py-2 text-green-800 hover:text-green-900"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedKey || generate.isPending}
              aria-busy={generate.isPending}
              onClick={handleConfirm}
            >
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {loadError && (
        <p role="alert" className="form-error">
          Could not load templates: {loadError.message}
        </p>
      )}

      {generated ? (
        <div className="flex flex-col gap-2">
          <p className="text-green-900">Draft document created.</p>
          <p className="text-sm text-green-800/70">
            Document <span className="font-mono">{generated.document_id}</span>
          </p>
          <a
            href={`/app/documents/${generated.document_id}`}
            className="text-green-700 underline"
            onClick={(e) => {
              if (onGenerated) {
                e.preventDefault();
                onGenerated(generated.document_id);
              }
            }}
          >
            Open document
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {templates.length === 0 && !loadError ? (
            <p className="text-green-800/60">No templates available.</p>
          ) : (
            <TemplatePicker
              templates={templates}
              value={selectedKey}
              onSelect={setSelectedKey}
            />
          )}
          {generate.isError && generate.error && (
            <p role="alert" className="form-error">
              {generate.error.message}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
