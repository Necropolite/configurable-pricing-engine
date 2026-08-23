import { calculateQuote, type PricingCatalog, type PricingInput, type PricingValue } from '../src';

type PublishedState = { businessName: string; catalog: PricingCatalog };

const decode = (value: string) => {
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as PublishedState;
};

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);

function addStyles() {
  if (document.getElementById('pricing-tool-embed-styles')) return;
  const style = document.createElement('style');
  style.id = 'pricing-tool-embed-styles';
  style.textContent = `
    .pricing-tool{max-width:720px;padding:24px;border:1px solid #d8d4c9;border-radius:8px;background:#fffdfa;color:#17201b;font:16px/1.45 system-ui,sans-serif}
    .pricing-tool h2{margin:0 0 18px;font:700 28px Georgia,serif}.pricing-tool label{display:block;margin:14px 0;color:#68716b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
    .pricing-tool input,.pricing-tool select{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #d8d4c9;border-radius:4px;background:white;color:#17201b;font:inherit}
    .pricing-tool input[type=checkbox]{display:inline;width:auto;margin-right:8px}.pricing-tool .pricing-check{text-transform:none;letter-spacing:0}
    .pricing-tool-lines{margin-top:22px;border-top:1px solid #d8d4c9}.pricing-tool-line,.pricing-tool-total{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid #e8e5dc}
    .pricing-tool-total{font-size:20px;border-bottom:0}.pricing-tool-error{color:#a53b32}
  `;
  document.head.append(style);
}

function option(value: string, label: string) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

function mount(host: HTMLElement, state: PublishedState) {
  const { catalog } = state;
  host.classList.add('pricing-tool');
  const title = document.createElement('h2');
  title.textContent = state.businessName + ' estimate';
  const serviceLabel = document.createElement('label');
  serviceLabel.textContent = 'Service';
  const service = document.createElement('select');
  for (const item of catalog.items) service.append(option(item.id, item.label));
  serviceLabel.append(service);
  const quantityLabel = document.createElement('label');
  quantityLabel.textContent = 'Quantity';
  const quantity = document.createElement('input');
  quantity.type = 'number'; quantity.min = '1'; quantity.step = '1'; quantity.value = '1';
  quantityLabel.append(quantity);
  const fields = document.createElement('div');
  const lines = document.createElement('div'); lines.className = 'pricing-tool-lines';
  const error = document.createElement('p'); error.className = 'pricing-tool-error'; error.setAttribute('role', 'status');
  host.append(title, serviceLabel, quantityLabel, fields, lines, error);

  function renderFields() {
    fields.replaceChildren();
    for (const input of (catalog.inputs ?? []).filter(value => !value.itemIds || value.itemIds.includes(service.value))) {
      const label = document.createElement('label');
      label.dataset.inputKey = input.key;
      if (input.type === 'boolean') {
        label.className = 'pricing-check';
        const control = document.createElement('input'); control.type = 'checkbox'; control.checked = input.defaultValue ?? false;
        label.append(control, document.createTextNode(input.label));
      } else if (input.type === 'select') {
        label.textContent = input.label;
        const control = document.createElement('select');
        for (const choice of input.options) control.append(option(String(choice.value), choice.label));
        if (input.defaultValue !== undefined) control.value = String(input.defaultValue);
        label.append(control);
      } else {
        label.textContent = input.label + (input.unit ? ' (' + input.unit + ')' : '');
        const control = document.createElement('input'); control.type = 'number'; control.step = String(input.step ?? 1);
        if (input.min !== undefined) control.min = String(input.min);
        if (input.max !== undefined) control.max = String(input.max);
        if (input.defaultValue !== undefined) control.value = String(input.defaultValue);
        label.append(control);
      }
      fields.append(label);
    }
    fields.querySelectorAll('input,select').forEach(element => element.addEventListener('input', calculate));
  }

  function calculate() {
    const attributes: Record<string, PricingValue> = {};
    fields.querySelectorAll<HTMLElement>('[data-input-key]').forEach(label => {
      const input = (catalog.inputs ?? []).find(value => value.key === label.dataset.inputKey) as PricingInput | undefined;
      const control = label.querySelector<HTMLInputElement | HTMLSelectElement>('input,select');
      if (!input || !control) return;
      attributes[input.key] = input.type === 'boolean'
        ? (control as HTMLInputElement).checked
        : input.type === 'number' ? Number(control.value) : control.value;
    });
    try {
      const quote = calculateQuote(catalog, { itemId: service.value, quantity: Number(quantity.value), attributes });
      lines.replaceChildren();
      for (const item of quote.lines) {
        const row = document.createElement('div'); row.className = 'pricing-tool-line';
        const name = document.createElement('span'); name.textContent = item.label;
        const amount = document.createElement('strong'); amount.textContent = money(item.amount, quote.currency);
        row.append(name, amount); lines.append(row);
      }
      const total = document.createElement('div'); total.className = 'pricing-tool-total';
      const totalLabel = document.createElement('strong'); totalLabel.textContent = 'Estimated total';
      const totalAmount = document.createElement('strong'); totalAmount.textContent = money(quote.total, quote.currency);
      total.append(totalLabel, totalAmount); lines.append(total);
      error.textContent = '';
    } catch (reason) {
      lines.replaceChildren();
      error.textContent = reason instanceof Error ? reason.message : 'Unable to calculate this estimate.';
    }
  }

  service.addEventListener('input', () => { renderFields(); calculate(); });
  quantity.addEventListener('input', calculate);
  renderFields(); calculate();
}

addStyles();
document.querySelectorAll<HTMLElement>('[data-pricing-tool]').forEach(host => {
  try { mount(host, decode(host.dataset.pricingTool!)); }
  catch { host.textContent = 'This pricing form configuration is invalid.'; }
});
