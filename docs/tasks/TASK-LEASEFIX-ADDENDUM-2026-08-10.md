# LEASEFIX ADDENDUM — owner change set, 2026-08-10 (evening)

**This is an ADDENDUM. It does not replace `TASK-LEASEFIX-insurance-rulings-2026-08-10.md`.**
Everything in the rulings doc stands except where this file contradicts it.

**Owner's own words, and they are binding:**

> *"if any of the above listed changes conflict with earlier decisions for this content or
> these elements, this message supersedes those decisions."*

So where this addendum and the rulings doc disagree, **this file wins.** Do not re-litigate.

Every anchor below was read from **production** (`lrstswfxfsezdmvkvukc`) on 2026-08-10 by the
orchestrator. The `clause_key` / `field_key` values are exact. **Match on the key, never on
the prose** — several bodies share near-identical sentences.

---

# OWNER RULINGS, 2026-08-10 evening — THESE CLOSE B2, C4 AND D3

**All three open questions are answered. Do not ask again. Do not re-litigate.**

### D3 — the GL deductible split is DELETED

GL is the **Lessee's own** policy, so its deductible is the Lessee's by construction.
Retire `TXN.GL_DED_RESP`, `TXN.GL_DED_RESP_SPLIT_LESSOR`, `TXN.GL_DED_RESP_SPLIT_LESSEE`
and `INSURANCE_RISK.GL_DED_SPLITC`. Splits survive **only** on mortality and medical, which
are the Lessor's policies. §4 D1/D2 apply as written; §0b's renumber still happens and is what
actually clears the stray text out of the CCC block.

### D3a — THE AT-FAULT SCOPING IS LOAD-BEARING. DO NOT SIMPLIFY IT.

Owner, verbatim: *"the deductible only applies to Lessee when Lessee is at fault."*

The replacement sentence already carries that scoping in the fragment
**"arising from events for which Lessee bears responsibility, whether directly or
indirectly"**. You are removing a merge token from the end of that sentence. **The temptation
is to tidy the sentence while you are in it. Do not.** That fragment is the entire reason the
clause is not a blanket assignment of every deductible to the Lessee, and losing it changes
what the contract means while looking like a cleanup.

Reproduce the sentence **exactly** as given in §4 D1 and paste the composed output.

### C4 — `GL_LESSEE_PERSONAL` SURVIVES, with its existing conditional gate

Owner, verbatim: *"that option is only available when the Lessor doesnt require Lessee to
maintain."*

That is the `when` gate the option already carries (`GL_LESSOR_REQUIRES = NEITHER`). **Keep the
option, keep the clause, keep the gate.** The final menu is three entries:

| value | label | availability |
|---|---|---|
| `AGREES` | Agrees | always |
| `ACCEPTS_PERSONALLY` | Does not carry general liability insurance | **only when `GL_LESSOR_REQUIRES = NEITHER`** |
| `OTHER` | Other — text input | always |

This also settles the arithmetic in §3 C1: the owner's "two removed selection options" really
were only `HAS` and `WILL_OBTAIN`. **`ACCEPTS_PERSONALLY` was never in scope for removal** —
an earlier draft of this addendum wrongly suggested deleting it.

**§5 F6 is therefore answered too:** `CCC_NA` stays reachable, because the uninsured-Lessee
state still exists. Do not touch it.

### B2 — YES, the GL menu label becomes "maintain"

`TXN.GL_LESSOR_REQUIRES`, option `GL_ONLY`:
*"Requires Lessee to have or obtain general liability insurance"*
→ **"Requires Lessee to maintain general liability insurance"**

`NEITHER` is unchanged. This makes the menu agree with the body it prints (§2 B1).

---

# 0. TWO THINGS THAT ARE NOT IN THE OWNER'S LIST — READ BEFORE YOU START

## 0a. THE CCC SECTION WILL SILENTLY DISAPPEAR IF YOU DO ONLY WHAT IS ASKED

This is the most important paragraph in this document.

`TXN.GL_LESSEE_STATUS` today has options `HAS` / `WILL_OBTAIN` / `ACCEPTS_PERSONALLY`.
Item **C** below removes `HAS` and `WILL_OBTAIN`, adds `AGREES` and `OTHER`, and **retains
`ACCEPTS_PERSONALLY`** per the owner's C4 ruling.

**Eight other objects gate on the two values you are deleting.** Verified in production.
Note that `ACCEPTS_PERSONALLY` being retained does **not** save them — every one of these
gates names `HAS` and `WILL_OBTAIN` specifically:

