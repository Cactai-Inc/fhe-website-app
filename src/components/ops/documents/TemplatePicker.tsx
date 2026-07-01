import type { ContractTemplate } from '../../../lib/ops/types';

/**
 * Radio-list template picker. Presentational + controlled: renders one option
 * per template (key + title), and reports the chosen `template_key` up via
 * `onSelect`. No default selection is ever forced — a document is only
 * generatable once the staff user has explicitly picked a template.
 */
export interface TemplatePickerProps {
  templates: ContractTemplate[];
  /** Currently-selected template_key, or '' when nothing is chosen. */
  value: string;
  onSelect: (templateKey: string) => void;
}

export function TemplatePicker({ templates, value, onSelect }: TemplatePickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="form-label mb-1">Template</legend>
      {templates.map((t) => (
        <label
          key={t.template_key}
          className="flex items-start gap-3 rounded border border-green-800/15 px-3 py-2 cursor-pointer hover:bg-green-50"
        >
          <input
            type="radio"
            name="template_key"
            className="mt-1"
            value={t.template_key}
            checked={value === t.template_key}
            onChange={() => onSelect(t.template_key)}
          />
          <span className="flex flex-col">
            <span className="text-green-900">{t.title}</span>
            <span className="text-xs text-green-800/60">{t.template_key}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
