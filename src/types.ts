export type PricingValue = string | number | boolean;

export type PricingOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface PricingCondition {
  attribute: string;
  operator: PricingOperator;
  value: PricingValue;
}

interface PricingRuleBase {
  id: string;
  label: string;
  condition?: PricingCondition;
}

export interface FixedRule extends PricingRuleBase {
  type: 'fixed';
  amount: number;
}

export interface PerUnitRule extends PricingRuleBase {
  type: 'per_unit';
  input: string;
  rate: number;
  includedUnits?: number;
}

export interface PercentageRule extends PricingRuleBase {
  type: 'percentage';
  percent: number;
}

export type PricingRule = FixedRule | PerUnitRule | PercentageRule;

export interface PricingItem {
  id: string;
  label: string;
  baseAmount: number;
  rules?: PricingRule[];
}

export interface PricingCatalog {
  currency: string;
  items: PricingItem[];
  rules?: PricingRule[];
}

export interface QuoteRequest {
  itemId: string;
  quantity?: number;
  attributes?: Record<string, PricingValue>;
}

export type QuoteLineKind =
  | 'base'
  | 'quantity'
  | 'fixed'
  | 'per_unit'
  | 'percentage';

export interface QuoteLine {
  id: string;
  label: string;
  kind: QuoteLineKind;
  amount: number;
}

export interface QuoteResult {
  currency: string;
  itemId: string;
  lines: QuoteLine[];
  subtotal: number;
  total: number;
}