```
FIELDS   TXN.CCC_REQUIRED          conditional_on: GL_LESSEE_STATUS equals [HAS, WILL_OBTAIN]
         TXN.CCC_LESSEE_STATUS     conditional_on: GL_LESSEE_STATUS equals [HAS, WILL_OBTAIN]

CLAUSES  INSURANCE_RISK.CCC_STATUS        INSURANCE_RISK.CCC_NA
         INSURANCE_RISK.CCC_NOT_REQUIRED  INSURANCE_RISK.CCC_REQ
         INSURANCE_RISK.GL_LESSEE_PERSONAL / _WILL / _RESP / _HAS
```

Change the options without changing the gates and `equals [HAS, WILL_OBTAIN]` can never match
again. **The entire care-custody-and-control section stops rendering, on every contract, with
no error.** Typecheck passes. The build passes. The clause simply is not there.

**Every gate that references a value you delete must be re-pointed in the same migration.**
When you are done, prove it: render a contract with the new `AGREES` value and show the CCC
clauses present in the composed body.

## 0b. THE MISPLACED DEDUCTIBLE TEXT IS A SORT-ORDER COLLISION, NOT A SECTION ERROR

Owner item: *"revise order of text to show deductible split … in the GL section, right now it
is showing in the CCC section."*

The cause is not section assignment — both are already in `INSURANCE_RISK`. **The sort orders
collide:**

```
GL_DED_SIMPLE   sort 170     CCC_PICK   sort 170     <- tie
GL_DED_SPLITC   sort 171     CCC_NA     sort 171     <- tie
```

A tie has no defined resolution, so the GL deductible clauses interleave into the CCC block.
**Renumber the GL deductible clauses to 164 / 165** (after `GL_LESSEE_RESP` at 163, before
`CCC_PICK` at 170). Do not renumber the CCC block — it is dense and other things point at it.

Then **sweep for every other duplicate `sort_order` within a section** and report what you
find. If this pair collided, others may. Report them even if you do not change them.

---

# 1. GL — LESSOR'S OWN COVERAGE

### A1. `INSURANCE_RISK.GL_LESSOR_COVERAGE_NONE` — replace `body`

FROM
> Lessor does not carry general liability insurance under this Agreement.

TO
> Lessor does not have general liability insurance for the Horse or the activities
> contemplated by this Agreement.

---

# 2. GL — WHAT LESSOR REQUIRES OF LESSEE

### B1. `INSURANCE_RISK.GL_REQUIRED` — replace `body`

FROM
> Lessor requires Lessee to **obtain and maintain**, at Lessee's sole cost, general liability
> insurance … **Failure to obtain or maintain that coverage** constitutes a material breach …

TO
> Lessor requires Lessee to maintain, at Lessee's sole cost, general liability insurance
> covering the Horse and the activities contemplated by this Agreement for the duration of
> this Agreement, and to provide proof of coverage to Lessor upon request. Failure to maintain
> coverage constitutes a material breach subject to the Termination for Cause provisions of
> this Agreement.

### B2. `TXN.GL_LESSOR_REQUIRES` — option label — **ANSWERED: YES, use "maintain". See the ruling block at the top. The reasoning below is retained only as the question that produced it.**

The `GL_ONLY` option currently reads *"Requires Lessee to have or obtain general liability
insurance"*. The owner asked for exactly this "have or obtain" → "maintain" shift on the CCC
selector (item F3) and described it as *"mirror the same changes"*, which implies GL leads.
He did not say it for GL explicitly.

**Ask. Do not infer it.** The likely answer is
*"Requires Lessee to maintain general liability insurance"*, but a menu label is what the
owner reads when authoring, and this thread does not author wording.

---

# 3. GL — LESSEE'S DECLARATION  (the biggest change)

### C1. `TXN.GL_LESSEE_STATUS` — replace the option set

FROM three options — `HAS` / `WILL_OBTAIN` / `ACCEPTS_PERSONALLY` (the last one carrying a
`when` gate on `GL_LESSOR_REQUIRES = NEITHER`).

TO **three** options — see the ruling block at the top of this file (C4). `ACCEPTS_PERSONALLY`
is **retained**, not removed:

| value | label | behaviour |
|---|---|---|
| `AGREES` | Agrees | renders the C2 body |
| `ACCEPTS_PERSONALLY` | Does not carry general liability insurance | **keep the existing `when` gate on `GL_LESSOR_REQUIRES = NEITHER`**; renders `GL_LESSEE_PERSONAL` unchanged |
| `OTHER` | Other | **text input**, renders what the author types |

Only `HAS` and `WILL_OBTAIN` are removed.

Use the existing `Other`-with-text-input pattern already used elsewhere in this template.
**Do not invent a new input mechanism.**

### C2. The `AGREES` body — use this text verbatim

