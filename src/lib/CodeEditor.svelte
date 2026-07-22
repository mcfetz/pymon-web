<script>
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState } from '@codemirror/state';
  import { python } from '@codemirror/lang-python';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { keymap } from '@codemirror/view';
  import { indentWithTab } from '@codemirror/commands';

  let { value = '', onchange } = $props();

  let editorEl = $state(null);
  let cm = null;

  function initCM() {
    if (!editorEl || cm) return;
    const startState = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        python(),
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onchange?.(update.state.doc.toString());
          }
        }),
      ],
    });
    cm = new EditorView({ state: startState, parent: editorEl });
  }

  function updateDoc(newVal) {
    if (cm && newVal !== cm.state.doc.toString()) {
      cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: newVal },
      });
    }
  }

  $effect(() => {
    if (cm) {
      const cur = cm.state.doc.toString();
      if (value !== cur) updateDoc(value);
    }
  });

  onMount(() => {
    if (editorEl && !cm) initCM();
  });

  onDestroy(() => {
    cm?.destroy();
  });
</script>

<div class="editor-wrap" bind:this={editorEl}></div>

<style>
  .editor-wrap {
    border: 1px solid #cbd5e0; border-radius: 6px; overflow: hidden;
    height: 100%; min-height: 250px; position: relative;
  }
  .editor-wrap :global(.cm-editor) { height: 100%; }
  .editor-wrap :global(.cm-scroller) { overflow: auto; }
</style>