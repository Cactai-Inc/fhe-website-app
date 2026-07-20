import { useMemo } from 'react';
import { Info } from 'lucide-react';
import {
  clauseConditionMet,
  type ContractField, type SectionDef, type ClauseDef,
} from '../../lib/contracts';
import { ContractCascade } from './ContractCascade';

/**
 * CLAUSE DOCUMENT — the numbered Section › Clause › Field authoring surface.
 *
 * Renders the template's clause STRUCTURE (sections → clauses), auto-numbered
 * (1, 1.1, 1.2, 2 …), and drops fields under their clause. Clauses gate in real
 * time: a clause whose `conditional_on` isn't met by the current field values is
 * hidden entirely (heading + fields), and a section with no visible clauses is
 * suppressed — mirroring exactly what the composed document will contain. This is
 * what makes it a creation tool: checking "Competition" surfaces the Competitions
 * section live; unchecking removes it (the data is kept, just excluded).
 *
 * Numbering here is display-only and recomputed on every render from what's
 * visible, so it always matches the composed body.
 */

type FieldCallbacks = {
  editable: boolean;
  onSave: (key: string, value: string) => void | Promise<void>;
  onSaveStructured: (key: string, s: unknown) => void | Promise<void>;
  onSaveResponsibility: (key: string, r: unknown) => void | Promise<void>;
  onInclude: (key: string, inc: boolean) => void | Promise<void>;
  onNa: (key: string, na: boolean) => void | Promise<void>;
  onControl: (key: string, ov: unknown) => void | Promise<void>;
  canSetControl: boolean;
  canSuggest: boolean;
  onSuggestEdit?: (f: ContractField) => void;
  onCommentField?: (f: ContractField) => void;
};

/** A prose-only clause renders as read-only numbered legal text (no inputs). */
function ProseClause({ number, heading }: { number: string; heading: string | null }) {
  return (
    <div className="mb-3">
      {heading && (
        <p className="text-[13.5px] font-medium text-green-900">
          <span className="text-muted mr-1.5 tabular-nums">{number}</span>{heading}
        </p>
      )}
      <p className="text-xs text-muted italic mt-0.5">Standard clause — no input needed.</p>
    </div>
  );
}

export function ClauseDocument({
  sections, fields, cb,
}: {
  sections: SectionDef[];
  fields: ContractField[];
  cb: FieldCallbacks;
}) {
  // current field values (multi-selects comma-joined) for live gating — mirrors
  // exactly how the SQL composer reads them.
  const fieldValues = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of fields) {
      m[f.field_key] = f.responsibility?.party ?? f.value ?? '';
    }
    return m;
  }, [fields]);

  const fieldsByClause = useMemo(() => {
    const m = new Map<string, ContractField[]>();
    for (const f of fields) {
      const k = f.clause_key ?? '';
      if (!k) continue;
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    return m;
  }, [fields]);

  const clauseVisible = (c: ClauseDef) => clauseConditionMet(c.conditional_on, fieldValues);

  // compute display numbering from what's visible (matches the composed body)
  let sectionNo = 0;
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        const visibleClauses = section.clauses.filter(clauseVisible);
        if (visibleClauses.length === 0) return null;   // suppress empty section
        sectionNo += 1;
        const secNum = sectionNo;
        let clauseNo = 0;
        return (
          <section key={section.section_key} className="bg-white border border-green-800/10 rounded-xl p-6">
            <h2 className="font-serif text-green-800 text-lg mb-4 flex items-baseline gap-2">
              <span className="text-gold-ink tabular-nums">{secNum}.</span>
              {section.heading}
              {section.guidance && (
                <span title={section.guidance} className="text-muted cursor-help">
                  <Info size={14} className="inline align-middle" aria-hidden="true" />
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-4">
              {visibleClauses.map((clause) => {
                clauseNo += 1;
                const num = `${secNum}.${clauseNo}`;
                if (clause.clause_type === 'prose') {
                  return <ProseClause key={clause.clause_key} number={num} heading={clause.heading} />;
                }
                const clauseFields = fieldsByClause.get(clause.clause_key) ?? [];
                return (
                  <div key={clause.clause_key} className="border-l-2 border-gold-200 pl-4">
                    {clause.heading && (
                      <p className="text-[13.5px] font-medium text-green-900 mb-2 flex items-center gap-1.5">
                        <span className="text-muted tabular-nums">{num}</span>{clause.heading}
                        {clause.guidance && (
                          <span title={clause.guidance} className="text-muted cursor-help">
                            <Info size={13} className="inline align-middle" aria-hidden="true" />
                          </span>
                        )}
                      </p>
                    )}
                    {clauseFields.length > 0 ? (
                      <ContractCascade
                        fields={clauseFields}
                        editable={cb.editable}
                        onSave={cb.onSave}
                        onSaveResponsibility={cb.onSaveResponsibility as never}
                        onSaveStructured={cb.onSaveStructured as never}
                        onInclude={cb.onInclude}
                        onNa={cb.onNa}
                        onControl={cb.onControl as never}
                        canSetControl={cb.canSetControl}
                        canSuggest={cb.canSuggest}
                        onSuggestEdit={cb.onSuggestEdit}
                        onCommentField={cb.onCommentField}
                      />
                    ) : (
                      <p className="text-xs text-muted italic">No input needed.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ClauseDocument;
