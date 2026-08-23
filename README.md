# Configurable Pricing Engine

A reusable, configuration-driven TypeScript engine for calculating transparent quotes from serializable pricing rules.

This repository is the canonical source for the generic pricing engine originally extracted from `Necropolite/LocksmithOS`. LocksmithOS is one consumer of the engine, not the definition of it.

## What it does

The engine accepts:

1. a pricing catalog describing items and pricing rules;
2. a quote request containing an item, quantity, and generic attributes.

It returns an itemized quote and final total. Optional input definitions describe the questions a quote interface should ask and validate, allowing the same catalog to drive both calculation and form generation.

The core has no dependency on UI, maps, payments, databases, dispatch systems, React, Next.js, or any specific business domain.

## Install for development

```powershell
npm install
npm test
npm run build
```

## Public API

```ts
import {
  calculateQuote,
  type PricingCatalog,
  type QuoteRequest,
  type QuoteResult,
} from './src';
```

The supported package API is exported from `src/index.ts` and compiled to `dist/index.js` / `dist/index.d.ts` by `npm run build`.

## Money

All monetary values use integer minor units, such as cents, to avoid floating-point money errors.

```ts
8500 // $85.00
```

Each catalog declares its own currency code, such as `USD`.

## Pricing model

```ts
interface PricingCatalog {
  currency: string;
  items: PricingItem[];
  inputs?: PricingInput[];
  rules?: PricingRule[];
}

interface PricingItem {
  id: string;
  label: string;
  baseAmount: number;
  rules?: PricingRule[];
}

interface QuoteRequest {
  itemId: string;
  quantity?: number;
  attributes?: Record<string, string | number | boolean>;
}
```

V1 supports three rule types:

- `fixed`: adds a fixed amount, optionally when a condition matches;
- `per_unit`: charges a configured rate for a numeric attribute, optionally after included units;
- `percentage`: adds a percentage of the running subtotal.

Conditions support `eq`, `neq`, `gt`, `gte`, `lt`, and `lte`.

Rules run in configured order. Catalog-level rules run before item-level rules. Percentage rules therefore calculate against the running subtotal at the point where they appear.

## Example

```ts
import { calculateQuote, type PricingCatalog } from './src';

const pricing: PricingCatalog = {
  currency: 'USD',
  items: [
    { id: 'mow', label: 'Lawn mowing', baseAmount: 3000 },
  ],
  rules: [
    {
      id: 'acreage',
      label: 'Additional acreage',
      type: 'per_unit',
      input: 'acres',
      rate: 6000,
      includedUnits: 0.5,
    },
    {
      id: 'bagging',
      label: 'Bag clippings',
      type: 'fixed',
      amount: 1500,
      condition: {
        attribute: 'bagClippings',
        operator: 'eq',
        value: true,
      },
    },
  ],
};

const quote = calculateQuote(pricing, {
  itemId: 'mow',
  attributes: {
    acres: 1.5,
    bagClippings: true,
  },
});

// quote.total === 10500
```

See `examples/lawn-service.ts` for the complete example.

## Pricing Tool Builder

The browser application under `demo/` is a usable configuration layer around the engine. A business owner can:

- create services and base prices;
- define number and yes/no customer questions in the no-code builder;
- add fixed, per-unit, conditional, and percentage rules;
- preview the generated customer quote form;
- see an itemized estimate calculated by the real engine;
- save work automatically in the browser;
- import and export portable JSON pricing configurations.

The builder is intentionally separate from the calculation core. Applications can use the engine and input schema without adopting this interface.

Build the tool with:

```powershell
npm run build:demo
```

Then serve the repository root with any static server and open `demo/index.html`.

## Demonstration boundary

The browser builder is a quick, working example of the reusable engine. Its visible controls are intentionally focused so a visitor can understand the core idea without learning a full business system.

The demo's feature list is not a statement of the developer's maximum capabilities. Production implementations can use the same engine with different interfaces, richer pricing policies, employee workflows, customer requests, booking, CRM, payments, the Location Service Area Toolkit, or other integrations. Those application-specific capabilities stay outside the generic calculation core.

## Cloudflare deployment

The browser builder is configured for Cloudflare Workers Static Assets. After authenticating Wrangler, deploy with:

```powershell
npm install
npm run deploy
```

The deployment uploads the built `demo/` directory and returns the public `workers.dev` URL. Validate without publishing by running `npm run deploy:dry`.

## Validation

V1 rejects invalid configurations and requests instead of silently guessing. This includes:

- unknown item IDs;
- zero, negative, or non-finite quantity;
- missing/non-numeric per-unit inputs;
- negative per-unit inputs;
- invalid or fractional monetary configuration;
- incompatible numeric conditions;
- duplicate item IDs.

All calculated monetary line items are rounded to integer minor units.

## Repository layout

```text
src/
  index.ts       public API
  engine.ts      calculation engine
  types.ts       configuration and result types

tests/
  pricing.test.ts

examples/
  lawn-service.ts
```

## V1 scope

Included:

- configurable base prices;
- quantity pricing;
- fixed surcharges;
- hourly and other per-unit pricing with included allowances;
- percentage modifiers;
- simple conditional rules;
- optional number, yes/no, and select input definitions for generated interfaces;
- itemized quote results;
- configuration/request validation;
- multiple currency codes without currency conversion.

Deliberately excluded until a real consumer requires them:

- tax or jurisdiction lookup;
- currency conversion;
- coupons/promotions;
- compound AND/OR condition trees;
- persistence/databases;
- payment processing;
- map/distance calculation;
- UI components;
- arbitrary executable pricing callbacks.

## Status

**V1.1 pricing-input schema and browser builder added on August 23, 2026.** The input schema is optional, so existing V1 catalogs and LocksmithOS integration remain backward-compatible.

**V1 core was independently verified complete on August 23, 2026.** Standalone validation passed all 9 package tests, `npm run build` completed successfully with TypeScript, and `npm install` reported 0 vulnerabilities.

The same engine behavior was also verified inside LocksmithOS before extraction, where all integrated pricing tests passed and the full Next.js production build succeeded.

## Consumer integration

Until a stable package distribution method is selected, consumers should not maintain independent feature development against copied engine code. Changes to the generic engine belong here first. Consumer-specific catalogs and adapters stay in their own repositories.
