# AI provider readiness and activation plan

**Status:** Planning only. This document does not implement, enable, or
authorize real provider dispatch. No API key was requested, created, or used;
no provider request was made. A separate owner-approved milestone is required
after Phase 4 review, verification, commit, and local deployment.

**Authority:** `docs/AI_PLAN.md` and `docs/AI_LAUNCH_CHECKLIST.md` remain
authoritative for provider eligibility, region restrictions, launch gates,
disclosures, and activation. This document cannot override them.

## 1. Existing implementation and missing components

The current Gemini integration is a **non-networking proxy skeleton**, not a
Gemini client:

- `server/ai/provider.ts` exports `unconfiguredProvider`; it always returns
  `not_configured` and makes no request.
- `server/ai/activation.ts` exports `disabledActivationReader`; runtime
  activation is permanently false.
- `server/ai/pipeline.ts` accepts injected providers for tests, checks gates,
  activation, payload integrity, and local budget, then calls the injected
  interface. Production uses the inert provider.
- `server/ai/config.ts` contains the existing provisional feature models,
  schemas, and local request limits. These are not verified for any live
  Google project.
- No production module reads an API key, knows a provider URL, or contains an
  HTTP client. There is no provider-connectivity command or real activation
  path.

Real dispatch must remain blocked until the provider is separately approved
and implemented. Phase 4 did not change these modules or gates.

## 2. Secret configuration proposal (future, not implemented)

If a later owner-approved milestone implements a provider client, the proposed
secret source is the **server process environment variable**
`GEMINI_API_KEY`. Read it only in Node-side `server/ai/` code at request time.
Do not use a `VITE_`-prefixed variable: Vite-prefixed values can be exposed to
browser code.

On Windows, the eventual local setup should prompt without echoing the key,
set the environment only for the current PowerShell process and its child, and
clear it when the foreground server exits. For a future implementation, the
PowerShell pattern would be:

```powershell
$secureKey = Read-Host -Prompt "Gemini API key" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  npm run start
} finally {
  Remove-Item Env:\GEMINI_API_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  $secureKey.Dispose()
}
```

This is a **future setup pattern, not a currently supported command**:
`npm run start` currently has no provider client and ignores this variable.
Never paste a key into a command argument, source file, README, test fixture,
browser storage, URL, launch-gate artifact, or log.

### Git and secret checks

The current `.gitignore` ignores `.env`, `.env.*`, and `/.study-hub/`; it
explicitly permits `.env.example`. Treat that exception as a reason to inspect
sample files carefully: never put a real credential or a copyable active key
in `.env.example`, and do not add a sample that activates dispatch. A future
milestone must verify the ignored local file is not tracked, inspect staged
names and diffs, and scan staged text for likely credential assignments
without printing any secret values. For example:

```powershell
git check-ignore -v .env.local
git ls-files -- .env .env.* .study-hub
git status --short --ignored
```

Do not run commands that print the contents of environment files or secret
values. If any key is ever exposed, stop, revoke it through the provider's
official console, and do not put the replacement in Git.

## 3. Models, request limits, failures, and budget

The current configuration declares these **provisional** model assignments:

| Feature | Current code value | Existing limits |
|---|---|---|
| Summary | `gemini-3.5-flash-lite` | 100,000 input characters; 1,024 output tokens (4,096 maximum allowed) |
| Quiz | `gemini-3.5-flash-lite` | 100,000 input characters; 2,048 output tokens (8,192 maximum allowed) |
| Q&A | `gemini-3.8-flash` | 50,000 input characters; 2,048 output tokens (8,192 maximum allowed) |

The proxy also caps raw request bodies and serialized payloads at 1 MiB and
prepared payloads expire after five minutes. These local values do not prove
project availability, quota, billing eligibility, or provider limits. The
owner must confirm the actual project models and limits; the plan and launch
checklist's `effectiveDailyCap` remains the single source of truth for the
local daily budget.

