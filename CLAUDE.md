# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A teaching exercise (class 5, design patterns) for the "TicketBox" ticket-sales domain. The code is **intentionally badly designed**: `src/checkout-service.ts` (~260 lines) hides several distinct design problems, each with a classic pattern as its answer. The README (in Spanish) describes the exercise: diagnose first, use the AI as a tutor, apply only 2–3 patterns, and justify every discarded one (over-engineering counts as a YAGNI/KISS violation).

## Commands

```bash
npm install
npm test                         # vitest run (30 tests: order.test.ts 13, checkout-service.test.ts 17)
npx vitest run test/order.test.ts            # single file
npx vitest run -t "part of test name"        # single test by name
npm run typecheck                # tsc --noEmit (covers src and test)
npm run demo                     # tsx src/demo.ts — full purchase with logging, retry, lifecycle
```

Node >= 22. ESM project (`"type": "module"`): imports use explicit `.ts` extensions (`allowImportingTsExtensions`).

## Architecture

- `src/checkout-service.ts` — the core. `CheckoutService.checkout()` validates, prices, charges via the legacy gateway, then fans out to side-effect services. Cross-cutting behaviour (`withLogging`, `withRetry`, `withCache`) is toggled by `CheckoutOptions` flags and tangled inside `checkout()` / `callGateway()`. A large `switch (request.paymentMethod)` handles per-method fees/gateway mapping.
- `src/order.ts` — `Order` with a status lifecycle; transitions are validated with `switch (this.currentStatus)` blocks and `if` chains.
- `src/legacy/payments-gateway-v1.ts` — 2011 payments gateway with its own request shape (`LegacyPaymentRequest`). **Must not be modified**; the service translates to it by hand in more than one place.
- `src/notifications/side-effects.ts` — five singleton services (email, inventory, loyalty, warehouse, analytics) that `CheckoutService` calls by name after charging.
- `src/types.ts` — shared request/result types.

## Exercise constraints (from the README)

- **Tests must not be modified**; all 30 stay green throughout the refactor.
- `npm run typecheck` must pass.
- Target: `checkout()` goes from ~150 lines to under 40.
- Deliverable `ANALISIS.md`: Phase-1 problem list, patterns considered, applied (and why), discarded (and why).
- Adding **Apple Pay** (1% fee) and an **antifraud** notification system must each be a new file with zero edits to `CheckoutService`.
- Docs are written in Spanish in the README; per global rules, new docs (e.g. `ANALISIS.md`) should be written in English unless the exercise says otherwise.
