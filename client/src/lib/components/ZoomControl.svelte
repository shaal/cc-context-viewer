<script lang="ts">
  import { settings, zoomIn, zoomOut, resetZoom } from '$lib/stores/settings';

  $: zoomPercent = Math.round(($settings.fontSize / 14) * 100);
</script>

<div class="zoom-control">
  <button
    class="zoom-btn"
    on:click={zoomOut}
    disabled={$settings.fontSize <= 10}
    title="Zoom out (Ctrl+-)"
  >
    −
  </button>

  <button class="zoom-display" on:click={resetZoom} title="Reset zoom (Ctrl+0)">
    {zoomPercent}%
  </button>

  <button
    class="zoom-btn"
    on:click={zoomIn}
    disabled={$settings.fontSize >= 28}
    title="Zoom in (Ctrl++)"
  >
    +
  </button>
</div>

<style>
  .zoom-control {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .zoom-btn {
    padding: 6px 10px;
    background: var(--color-bg);
    border: none;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .zoom-btn:hover:not(:disabled) {
    background: var(--color-border);
  }

  .zoom-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-display {
    padding: 6px 12px;
    background: var(--color-surface);
    border: none;
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
    font-size: 12px;
    color: var(--color-text-secondary);
    cursor: pointer;
    min-width: 50px;
    text-align: center;
  }

  .zoom-display:hover {
    background: var(--color-bg);
  }
</style>
