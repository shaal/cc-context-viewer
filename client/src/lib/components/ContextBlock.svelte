<script lang="ts">
  import { ContentType, CONTENT_TYPE_COLORS, type ContextBlock } from '$types';

  export let block: ContextBlock;
  export let index: number = 0;
  export let fontSize: number = 14;

  let isCollapsed = false;

  $: colors = CONTENT_TYPE_COLORS[block.type] || CONTENT_TYPE_COLORS[ContentType.ERROR];
  $: isLongContent = block.content.length > 2000;
  $: shouldCollapse = isLongContent && isCollapsed;
  $: displayContent = shouldCollapse ? block.content.slice(0, 500) + '...' : block.content;
  $: isJson = block.type === ContentType.TOOL_USE || block.type === ContentType.TOOL_RESULT || block.type === ContentType.TOOL_DEFINITION;

  // Format timestamp
  $: timestamp = new Date(block.timestamp).toLocaleTimeString();

  // Try to format JSON content
  $: formattedContent = isJson ? tryFormatJson(displayContent) : displayContent;

  function tryFormatJson(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<article
  class="context-block"
  class:streaming={block.isStreaming}
  style="
    --block-bg: {colors.bg};
    --block-text: {colors.text};
    --block-border: {colors.border};
    --font-size: {fontSize}px;
  "
>
  <header class="block-header">
    <span class="block-type">{colors.label}</span>
    {#if block.metadata?.toolName}
      <span class="tool-name">{block.metadata.toolName}</span>
    {/if}
    <span class="block-index">#{index + 1}</span>
    <span class="block-timestamp">{timestamp}</span>
    {#if block.isStreaming}
      <span class="streaming-indicator" title="Streaming...">●</span>
    {/if}
    {#if isLongContent}
      <button class="collapse-btn" on:click={toggleCollapse}>
        {isCollapsed ? '▶ Show more' : '▼ Show less'}
      </button>
    {/if}
  </header>

  <div class="block-content" class:code={isJson}>
    {#if isJson}
      <pre>{formattedContent}</pre>
    {:else}
      <p>{formattedContent}</p>
    {/if}
  </div>

  {#if block.metadata?.inputTokens || block.metadata?.outputTokens}
    <footer class="block-footer">
      {#if block.metadata.inputTokens}
        <span>In: {block.metadata.inputTokens}</span>
      {/if}
      {#if block.metadata.outputTokens}
        <span>Out: {block.metadata.outputTokens}</span>
      {/if}
    </footer>
  {/if}
</article>

<style>
  .context-block {
    background: var(--block-bg);
    border-left: 4px solid var(--block-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-md);
    overflow: hidden;
    font-size: var(--font-size, 14px);
    transition: box-shadow var(--transition-fast);
  }

  .context-block:hover {
    box-shadow: var(--shadow-sm);
  }

  .context-block.streaming {
    border-left-width: 4px;
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% {
      border-left-color: var(--block-border);
    }
    50% {
      border-left-color: var(--color-primary);
    }
  }

  .block-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(0, 0, 0, 0.03);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    font-size: 0.85em;
  }

  .block-type {
    font-weight: 600;
    color: var(--block-text);
    text-transform: uppercase;
    font-size: 0.75em;
    letter-spacing: 0.5px;
  }

  .tool-name {
    background: var(--block-border);
    color: white;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.8em;
    font-family: monospace;
  }

  .block-index {
    color: var(--color-text-secondary);
    font-size: 0.8em;
  }

  .block-timestamp {
    margin-left: auto;
    color: var(--color-text-secondary);
    font-size: 0.8em;
  }

  .streaming-indicator {
    color: var(--color-primary);
    animation: pulse 1s ease-in-out infinite;
  }

  .collapse-btn {
    padding: 2px 8px;
    font-size: 0.75em;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-secondary);
  }

  .collapse-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .block-content {
    padding: var(--spacing-md);
    color: var(--color-text);
    line-height: 1.6;
  }

  .block-content p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .block-content.code {
    padding: 0;
  }

  .block-content pre {
    margin: 0;
    padding: var(--spacing-md);
    background: rgba(0, 0, 0, 0.03);
    overflow-x: auto;
    font-size: 0.9em;
  }

  .block-footer {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-xs) var(--spacing-md);
    background: rgba(0, 0, 0, 0.03);
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    font-size: 0.75em;
    color: var(--color-text-secondary);
  }
</style>
