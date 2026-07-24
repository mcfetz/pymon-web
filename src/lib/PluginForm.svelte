<script>
  let { schema = { fields: [] }, config = {}, onchange } = $props();

  let dirty = $state({});

  function val(key) {
    if (key in dirty) return dirty[key];
    if (key in config) return config[key];
    const f = schema.fields.find((x) => x.key === key);
    return f?.default ?? '';
  }

  function setVal(key, v) {
    dirty[key] = v;
    onchange?.({ ...config, ...dirty });
  }

  function addArrayItem(key) {
    const arr = [...(val(key) || [])];
    arr.push('');
    setVal(key, arr);
  }

  function removeArrayItem(key, i) {
    const arr = [...(val(key) || [])];
    arr.splice(i, 1);
    setVal(key, arr);
  }

  function setArrayItem(key, i, v) {
    const arr = [...(val(key) || [])];
    arr[i] = v;
    setVal(key, arr);
  }
</script>

<div class="plugin-form">
  {#each schema.fields as field}
    <div class="field">
      <label>{field.label}</label>

      {#if field.type === 'number'}
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={val(field.key)}
          oninput={(e) => setVal(field.key, parseFloat(e.target.value) || 0)}
        />

      {:else if field.type === 'string'}
        <input
          type="text"
          value={val(field.key)}
          oninput={(e) => setVal(field.key, e.target.value)}
        />

      {:else if field.type === 'array:string'}
        <div class="array-field">
          {#each val(field.key) || [] as item, i}
            <div class="array-row">
              <input type="text" value={item} oninput={(e) => setArrayItem(field.key, i, e.target.value)} />
              <button class="btn-remove" onclick={() => removeArrayItem(field.key, i)}>✕</button>
            </div>
          {/each}
          <button class="btn-add" onclick={() => addArrayItem(field.key)}>+ Add</button>
        </div>

      {:else if field.type === 'array:object'}
        <div class="object-array">
          {#each val(field.key) || [] as item, idx}
            <div class="object-card">
              <div class="obj-header">
                <strong>{item[field.fields?.[0]?.key] || 'Entry ' + (idx + 1)}</strong>
                <button class="btn-remove" onclick={() => { const a = [...val(field.key)]; a.splice(idx, 1); setVal(field.key, a); }}>✕</button>
              </div>
              {#each field.fields || [] as sub}
                <div class="field">
                  <label>{sub.label}</label>
                  <input
                    type="text"
                    value={item[sub.key] || ''}
                    oninput={(e) => {
                      const a = [...val(field.key)];
                      a[idx] = { ...a[idx], [sub.key]: e.target.value };
                      setVal(field.key, a);
                    }}
                  />
                </div>
              {/each}
            </div>
          {/each}
          <button class="btn-add" onclick={() => {
            const a = [...(val(field.key) || [])];
            const obj = {};
            for (const f of (field.fields || [])) {
              if (!f.optional) obj[f.key] = '';
            }
            a.push(obj);
            setVal(field.key, a);
          }}>+ Add Entry</button>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .plugin-form { display: flex; flex-direction: column; gap: 0.75rem; }
  .field { display: flex; flex-direction: column; gap: 0.25rem; }
  .field label { font-size: 0.8rem; font-weight: 600; color: #555; }
  .field input[type="text"],
  .field input[type="number"] {
    padding: 0.4rem 0.6rem; border: 1px solid #cbd5e0; border-radius: 5px;
    font-size: 0.85rem; width: 100%; box-sizing: border-box;
  }
  .array-field, .object-array { display: flex; flex-direction: column; gap: 0.4rem; }
  .array-row { display: flex; gap: 0.4rem; align-items: center; }
  .array-row input { flex: 1; }
  .object-card {
    border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.6rem;
    background: #fafafa;
  }
  .obj-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
  .obj-header strong { font-size: 0.85rem; }
  .btn-remove {
    background: none; border: 1px solid #e2e8f0; border-radius: 4px;
    cursor: pointer; font-size: 0.75rem; padding: 0.15rem 0.4rem; color: #e53e3e;
  }
  .btn-add {
    background: #edf2f7; border: 1px dashed #cbd5e0; border-radius: 5px;
    padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.8rem; color: #555;
    width: fit-content;
  }
  .btn-add:hover { background: #e2e8f0; }
</style>
