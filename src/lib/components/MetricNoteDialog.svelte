<script>
  import StickyNote from 'lucide-svelte/icons/sticky-note';
  import Modal from './Modal.svelte';
  import { saveMetricNote } from '../api.js';
  import { fmtTime, fmtVal } from '../metricsUtils.js';

  let { row, onclose = () => {}, onsaved = () => {} } = $props();

  let note = $state(row?.note || '');
  let saving = $state(false);
  let error = $state('');

  async function save() {
    if (!row || saving) return;
    saving = true; error = '';
    try {
      const result = await saveMetricNote(row.id, note);
      onsaved(result);
      onclose();
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function clear() {
    if (!row || saving) return;
    if (!confirm('Delete this metric note?')) return;
    saving = true; error = '';
    try {
      const result = await saveMetricNote(row.id, '');
      onsaved(result);
      onclose();
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }
</script>

<Modal open={true} title="Metric note" {onclose}>
  <div class="flex flex-col gap-3">
    <div class="rounded-xl p-3 flex flex-col gap-1" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.18)">
      <div class="flex items-center gap-1.5 text-[11px] font-semibold" style="color:#b45309">
        <StickyNote size={12} />
        <span class="truncate">{row?.metric}</span>
      </div>
      <div class="text-[11px] font-mono" style="color:var(--text-secondary)">
        {fmtVal(row?.value)} · {fmtTime(row?.timestamp)}
      </div>
      <div class="text-[11px]" style="color:var(--text-secondary)">
        {row?.agent_title || row?.agentid} · {row?.plugin_title || row?.pluginid}
      </div>
      {#if row?.note_by}
        <div class="text-[10px]" style="color:var(--text-secondary)">last edited by {row.note_by}</div>
      {/if}
    </div>

    <textarea
      bind:value={note}
      maxlength="4000"
      rows="5"
      aria-label="Metric note"
      placeholder="What changed? Why did this value move?"
      class="w-full px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none resize-y"
      style="border-color:var(--border-default);color:var(--text-primary);min-height:6rem"
    ></textarea>

    <div class="flex items-center gap-2">
      <span class="text-[10px]" style="color:var(--text-secondary)">{note.length}/4000</span>
      {#if row?.note}
        <button
          onclick={clear}
          disabled={saving}
          class="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-40"
          style="background:rgba(239,68,68,0.1);color:#ef4444"
        >Delete note</button>
      {/if}
      <div class="ml-auto flex items-center gap-2">
        <button
          onclick={onclose}
          disabled={saving}
          class="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-40"
          style="background:var(--bg-app);color:var(--text-secondary);border:1px solid var(--border-default)"
        >Cancel</button>
        <button
          onclick={save}
          disabled={saving || note.trim() === (row?.note || '')}
          class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
          style="background:var(--color-primary)"
        >{saving ? 'Saving...' : 'Save note'}</button>
      </div>
    </div>

    {#if error}
      <div class="text-xs px-2 py-1.5 rounded-lg" style="background:rgba(239,68,68,0.08);color:#ef4444">{error}</div>
    {/if}
  </div>
</Modal>
