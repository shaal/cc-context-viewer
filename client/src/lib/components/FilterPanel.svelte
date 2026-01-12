<script lang="ts">
  import { activeFilters, toggleFilter, showAll, ALL_CONTENT_TYPES } from '$lib/stores/filters';
  import { blockCountByType } from '$lib/stores/context';
  import { ContentType, CONTENT_TYPE_COLORS } from '$types';

  // Short labels for filter buttons
  const SHORT_LABELS: Record<ContentType, string> = {
    [ContentType.SYSTEM]: 'Sys',
    [ContentType.TOOL_DEFINITION]: 'Tools',
    [ContentType.USER]: 'User',
    [ContentType.ASSISTANT_THINKING]: 'Think',
    [ContentType.ASSISTANT_TEXT]: 'Asst',
    [ContentType.TOOL_USE]: 'Call',
    [ContentType.TOOL_RESULT]: 'Result',
    [ContentType.ERROR]: 'Err',
  };

  $: isShowingAll = $activeFilters.size === 0;
</script>

<div class="filter-panel">
  <button
    class="filter-btn all"
    class:active={isShowingAll}
    on:click={showAll}
    title="Show all content types"
  >
    All
  </button>

  {#each ALL_CONTENT_TYPES as type}
    {@const colors = CONTENT_TYPE_COLORS[type]}
    {@const count = $blockCountByType[type] || 0}
    {@const isActive = $activeFilters.size === 0 || $activeFilters.has(type)}
    <button
      class="filter-btn"
      class:active={isActive && !isShowingAll}
      class:dimmed={!isActive}
      style="--btn-bg: {colors.bg}; --btn-border: {colors.border}; --btn-text: {colors.text}"
      on:click={() => toggleFilter(type)}
      title="{colors.label} ({count})"
    >
      {SHORT_LABELS[type]}
      {#if count > 0}
        <span class="count">{count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .filter-panel {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .filter-btn:hover {
    border-color: var(--btn-border, var(--color-primary));
  }

  .filter-btn.active {
    background: var(--btn-bg, var(--color-primary-light));
    border-color: var(--btn-border, var(--color-primary));
    color: var(--btn-text, var(--color-primary));
  }

  .filter-btn.all.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .filter-btn.dimmed {
    opacity: 0.4;
  }

  .count {
    font-size: 10px;
    padding: 0 4px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }
</style>
