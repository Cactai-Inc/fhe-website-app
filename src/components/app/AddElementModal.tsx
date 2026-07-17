import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { addContractElement, listContractFormats, type ContractFormat } from '../../lib/contracts';

/**
 * ADD ELEMENT — a small button that opens a modal to add a new section, item, or
 * field to a live contract, asking WHERE it belongs and WHAT it is:
 *   • New SECTION → inserted between two existing sections (pick the one it follows).
 *   • New FIELD   → pick the section + position (1-based), then the TYPE from the
 *     format registry (dropdown / free text / a formatted type: phone, name,
 *     company, website, currency, date, …). For a dropdown you list the choices;
 *     for free text you set placeholder guidance.
 * Replaces the old full-width "add a section" block — now a compact affordance.
 */

type Mode = 'section' | 'field';

export function AddElementButton({
  sections, documentId, disabled, onAdded,
}: {
  sections: string[];
  documentId: string;
  disabled?: boolean;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-gold-800 border border-gold-400/60 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring disabled:opacity-50">
        <Plus size={13} /> Add section, item, or field
      </button>
      {open && (
        <AddElementModal sections={sections} documentId={documentId}
          onClose={() => setOpen(false)}
          onAdded={() => { setOpen(false); onAdded(); }} />
      )}
    </>
  );
}

function AddElementModal({
  sections, documentId, onClose, onAdded,
}: {
  sections: string[];
  documentId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<Mode>('field');
  const [formats, setFormats] = useState<ContractFormat[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // section mode
  const [newSectionName, setNewSectionName] = useState('');
  const [afterSection, setAfterSection] = useState(sections[0] ?? '');

  // field mode
  const [targetSection, setTargetSection] = useState(sections[0] ?? '');
  const [position, setPosition] = useState<string>('');   // '' = end
  const [label, setLabel] = useState('');
  const [formatType, setFormatType] = useState('text');
  const [guidance, setGuidance] = useState('');
  const [choices, setChoices] = useState('');   // one per line, for select/buttons

  useEffect(() => { listContractFormats().then(setFormats).catch(() => setFormats([])); }, []);

  const selectedFormat = formats.find((f) => f.format_type === formatType);
  const isChoiceFormat = formatType === 'select' || formatType === 'buttons';

  async function submit() {
    setErr(null); setBusy(true);
    try {
      if (mode === 'section') {
        if (!newSectionName.trim()) throw new Error('Name the new section.');
        await addContractElement(documentId, {
          kind: 'section', section: newSectionName.trim(), afterSection,
          label: `${newSectionName.trim()} — details`, formatType: 'longtext',
        });
      } else {
        if (!label.trim()) throw new Error('Give the field a label.');
        const opts = isChoiceFormat
          ? choices.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => ({ value: s.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label: s }))
          : null;
        await addContractElement(documentId, {
          kind: 'field', section: targetSection,
          position: position ? Number(position) : null,
          label: label.trim(), formatType, options: opts,
          guidance: guidance.trim() || null,
        });
      }
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg text-green-900">Add to this contract</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-green-800 focus-ring rounded"><X size={18} /></button>
        </div>

        {/* what to add */}
        <div className="flex gap-1.5 mb-4">
          {(['field', 'section'] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
                mode === m ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
              {m === 'field' ? 'A field' : 'A section'}
            </button>
          ))}
        </div>

        {err && <p role="alert" className="form-error mb-3">{err}</p>}

        {mode === 'section' ? (
          <div className="flex flex-col gap-3">
            <div>
              <span className="form-label">Section name</span>
              <input className="form-input" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g. Special Provisions" />
            </div>
            <div>
              <span className="form-label">Insert it after</span>
              <select className="form-input" value={afterSection} onChange={(e) => setAfterSection(e.target.value)}>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="form-hint mt-1">The new section will appear directly after this one.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="form-label">Section</span>
                <select className="form-input" value={targetSection} onChange={(e) => setTargetSection(e.target.value)}>
                  {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <span className="form-label">Position</span>
                <input type="number" min={1} className="form-input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="End" />
                <p className="form-hint mt-1">1 = first. Blank = end.</p>
              </div>
            </div>
            <div>
              <span className="form-label">Label</span>
              <input className="form-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Processing fee" />
            </div>
            <div>
              <span className="form-label">Type</span>
              <select className="form-input" value={formatType} onChange={(e) => setFormatType(e.target.value)}>
                {formats.map((f) => <option key={f.format_type} value={f.format_type}>{f.label}</option>)}
              </select>
              {selectedFormat?.reusable_as && (
                <p className="form-hint mt-1">Stored as {selectedFormat.reusable_as} — reusable elsewhere in the app.</p>
              )}
            </div>
            {isChoiceFormat ? (
              <div>
                <span className="form-label">Choices (one per line)</span>
                <textarea rows={3} className="form-input resize-y" value={choices} onChange={(e) => setChoices(e.target.value)} placeholder={'Option A\nOption B'} />
              </div>
            ) : (
              <div>
                <span className="form-label">Guidance / placeholder <span className="text-muted font-normal">(optional)</span></span>
                <input className="form-input" value={guidance} onChange={(e) => setGuidance(e.target.value)}
                  placeholder={selectedFormat?.guidance ?? 'Help text shown in the field'} />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void submit()}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
