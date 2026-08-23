export type PricingValue = string | number | boolean;
export type PricingOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
export type PricingInputType = 'number' | 'boolean' | 'select';
interface PricingInputBase { key: string; label: string; type: PricingInputType; required?: boolean; helpText?: string; }
export interface NumberPricingInput extends PricingInputBase { type: 'number'; unit?: string; min?: number; max?: number; step?: number; defaultValue?: number; }
export interface BooleanPricingInput extends PricingInputBase { type: 'boolean'; defaultValue?: boolean; }
export interface SelectPricingInputOption { label: string; value: string | number | boolean; }
export interface SelectPricingInput extends PricingInputBase { type: 'select'; options: SelectPricingInputOption[]; defaultValue?: string | number | boolean; }
export type PricingInput = NumberPricingInput | BooleanPricingInput | SelectPricingInput;
export interface PricingCondition { attribute: string; operator: PricingOperator; value: PricingValue; }
interface PricingRuleBase { id: string; label: string; condition?: PricingCondition; }
export interface FixedRule extends PricingRuleBase { type: 'fixed'; amount: number; }
export interface PerUnitRule extends PricingRuleBase { type: 'per_unit'; input: string; rate: number; includedUnits?: number; }
export interface PercentageRule extends PricingRuleBase { type: 'percentage'; percent: number; }
export type PricingRule = FixedRule | PerUnitRule | PercentageRule;
export interface PricingItem { id: string; label: string; baseAmount: number; rules?: PricingRule[]; }
export interface PricingCatalog { currency: string; items: PricingItem[]; inputs?: PricingInput[]; rules?: PricingRule[]; }
export interface QuoteRequest { itemId: string; quantity?: number; attributes?: Record<string, PricingValue>; }
export type QuoteLineKind = 'base' | 'quantity' | 'fixed' | 'per_unit' | 'percentage';
export interface QuoteLine { id: string; label: string; kind: QuoteLineKind; amount: number; }
export interface QuoteResult { currency: string; itemId: string; lines: QuoteLine[]; subtotal: number; total: number; }
