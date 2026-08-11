/** The tenant's own word for their facility (barn/ranch/stables/grounds/facility —
 *  U16, TASK-FACILITYTERM). `property` is the INTERNAL term only — never rendered;
 *  it never collides with the existing `Facility`/`facilities` boarding entity (a
 *  physical structure with stalls) or with "site" meaning the public website.
 *
 *  Not just a bare noun: `stables`/`grounds` are plural in form ("the stables ARE
 *  closed", not "IS"), so every consumer renders against this shape, never a raw
 *  string. Where a sentence can't survive the substitution cleanly, rewrite the
 *  sentence rather than special-case it.
 */
export interface PropertyTerm {
  key: string;
  term: string;
  article: string;
  plural: boolean;
  preposition: string;
}

/** The client-side fallback, mirroring brand.ts's BRAND constant exactly: FHE's
 *  own actual term (ranch — "FHE is a stable at a ranch, not a barn"), not the
 *  neutral placeholder. Used before any per-tenant fetch resolves (so the
 *  synchronous prerender path stays complete) and if that fetch fails — same
 *  "start from the FHE constant" posture BrandProvider already documents for
 *  brand. This is distinct from the DB's property_terms.FACILITY row, which is
 *  the neutral fallback resolve_property_term() gives a real *other* provisioned
 *  tenant who hasn't picked a word yet — bland is right for a stranger tenant;
 *  it would be wrong here, where the tenant is known (FHE) and its word is known. */
export const DEFAULT_PROPERTY_TERM: PropertyTerm = {
  key: 'RANCH',
  term: 'ranch',
  article: 'the',
  plural: false,
  preposition: 'at',
};

/** Merge a resolved property-term object (from my_property_term() / the
 *  org_public_config().property jsonb) onto the default shape, so a partial or
 *  missing payload still renders a complete, grammatically valid term. */
export function resolvePropertyTerm(raw?: Partial<PropertyTerm> | null): PropertyTerm {
  if (!raw) return DEFAULT_PROPERTY_TERM;
  return {
    key: raw.key ?? DEFAULT_PROPERTY_TERM.key,
    term: raw.term ?? DEFAULT_PROPERTY_TERM.term,
    article: raw.article ?? DEFAULT_PROPERTY_TERM.article,
    plural: raw.plural ?? DEFAULT_PROPERTY_TERM.plural,
    preposition: raw.preposition ?? DEFAULT_PROPERTY_TERM.preposition,
  };
}

/** "the ranch" / "the stables". */
export function withArticle(t: PropertyTerm): string {
  return `${t.article} ${t.term}`;
}

/** "at the ranch" / "on the grounds". */
export function withPreposition(t: PropertyTerm): string {
  return `${t.preposition} ${t.article} ${t.term}`;
}

/** Title-case the bare noun for headings — "Ranch", "Stables". */
export function titleCase(t: PropertyTerm): string {
  return t.term.charAt(0).toUpperCase() + t.term.slice(1);
}

/** "The ranch" / "The stables" — withArticle(), capitalized for sentence-start use. */
export function withArticleCapitalized(t: PropertyTerm): string {
  const s = withArticle(t);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Subject-verb agreement for a sentence built around the term as subject —
 *  "the stables HAVE" vs "the ranch HAS". Defaults cover the two irregular verbs
 *  that show up in this app's copy; pass overrides for others (e.g. 'was'/'were'). */
export function agree(t: PropertyTerm, singular: string, plural: string): string {
  return t.plural ? plural : singular;
}
