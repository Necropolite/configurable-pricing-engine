import type {
  PricingCatalog,
  PricingCondition,
  PricingRule,
  PricingValue,
  QuoteLine,
  QuoteRequest,
  QuoteResult,
} from './types';

function assertNonNegativeFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

function assertMoney(value: number, label: string) {
  assertNonNegativeFinite(value, label);

  if (!Number.isInteger(value)) {
    throw new Error(`${label} must use integer minor currency units`);
  }
}

function evaluateCondition(
  condition: PricingCondition,
  attributes: Record<string, PricingValue>,
) {
  const actual = attributes[condition.attribute];

  if (actual === undefined) {
    return false;
  }

  switch (condition.operator) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (
        typeof actual !== 'number' ||
        typeof condition.value !== 'number' ||
        !Number.isFinite(actual) ||
        !Number.isFinite(condition.value)
      ) {
        throw new Error(
          `Condition ${condition.operator} for ${condition.attribute} requires finite numbers`,
        );
      }

      if (condition.operator === 'gt') return actual > condition.value;
      if (condition.operator === 'gte') return actual >= condition.value;
      if (condition.operator === 'lt') return actual < condition.value;
      return actual <= condition.value;
    }
  }
}

function assertRule(rule: PricingRule) {
  if (!rule.id.trim()) throw new Error('Pricing rule id is required');
  if (!rule.label.trim()) throw new Error(`Pricing rule ${rule.id} requires a label`);

  switch (rule.type) {
    case 'fixed':
      assertMoney(rule.amount, `Fixed rule ${rule.id} amount`);
      break;
    case 'per_unit':
      if (!rule.input.trim()) throw new Error(`Per-unit rule ${rule.id} requires an input`);
      assertMoney(rule.rate, `Per-unit rule ${rule.id} rate`);
      if (rule.includedUnits !== undefined) {
        assertNonNegativeFinite(rule.includedUnits, `Per-unit rule ${rule.id} includedUnits`);
      }
      break;
    case 'percentage':
      assertNonNegativeFinite(rule.percent, `Percentage rule ${rule.id} percent`);
      break;
  }
}

function assertCatalog(catalog: PricingCatalog) {
  if (!catalog.currency.trim()) {
    throw new Error('Pricing catalog currency is required');
  }

  if (catalog.items.length === 0) {
    throw new Error('Pricing catalog must contain at least one item');
  }

  const itemIds = new Set<string>();
  for (const item of catalog.items) {
    if (!item.id.trim()) throw new Error('Pricing item id is required');
    if (!item.label.trim()) throw new Error(`Pricing item ${item.id} requires a label`);
    if (itemIds.has(item.id)) throw new Error(`Duplicate pricing item id: ${item.id}`);
    itemIds.add(item.id);
    assertMoney(item.baseAmount, `Pricing item ${item.id} baseAmount`);
    item.rules?.forEach(assertRule);
  }

  catalog.rules?.forEach(assertRule);
}

function ruleApplies(rule: PricingRule, attributes: Record<string, PricingValue>) {
  return rule.condition ? evaluateCondition(rule.condition, attributes) : true;
}

function applyRule(
  rule: PricingRule,
  attributes: Record<string, PricingValue>,
  runningSubtotal: number,
): QuoteLine | undefined {
  if (!ruleApplies(rule, attributes)) {
    return undefined;
  }

  if (rule.type === 'fixed') {
    return {
      id: rule.id,
      label: rule.label,
      kind: 'fixed',
      amount: rule.amount,
    };
  }

  if (rule.type === 'per_unit') {
    const rawUnits = attributes[rule.input];
    if (typeof rawUnits !== 'number' || !Number.isFinite(rawUnits)) {
      throw new Error(`Per-unit rule ${rule.id} requires numeric attribute ${rule.input}`);
    }
    if (rawUnits < 0) {
      throw new Error(`Per-unit rule ${rule.id} does not allow negative ${rule.input}`);
    }

    const chargeableUnits = Math.max(rawUnits - (rule.includedUnits ?? 0), 0);
    return {
      id: rule.id,
      label: rule.label,
      kind: 'per_unit',
      amount: Math.round(chargeableUnits * rule.rate),
    };
  }

  return {
    id: rule.id,
    label: rule.label,
    kind: 'percentage',
    amount: Math.round((runningSubtotal * rule.percent) / 100),
  };
}

export function calculateQuote(catalog: PricingCatalog, request: QuoteRequest): QuoteResult {
  assertCatalog(catalog);

  const item = catalog.items.find((candidate) => candidate.id === request.itemId);
  if (!item) {
    throw new Error(`Unknown pricing item: ${request.itemId}`);
  }

  const quantity = request.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quote quantity must be greater than zero and finite');
  }

  const attributes = request.attributes ?? {};
  const baseAmount = Math.round(item.baseAmount * quantity);
  const lines: QuoteLine[] = [
    {
      id: item.id,
      label: item.label,
      kind: quantity === 1 ? 'base' : 'quantity',
      amount: baseAmount,
    },
  ];

  let runningSubtotal = baseAmount;
  const rules = [...(catalog.rules ?? []), ...(item.rules ?? [])];

  for (const rule of rules) {
    const line = applyRule(rule, attributes, runningSubtotal);
    if (!line) continue;

    lines.push(line);
    runningSubtotal += line.amount;
  }

  return {
    currency: catalog.currency,
    itemId: item.id,
    lines,
    subtotal: runningSubtotal,
    total: runningSubtotal,
  };
}
