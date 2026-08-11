# D1a — the platform owner is not a tenant. Settled 2026-08-10.

**Owner ruling, verbatim:**

> *"super admin is platform owner, not part of any tenant other than their own if such exists.
> For this platform there is no tenant for super admin, super admin is purely platform owner
> and single first tenant is FHE. my admin account on FHE tenant is tenant owner not platform
> owner and my platform owner account is not the tenant owner account."*

This **confirms and sharpens D1.** It does not supersede it.

```
admin@cactai.io          PLATFORM OWNER   Cactai Inc   org_id NULL   NOT a tenant member
admin@fhequestrian.com   TENANT OWNER     FHE          org set       full tenant access
hello@fhequestrian.com   TENANT ADMIN     FHE          org set       full tenant access
```

**These are different people-shaped things and must never be merged.** The platform owner
account is not the tenant owner account, and there is no super-admin tenant.

---

## WHAT THIS SETTLES — three threads asked the same question and all three are answered

### 1. Being denied by FHE surfaces is CORRECT, not a bug

`has_staff_access() AND v_org = current_org()` evaluates to NULL for a caller whose
`current_org()` is NULL, so the `IF` skips and the caller is admitted. **For the platform
owner that admission was the accident. The denial is the correct behaviour.**

Three separate threads reported this as breakage. It is not:

- **NOGUARD2** applied a guard on `fill_party_fields_from_contacts` that denies the platform
  account. **Correct. Leave it.**
- **CONTRACTORPHAN**'s integrity panel returns "staff access required" to the platform
  account. **Correct. Leave it.**
- **NOGUARD3** flagged 48 functions that would deny it after a `coalesce(…, false)` repair.
  **That denial is the intended end state.**

### 2. All 48 `coalesce(…, false)` repairs are SAFE. NOGUARD3 Phase B is unblocked.

The blocker was the fear of locking the platform account out of the tenant surface. **Locking
it out of the tenant surface is the design.** Proceed with the repairs.

### 3. DO NOT set `org_id` on `admin@cactai.io`

NOGUARD3 recommended it as the cheap fix — one row, after which the 48 repairs are trivially
safe. **It is refused.** It would make the platform owner a tenant member, which is precisely
what this ruling forbids. The recommendation was reasonable from inside a single thread's view
and wrong against the decision record. **Do not raise it again.**

---

## THE REMAINING D1 VIOLATION IS NOW UNAMBIGUOUS

`admin@cactai.io` **holds 1 `contacts` row** (`8795c065-d153-44cc-8a81-758b94d2f5ce`), via
`profiles.contact_id`. D1 says it must hold **zero** FHE tenant rows, and this ruling removes
any remaining doubt about what that row is: a tenant row on a non-tenant identity.

**It is not fixed here.** Removing it touches identity plumbing (`profiles.contact_id` is
written solely by `promote_contact_to_account`, and a structural denylist already refuses the
protected identities). It gets its own task with its own proof. **Recorded, owner-visible,
not silently carried.**

## STILL OPEN, AND NOT PART OF THIS RULING

**Nothing provisions a `profiles` row at signup** — there is no trigger on `auth.users`.
**2 of 10 auth users have no `profiles` row** (`cjzigs+averify2@icloud.com`,
`ashlanalexis22@gmail.com`), so every fresh signup begins as a NULL-org caller. That is a
separate defect from this ruling and it regenerates the exact caller shape the guard work is
hardening against. Verified in production 2026-08-10.
