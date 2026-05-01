<script lang="ts">
  import { onMount } from "svelte";
  import { createEditor } from "$lib/editor/editor";

  let container: HTMLDivElement;
  let contents = $state("# Welcome to Markdusk\n\nStart writing.");

  onMount(() => {
    const view = createEditor(container, contents, (next) => {
      contents = next;
    });
    return () => view.destroy();
  });
</script>

<main>
  <div bind:this={container} class="editor"></div>
</main>

<style>
  main { height: 100vh; display: flex; flex-direction: column; }
  .editor { flex: 1; overflow: auto; }
  :global(.cm-editor) { height: 100%; font-family: ui-serif, Charter, "Iowan Old Style", Georgia, serif; font-size: 16px; }
</style>
