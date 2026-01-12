<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
  import { ContentType, CONTENT_TYPE_COLORS, type ContextBlock } from '$types';

  export let blocks: ContextBlock[] = [];
  export let scrollPosition: number = 0;
  export let viewportHeight: number = 0;
  export let totalHeight: number = 0;

  const dispatch = createEventDispatcher<{
    click: { position: number };
  }>();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isDragging = false;

  // Canvas dimensions
  const WIDTH = 80;
  let canvasHeight = 400;

  // Color map (hex values for canvas)
  const MINIMAP_COLORS: Record<ContentType, string> = {
    [ContentType.SYSTEM]: '#E3F2FD',
    [ContentType.TOOL_DEFINITION]: '#E8F5E9',
    [ContentType.USER]: '#FFFDE7',
    [ContentType.ASSISTANT_THINKING]: '#F3E5F5',
    [ContentType.ASSISTANT_TEXT]: '#FAFAFA',
    [ContentType.TOOL_USE]: '#FFF3E0',
    [ContentType.TOOL_RESULT]: '#FFEBEE',
    [ContentType.ERROR]: '#ECEFF1',
  };

  // Calculate total estimated height from blocks
  $: estimatedTotalHeight = blocks.reduce(
    (sum, b) => sum + (b.estimatedHeight || 100),
    0
  );

  // Scale factor for mapping content height to canvas
  $: scale = canvasHeight / Math.max(estimatedTotalHeight, 1);

  // Viewport indicator position and size
  $: viewportTop = (scrollPosition / Math.max(totalHeight, 1)) * canvasHeight;
  $: viewportSize = Math.max(20, (viewportHeight / Math.max(totalHeight, 1)) * canvasHeight);

  function draw() {
    if (!ctx || !canvas) return;

    // Clear canvas
    ctx.clearRect(0, 0, WIDTH, canvasHeight);

    // Draw background
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, 0, WIDTH, canvasHeight);

    // Draw blocks
    let y = 0;
    for (const block of blocks) {
      const blockHeight = Math.max(2, (block.estimatedHeight || 100) * scale);
      ctx.fillStyle = MINIMAP_COLORS[block.type] || '#ECEFF1';
      ctx.fillRect(0, y, WIDTH, blockHeight - 1);
      y += blockHeight;
    }

    // Draw viewport indicator
    ctx.strokeStyle = '#1976D2';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(25, 118, 210, 0.1)';
    ctx.fillRect(0, viewportTop, WIDTH, viewportSize);
    ctx.strokeRect(0, viewportTop, WIDTH, viewportSize);
  }

  function handleClick(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const position = y / canvasHeight;
    dispatch('click', { position: Math.max(0, Math.min(1, position)) });
  }

  function handleMouseDown(event: MouseEvent) {
    isDragging = true;
    handleClick(event);
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging) {
      handleClick(event);
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    canvasHeight = canvas.parentElement?.clientHeight || 400;
    canvas.height = canvasHeight;
    draw();

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      if (canvas.parentElement) {
        canvasHeight = canvas.parentElement.clientHeight;
        canvas.height = canvasHeight;
        draw();
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => resizeObserver.disconnect();
  });

  afterUpdate(() => {
    draw();
  });
</script>

<svelte:window on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

<aside class="minimap">
  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={canvasHeight}
    on:mousedown={handleMouseDown}
    role="slider"
    aria-label="Context minimap navigation"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round((scrollPosition / Math.max(totalHeight, 1)) * 100)}
    tabindex="0"
  />
</aside>

<style>
  .minimap {
    width: var(--minimap-width, 80px);
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  canvas {
    display: block;
    width: 100%;
    cursor: pointer;
  }

  canvas:active {
    cursor: grabbing;
  }
</style>
