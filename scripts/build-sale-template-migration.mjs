#!/usr/bin/env node
/* build-sale-template-migration.mjs — generate the HORSE_SALE_V2 + HORSE_BILL_OF_SALE
 * clause-model seed migration from the canonical content files in
 * docs/contract-content/. Bodies load VERBATIM from the .md sources — never edit
 * the generated SQL's legal text by hand; edit the content file and re-run:
 *
 *   node scripts/build-sale-template-migration.mjs
 *
 * Output: supabase/migrations/20260802090000_sale_and_bos_templates.sql
 *
 * Idempotency follows the lease-seed precedent (20260720170000): delete-then-insert
 * scoped to the two template_keys. Field defs are curated here (the content files
 * specify them in prose); HORSE.* identity defs are DERIVED from the live
 * HORSE_LEASE_V2 rows at apply time (INSERT..SELECT) so record auto-import wiring
 * matches — plus hand rows for HORSE.BARN_NAME / HORSE.HEIGHT, which the sale
 * bodies reference but the lease never carried.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'supabase/migrations/20260802090000_sale_and_bos_templates.sql')

// ── content-file parser (structure only; bodies verbatim) ────────────────────
function parse(path) {
  const lines = readFileSync(path, 'utf8').split('\n')
  const sections = []
  let cur = null, clause = null, inBody = false, bodyLines = []
  const flush = () => {
    if (!clause) return
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop()
    clause.body = bodyLines.join('\n')
    cur.clauses.push(clause)
    clause = null; bodyLines = []; inBody = false
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const sec = line.match(/^## SECTION (\d+) — key ([A-Z0-9_]+), heading "(.+)"/)
    if (sec) { flush(); cur = { order: +sec[1], key: sec[2], heading: sec[3], clauses: [] }; sections.push(cur); continue }
    const cl = line.match(/^CLAUSE ([A-Z0-9_.]+) — heading (NULL|"[^"]*"), type (input|prose), conditional (NULL|\{.*\})$/)
    if (cl) {
      flush()
      clause = { key: cl[1], heading: cl[2] === 'NULL' ? null : cl[2].slice(1, -1), type: cl[3], cond: cl[4] === 'NULL' ? null : JSON.parse(cl[4]) }
      continue
    }
    if (line.startsWith('CLAUSE ')) { flush(); continue } // structural note (DEFINITIONS_NOTE)
    if (clause && line === 'BODY:') { inBody = true; bodyLines = []; continue }
    if (inBody) {
      if (/^(CLAUSE |FIELD: |FIELDS:|## SECTION )/.test(line)) { flush(); if (/^(## SECTION |CLAUSE )/.test(line)) i--; continue }
      bodyLines.push(line)
    }
  }
  flush()
  return sections
}

// ── SQL helpers ──────────────────────────────────────────────────────────────
const q = (s) => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`
const body = (s) => `$BODY$${s}$BODY$`
const jb = (o) => o == null ? 'NULL' : `${q(JSON.stringify(o))}::jsonb`
const opts = (pairs) => pairs == null ? 'NULL' : jb(pairs.map(([label, value]) => ({ label, value })))

// ── shared option sets / conditions ──────────────────────────────────────────
const YESNO = [['Yes', 'YES'], ['No', 'NO']]
const INDENT = [['Individual', 'INDIVIDUAL'], ['Entity / organization', 'ENTITY']]
const INCNOT = [['Included', 'INCLUDED'], ['Not included', 'NOT_INCLUDED']]
const BUYSELL = [['Buyer', 'BUYER'], ['Seller', 'SELLER']]
const eq = (field_key, v) => ({ equals: [v], field_key })
const COB_YES = eq('TXN.CO_BUYER_ENABLED', 'YES')

// field spec: [key, label, section, clause, owner, kind, options, cond, required]
// kind ∈ text|longtext|select|buttons|currency|date|number → live triplet convention
const KIND = {
  text: ['text', 'text', 'text'],
  longtext: ['longtext', 'longtext', 'longtext'],
  select: ['select', 'select', 'select'],
  buttons: ['checkbox', 'buttons', 'buttons'],
  currency: ['currency', 'currency', 'currency'],
  date: ['date', 'date', 'date'],
  number: ['number', 'number', 'number'],
}

const COBUYER_CONTACT = (section, clauseKey) => [
  ['COBUYER.FULL_NAME', 'Co-Buyer name', section, clauseKey, 'COBUYER', 'text', null, COB_YES, true],
  ['COBUYER.ADDRESS', 'Co-Buyer address', section, clauseKey, 'COBUYER', 'text', null, COB_YES, true],
  ['COBUYER.PHONE', 'Co-Buyer phone', section, clauseKey, 'COBUYER', 'text', null, COB_YES, false],
  ['COBUYER.EMAIL', 'Co-Buyer email', section, clauseKey, 'COBUYER', 'text', null, COB_YES, false],
  ['COBUYER.PRINTED_NAME', 'Co-Buyer printed name', section, clauseKey, 'COBUYER', 'text', null, COB_YES, false],
  ['COBUYER.PARTY_TYPE', 'Co-Buyer is an', section, clauseKey, 'COBUYER', 'select', INDENT, COB_YES, true],
  ['TXN.CO_BUYER_TITLE_FORM', 'How will title be held?', section, clauseKey, 'DEAL', 'select', [
    ['Joint tenants with right of survivorship', 'JTWROS'],
    ['Tenants in common in equal shares', 'TIC_EQUAL'],
    ['Tenants in common in the shares stated below', 'TIC_STATED'],
    ['As stated below', 'OTHER'],
  ], COB_YES, true],
]
const TITLE_DETAIL_COND = { any: [eq('TXN.CO_BUYER_TITLE_FORM', 'TIC_STATED'), eq('TXN.CO_BUYER_TITLE_FORM', 'OTHER')] }

const ENTITY_SIGNERS = (tpl) => {
  const c = tpl === 'SALE' ? 'SIGNATURES' : 'BOS_SIGNATURES'
  return [
    ['SELLER.ENTITY_SIGNER_NAME', 'Signing individual — name', c, `${c}.SELLER_CAPACITY`, 'SELLER', 'text', null, eq('SELLER.PARTY_TYPE', 'ENTITY'), true],
    ['SELLER.ENTITY_SIGNER_TITLE', 'Signing individual — title', c, `${c}.SELLER_CAPACITY`, 'SELLER', 'text', null, eq('SELLER.PARTY_TYPE', 'ENTITY'), true],
    ['BUYER.ENTITY_SIGNER_NAME', 'Signing individual — name', c, `${c}.BUYER_CAPACITY`, 'BUYER', 'text', null, eq('BUYER.PARTY_TYPE', 'ENTITY'), true],
    ['BUYER.ENTITY_SIGNER_TITLE', 'Signing individual — title', c, `${c}.BUYER_CAPACITY`, 'BUYER', 'text', null, eq('BUYER.PARTY_TYPE', 'ENTITY'), true],
    ['COBUYER.ENTITY_SIGNER_NAME', 'Signing individual — name', c, `${c}.COBUYER_CAPACITY`, 'COBUYER', 'text', null, { all: [COB_YES, eq('COBUYER.PARTY_TYPE', 'ENTITY')] }, true],
    ['COBUYER.ENTITY_SIGNER_TITLE', 'Signing individual — title', c, `${c}.COBUYER_CAPACITY`, 'COBUYER', 'text', null, { all: [COB_YES, eq('COBUYER.PARTY_TYPE', 'ENTITY')] }, true],
  ]
}

// ── HORSE_SALE_V2 field curation ─────────────────────────────────────────────
// Gate-driver selects with a PENDING clause link to that pending clause so an
// unanswered gate is a required field on a VISIBLE clause — contract_lock_blockers
// then blocks locking, which is the content files' stated blocks-signing behavior.
const SALE_FIELDS = [
  ['SELLER.PARTY_TYPE', 'Seller is an', 'PARTIES', 'PARTIES.INTRO', 'SELLER', 'select', INDENT, null, true],
  ['BUYER.PARTY_TYPE', 'Buyer is an', 'PARTIES', 'PARTIES.INTRO', 'BUYER', 'select', INDENT, null, true],
  ['TXN.CO_BUYER_ENABLED', 'Is there a co-buyer?', 'PARTIES', 'PARTIES.CO_BUYER_PENDING', 'DEAL', 'select', YESNO, null, true],
  ...COBUYER_CONTACT('PARTIES', 'PARTIES.CO_BUYER'),
  ['TXN.CO_BUYER_TITLE_DETAIL', 'Title detail', 'PARTIES', 'PARTIES.CO_BUYER_TITLE_DETAIL', 'DEAL', 'text', null, TITLE_DETAIL_COND, true],
  ['TXN.HAS_ENCUMBRANCES', 'Any liens, leases, or other encumbrances?', 'HORSE', 'HORSE.ENCUMBRANCES', 'SELLER', 'select', YESNO, null, true],
  ['TXN.DISCLOSED_ENCUMBRANCES', 'Encumbrance details', 'HORSE', 'HORSE.ENCUMBRANCES', 'SELLER', 'longtext', null, eq('TXN.HAS_ENCUMBRANCES', 'YES'), true],
  ['TXN.KNOWN_CONDITIONS', 'Known conditions and history', 'HORSE', 'HORSE.DISCLOSURES', 'SELLER', 'longtext', null, null, true],
  ['TXN.INJURY_HISTORY', "Has anyone been seriously injured by the Horse's direct actions?", 'HORSE', 'HORSE.INJURY_HISTORY_PENDING', 'SELLER', 'select', YESNO, null, true],
  ['TXN.INJURY_HISTORY_DETAILS', 'Injury history details', 'HORSE', 'HORSE.INJURY_HISTORY_DISCLOSED', 'SELLER', 'longtext', null, eq('TXN.INJURY_HISTORY', 'YES'), true],
  ['TXN.BREEDING_ELECTION', 'Breeding warranty', 'HORSE', 'HORSE.BREEDING', 'DEAL', 'select', INCNOT, null, true],
  ['TXN.BREEDING_BASIS', 'Reproductive exam or records', 'HORSE', 'HORSE.BREEDING', 'SELLER', 'longtext', null, eq('TXN.BREEDING_ELECTION', 'INCLUDED'), true],
  ['TXN.BREEDING_CLAIM_WINDOW', 'Claim window (days)', 'HORSE', 'HORSE.BREEDING', 'DEAL', 'number', null, eq('TXN.BREEDING_ELECTION', 'INCLUDED'), true],
  ['TXN.PURCHASE_PRICE', 'Purchase price', 'PRICE', 'PRICE.AMOUNT', 'DEAL', 'currency', null, null, true],
  ['TXN.DEPOSIT_ENABLED', 'Deposit', 'PRICE', 'PRICE.DEPOSIT', 'DEAL', 'select', YESNO, null, true],
  ['TXN.DEPOSIT_AMOUNT', 'Deposit amount', 'PRICE', 'PRICE.DEPOSIT', 'DEAL', 'currency', null, eq('TXN.DEPOSIT_ENABLED', 'YES'), true],
  ['TXN.PAYMENT_METHODS', 'Accepted payment methods', 'PRICE', 'PRICE.PAYMENT_METHOD', 'DEAL', 'buttons', [['Cash', 'CASH'], ['Zelle', 'ZELLE'], ['Credit Card', 'CREDIT_CARD']], null, true],
  ['TXN.INSTALLMENTS_ENABLED', 'Installment payment', 'PRICE', 'PRICE.INSTALLMENTS_PENDING', 'DEAL', 'select', YESNO, null, true],
  ['TXN.INSTALLMENT_SCHEDULE', 'Installment schedule', 'PRICE', 'PRICE.INSTALLMENTS', 'DEAL', 'longtext', null, eq('TXN.INSTALLMENTS_ENABLED', 'YES'), true],
  ['TXN.INSTALLMENT_LOCATION', 'Horse location during installments', 'PRICE', 'PRICE.INSTALLMENTS', 'DEAL', 'text', null, eq('TXN.INSTALLMENTS_ENABLED', 'YES'), true],
  ['TXN.FINANCING_ELECTION', 'Financing contingency', 'PRICE', 'PRICE.FINANCING', 'DEAL', 'select', INCNOT, null, true],
  ['TXN.FINANCING_AMOUNT', 'Financing amount', 'PRICE', 'PRICE.FINANCING', 'DEAL', 'currency', null, eq('TXN.FINANCING_ELECTION', 'INCLUDED'), true],
  ['TXN.FINANCING_DEADLINE', 'Financing deadline', 'PRICE', 'PRICE.FINANCING', 'DEAL', 'date', null, eq('TXN.FINANCING_ELECTION', 'INCLUDED'), true],
  ['TXN.SALES_TAX_RESPONSIBLE', 'Transfer tax responsibility', 'PRICE', 'PRICE.TAXES', 'DEAL', 'select', BUYSELL, null, true],
  ['TXN.PPE_CHOICE', 'Pre-purchase examination', 'PPE', 'PPE.PENDING', 'BUYER', 'select', [['Conducted', 'CONDUCTED'], ['Waived', 'WAIVED']], null, true],
  ['TXN.PPE_CONTINGENT', 'Sale contingent on exam results', 'PPE', 'PPE.CONTINGENCY', 'DEAL', 'select', YESNO, eq('TXN.PPE_CHOICE', 'CONDUCTED'), true],
  ['TXN.PPE_DEADLINE', 'Examination deadline', 'PPE', 'PPE.CONDUCTED', 'DEAL', 'date', null, eq('TXN.PPE_CHOICE', 'CONDUCTED'), true],
  ['TXN.DRUG_TEST_ELECTION', 'Drug and substance testing', 'PPE', 'PPE.DRUG_TESTING', 'DEAL', 'select', INCNOT, null, true],
  ['TXN.DRUG_TEST_WINDOW', 'Testing window (days)', 'PPE', 'PPE.DRUG_TESTING', 'DEAL', 'number', null, eq('TXN.DRUG_TEST_ELECTION', 'INCLUDED'), true],
  ['TXN.TRIAL_ENABLED', 'Trial period', 'TRIAL', 'TRIAL.PENDING', 'DEAL', 'select', YESNO, null, true],
  ['TXN.TRIAL_START', 'Trial start', 'TRIAL', 'TRIAL.TERMS', 'DEAL', 'date', null, eq('TXN.TRIAL_ENABLED', 'YES'), true],
  ['TXN.TRIAL_END', 'Trial end', 'TRIAL', 'TRIAL.TERMS', 'DEAL', 'date', null, eq('TXN.TRIAL_ENABLED', 'YES'), true],
  ['TXN.TRIAL_LOCATION', 'Trial location', 'TRIAL', 'TRIAL.TERMS', 'DEAL', 'text', null, eq('TXN.TRIAL_ENABLED', 'YES'), true],
  ['TXN.TRIAL_INSURANCE_RESPONSIBLE', 'Trial mortality insurance paid by', 'TRIAL', 'TRIAL.TERMS', 'DEAL', 'select', BUYSELL, eq('TXN.TRIAL_ENABLED', 'YES'), true],
  ['TXN.DELIVERY_LOCATION', 'Delivery location', 'DELIVERY', 'DELIVERY.TERMS', 'DEAL', 'text', null, null, true],
  ['TXN.DELIVERY_DATE', 'Delivery date', 'DELIVERY', 'DELIVERY.TERMS', 'DEAL', 'date', null, null, true],
  ['TXN.TRANSPORT_RESPONSIBLE', 'Transport arranged by', 'DELIVERY', 'DELIVERY.TERMS', 'DEAL', 'select', BUYSELL, null, true],
  ['TXN.TRANSPORT_COST_RESPONSIBLE', 'Transport paid by', 'DELIVERY', 'DELIVERY.TERMS', 'DEAL', 'select', BUYSELL, null, true],
  ['TXN.BOARD_RATE_AFTER', 'Board rate after missed delivery (per day)', 'DELIVERY', 'DELIVERY.TERMS', 'DEAL', 'currency', null, null, true],
  ['TXN.TRANSFER_FEES_RESPONSIBLE', 'Registry transfer fees', 'DELIVERY', 'DELIVERY.PAPERS', 'DEAL', 'select', BUYSELL, null, true],
  ['TXN.NO_SLAUGHTER_ELECTION', 'No-slaughter covenant', 'DELIVERY', 'DELIVERY.NO_SLAUGHTER', 'DEAL', 'select', INCNOT, null, true],
  ...ENTITY_SIGNERS('SALE'),
]

// ── HORSE_BILL_OF_SALE field curation ────────────────────────────────────────
const BOS_FIELDS = [
  ['SELLER.PARTY_TYPE', 'Seller is an', 'BOS_TITLE', 'BOS_TITLE.INTRO', 'SELLER', 'select', INDENT, null, true],
  ['BUYER.PARTY_TYPE', 'Buyer is an', 'BOS_TITLE', 'BOS_TITLE.INTRO', 'BUYER', 'select', INDENT, null, true],
  ['TXN.CO_BUYER_ENABLED', 'Is there a co-buyer?', 'BOS_TITLE', 'BOS_TITLE.CO_BUYER', 'DEAL', 'select', YESNO, null, true],
  ...COBUYER_CONTACT('BOS_TITLE', 'BOS_TITLE.CO_BUYER'),
  ['TXN.CO_BUYER_TITLE_DETAIL', 'Title detail', 'BOS_TITLE', 'BOS_TITLE.CO_BUYER', 'DEAL', 'text', null, TITLE_DETAIL_COND, true],
  ['TXN.PURCHASE_PRICE', 'Purchase price', 'BOS_CONSIDERATION', 'BOS_CONSIDERATION.PRICE', 'DEAL', 'currency', null, null, true],
  ['TXN.BOS_PAYMENT_STATUS', 'Payment status at execution', 'BOS_CONVEYANCE', 'BOS_CONVEYANCE.PENDING', 'DEAL', 'select', [['Paid in full', 'PAID_IN_FULL'], ['Installments', 'INSTALLMENTS']], null, true],
  ['TXN.BOS_HAS_SALE_AGREEMENT', 'Accompanying sale agreement', 'BOS_WARRANTY', 'BOS_WARRANTY.PENDING', 'DEAL', 'select', YESNO, null, true],
  ['TXN.AGENT_ELECTION', 'Compensated agent or intermediary', 'BOS_AGENT', 'BOS_AGENT.PENDING', 'DEAL', 'select', INCNOT, null, true],
  ['TXN.AGENT_NAME', 'Agent name', 'BOS_AGENT', 'BOS_AGENT.DISCLOSURE', 'DEAL', 'text', null, eq('TXN.AGENT_ELECTION', 'INCLUDED'), true],
  ['TXN.AGENT_ACTING_FOR', 'Acting on behalf of', 'BOS_AGENT', 'BOS_AGENT.DISCLOSURE', 'DEAL', 'select', [['Seller', 'SELLER'], ['Buyer', 'BUYER'], ['Both parties', 'BOTH']], eq('TXN.AGENT_ELECTION', 'INCLUDED'), true],
  ['TXN.AGENT_COMPENSATION', 'Compensation (amount or formula)', 'BOS_AGENT', 'BOS_AGENT.DISCLOSURE', 'DEAL', 'text', null, eq('TXN.AGENT_ELECTION', 'INCLUDED'), true],
  ['TXN.AGENT_PAID_BY', 'Compensation paid by', 'BOS_AGENT', 'BOS_AGENT.DISCLOSURE', 'DEAL', 'select', [['Seller', 'SELLER'], ['Buyer', 'BUYER'], ['Both parties', 'BOTH']], eq('TXN.AGENT_ELECTION', 'INCLUDED'), true],
  ['TXN.NOTARY_ELECTION', 'Notary acknowledgment', 'BOS_SIGNATURES', 'BOS_SIGNATURES.NOTARY', 'DEAL', 'select', INCNOT, null, true],
  ...ENTITY_SIGNERS('BOS'),
]

// HORSE identity tokens each template's bodies actually reference (derived defs)
const SALE_HORSE_COPY = ['HORSE.REGISTERED_NAME', 'HORSE.COLOR', 'HORSE.MARKINGS', 'HORSE.BREED', 'HORSE.REGISTRATION_NUMBER', 'HORSE.SEX', 'HORSE.AGE_DOB', 'HORSE.MICROCHIP', 'HORSE.PASSPORT_NUMBER', 'HORSE.CURRENT_LOCATION']
const BOS_HORSE_COPY = SALE_HORSE_COPY.filter((k) => k !== 'HORSE.CURRENT_LOCATION')

// ── emit ─────────────────────────────────────────────────────────────────────
const sale = parse(resolve(ROOT, 'docs/contract-content/HORSE_SALE_V2_TEMPLATE.md'))
const bos = parse(resolve(ROOT, 'docs/contract-content/HORSE_BILL_OF_SALE_TEMPLATE.md'))

const out = []
out.push(`/*
  # HORSE_SALE_V2 + HORSE_BILL_OF_SALE — clause-model template seed

  GENERATED by scripts/build-sale-template-migration.mjs from the canonical
  content files in docs/contract-content/ (2026-08-02 final legal drafts).
  Do not edit legal text here — edit the content file and re-run the generator.

  Idempotent: delete-then-insert scoped to the two template_keys (the lease-seed
  precedent). HORSE.* identity defs are derived from live HORSE_LEASE_V2 rows.
*/

