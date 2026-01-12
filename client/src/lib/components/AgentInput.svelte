<script lang="ts">
  import { sendMessage, clearContext } from '$lib/stores/context';

  export let disabled: boolean = false;

  let inputValue = '';
  let textareaElement: HTMLTextAreaElement;

  async function handleSend() {
    if (!inputValue.trim() || disabled) return;

    const message = inputValue.trim();
    inputValue = '';

    // Reset textarea height
    if (textareaElement) {
      textareaElement.style.height = 'auto';
    }

    await sendMessage(message);
  }

  function handleKeydown(event: KeyboardEvent) {
    // Ctrl/Cmd + Enter to send
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    // Auto-resize textarea
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = Math.min(textareaElement.scrollHeight, 150) + 'px';
    }
  }

  async function handleClear() {
    if (confirm('Are you sure you want to clear the conversation?')) {
      await clearContext();
    }
  }

  $: charCount = inputValue.length;
</script>

<div class="agent-input" class:disabled>
  <div class="input-container">
    <textarea
      bind:this={textareaElement}
      bind:value={inputValue}
      on:keydown={handleKeydown}
      on:input={handleInput}
      placeholder="Type a message... (Ctrl+Enter to send)"
      {disabled}
      rows="1"
    />
    <span class="char-count">{charCount}</span>
  </div>

  <div class="input-actions">
    <button
      class="btn btn-clear"
      on:click={handleClear}
      disabled={disabled}
      title="Clear conversation"
    >
      🗑 Clear
    </button>
    <button
      class="btn btn-send"
      on:click={handleSend}
      disabled={disabled || !inputValue.trim()}
      title="Send message (Ctrl+Enter)"
    >
      {#if disabled}
        ⏳ Sending...
      {:else}
        ➤ Send
      {/if}
    </button>
  </div>
</div>

<style>
  .agent-input {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
  }

  .agent-input.disabled {
    opacity: 0.7;
  }

  .input-container {
    flex: 1;
    position: relative;
  }

  textarea {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    padding-right: 60px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: var(--font-size-base);
    line-height: 1.5;
    resize: none;
    min-height: 44px;
    max-height: 150px;
    outline: none;
    transition: border-color var(--transition-fast);
  }

  textarea:focus {
    border-color: var(--color-primary);
  }

  textarea:disabled {
    background: var(--color-bg);
    cursor: not-allowed;
  }

  .char-count {
    position: absolute;
    right: 12px;
    bottom: 10px;
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .input-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-send {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .btn-send:hover:not(:disabled) {
    background: var(--color-primary-light);
  }

  .btn-clear {
    background: var(--color-bg);
    color: var(--color-text-secondary);
  }

  .btn-clear:hover:not(:disabled) {
    background: var(--color-error-bg);
    border-color: var(--color-error-border);
    color: var(--color-error-text);
  }
</style>