There is no provider timeout behavior today. If a provider client is approved,
the proposed default is one bounded request with an `AbortController` timeout
(initial proposal: 30 seconds), no automatic retry, no background request, and
one budget charge immediately before the single outbound attempt. A timeout
after dispatch must be reported as a post-dispatch/unknown-delivery outcome,
never as "not sent"; it must not retry. Final timeout value and error mapping
require review in that future implementation.

The existing pipeline already distinguishes pre-dispatch errors from
post-dispatch errors and has a serialized local daily budget with fail-closed
state. Any provider implementation must preserve that ordering, charge exactly
once per dispatched attempt, and never describe the local cap as Google's
quota. Provider errors, 429 classification, incomplete output, and timeout
handling must not expose key material in UI or logs.

## 4. Local connectivity test proposal

There is no connectivity test available now, and none was run for this plan.
Do not test provider connectivity during Phase 1–4 regression or browser
testing.

Only after eligibility is resolved and an owner separately authorizes provider
implementation, add a Node-only, explicitly invoked connectivity check. It
should:

1. Read `GEMINI_API_KEY` only from the server process environment; reject a
   missing key without printing its value.
2. Use a fixed harmless probe with no course material, personal notes, or
   user-entered content. It must not be callable by the browser or exposed as a
   general HTTP route.
3. Use the same configured model, timeout, error mapping, and one-request
   budget accounting intended for production.
4. Make exactly one request and never retry.
5. Print only a redacted success/failure category, model identifier, and
   non-sensitive status/request identifier. Never print headers, environment
   values, the request body, or raw provider response.
6. Require the exact launch gates and separate runtime activation; a key or
   environment setting alone cannot enable it.

This procedure and command are not implemented. A future implementation must
be reviewed before any real call. If no eligible no-content probe can be
established, do not make a connectivity request.

## 5. Eligibility and region prerequisites

Before any real dispatch:

- Resolve the use restriction exactly as `docs/AI_PLAN.md` §3 specifies, using
  an authoritative source or the separately recorded owner decision permitted
  by that plan. A checkbox, paid account, test pass, or this proposal is not
  evidence of eligibility.
- Keep EEA, Switzerland, and United Kingdom restrictions fail-closed unless
  the owner separately resolves the paid-services requirement under the AI
  plan. Do not broaden permitted regions here.
- Verify the actual Google project, model availability, per-project limits,
  billing tier, terms, data use, retention, and human-review disclosures from
  current official sources. Preserve frozen M1–M8 wording.
- Complete every launch artifact field and independent runtime activation
  required by the AI plan. A launch artifact or activation must never be
  created from a sample or test fixture.
- Obtain separate owner approval for the provider code, connectivity test, and
  activation. Phase completion itself is not authorization.

All automated tests must continue using injected in-process fakes. No Phase
1–4 test may contact Google.

## 6. Separate activation and rollback procedure

### Proposed activation sequence — future approval required

1. Owner reviews and resolves the eligibility and regional gates with evidence.
2. Owner approves a separate implementation change for the Node-only client,
   server-environment secret reader, timeout, error handling, budget behavior,
   redacted connectivity command, tests, and documentation.
3. Verify `.gitignore`, tracked files, staged diffs, and logs contain no
   credential. Confirm the browser bundle and Vite-exposed environment contain
   no key.
4. Run all non-provider regression tests using only the in-process fake. Keep
   runtime activation disabled.
5. After a further explicit owner action, perform at most one approved
   no-course-content connectivity attempt under the gates and local budget.
6. Only after that succeeds and the owner separately approves activation may
   the runtime provider path be activated. The default remains disabled.

### Rollback sequence — future implementation only

1. Disable runtime activation and the AI enable flag; stop the local server.
2. Remove the key from the server process environment and close that process.
   Never write it into a file to simplify rollback.
3. Restore the inert provider/disabled activation path in a reviewed code
   change, and rerun safety tests proving no outbound request is reachable.
4. Preserve launch artifacts and usage history unless the owner explicitly
   requests otherwise; do not delete user data or silently reset the budget.
5. Revoke any potentially exposed credential through the provider's official
   console. Inspect Git history/staged changes for accidental secret exposure
   without printing secret contents.

This plan does not authorize or perform any activation, rollback, key
configuration, eligibility decision, or real provider call.