DELETE FROM contract_field_defs   WHERE template_key IN ('HORSE_SALE_V2','HORSE_BILL_OF_SALE');
DELETE FROM contract_clause_defs  WHERE template_key IN ('HORSE_SALE_V2','HORSE_BILL_OF_SALE');
DELETE FROM contract_section_defs WHERE template_key IN ('HORSE_SALE_V2','HORSE_BILL_OF_SALE');

-- template rows (body placeholder: clause-model templates compose from clauses)
INSERT INTO contract_templates (template_key, title, party_namespaces, body, version, active, contract_kind)
VALUES
  ('HORSE_SALE_V2', 'Horse Sale and Purchase Agreement', ARRAY['SELLER','BUYER'], '(composed from clauses)', 1, true, 'HORSE_SALE'),
  ('HORSE_BILL_OF_SALE', 'Equine Bill of Sale', ARRAY['SELLER','BUYER'], '(composed from clauses)', 1, true, 'HORSE_BILL_OF_SALE')
ON CONFLICT (template_key) DO NOTHING;

-- kind registration also for pre-existing rows (re-run / partial-state safety)
UPDATE contract_templates SET contract_kind = 'HORSE_SALE'
 WHERE template_key = 'HORSE_SALE_V2' AND contract_kind IS DISTINCT FROM 'HORSE_SALE';
