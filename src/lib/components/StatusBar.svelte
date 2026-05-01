<script lang="ts">
  interface Props {
    path: string | null;
    dirty: boolean;
    wordCount: number;
  }

  let { path, dirty, wordCount }: Props = $props();
  let readMin = $derived(Math.max(1, Math.round(wordCount / 220)));
</script>

<footer class="status">
  <span>{dirty ? "● " : ""}{path ?? "Untitled"}</span>
  <span>{wordCount} words · {readMin} min · ⌘\ files · ⌘⇧\ outline · ⌘⇧F focus</span>
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
</style>
