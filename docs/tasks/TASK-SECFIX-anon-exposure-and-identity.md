# TASK SECFIX — anon data exposure and profile identity takeover

**Priority: highest open item.** Three confirmed vulnerabilities in production, two of
them exploitable by anyone holding the public anon key — which ships in the client bundle
by design.

Found by `TASK-ACCTEVAL`. **Independently re-verified by the orchestrator against prod
2026-08-06** — every fact below was reproduced, not accepted.

No evidence of exploitation. This is exposure, not a known breach.

---

## S1 — Five views leak real data to `anon`

Five views in `public` are owned by `postgres`, carry **no `security_invoker`**, and grant
SELECT to `anon`. Because `postgres` holds `rolbypassrls`, the views bypass RLS entirely.

Reproduced with `SET LOCAL ROLE anon`:

| View | Rows visible to anon | Sensitive content |
|---|---|---|
| `clients_overview` | 14 | client records |
| `inbound_queue` | 11 | contact emails/phones **plus `staff_notes`** |
| `memberships` | 9 | membership records |
| `member_directory` | 6 | `email`, `mobile`, `whatsapp` + 4 community channels |
| `service_credits` | 0 | (empty today; same defect) |

**40 rows of real member and client data readable without authentication.**

### Known app usage — do not break these

- `member_directory` → `src/lib/community.ts` (authenticated community feature)
- `inbound_queue` → `src/lib/ops/api-intake.ts` (staff)
- `clients_overview`, `memberships`, `service_credits` → **no reference in `src/` or
  `api/`**. Confirm that yourself before assuming they are unused.

## S2 — A member can take over another contact's identity

**The most severe of the three.**

`authenticated` holds UPDATE on `profiles.contact_id`. The `profiles_update_own` policy's
check is:

```
user_id = auth.uid() OR app_role() = 'SUPER_ADMIN' OR (is_admin() AND …)
```

It confirms the row belongs to the caller. It **never constrains `contact_id`**. So any
logged-in member can repoint their own profile at any other contact row.

`current_contact_id()` derives from that column, and every contact-scoped RLS policy in
the system is built on it — including the party-read policies shipped today. The result is
not data leakage but **full identity assumption**.

No client-side code writes `profiles.contact_id` (`src/lib/admin.ts:126` writes
`contacts.phone` *using* it, which is a read).

## S3 — `anon` can execute a SECURITY DEFINER writer

`_ensure_client_account(p_org, p_email, p_first_name, p_last_name, p_categories,
p_template_keys, p_marker)` is `SECURITY DEFINER`, `anon` holds EXECUTE, and it validates
only that `p_org` and email are non-null — **no caller check**. It writes `contacts`,
`clients`, and `contact_required_documents`, into **any org passed as a parameter**.

Its four legitimate callers are all other database functions — `provision_client_invitation`,
`redeem_gift`, `redeem_contract_invitation`, `ensure_gift_buyer_account` — which run with
their own rights and do **not** depend on `anon`'s grant. No direct call from `src/` or
`api/`.

---

## Fix order — S2 first

S2 is identity takeover; S1 and S3 are exposure and unauthorised writes. Fix S2 first, and
land it separately so it can be verified and, if necessary, reverted on its own.

### S2

Revoke the column privilege: `REVOKE UPDATE (contact_id) ON profiles FROM authenticated`.

Prefer this over a trigger — it is declarative and cannot be bypassed by a code path that
forgets to check. Confirm first that no legitimate authenticated write sets `contact_id`;
definer functions run as owner and are unaffected by this grant.

If a legitimate authenticated path does exist, **stop and report** rather than choosing a
weaker fix on your own.

### S1

`ALTER VIEW … SET (security_invoker = true)` on all five. This is the correct fix: the
view then executes with the caller's rights and RLS applies as intended.

Revoking `anon`'s SELECT is defence in depth and worth doing **where nothing legitimate
reads the view as anon** — but `security_invoker` is the primary fix and must not be
skipped in favour of a revoke.

**Danger, and the reason this needs care:** turning on `security_invoker` makes RLS apply
to callers it previously bypassed. If an underlying table's RLS does not grant what the
app needs, **authenticated users lose access**. Verify every consumer after each view, not
at the end.

### S3

`REVOKE EXECUTE ON FUNCTION _ensure_client_account(...) FROM anon`.

Then confirm all four calling functions still work — they should, since they run with
their own rights, but prove it rather than reasoning about it.

---

## Verification — the negative case matters most

For each fix, prove **both** that the hole is closed **and** that legitimate access still
works. A lockout is a worse outcome than the exposure.

1. **S2:** as an authenticated member, an UPDATE setting `contact_id` to another contact
   now fails. Then confirm a member can still update the profile fields they legitimately
   own (display name, avatar, bio).
2. **S1:** `SET LOCAL ROLE anon` → each of the five views returns **0 rows**. Then, as a
   real authenticated member, confirm the community directory still returns what it did
   before. Then, as staff, confirm `inbound_queue` still returns its 11 rows.
3. **S3:** `anon` can no longer execute the function. Then exercise each of the four
   callers and confirm each still completes.
4. **Row counts unchanged** across `contacts`, `clients`, `profiles`, `documents` —
   nothing here should write data.

Capture before/after raw output for every one.

## Constraints

- Own git worktree off `origin/main`.
- **Three separate migrations** — S2, S1, S3 — each revertable alone. Not one combined.
- Every migration: dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply.
- **Stop and report between S2 and the rest.** S2 is the severe one and deserves its own
  verification pass before anything else moves.
- Do **not** rewrite `current_contact_id()`, `caller_owns_document()`, or any existing
  policy body. Grants and view options only. If a fix appears to need more, stop and
  report.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Also found by ACCTEVAL — NOT in this task

Real, but not this task's scope. Do not fix them here:

- No `auth.users` trigger creates `profiles` rows; two real auth users have none.
- `contacts_a_seed_community_channels` copies `contacts.phone` into all four published
  community channels on every write — including two WhatsApp channels seeded from an
  ordinary number.
- `hide_email` / `hide_mobile` / `hide_whatsapp` have zero references in `src/` or `api/`.
- Three `profiles` rows violate two validated, enabled foreign keys.

## Reporting

`docs/reports/TASK-SECFIX-REPORT.md`. Raw before/after for every claim, including the
negative cases. State plainly what you verified with your own eyes versus what you assume.
