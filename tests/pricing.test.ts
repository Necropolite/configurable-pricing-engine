import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQuote, type PricingCatalog } from '../src';

const serviceCatalog: PricingCatalog = {
  currency: 'USD',
  items: [{ id: 'service-call', label: 'Service call', baseAmount: 8500 }],
  rules: [
    {
      id: 'mileage',
      label: 'Mileage',
      type: 'per_unit',
      input: 'distanceMiles',
      rate: 200,
      includedUnits: 15,
    },
    {
      id: 'after-hours',
      label: 'After-hours surcharge',
      type: 'fixed',
      amount: 4000,
      condition: { attribute: 'afterHours', operator: 'eq', value: true },
    },
  ],
};

test('returns an itemized quote with base, per-unit, and conditional fixed charges', () => {
  const result = calculateQuote(serviceCatalog, {
    itemId: 'service-call',
    attributes: { distanceMiles: 24, afterHours: true },
  });

  assert.deepEqual(result, {
    currency: 'USD',
    itemId: 'service-call',
    lines: [
      { id: 'service-call', label: 'Service call', kind: 'base', amount: 8500 },
      { id: 'mileage', label: 'Mileage', kind: 'per_unit', amount: 1800 },
      { id: 'after-hours', label: 'After-hours surcharge', kind: 'fixed', amount: 4000 },
    ],
    subtotal: 14300,
    total: 14300,
  });
});

test('supports unrelated business configurations without engine changes', () => {
  const lawnCatalog: PricingCatalog = {
    currency: 'USD',
    items: [{ id: 'mow', label: 'Lawn mowing', baseAmount: 3000 }],
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
        condition: { attribute: 'bagClippings', operator: 'eq', value: true },
      },
    ],
  };

  const result = calculateQuote(lawnCatalog, {
    itemId: 'mow',
    attributes: { acres: 1.5, bagClippings: true },
  });

  assert.equal(result.total, 10500);
});

test('quantity multiplies the base amount', () => {
  const result = calculateQuote(
    {
      currency: 'USD',
      items: [{ id: 'rental-day', label: 'Rental day', baseAmount: 2500 }],
    },
    { itemId: 'rental-day', quantity: 3 },
  );

  assert.deepEqual(result.lines[0], {
    id: 'rental-day',
    label: 'Rental day',
    kind: 'quantity',
    amount: 7500,
  });
  assert.equal(result.total, 7500);
});

test('percentage rules use the running subtotal in configured order', () => {
  const result = calculateQuote(
    {
      currency: 'USD',
      items: [{ id: 'job', label: 'Job', baseAmount: 10000 }],
      rules: [
        { id: 'rush', label: 'Rush fee', type: 'fixed', amount: 2000 },
        { id: 'markup', label: 'Markup', type: 'percentage', percent: 10 },
      ],
    },
    { itemId: 'job' },
  );

  assert.equal(result.lines[2].amount, 1200);
  assert.equal(result.total, 13200);
});

test('false conditions skip their rules', () => {
  const result = calculateQuote(serviceCatalog, {
    itemId: 'service-call',
    attributes: { distanceMiles: 10, afterHours: false },
  });

  assert.equal(result.total, 8500);
  assert.equal(result.lines.some((line) => line.id === 'after-hours'), false);
});

test('per-unit charges respect included units and round to minor units', () => {
  const result = calculateQuote(serviceCatalog, {
    itemId: 'service-call',
    attributes: { distanceMiles: 15.555, afterHours: false },
  });

  assert.equal(result.lines.find((line) => line.id === 'mileage')?.amount, 111);
  assert.equal(result.total, 8611);
});

test('rejects unknown items and invalid quantities', () => {
  assert.throws(() => calculateQuote(serviceCatalog, { itemId: 'missing' }), /Unknown pricing item/);
  assert.throws(
    () => calculateQuote(serviceCatalog, { itemId: 'service-call', quantity: 0 }),
    /quantity/i,
  );
});

