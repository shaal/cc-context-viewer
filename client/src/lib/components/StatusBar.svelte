<script lang="ts">
  export let connected: boolean = false;
  export let streaming: boolean = false;
  export let error: string | undefined = undefined;
  export let blockCount: number = 0;
  export let inputTokens: number = 0;
  export let outputTokens: number = 0;
  export let projectName: string = '';

  $: statusColor = error ? 'error' : streaming ? 'streaming' : connected ? 'connected' : 'disconnected';
  $: statusText = error ? 'Error' : streaming ? 'Streaming' : connected ? 'Connected' : 'Disconnected';
  $: totalTokens = inputTokens + outputTokens;

  // Format large numbers
  function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }
</script>

<footer class="status-bar">
  <div class="status-left">
    <span class="status-indicator {statusColor}" title={error || statusText}>
      <span class="status-dot"></span>
      {statusText}
    </span>
    {#if error}
      <span class="error-message" title={error}>
        {error.length > 30 ? error.slice(0, 30) + '...' : error}
      </span>
    {/if}
  </div>

  <div class="status-center">
    {#if projectName}
      <span class="project-name" title="Project directory">
        📁 {projectName}
      </span>
      <span class="separator">|</span>
    {/if}
    <span class="block-count" title="Total blocks">
      📦 {blockCount} blocks
    </span>
  </div>

  <div class="status-right">
    <span class="token-usage" title="Token usage">
      <span class="token-in">↓ {formatNumber(inputTokens)}</span>
      <span class="token-out">↑ {formatNumber(outputTokens)}</span>
      <span class="token-total">Σ {formatNumber(totalTokens)}</span>
    </span>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--statusbar-height);
    padding: 0 var(--spacing-md);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .status-left,
  .status-center,
  .status-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-secondary);
  }

  .status-indicator.connected .status-dot {
    background: #4CAF50;
  }

  .status-indicator.streaming .status-dot {
    background: #FF9800;
    animation: pulse 1s ease-in-out infinite;
  }

  .status-indicator.error .status-dot {
    background: #F44336;
  }

  .status-indicator.disconnected .status-dot {
    background: #9E9E9E;
  }

  .error-message {
    color: var(--color-error-text);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-name {
    font-weight: 600;
    color: var(--color-primary, #2196F3);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .separator {
    color: var(--color-text-secondary);
    opacity: 0.5;
  }

  .block-count {
    font-weight: 500;
  }

  .token-usage {
    display: flex;
    gap: var(--spacing-sm);
    font-family: monospace;
  }

  .token-in {
    color: #2196F3;
  }

  .token-out {
    color: #4CAF50;
  }

  .token-total {
    font-weight: 600;
    color: var(--color-text);
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
