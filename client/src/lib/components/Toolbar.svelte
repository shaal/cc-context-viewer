<script lang="ts">
  import { clearContext, fetchContext } from '$lib/stores/context';
  import SearchBar from './SearchBar.svelte';
  import FilterPanel from './FilterPanel.svelte';
  import ZoomControl from './ZoomControl.svelte';

  let showExportMenu = false;

  async function handleExport(format: 'json' | 'text' | 'html') {
    const response = await fetch(`/api/export/${format}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-context.${format === 'text' ? 'txt' : format}`;
    a.click();
    URL.revokeObjectURL(url);
    showExportMenu = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (showExportMenu) {
      showExportMenu = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<header class="toolbar">
  <div class="toolbar-left">
    <h1 class="title">
      <span class="icon">🔍</span>
      Claude Context Viewer
    </h1>
  </div>

  <div class="toolbar-center">
    <SearchBar />
    <FilterPanel />
  </div>

  <div class="toolbar-right">
    <ZoomControl />

    <button class="btn" on:click={() => fetchContext()} title="Refresh context">
      <span class="icon">↻</span>
      Refresh
    </button>

    <button class="btn btn-danger" on:click={() => clearContext()} title="Clear conversation">
      <span class="icon">🗑</span>
      Clear
    </button>

    <div class="export-dropdown">
      <button
        class="btn"
        on:click|stopPropagation={() => (showExportMenu = !showExportMenu)}
        title="Export context"
      >
        <span class="icon">⬇</span>
        Export
      </button>
      {#if showExportMenu}
        <div class="export-menu">
          <button on:click={() => handleExport('json')}>
            📄 JSON
          </button>
          <button on:click={() => handleExport('text')}>
            📝 Plain Text
          </button>
          <button on:click={() => handleExport('html')}>
            🌐 HTML
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--toolbar-height);
    padding: 0 var(--spacing-md);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    gap: var(--spacing-md);
  }

  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .toolbar-center {
    flex: 1;
    justify-content: center;
  }

  .title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0;
  }

  .icon {
    font-size: 1.1em;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    transition: all var(--transition-fast);
  }

  .btn:hover {
    background: var(--color-border);
  }

  .btn-danger:hover {
    background: var(--color-error-bg);
    border-color: var(--color-error-border);
    color: var(--color-error-text);
  }

  .export-dropdown {
    position: relative;
  }

  .export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--spacing-xs);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    z-index: 100;
    min-width: 140px;
  }

  .export-menu button {
    display: block;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .export-menu button:hover {
    background: var(--color-bg);
  }

  .export-menu button:first-child {
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }

  .export-menu button:last-child {
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  }
</style>