test('rejects missing or negative numeric inputs required by per-unit rules', () => {
  assert.throws(() => calculateQuote(serviceCatalog, { itemId: 'service-call' }), /distanceMiles/);
  assert.throws(
    () =>
      calculateQuote(serviceCatalog, {
        itemId: 'service-call',
        attributes: { distanceMiles: -1 },
      }),
    /negative/,
  );
});

test('rejects fractional monetary configuration', () => {
  assert.throws(
    () =>
      calculateQuote(
        {
          currency: 'USD',
          items: [{ id: 'bad', label: 'Bad price', baseAmount: 10.5 }],
        },
        { itemId: 'bad' },
      ),
    /integer minor currency units/,
  );
});


test('applies configured input defaults before pricing rules', () => {
  const result = calculateQuote(
    {
      currency: 'USD',
      items: [{ id: 'visit', label: 'Visit', baseAmount: 5000 }],
      inputs: [
        { key: 'miles', label: 'Miles', type: 'number', defaultValue: 20 },
      ],
      rules: [
        {
          id: 'travel',
          label: 'Travel',
          type: 'per_unit',
          input: 'miles',
          rate: 100,
          includedUnits: 10,
        },
      ],
    },
    { itemId: 'visit' },
  );

  assert.equal(result.total, 6000);
});

test('validates required, bounded, and select input values', () => {
  const catalog: PricingCatalog = {
    currency: 'USD',
    items: [{ id: 'job', label: 'Job', baseAmount: 1000 }],
    inputs: [
      { key: 'hours', label: 'Hours', type: 'number', required: true, min: 1, max: 8 },
      {
        key: 'tier',
        label: 'Tier',
        type: 'select',
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Premium', value: 'premium' },
        ],
      },
    ],
  };

  assert.throws(() => calculateQuote(catalog, { itemId: 'job' }), /hours is required/);
  assert.throws(
    () => calculateQuote(catalog, { itemId: 'job', attributes: { hours: 9 } }),
    /cannot exceed 8/,
  );
  assert.throws(
    () =>
      calculateQuote(catalog, {
        itemId: 'job',
        attributes: { hours: 2, tier: 'unsupported' },
      }),
    /unsupported option/,
  );
});

test('rejects invalid pricing input definitions', () => {
  assert.throws(
    () =>
      calculateQuote(
        {
          currency: 'USD',
          items: [{ id: 'job', label: 'Job', baseAmount: 1000 }],
          inputs: [
            { key: 'size', label: 'Size', type: 'number' },
            { key: 'size', label: 'Duplicate', type: 'boolean' },
          ],
        },
        { itemId: 'job' },
      ),
    /Duplicate pricing input key/,
  );
});


test('scopes questions and rules to selected services', () => {
  const scoped: PricingCatalog = {
    currency: 'USD',
    items: [
      { id: 'repair', label: 'Repair', baseAmount: 10000 },
      { id: 'consulting', label: 'Consulting', baseAmount: 15000 },
    ],
    inputs: [
      { key: 'hours', label: 'Hours', type: 'number', required: true, itemIds: ['consulting'] },
    ],
    rules: [
      { id: 'labor', label: 'Hourly labor', type: 'per_unit', input: 'hours', rate: 5000, itemIds: ['consulting'] },
      { id: 'shop', label: 'Shop fee', type: 'fixed', amount: 2500, itemIds: ['repair'] },
    ],
  };

  assert.equal(calculateQuote(scoped, { itemId: 'repair' }).total, 12500);
  assert.equal(calculateQuote(scoped, { itemId: 'consulting', attributes: { hours: 2 } }).total, 25000);
  assert.throws(() => calculateQuote(scoped, { itemId: 'consulting' }), /hours is required/);
});

test('rejects service scopes that reference unknown items', () => {
  assert.throws(
    () => calculateQuote(
      {
        currency: 'USD',
        items: [{ id: 'known', label: 'Known', baseAmount: 1000 }],
        rules: [{ id: 'bad', label: 'Bad', type: 'fixed', amount: 100, itemIds: ['missing'] }],
      },
      { itemId: 'known' },
    ),
    /unknown pricing item/,
  );
});
