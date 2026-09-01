# Lease map — the insurance and risk system of HORSE_LEASE_V2

Four files. Read them in this order.

| File | What it is |
|---|---|
| [FIELD-MAP.md](FIELD-MAP.md) | Every field the insurance sections touch. What each one turns on and off. |
| [CLAUSE-MAP.md](CLAUSE-MAP.md) | Every one of the 35 insurance clauses. When it prints, when it can never print. |
| [SCENARIOS.md](SCENARIOS.md) | Nine configurations traced end to end — the printed text, in order. |
| [APPENDIX-JSON.md](APPENDIX-JSON.md) | Raw gate JSON and the composer's rules, for anyone verifying the above. |

CSV copies sit alongside the two long tables (`FIELD-MAP.csv`, `CLAUSE-MAP.csv`).

The findings — dead content, contradictions, silent holes, single points of
failure, and which fields are a party's own declaration — are in
[../../reports/TASK-LEASEMAP-REPORT.md](../../reports/TASK-LEASEMAP-REPORT.md).

## The shape of the thing, in one paragraph

The insurance section is a **sink**. Nothing anywhere else in the lease reads an
insurance field, and no insurance clause is gated on anything outside itself
except three fields: `LESSEE.PARTY_TYPE`, `TXN.PERMITTED_ACTIVITIES`, and
`HORSE.FAIR_MARKET_VALUE` (the last of which is printed, not tested). So the
blast radius of an insurance change is contained — but the reverse is not true:
changing `LESSEE.PARTY_TYPE` moves twelve clauses across five sections, two of
which are insurance clauses.

Inside the section there are three parallel blocks — General Liability (GL),
Mortality (MORT), Medical (MED) — built from the same six-field pattern, plus a
fixed tail of nine clauses that print no matter what anyone chooses, plus four
more that depend only on which activities are permitted.

## Prior art

`docs/archive/CONDITIONAL_CLAUSES.md` lists the gates for the whole template. It was
written against a 129-clause version (the template now has 144) and it stops at
the gate: it says what a clause is conditioned on, not what happens to the rest
of the document when that condition changes. This map resolves the gates into
consequences in both directions and traces them to printed text.