UPDATE contract_templates SET contract_kind = 'HORSE_BILL_OF_SALE'
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND contract_kind IS DISTINCT FROM 'HORSE_BILL_OF_SALE';
`)

function emitTemplate(tkey, sections) {
  out.push(`\n-- ═══ ${tkey}: sections ═══`)
  for (const s of sections) {
    out.push(`INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES (${q(tkey)}, ${q(s.key)}, ${q(s.heading)}, ${s.order * 10});`)
  }
  out.push(`\n-- ═══ ${tkey}: clauses (bodies verbatim from the content file) ═══`)
  for (const s of sections) {
    let n = 0
    for (const c of s.clauses) {
      n += 10
      out.push(`INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)`)
      out.push(`VALUES (${q(tkey)}, ${q(s.key)}, ${q(c.key)}, ${q(c.heading)}, ${body(c.body)}, ${q(c.type)}, ${n}, ${jb(c.cond)});`)
    }
  }
}

emitTemplate('HORSE_SALE_V2', sale)
emitTemplate('HORSE_BILL_OF_SALE', bos)

function emitFields(tkey, fields) {
  out.push(`\n-- ═══ ${tkey}: field defs ═══`)
  let n = 0
  for (const [key, label, section, clause, owner, kind, options, cond, required] of fields) {
    n += 10
    const [vt, ik, ft] = KIND[kind]
    out.push(`INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role, value_type, input_kind, format_type, options, conditional_on, required, sort_order)`)
    out.push(`VALUES (${q(tkey)}, ${q(key)}, ${q(label)}, ${q(section)}, ${q(clause)}, ${q(owner)}, ${q(vt)}, ${q(ik)}, ${q(ft)}, ${opts(options)}, ${jb(cond)}, ${required}, ${n});`)
  }
}

emitFields('HORSE_SALE_V2', SALE_FIELDS)
emitFields('HORSE_BILL_OF_SALE', BOS_FIELDS)

function emitHorseCopy(tkey, keys, section, clause, sortBase) {
  out.push(`
