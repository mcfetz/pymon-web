<script>
  let {
    value = '',
    items = [],
    placeholder = '',
    required = false,
    onchange = () => {},
  } = $props();

  let open = $state(false);
  let root = $state(null);

  function itemValue(item) {
    return typeof item === 'string' ? item : item?.value ?? '';
  }

  function itemLabel(item) {
    return typeof item === 'string' ? item : item?.label ?? itemValue(item);
  }

  let filteredItems = $derived.by(() => {
    const query = String(value ?? '').toLowerCase();
    return items.filter((item) => {
      const itemText = `${itemValue(item)} ${itemLabel(item)}`.toLowerCase();
      return !query || itemText.includes(query);
    });
  });

  function handleWindowClick(event) {
    if (open && root && !root.contains(event.target)) open = false;
  }

  function handleWindowKeydown(event) {
    if (event.key === 'Escape') open = false;
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="combobox" bind:this={root}>
  <div class="combobox-input-wrap">
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      required={required}
      onfocus={() => open = true}
      oninput={(event) => { onchange(event.target.value); open = true; }}
      class="combobox-input"
    />
    <button
      type="button"
      class="combobox-toggle"
      aria-label="Show suggestions"
      onclick={() => open = !open}
    >{open ? '▴' : '▾'}</button>
  </div>

  {#if open}
    <div class="combobox-menu">
      {#each filteredItems as item}
        <button
          type="button"
          class="combobox-option"
          class:selected={itemValue(item) === value}
          onclick={() => { onchange(itemValue(item)); open = false; }}
        >{itemLabel(item)}</button>
      {:else}
        <div class="combobox-empty">no suggestions</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .combobox { position: relative; width: 100%; }
  .combobox-input-wrap { display: flex; width: 100%; }
  .combobox-input {
    min-width: 0; flex: 1; padding: 0.35rem 0.5rem;
    border: 1px solid var(--border-default); border-right: none;
    border-radius: 5px 0 0 5px; font-size: 0.82rem;
    background: var(--bg-surface); color: var(--text-primary);
  }
  .combobox-input:focus { border-color: var(--color-primary); outline: none; }
  .combobox-toggle {
    width: 1.8rem; padding: 0; border: 1px solid var(--border-default);
    border-radius: 0 5px 5px 0; background: var(--bg-surface);
    color: var(--text-secondary); cursor: pointer;
  }
  .combobox-toggle:hover { color: var(--color-primary); }
  .combobox-menu {
    position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 100;
    max-height: 180px; overflow-y: auto; padding: 0.2rem;
    border: 1px solid var(--border-default); border-radius: 5px;
    background: var(--bg-surface); box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  .combobox-option {
    display: block; width: 100%; padding: 0.35rem 0.5rem;
    border: none; border-radius: 3px; background: transparent;
    color: var(--text-primary); cursor: pointer; font-size: 0.78rem;
    text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .combobox-option:hover { background: rgba(var(--color-primary-rgb), 0.1); }
  .combobox-option.selected { color: var(--color-primary); }
  .combobox-empty { padding: 0.4rem 0.5rem; color: var(--text-secondary); font-size: 0.75rem; }
</style>
