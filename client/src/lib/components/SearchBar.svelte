<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { blocks } from '$lib/stores/context';

  const dispatch = createEventDispatcher();

  let searchQuery = '';
  let matchCount = 0;
  let currentMatch = 0;
  let inputElement: HTMLInputElement;

  // Find matches when query changes
  $: {
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      let count = 0;
      for (const block of $blocks) {
        const matches = block.content.toLowerCase().split(query).length - 1;
        count += matches;
      }
      matchCount = count;
      currentMatch = count > 0 ? 1 : 0;
    } else {
      matchCount = 0;
      currentMatch = 0;
    }
    dispatch('search', { query: searchQuery, matchCount });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
    if (event.key === 'Escape') {
      searchQuery = '';
      inputElement?.blur();
    }
  }

  function nextMatch() {
    if (matchCount > 0) {
      currentMatch = currentMatch >= matchCount ? 1 : currentMatch + 1;
      dispatch('navigate', { index: currentMatch });
    }
  }

  function prevMatch() {
    if (matchCount > 0) {
      currentMatch = currentMatch <= 1 ? matchCount : currentMatch - 1;
      dispatch('navigate', { index: currentMatch });
    }
  }

  function clearSearch() {
    searchQuery = '';
    inputElement?.focus();
  }

  // Global Ctrl+F handler
  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      inputElement?.focus();
      inputElement?.select();
    }
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="search-bar">
  <span class="search-icon">🔍</span>
  <input
    bind:this={inputElement}
    bind:value={searchQuery}
    type="text"
    placeholder="Search context... (Ctrl+F)"
    on:keydown={handleKeydown}
  />
  {#if searchQuery}
    <span class="match-count">
      {#if matchCount > 0}
        {currentMatch}/{matchCount}
      {:else}
        No matches
      {/if}
    </span>
    <button class="nav-btn" on:click={prevMatch} disabled={matchCount === 0} title="Previous (Shift+Enter)">
      ↑
    </button>
    <button class="nav-btn" on:click={nextMatch} disabled={matchCount === 0} title="Next (Enter)">
      ↓
    </button>
    <button class="clear-btn" on:click={clearSearch} title="Clear (Esc)">
      ✕
    </button>
  {/if}
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    min-width: 250px;
  }

  .search-bar:focus-within {
    border-color: var(--color-primary);
  }

  .search-icon {
    font-size: var(--font-size-sm);
    opacity: 0.5;
  }

  input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font-size: var(--font-size-sm);
    min-width: 100px;
  }

  .match-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .nav-btn,
  .clear-btn {
    padding: 2px 6px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .nav-btn:hover:not(:disabled),
  .clear-btn:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
