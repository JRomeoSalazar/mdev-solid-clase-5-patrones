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

Hybrid approach: functional composition (functions and data tables) instead of class hierarchies.

- `src/checkout-service.ts` — `CheckoutService.checkout` is a pipeline built in the constructor: `processCheckout` (validate, price, charge, notify) wrapped by decorators according to `CheckoutOptions`.
- `src/decorators.ts` — `pipe`/`when` plus the cross-cutting decorators: `withGatewayLogging`, `withRetry` (gateway) and `withCheckoutLogging`, `withCache` (checkout). Only completed (`issued`) purchases are cached.
- `src/payment-methods.ts` — Strategy as a `Record<PaymentMethod, PaymentMethodHandler>` registry (validate + charge). The only place that translates to `LegacyPaymentRequest`.
- `src/validation.ts` — common validation rules as an array of pure functions; the payment method adds its own rule last.
- `src/pricing.ts` — pure price/discount calculation.
- `src/purchase-listeners.ts` — Observer as an array of functions called after a purchase completes (inject a custom list via the 3rd constructor argument).
- `src/checkout-request.ts` — `buildCheckoutRequest` takes named fields with defaults (replaces the 14-positional factory).
- `src/order.ts` — `Order` driven by two tables: `TRANSITIONS` (legal moves and error messages) and `STATES` (description and advertised actions).
- `src/legacy/payments-gateway-v1.ts` — 2011 payments gateway. **Must not be modified**.
- `src/notifications/side-effects.ts` — five singleton services (email, inventory, loyalty, warehouse, analytics).
- `src/types.ts` — shared request/result types.

## Exercise constraints (from the README)

- **Tests must not be modified**; all 30 stay green throughout the refactor.
- `npm run typecheck` must pass.
- Target: `checkout()` goes from ~150 lines to under 40.
- Deliverable `ANALISIS.md`: Phase-1 problem list, patterns considered, applied (and why), discarded (and why).
- Adding **Apple Pay** (1% fee) and an **antifraud** notification system must each be a new file with zero edits to `CheckoutService`.
- Docs are written in Spanish in the README; per global rules, new docs (e.g. `ANALISIS.md`) should be written in English unless the exercise says otherwise.
