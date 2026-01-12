<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    searchQuery as searchQueryStore,
    matchCount,
    currentMatchIndex,
    currentMatch,
    isSearching,
    setSearchQuery,
    nextMatch as goNextMatch,
    prevMatch as goPrevMatch,
    clearSearch as clearSearchStore,
    initializeSearch,
  } from '$lib/stores/search';

  const dispatch = createEventDispatcher();

  let inputElement: HTMLInputElement;
  let localQuery = '';

  // Sync local query with store
  $: localQuery = $searchQueryStore;

  // Dispatch events for parent components
  $: dispatch('search', { query: $searchQueryStore, matchCount: $matchCount });
  $: if ($currentMatch) {
    dispatch('navigate', { match: $currentMatch });
  }

  // Display values (1-indexed for users)
  $: displayIndex = $matchCount > 0 ? $currentMatchIndex + 1 : 0;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    setSearchQuery(target.value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        goPrevMatch();
      } else {
        goNextMatch();
      }
    }
    if (event.key === 'Escape') {
      clearSearchStore();
      inputElement?.blur();
    }
  }

  function handleClear() {
    clearSearchStore();
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

  // Initialize worker on mount
  onMount(() => {
    initializeSearch();
  });
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="search-bar">
  <span class="search-icon">🔍</span>
  <input
    bind:this={inputElement}
    value={localQuery}
    type="text"
    placeholder="Search context... (Ctrl+F)"
    on:input={handleInput}
    on:keydown={handleKeydown}
  />
  {#if localQuery}
    <span class="match-count">
      {#if $isSearching}
        Searching...
      {:else if $matchCount > 0}
        {displayIndex}/{$matchCount}
      {:else}
        No matches
      {/if}
    </span>
    <button class="nav-btn" on:click={goPrevMatch} disabled={$matchCount === 0} title="Previous (Shift+Enter)">
      ↑
    </button>
    <button class="nav-btn" on:click={goNextMatch} disabled={$matchCount === 0} title="Next (Enter)">
      ↓
    </button>
    <button class="clear-btn" on:click={handleClear} title="Clear (Esc)">
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
