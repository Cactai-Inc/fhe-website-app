import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { addContractElement, listContractFormats, proposeClause, type ContractFormat } from '../../lib/contracts';

/**
 * ADD ELEMENT — one toolbar button, one modal, for every way of adding to a
 * contract (audit M-2 — replaces the three separate add surfaces). It asks WHAT
 * to add and WHERE:
 *   • A FIELD   → pick the section + position, then the TYPE from the format
 *     registry (dropdown / free text / phone, name, company, currency, date, …).
 *   • A SECTION → inserted between two existing sections.
 *   • A CLAUSE  → free-text clause proposed for the other party to accept/reject
 *     (was the separate "Add a clause" box in RedlineSection).
 * `canAddClause` gates the clause mode (a party proposes; the owner just adds
 * structure directly). `canAddStructure` gates section/field (owner/staff).
 */

type Mode = 'field' | 'section' | 'clause';

export function AddElementButton({
  sections, documentId, disabled, onAdded,
  canAddStructure = true, canAddClause = false,
}: {
  sections: string[];
  documentId: string;
  disabled?: boolean;
  onAdded: () => void;
  canAddStructure?: boolean;
  canAddClause?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canAddStructure && !canAddClause) return null;
  const label = canAddStructure ? 'Add section, field, or clause' : 'Propose a clause';
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-gold-800 border border-gold-400/60 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring disabled:opacity-50">
        <Plus size={13} /> {label}
      </button>
      {open && (
        <AddElementModal sections={sections} documentId={documentId}
          canAddStructure={canAddStructure} canAddClause={canAddClause}
          onClose={() => setOpen(false)}
          onAdded={onAdded} />
      )}
    </>
  );
}

function AddElementModal({
  sections, documentId, onClose, onAdded, canAddStructure, canAddClause,
}: {
  sections: string[];
  documentId: string;
  onClose: () => void;
  onAdded: () => void;
  canAddStructure: boolean;
  canAddClause: boolean;
}) {
  const modes: Mode[] = [
    ...(canAddStructure ? (['field', 'section'] as Mode[]) : []),
    ...(canAddClause ? (['clause'] as Mode[]) : []),
  ];
  const [mode, setMode] = useState<Mode>(modes[0] ?? 'field');
  const [formats, setFormats] = useState<ContractFormat[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // A running log of what's been added this session, so the author can build out a
  // section without reopening the modal for each item.
  const [added, setAdded] = useState<string[]>([]);
  // Sections created this session (targetable immediately for fields).
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const allSections = [...sections, ...extraSections];

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

  // clause mode
  const [clauseText, setClauseText] = useState('');

  useEffect(() => { listContractFormats().then(setFormats).catch(() => setFormats([])); }, []);

  const selectedFormat = formats.find((f) => f.format_type === formatType);
  const isChoiceFormat = formatType === 'select' || formatType === 'buttons';

  // Add one item, then STAY OPEN so the author can keep building. After creating a
  // section we switch straight to field mode targeting it, so they can fill it out.
  async function submit() {
    setErr(null); setBusy(true);
    try {
      if (mode === 'clause') {
        if (!clauseText.trim()) throw new Error('Write the clause to propose.');
        await proposeClause(documentId, clauseText.trim());
        setAdded((a) => [...a, `Clause proposed`]);
        setClauseText('');
      } else if (mode === 'section') {
        const name = newSectionName.trim();
        if (!name) throw new Error('Name the new section.');
        await addContractElement(documentId, {
          kind: 'section', section: name, afterSection,
          label: `${name} — details`, formatType: 'longtext',
        });
        setAdded((a) => [...a, `Section “${name}”`]);
        setExtraSections((s) => (s.includes(name) ? s : [...s, name]));
        setNewSectionName('');
        // advance: now add fields into the section we just created
        setTargetSection(name);
        setMode('field');
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
        setAdded((a) => [...a, `Field “${label.trim()}” in ${targetSection}`]);
        setLabel(''); setChoices(''); setGuidance(''); setPosition('');
      }
      onAdded();   // refresh the document behind the modal
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg text-green-900">Add to this contract</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-green-800 focus-ring rounded"><X size={18} /></button>
        </div>

        {/* what to add */}
        <div className="flex gap-1.5 mb-4">
          {modes.map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
                mode === m ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
              {m === 'field' ? 'A field' : m === 'section' ? 'A section' : 'A clause'}
            </button>
          ))}
        </div>

        {err && <p role="alert" className="form-error mb-3">{err}</p>}

        {mode === 'clause' ? (
          <div className="flex flex-col gap-2">
            <span className="form-label">New clause</span>
            <textarea rows={4} className="form-input resize-y" value={clauseText} onChange={(e) => setClauseText(e.target.value)}
              placeholder="Write the clause you want to propose. It's highlighted for the other party to accept or reject." />
            <p className="form-hint">Proposed clauses don't change the contract until accepted — they appear under Proposed changes for review.</p>
          </div>
        ) : mode === 'section' ? (
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
                  {allSections.map((s) => <option key={s} value={s}>{s}</option>)}
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

        {/* running log of what's been added — build out a section without reopening */}
        {added.length > 0 && (
          <div className="mt-4 rounded-lg bg-green-50/60 border border-green-800/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Added this session</p>
            <ul className="text-sm text-green-900 list-disc list-inside space-y-0.5">
              {added.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            {added.length > 0 ? 'Done' : 'Cancel'}
          </button>
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void submit()}>
            <Plus size={14} /> {mode === 'clause' ? 'Propose' : mode === 'section' ? 'Add section & continue' : 'Add field'}
          </button>
        </div>
      </div>
    </div>
  );
}
