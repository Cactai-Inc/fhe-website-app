import type { ContractTemplate } from '../../../lib/ops/types';

/**
 * Radio-list template picker. Presentational + controlled: renders one option
 * per template (key + title), and reports the chosen `template_key` up via
 * `onSelect`. No default selection is ever forced — a document is only
 * generatable once the staff user has explicitly picked a template.
 *
 * When `requiredKeys` is non-empty, a "Required signing set for this
 * engagement" section renders first: the contract_requirements matrix rows for
 * the engagement's service_type (releases + facility rules + medical/vet
 * authorizations), each flagged "On file" when a document generated from that
 * template already exists on the engagement (`existingTemplateIds`) or "Needed"
 * otherwise. The full template list always renders below.
 */
export interface TemplatePickerProps {
  templates: ContractTemplate[];
  /** Currently-selected template_key, or '' when nothing is chosen. */
  value: string;
  onSelect: (templateKey: string) => void;
  /** Matrix-required template_keys for the engagement's service_type. */
  requiredKeys?: string[];
  /** template_ids of documents already generated on the engagement. */
  existingTemplateIds?: string[];
}

function TemplateOption({
  template,
  value,
  onSelect,
  status,
}: {
  template: ContractTemplate;
  value: string;
  onSelect: (templateKey: string) => void;
  status?: 'on-file' | 'needed';
}) {
  return (
    <label
      key={template.template_key}
      className="flex items-start gap-3 rounded border border-green-800/15 px-3 py-2 cursor-pointer hover:bg-green-50"
    >
      <input
        type="radio"
        name="template_key"
        className="mt-1"
        value={template.template_key}
        checked={value === template.template_key}
        onChange={() => onSelect(template.template_key)}
      />
      <span className="flex flex-col">
        <span className="text-green-900">{template.title}</span>
        <span className="text-xs text-green-800/60">{template.template_key}</span>
      </span>
      {status && (
        <span
          className={
            status === 'on-file'
              ? 'ml-auto mt-1 text-xs text-green-700'
              : 'ml-auto mt-1 text-xs text-amber-700'
          }
        >
          {status === 'on-file' ? 'On file' : 'Needed'}
        </span>
      )}
    </label>
  );
}

export function TemplatePicker({
  templates,
  value,
  onSelect,
  requiredKeys = [],
  existingTemplateIds = [],
}: TemplatePickerProps) {
  const required = requiredKeys
    .map((key) => templates.find((t) => t.template_key === key))
    .filter((t): t is ContractTemplate => t !== undefined);
  const existing = new Set(existingTemplateIds);

  return (
    <div className="flex flex-col gap-4">
      {required.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="form-label mb-1">Required signing set for this engagement</legend>
          {required.map((t) => (
            <TemplateOption
              key={t.template_key}
              template={t}
              value={value}
              onSelect={onSelect}
              status={existing.has(t.id) ? 'on-file' : 'needed'}
            />
          ))}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="form-label mb-1">Template</legend>
        {templates.map((t) => (
          <TemplateOption key={t.template_key} template={t} value={value} onSelect={onSelect} />
        ))}
      </fieldset>
    </div>
  );
}
