# TASK LEASESET — the lease family becomes Standard / Simple / Detailed, and the original is archived

**Owner ruling, 2026-08-11.** This answers the question `TASK-ONEAUTHOR` raised about the four
byte-identical lease templates. **The ruling is settled — implement it, do not re-open it.**

> *"the lease templates are intended to be the original, the recent revised version that is
> considered the standard default, a lower complexity one might be built and a more complex
> version might get built both of which would be derivatives of the default. We dont label the
> default as that we call it Standard. Until i modify the Simple, or the Detailed, we will
> continue to have 3 byte identical copies. The old version can be retired to archive and is not
> to be used except as reference for historical purposes or to resurrect something we dont like
> in the current version that was better in the old one (unlikely)"*

---

# MEASURED IN PRODUCTION, 2026-08-11

```
key                   title                              active  clauses  body_len  docs  created
HORSE_LEASE           Horse Lease Agreement              FALSE      0      18253     0    2026-07-02
HORSE_LEASE_V2        Horse Lease Agreement              true     163         23     6    2026-07-20
HORSE_LEASE_STANDARD  Horse Lease Agreement — Standard   true     163         23     0    2026-08-07
HORSE_LEASE_FULL      Horse Lease Agreement — Comprehensive true   163        23     0    2026-08-07
HORSE_LEASE_SIMPLE    Horse Lease Agreement — Simple     true     163         23     0    2026-08-07
```

The four clause-composed templates are byte-identical — one md5 across each full clause set,
`fa5326ba71f62f60743781a798274cfe`. `20260807121000_leasefork_three_lease_forks.sql` cloned
`_V2` three times on 2026-08-07 and **16 migrations since have written to all four in lockstep.**

## How the ruling maps onto the keys

| owner's word | key | why |
|---|---|---|
| **the original** | `HORSE_LEASE` | flat markdown, **18,253 chars of real body text** — the only one with wording that could be resurrected. Already `active = false`. |
| **Standard** (the default) | **`HORSE_LEASE_V2`** | the revised clause-composed version; holds **all 6 live lease documents**; the target of every `leasefix` migration. |
| **Simple** | `HORSE_LEASE_SIMPLE` | not yet modified — identical by design |
| **Detailed** | `HORSE_LEASE_FULL` | not yet modified — identical by design |
| *(nothing)* | `HORSE_LEASE_STANDARD` | **the redundant fourth.** 0 documents. The owner's model has three active copies; there are four. |

**`HORSE_LEASE_V2` IS the Standard. `HORSE_LEASE_STANDARD` is the duplicate that goes.**

This direction and not the reverse, for one decisive reason: **`_V2` carries the 6 live lease
documents.** Retitling a template is free; re-pointing signed documents at a different template
row is not, and 61 EXECUTED documents in this system are evidence that is never rewritten.

---

# WHAT TO DO

## 1. `HORSE_LEASE_V2` becomes the Standard — by TITLE only

Retitle to **`Horse Lease Agreement — Standard`**.

**DO NOT change `template_key`.** Six documents reference this template by `id`, 16 migrations
match on the key string, and the key is not user-visible. Renaming it would break every one of
those for a cosmetic gain. **The title is what a staff member reads; the key is plumbing.**

## 2. `HORSE_LEASE_STANDARD` → `active = false`

It is a zero-document duplicate of the row above. Deactivating removes it from the picker —
`listLeaseTemplates()` filters on `active` — while keeping its 163 clause rows intact.

**Delete nothing.** If the owner later wants the name on a different row, this is one `UPDATE`
back.

## 3. `HORSE_LEASE_FULL` retitle: "Comprehensive" → **"Detailed"**

The owner called it *"the Detailed"* twice. The existing title says "Comprehensive". Align it
to his word. **Title only — the key stays `HORSE_LEASE_FULL`**, for the same reason as §1.

## 4. `HORSE_LEASE` — make the archive explicit

It is already `active = false`, so it cannot be picked. Nothing anywhere *says* it is retained
deliberately, which is how a future cleanup deletes it as dead weight.

**Record it where a cleanup would look**: a comment in the migration, and a line in
`supabase/contract_templates/HORSE_LEASE.md` (already a pointer doc — see `CLAUDE.md`). The
substance to record: **retained as historical reference and as a source of wording that could be
resurrected; never to be activated or used to generate a document.**

**Do not add an `archived` column** unless one already exists — check first. A boolean nobody
reads is worse than a comment somebody finds.

## 5. Say what this does to the lockstep write

After this, the synchronised set is **`_V2` + `_SIMPLE` + `_FULL`** — three, not four.
`HORSE_LEASE_STANDARD` is inactive and **must stop receiving content updates**, or it will drift
into being a stale copy that someone reactivates by mistake.

**This is the operationally important half of the task.** Every future `leasefix` migration has
been pasting a four-key `IN` list. **Write the new three-key list down where the next author will
see it** — the top of `supabase/contract_templates/HORSE_LEASE.md`, which `CLAUDE.md` already
names as the place to read before touching lease wording.

## 6. Do not hide the three identical copies

The owner has explicitly accepted them: *"Until i modify the Simple, or the Detailed, we will
continue to have 3 byte identical copies."* The picker will show three lease options that
currently produce the same document. **That is the ruled state. Do not deactivate Simple or
Detailed to tidy the picker.**

**One thing worth improving rather than hiding:** `NewContractPage.tsx:222` renders a
`<select>` labelled "Lease version" with a `Default` option plus each title. With `_STANDARD`
gone that becomes Default + three. **"Default" is exactly the label the owner rejected** — *"We
dont label the default as that we call it Standard."* Make the picker name the Standard as
Standard. Keep the change minimal and describe it in the report.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-leaseset`, branch `task/leaseset`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **Do not edit `AppLayout.tsx`** (`TASK-NAVMOTION` owns it), **`DataTable.tsx`**
  (`TASK-FRAMESCROLL`), or the documents queue table/page (`TASK-DOCCOLS`). All may be running.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Change no clause content.** This task changes titles, one `active` flag, and documentation.
  **The 163 clause rows on every template are untouched**, and so is every generated document.
- **THE SIGNING FREEZE IS IN FORCE.** Nothing here lifts it.
- **The 6 live `HORSE_LEASE_V2` documents must be provably unaffected.** Their `template_id`,
  `merged_body`, `status` and `signed_template_version` are identical before and after — show it.
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name** (two used `_lf` and could not run together).
- Dry-run in `BEGIN; … ROLLBACK;` first, then apply, then verify with a query. **Apply your
  proven work — do not leave it held.**
- No staff browser session exists and you will not be given one. Prove against SQL; report the
  picker's render as **NOT VERIFIED**.

# THE TEST THIS MUST PASS

1. `HORSE_LEASE_V2` is titled **"Horse Lease Agreement — Standard"** and still has **6**
   documents, **163** clauses, and `active = true`.
2. `HORSE_LEASE_STANDARD` is `active = false` with its **163 clause rows still present**.
3. `HORSE_LEASE_FULL` reads **"Detailed"**; `HORSE_LEASE_SIMPLE` is unchanged; both stay active.
4. `HORSE_LEASE` is still inactive, still has its **18,253-character body**, and its retention
   is now recorded in writing.
5. `listLeaseTemplates()` returns **three** rows, and the picker no longer offers "Default".
6. The 6 live lease documents are byte-identical before and after — **prove it.**

Report to `docs/reports/TASK-LEASESET-REPORT.md`.
