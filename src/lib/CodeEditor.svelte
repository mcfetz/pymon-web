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
  let view = null;

  function createEditor() {
    if (!editorEl) return;

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

    view = new EditorView({ state: startState, parent: editorEl });
  }

  function updateContent(newVal) {
    if (view && newVal !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newVal },
      });
    }
  }

  $effect(() => {
    // When value changes externally (e.g. switching plugins), update editor
    if (view) {
      const cur = view.state.doc.toString();
      if (value !== cur) updateContent(value);
    }
  });

  onMount(() => {
    if (editorEl && !view) createEditor();
  });

  onDestroy(() => {
    view?.destroy();
  });
</script>

<div class="editor-wrap" bind:this={editorEl}></div>

<style>
  .editor-wrap {
    border: 1px solid #cbd5e0; border-radius: 6px; overflow: hidden;
    height: 450px;
  }
  .editor-wrap :global(.cm-editor) { height: 100%; }
  .editor-wrap :global(.cm-scroller) { overflow: auto; }
</style>