> Lessee agrees to maintain general liability insurance covering the Horse and the activities
> contemplated by this Agreement for the duration of this Agreement, and shall provide to
> Lessor proof of coverage upon request. As between the parties, and except as otherwise
> expressly allocated in this Agreement, Lessee bears responsibility for liability claims for
> bodily injury or property damage to third parties arising from the Horse or the activities
> contemplated by this Agreement to the extent not covered by an in-force policy.

### C3. Retire three clauses

`INSURANCE_RISK.GL_LESSEE_HAS` · `INSURANCE_RISK.GL_LESSEE_WILL` ·
`INSURANCE_RISK.GL_LESSEE_RESP`

The owner's words: *"this removes the corresponding text options for the two removed selection
options and the separate third text segment where Lessee accepts financial responsibility for
the insurance."* `GL_LESSEE_RESP` is that third segment — its substance is folded into C2.

**Retire, do not hard-delete, if any executed document references them.** Executed documents
are evidence and are never rewritten. Check first, then choose, and say which you did.

### C4. `INSURANCE_RISK.GL_LESSEE_PERSONAL` — **ANSWERED: IT SURVIVES. See the ruling block at the top of this file. The discussion below is retained only as the reasoning that produced the question; the owner ruled AGAINST the recommendation in it.**

This is the *"Lessee does not carry general liability insurance … accepts personal financial
responsibility"* clause, driven by `ACCEPTS_PERSONALLY`.

The owner named **two** removed options (`HAS`, `WILL_OBTAIN`) — but the replacement menu is
`Agrees` / `Other` only, which leaves `ACCEPTS_PERSONALLY` unreachable, and its clause dead.

**Do not resolve this yourself.** Two coherent answers:
1. Delete it — `Other` + free text covers a Lessee who carries nothing.
2. Keep it as a third option — an uninsured Lessee is a materially different deal and may
   deserve its own fixed wording rather than whatever someone types.

Orchestrator's read, offered as input and not as a decision: **(1)**, because C2's own text
already allocates uncovered liability to the Lessee, which is what `GL_LESSEE_PERSONAL`
existed to say. But this is contract meaning, and it is the owner's call.

---

# 4. GL — DEDUCTIBLE

### D1. `INSURANCE_RISK.GL_DED_SIMPLE` — replace `body`, drop the token

FROM
> If a claim is made under any such policy … responsibility for any deductible shall be borne
> by: `{{TXN.GL_DED_RESP}}`

TO — **no merge token, the sentence now ends in a fixed word**
> For any and all such claims made against any such insurance policy arising from events for
> which Lessee bears responsibility, whether directly or indirectly, responsibility for any
> deductible shall be borne by Lessee

### D2. Remove the GL deductible selection menu

`TXN.GL_DED_RESP` is no longer referenced by any body. Retire it and its two split children
`TXN.GL_DED_RESP_SPLIT_LESSOR` / `_LESSEE`.

### D3. **CONFLICT — RESOLVE THIS BEFORE TOUCHING D1/D2**

D1/D2 delete the GL deductible menu, including its `Split` option. But item **0b** asks to
*relocate* the GL deductible **split** text. **A thing cannot be both deleted and repositioned.**

Orchestrator's read: the GL policy is the **Lessee's own** policy, so its deductible is the
Lessee's by construction — no split is meaningful, and `INSURANCE_RISK.GL_DED_SPLITC` should
go with `TXN.GL_DED_RESP`. Splits remain on **mortality and medical**, which are the *Lessor's*
policies, matching the owner's standing ruling that *"the deductible … can be a split."*
On that reading item 0b is simply the owner seeing GL deductible text in the wrong place and
asking for it to be moved — and the collision fix in 0b plus deletion in D2 both resolve it.

**Ask the owner to confirm before deleting `GL_DED_SPLITC`.** If he wants the split kept,
D1 and D2 do not apply and only the renumbering in 0b does.

---

# 5. CCC — CARE, CUSTODY AND CONTROL

### F1. `INSURANCE_RISK.CCC_NOT_REQUIRED` — replace `body`

FROM *"…does not require Lessee to **carry** care, custody and control coverage…"*
TO
> Lessor does not require Lessee to maintain care, custody and control coverage under this
> Agreement.

### F2. `INSURANCE_RISK.CCC_REQ` — replace `body`

Two edits: *"requires Lessee to **have**"* → *"requires Lessee to **maintain**"*, and drop
*"loss of,"* from the applicability sentence.