-- ${tkey}: HORSE identity defs derived from the live lease rows (owner → SELLER)
INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role,
       value_type, input_kind, format_type, options, conditional_on, required, sort_order, guidance)
SELECT ${q(tkey)}, d.field_key, d.label, ${q(section)}, ${q(clause)}, 'SELLER',
       d.value_type, d.input_kind, d.format_type, d.options, NULL, d.required,
       ${sortBase} + (row_number() OVER (ORDER BY d.sort_order))::int * 10, d.guidance
  FROM contract_field_defs d
 WHERE d.template_key = 'HORSE_LEASE_V2'
   AND d.field_key IN (${keys.map(q).join(', ')})
ON CONFLICT (template_key, field_key) DO NOTHING;

-- barn name + height: referenced by the ${tkey} bodies; the lease never carried defs
INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role, value_type, input_kind, format_type, required, sort_order)
VALUES
  (${q(tkey)}, 'HORSE.BARN_NAME', 'Barn name', ${q(section)}, ${q(clause)}, 'SELLER', 'text', 'text', 'text', false, ${sortBase + 2}),
  (${q(tkey)}, 'HORSE.HEIGHT', 'Height', ${q(section)}, ${q(clause)}, 'SELLER', 'text', 'text', 'text', false, ${sortBase + 4})
ON CONFLICT (template_key, field_key) DO NOTHING;`)
}

emitHorseCopy('HORSE_SALE_V2', SALE_HORSE_COPY, 'HORSE', 'HORSE.IDENTITY', 5000)
emitHorseCopy('HORSE_BILL_OF_SALE', BOS_HORSE_COPY, 'BOS_HORSE', 'BOS_HORSE.IDENTITY', 5000)

out.push('')
writeFileSync(OUT, out.join('\n'))
const nSale = sale.reduce((a, s) => a + s.clauses.length, 0)
const nBos = bos.reduce((a, s) => a + s.clauses.length, 0)
console.log(`wrote ${OUT}`)
console.log(`HORSE_SALE_V2: ${sale.length} sections, ${nSale} clauses, ${SALE_FIELDS.length} curated + ${SALE_HORSE_COPY.length + 2} horse defs`)
console.log(`HORSE_BILL_OF_SALE: ${bos.length} sections, ${nBos} clauses, ${BOS_FIELDS.length} curated + ${BOS_HORSE_COPY.length + 2} horse defs`)
