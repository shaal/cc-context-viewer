<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
  import ContextBlock from './ContextBlock.svelte';
  import type { ContextBlock as ContextBlockType } from '$types';

  export let blocks: ContextBlockType[] = [];
  export let fontSize: number = 14;
  export let autoScroll: boolean = true;
  export let isStreaming: boolean = false;

  const dispatch = createEventDispatcher<{
    scroll: { scrollTop: number; viewportHeight: number; totalHeight: number };
  }>();

  let containerElement: HTMLElement;
  let shouldAutoScroll = true;

  function handleScroll() {
    if (!containerElement) return;

    const scrollTop = containerElement.scrollTop;
    const viewportHeight = containerElement.clientHeight;
    const totalHeight = containerElement.scrollHeight;

    // Check if user scrolled away from bottom
    const distanceFromBottom = totalHeight - (scrollTop + viewportHeight);
    shouldAutoScroll = distanceFromBottom < 50;

    dispatch('scroll', {
      scrollTop,
      viewportHeight,
      totalHeight,
    });
  }

  // Auto-scroll to bottom when streaming
  afterUpdate(() => {
    if (autoScroll && isStreaming && shouldAutoScroll && containerElement) {
      containerElement.scrollTop = containerElement.scrollHeight;
    }
  });

  onMount(() => {
    if (containerElement) {
      handleScroll();
    }
  });

  // Expose scrollTo method for external control (minimap)
  export function scrollTo(position: number) {
    if (containerElement) {
      containerElement.scrollTo({ top: position, behavior: 'smooth' });
    }
  }
</script>

<div
  class="context-viewer"
  bind:this={containerElement}
  on:scroll={handleScroll}
  style="--font-size: {fontSize}px"
>
  {#each blocks as block, i (block.id)}
    <ContextBlock
      {block}
      index={i}
      {fontSize}
    />
  {/each}

  {#if blocks.length === 0}
    <div class="empty-state">
      <div class="empty-icon">💬</div>
      <p>No messages yet</p>
      <p class="empty-hint">Send a message to start a conversation with Claude</p>
    </div>
  {/if}
</div>

<style>
  .context-viewer {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-md);
    font-size: var(--font-size, 14px);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .empty-state p {
    margin: var(--spacing-xs) 0;
  }

  .empty-hint {
    font-size: 0.9em;
    opacity: 0.7;
  }
</style>
