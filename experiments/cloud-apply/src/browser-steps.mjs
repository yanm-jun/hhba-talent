/** Browser DOM scanning and readback. Must be run only on authorized test pages. */
export async function scanPage(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('input, textarea, select')].map((el, index) => {
      const id = 'hhba-poc-' + index;
      el.dataset.hhbaPoc = id;
      const label = el.labels?.[0]?.innerText?.trim() || el.closest('label')?.innerText?.trim() || '';
      return {
        id, label, name: el.name || '', placeholder: el.getAttribute('placeholder') || '',
        kind: el.tagName.toLowerCase() === 'input' ? (el.type || 'text').toLowerCase() : el.tagName.toLowerCase(),
        value: el.value || '', disabled: el.disabled, readOnly: el.readOnly,
      };
    });
  });
}
export async function writeVerified(page, actions) {
  const results = [];
  for (const action of actions) {
    const output = await page.evaluate(({ id, value }) => {
      const el = [...document.querySelectorAll('[data-hhba-poc]')].find(x => x.dataset.hhbaPoc === id);
      if (!el || el.disabled || el.readOnly || el.value || !['text', 'tel', 'email'].includes(el.type)) {
        return { ok: false, reason: 'field-changed' };
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) return { ok: false, reason: 'unsupported-field' };
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: el.value === value, reason: el.value === value ? 'verified' : 'readback-failed' };
    }, { id: action.id, value: action.value });
    results.push({ id: action.id, key: action.key, ...output });
  }
  return results;
}
