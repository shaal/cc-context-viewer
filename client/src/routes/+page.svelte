<script lang="ts">
  import { onMount } from 'svelte';
  import Toolbar from '$components/Toolbar.svelte';
  import ContextViewer from '$components/ContextViewer.svelte';
  import ContextMinimap from '$components/ContextMinimap.svelte';
  import AgentInput from '$components/AgentInput.svelte';
  import StatusBar from '$components/StatusBar.svelte';
  import {
    fetchContext,
    connectionStatus,
    blocks,
    tokenUsage,
    isStreaming,
  } from '$lib/stores/context';
  import { settings } from '$lib/stores/settings';
  import { activeFilters } from '$lib/stores/filters';
  import type { ContentType } from '$types';

  let viewerElement: HTMLElement;
  let scrollPosition = 0;
  let viewportHeight = 0;
  let totalHeight = 0;

  // Filter blocks based on active filters
  $: filteredBlocks =
    $activeFilters.size === 0
      ? $blocks
      : $blocks.filter((b) => $activeFilters.has(b.type as ContentType));

  // Handle scroll position updates from viewer
  function handleScroll(event: CustomEvent<{ scrollTop: number; viewportHeight: number; totalHeight: number }>) {
    scrollPosition = event.detail.scrollTop;
    viewportHeight = event.detail.viewportHeight;
    totalHeight = event.detail.totalHeight;
  }

  // Handle minimap click to scroll
  function handleMinimapClick(event: CustomEvent<{ position: number }>) {
    if (viewerElement) {
      const scrollTo = event.detail.position * totalHeight;
      viewerElement.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Ctrl/Cmd + Plus: Zoom in
    if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      settings.update((s) => ({ ...s, fontSize: Math.min(28, s.fontSize + 2) }));
    }
    // Ctrl/Cmd + Minus: Zoom out
    if ((event.ctrlKey || event.metaKey) && event.key === '-') {
      event.preventDefault();
      settings.update((s) => ({ ...s, fontSize: Math.max(10, s.fontSize - 2) }));
    }
    // Ctrl/Cmd + 0: Reset zoom
    if ((event.ctrlKey || event.metaKey) && event.key === '0') {
      event.preventDefault();
      settings.update((s) => ({ ...s, fontSize: 14 }));
    }
  }

  onMount(() => {
    fetchContext();

    // Set up keyboard listener
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<svelte:head>
  <title>Claude Context Viewer</title>
</svelte:head>

<div class="app" style="--font-size: {$settings.fontSize}px">
  <Toolbar />

  <main class="main-content">
    <div class="viewer-container" bind:this={viewerElement}>
      <ContextViewer
        blocks={filteredBlocks}
        fontSize={$settings.fontSize}
        autoScroll={$settings.autoScroll}
        isStreaming={$isStreaming}
        on:scroll={handleScroll}
      />
    </div>

    {#if $settings.showMinimap}
      <ContextMinimap
        blocks={filteredBlocks}
        {scrollPosition}
        {viewportHeight}
        {totalHeight}
        on:click={handleMinimapClick}
      />
    {/if}
  </main>

  <AgentInput disabled={$isStreaming} />

  <StatusBar
    connected={$connectionStatus.connected}
    streaming={$connectionStatus.streaming}
    error={$connectionStatus.error}
    blockCount={filteredBlocks.length}
    inputTokens={$tokenUsage.input}
    outputTokens={$tokenUsage.output}
  />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    font-size: var(--font-size, 14px);
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    background: var(--color-bg);
  }

  .viewer-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
