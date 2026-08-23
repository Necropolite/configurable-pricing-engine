import { calculateQuote, type PricingCatalog } from '../src';

const lawnServicePricing: PricingCatalog = {
  currency: 'USD',
  items: [
    {
      id: 'mow',
      label: 'Lawn mowing',
      baseAmount: 3000,
    },
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

const quote = calculateQuote(lawnServicePricing, {
  itemId: 'mow',
  attributes: {
    acres: 1.5,
    bagClippings: true,
  },
});

console.log(quote);
