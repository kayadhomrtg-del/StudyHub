# AI provider readiness and activation plan

**Status:** Superseded as a proposal by the owner-authorized Phase 5
implementation in the current working tree. No API key was requested in chat
or found in the repository; no live provider request has been made.

**Authority:** `docs/AI_PLAN.md` and `docs/AI_LAUNCH_CHECKLIST.md` remain
authoritative for provider eligibility, region restrictions, launch gates,
disclosures, and activation. This document cannot override them.

**Owner clarification (2026-11-02):** the owner reports that Google confirmed
the intended personal, single-user coursework use is permitted. The written
response and its date were not present in the project files. Record this as a
limited owner report; do not quote it, claim broader approval, or present the
terms as changed. The previous categorical-ineligibility statement was
incorrect.

## 1. Implemented Phase 5 architecture

- `server/ai/provider.ts` implements the Gemini provider behind the existing
  `AiProvider` interface. It checks model metadata only after an explicit
  setup action and sends feature requests through the existing pipeline.
- `server/ai/secretStore.ts` uses Windows DPAPI (`CurrentUser`) and stores only
  protected bytes under git-ignored `.study-hub/`. The browser never stores
  the key and never calls Google directly.
- `server/ai/configuration.ts` manages explicit setup, the model check, launch
  gates, activation, dismissal, and key removal.
- `server/ai/handler.ts` checks the actual listener and socket peer are
  loopback, then validates Host/Origin before configuration or the existing
  prepare/send contract.
- `src/features/ai/AiConfigurationPanel.tsx` provides optional first-launch
  setup and Settings replacement/removal controls. Navigation is not blocked.
- The production request still requires `STUDY_HUB_AI_ENABLED=1`, a saved key,
  launch gates, explicit local activation, and fresh exact-payload approval.
  Dispatch remains single-attempt/no-retry.

## 2. Server-side secret storage

The key is protected with the Windows user's DPAPI and is never placed in an
environment variable, browser bundle, localStorage, sessionStorage, IndexedDB,
URL, log, launch artifact, backup, or Git. PowerShell receives the secret
material over stdin; it is not passed as a command-line argument. Tests inject
an in-process fake protector and a dummy secret only.

The key's encrypted file is local machine state, not a portable backup. If the
repository is moved to another Windows user or machine, that user cannot
decrypt it; configure a replacement key through Settings. Never copy or
commit the encrypted key file.

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
user must confirm actual project model access and limits through the explicit
metadata check and local declaration. The plan and launch checklist's
`effectiveDailyCap` remains the single source of truth for the local daily
budget.

The current public model catalogue lists `gemini-3.5-flash-lite` and
`gemini-3.8-flash` as stable models, but that does not prove access or quota in
this user's project. Google's Interactions API documentation identifies that
API as Beta and warns that features and schemas may change. The setup metadata
check verifies the model names only; it does not exercise the Interactions
endpoint or guarantee a successful generation. Recheck the official API
documentation and test generation explicitly before relying on it.

Provider requests use a 30-second timeout, no redirects, no automatic retry,
no background request, and one budget charge immediately before the single
outbound attempt. A timeout after dispatch is reported as a post-dispatch
failure, never as "not sent"; it is not retried.

The existing pipeline already distinguishes pre-dispatch errors from
post-dispatch errors and has a serialized local daily budget with fail-closed
state. Any provider implementation must preserve that ordering, charge exactly
once per dispatched attempt, and never describe the local cap as Google's
quota. Provider errors, 429 classification, incomplete output, and timeout
handling must not expose key material in UI or logs.

## 4. Explicit local connection test

The Settings action “Save key and test connection” is the only setup path that
contacts Google. It sends the key and configured model names to the model
metadata endpoint only; no study text or prompt is sent. The connection test
has a timeout, no redirects, no retry, and returns only safe status/model
information. A successful check marks the configured models confirmed and
allows local activation after the other gates pass.

The user must press the button; application startup, a stored key, route
navigation, and local fallback execution never initiate provider traffic.

## 5. Eligibility and regional requirements

The owner reports Google's confirmation only for the intended personal,
single-user coursework use. The written response was not available for
inspection. The official terms still contain the professional/business versus
consumer-use wording; do not claim the terms changed or infer approval beyond
the owner's report. The runtime gate stores this as
`owner_reported_confirmation`, with no invented quote.

The UI requires the owner to select a supported region and tier. EEA,
Switzerland, and UK selections require a paid project with active billing
confirmed. Actual project model access, limits, age, disclosures, and local
cap remain separate checks. Preserve frozen M1–M8 wording.

Automated tests use injected in-process provider fakes. No test may contact
Google. Real requests are explicitly user-triggered and are not represented by
mock tests.

## 6. Separate activation and rollback procedure

### Activation sequence

1. Start the loopback server with `STUDY_HUB_AI_ENABLED=1`; the flag is
   required and does not by itself enable provider calls.
2. In the first-launch panel or Settings, choose region/tier and complete the
   declarations. Enter the key only in the password field and select “Save key
   and test connection”.
3. The server stores the key using Windows DPAPI, checks model metadata, and
   activates only after the check and all other gates pass.
4. For each feature request, review the complete payload and make fresh
   explicit approval before Send.

### Rollback sequence

1. Stop the local server or unset `STUDY_HUB_AI_ENABLED`; generation and
   connection checks are disabled.
2. Use Settings to remove the saved key. If Settings is unavailable, the
   owner may remove only the specific encrypted `.study-hub/ai-provider-secret.bin`
   file after stopping the server.
3. Confirm local fallbacks remain available and no AI request occurs.
4. Preserve launch artifacts and usage history unless the owner explicitly
   requests otherwise; do not delete user data or silently reset the budget.
5. Revoke any potentially exposed credential through the provider's official
   console. Inspect Git history/staged changes for accidental secret exposure
   without printing secret contents.
