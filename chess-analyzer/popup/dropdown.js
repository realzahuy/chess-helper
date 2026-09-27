// A small keyboard-accessible menu so the open list matches the popup theme.
export function createDropdown(root, onChange) {
  const trigger = root.querySelector('.dropdown-trigger');
  const valueLabel = root.querySelector('.dropdown-value');
  const menu = root.querySelector('.dropdown-menu');
  const options = [...root.querySelectorAll('.dropdown-option')];

  function close(restoreFocus = false) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    if (restoreFocus) trigger.focus();
  }
  function open(index) {
    if (trigger.disabled) return;
    for (const other of document.querySelectorAll('.dropdown.is-open')) {
      if (other !== root) other.querySelector('.dropdown-trigger').click();
    }
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    if (index !== undefined) options[index]?.focus();
  }
  function setValue(value) {
    const selected = options.find(option => option.dataset.value === value) || options[0];
    trigger.dataset.value = selected.dataset.value;
    valueLabel.textContent = selected.textContent;
    for (const option of options) option.setAttribute('aria-selected', String(option === selected));
  }
  trigger.addEventListener('click', () => {
    if (menu.hidden) open(); else close();
  });
  trigger.addEventListener('keydown', event => {
    const selectedIndex = Math.max(0, options.findIndex(option => option.dataset.value === trigger.dataset.value));
    const next = { ArrowDown: Math.min(selectedIndex + 1, options.length - 1),
      ArrowUp: Math.max(selectedIndex - 1, 0), Home: 0, End: options.length - 1 }[event.key];
    if (next === undefined) { if (event.key === 'Escape') close(); return; }
    event.preventDefault();
    open(next);
  });
  menu.addEventListener('keydown', event => {
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key === 'Tab') { close(); return; }
    const next = { ArrowDown: (index + 1) % options.length,
      ArrowUp: (index + options.length - 1) % options.length,
      Home: 0, End: options.length - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); options[next].focus(); }
  });
  for (const option of options) option.addEventListener('click', () => {
    const value = option.dataset.value;
    const changed = trigger.dataset.value !== value;
    setValue(value);
    close(true);
    if (changed) onChange(value);
  });
  document.addEventListener('pointerdown', event => {
    if (!root.contains(event.target)) close();
  });
  return {
    setValue,
    setDisabled(disabled) { trigger.disabled = disabled; if (disabled) close(); },
  };
}
