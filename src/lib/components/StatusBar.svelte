<script lang="ts">
  interface Props {
    path: string | null;
    dirty: boolean;
    wordCount: number;
    charCount: number;
    readingMin: number;
  }

  let { path, dirty, wordCount, charCount, readingMin }: Props = $props();
  let showChars = $state(false);
</script>

<footer class="status">
  <span>{dirty ? "● " : ""}{path ?? "Untitled"}</span>
  <span class="counts" onclick={() => (showChars = !showChars)} role="presentation">
    {#if showChars}
      {charCount.toLocaleString()} chars
    {:else}
      {wordCount.toLocaleString()} words
    {/if}
    · {readingMin} min read · ⌘⇧P palette · ⌘P files · ⌘⇧F focus
  </span>
</footer>

<style>
  .status {
    display: flex;
    justify-content: space-between;
    padding: 6px 14px;
    font-size: 11px;
    color: var(--md-muted);
    border-top: 1px solid var(--md-rule);
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }
  .counts {
    cursor: pointer;
    user-select: none;
  }
  .counts:hover {
    color: var(--md-ink);
  }
</style>