TO
> Lessor requires Lessee to maintain care, custody and control insurance for the duration of
> this Agreement. Care, custody and control insurance applies only where injury to, or death
> of the Horse is caused by Lessee's negligence. It shall not be claimed against merely
> because other coverage is unavailable, is not in force, or has denied a claim. Where a loss
> is caused by Lessee's negligence, care, custody and control insurance is the policy to be
> claimed against for that loss.

**Note:** the last sentence still says *"Where a loss is caused…"*. The owner removed
*"loss of"* only from the applicability sentence. **Leave the final sentence alone.**

### F3. `TXN.CCC_REQUIRED` — option labels

Owner: *"listed as `Lessor [does not require CCC] / [requires Lessee to maintain CCC]`"*

| value | from | to |
|---|---|---|
| `YES` | Requires Lessee to have or obtain care, custody and control coverage | Requires Lessee to maintain care, custody and control coverage |
| `NO` | Does not require care, custody and control coverage of Lessee | *unchanged* |

### F4. `TXN.CCC_LESSEE_STATUS` — replace the option set

FROM `HAS` ("has and will maintain") / `WILL_OBTAIN` ("will obtain and will maintain") /
`NONE` ("does not carry", gated on `CCC_REQUIRED = NO`).

TO exactly two:

| value | label |
|---|---|
| `AGREES` | agrees to maintain |
| `OTHER` | Other — **text input** |

Lower-case labels are deliberate: this token renders **inline mid-sentence** (see F5).

### F5. `INSURANCE_RISK.CCC_STATUS` — remove the colon

FROM
> Lessee: `{{TXN.CCC_LESSEE_STATUS}}` care, custody and control insurance covering the Horse
> while in Lessee's care, custody, or control.

TO
> Lessee `{{TXN.CCC_LESSEE_STATUS}}` care, custody and control insurance covering the Horse
> while in Lessee's care, custody, or control.

Composed with `AGREES` this must read:
*"Lessee agrees to maintain care, custody and control insurance covering the Horse while in
Lessee's care, custody, or control."* **Render it and paste the actual output in your report.**

### F6. `INSURANCE_RISK.CCC_NA` — check reachability, report, do not fix

`CCC_NA` says CCC is unavailable *because Lessee carries no GL*. If C4 resolves as "delete
`ACCEPTS_PERSONALLY`", that state may be unreachable. **Report it; do not act on it.**

---

# 6. STILL OWED FROM THE ORIGINAL RULINGS — NOT SUPERSEDED

The owner lists **"the changes to the mortality and medical insurance sections"** as
*requested but not landed*. That work is specified in
`TASK-LEASEFIX-insurance-rulings-2026-08-10.md` and is **still owed in full.**
Nothing in this addendum cancels it. If you have it in progress, finish it.

---

# 7. SCOPE, APPLY MODE, AND PROOF

- **All contracts are in scope.** Owner: *"the changes should affect all contracts. we dont
  have any real contracts in play right now."*
- **Sarah's `704c8d2d…` is a SAMPLE, not a live negotiation.** Template changes are EXPECTED
  to reach it. Do not scope around it. (Another session touched it at 02:54 on 2026-08-10 —
  that was not this task and is not a reason to avoid it.)
- **Selections at risk may be cleared.** Owner: *"any selections that are at risk can be
  cleared and removed without consequence. the real consequence is someone signing an outdated
  contract."*
- **THE SIGNING FREEZE IS IN FORCE.** *"nothing is going to be signed at all until this full
  revision session is done."* Nothing here is blocked by it — but nothing here lifts it.
- **Executed documents are never rewritten.** 61 of them. Retire, supersede — never edit.

**Apply mode: DRY-RUN, then STOP.** `BEGIN … ROLLBACK` with raw output, then report before
applying. This touches the wording of every lease in the system and it gets a review.

**A migration must not contain its own `COMMIT;`.** It ends the dry-run wrapper and applies
for real while you believe you are testing. This has already happened twice on this project.

**Prove the render, not the update.** For each changed clause, compose an actual document and
paste the composed prose. An `UPDATE` that reports success proves nothing — a body-rewrite
that matches nothing silently no-ops. Show:

1. CCC clauses **present** in a composed body under the new `AGREES` value (the 0a landmine)
2. GL deductible clauses ordered **before** CCC in a composed body (the 0b collision)
3. The F5 sentence composed, verbatim
4. The C2 body composed, verbatim
5. Row counts unchanged on `documents` and `signatures`

**ALL THREE OWNER QUESTIONS ARE NOW ANSWERED** — see the ruling block at the top of this file. Nothing in this addendum is blocked. Superseded question text:
**B2** (GL menu label) · **C4** (does `GL_LESSEE_PERSONAL` survive) · **D3** (does the GL
deductible split survive). Everything else proceeds without waiting.
