/**
 * Parser Web Worker
 *
 * Handles CPU-intensive operations off the main thread:
 * - Building and searching an inverted index for fast text search
 * - Calculating estimated heights for virtual scrolling
 * - Batching updates to minimize main thread communication
 */

// Types duplicated here since workers have separate context
interface SearchMatch {
  blockId: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

interface BlockHeightData {
  id: string;
  content: string;
  type: string;
}

interface IndexEntry {
  blockId: string;
  positions: number[];
}

// Message types from main thread
type WorkerMessage =
  | { type: 'index'; blocks: BlockHeightData[] }
  | { type: 'search'; query: string }
  | { type: 'calculateHeights'; blocks: BlockHeightData[]; fontSize: number }
  | { type: 'updateBlock'; block: BlockHeightData }
  | { type: 'clear' };

// Message types to main thread
type WorkerResponse =
  | { type: 'indexed'; count: number }
  | { type: 'searchResults'; matches: SearchMatch[]; query: string }
  | { type: 'heights'; data: Record<string, number> }
  | { type: 'error'; message: string };

/**
 * Inverted index for fast text search
 * Maps normalized words to their locations in blocks
 */
class SearchIndex {
  private index: Map<string, IndexEntry[]> = new Map();
  private blockContents: Map<string, string> = new Map();

  /**
   * Add or update a block in the index
   */
  indexBlock(blockId: string, content: string): void {
    // Remove old entries for this block
    this.removeBlock(blockId);

    // Store original content for match extraction
    this.blockContents.set(blockId, content);

    // Normalize and tokenize
    const normalizedContent = content.toLowerCase();
    const words = this.tokenize(normalizedContent);

    // Build index entries
    for (const { word, position } of words) {
      const entries = this.index.get(word) || [];
      const existingEntry = entries.find((e) => e.blockId === blockId);

      if (existingEntry) {
        existingEntry.positions.push(position);
      } else {
        entries.push({ blockId, positions: [position] });
        this.index.set(word, entries);
      }
    }
  }

  /**
   * Remove a block from the index
   */
  removeBlock(blockId: string): void {
    this.blockContents.delete(blockId);

    // Remove from all word entries
    for (const [word, entries] of this.index.entries()) {
      const filtered = entries.filter((e) => e.blockId !== blockId);
      if (filtered.length === 0) {
        this.index.delete(word);
      } else if (filtered.length !== entries.length) {
        this.index.set(word, filtered);
      }
    }
  }

  /**
   * Search for a query string
   */
  search(query: string): SearchMatch[] {
    if (!query.trim()) return [];

    const normalizedQuery = query.toLowerCase();
    const matches: SearchMatch[] = [];

    // For each block, find all occurrences of the query
    for (const [blockId, content] of this.blockContents.entries()) {
      const normalizedContent = content.toLowerCase();
      let searchStart = 0;

      while (searchStart < normalizedContent.length) {
        const index = normalizedContent.indexOf(normalizedQuery, searchStart);
        if (index === -1) break;

        matches.push({
          blockId,
          startIndex: index,
          endIndex: index + query.length,
          text: content.substring(index, index + query.length),
        });

        searchStart = index + 1;
      }
    }

    return matches;
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.index.clear();
    this.blockContents.clear();
  }

  /**
   * Tokenize text into words with positions
   */
  private tokenize(text: string): Array<{ word: string; position: number }> {
    const words: Array<{ word: string; position: number }> = [];
    const regex = /\b\w+\b/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      words.push({ word: match[0], position: match.index });
    }

    return words;
  }
}

/**
 * Height calculator for virtual scrolling
 */
class HeightCalculator {
  private readonly LINE_HEIGHT = 1.5; // em
  private readonly BASE_PADDING = 32; // px (16px top + 16px bottom)
  private readonly HEADER_HEIGHT = 28; // px for block header
  private readonly CHARS_PER_LINE = 100; // approximate characters per line

  /**
   * Estimate height based on content
   */
  estimateHeight(content: string, fontSize: number): number {
    // Count actual line breaks
    const lineBreaks = (content.match(/\n/g) || []).length;

    // Estimate wrapped lines based on content length
    const charCount = content.length;
    const estimatedWrappedLines = Math.ceil(charCount / this.CHARS_PER_LINE);

    // Total lines is max of actual breaks or estimated wrapped lines
    const totalLines = Math.max(lineBreaks + 1, estimatedWrappedLines);

    // Calculate height
    const lineHeightPx = fontSize * this.LINE_HEIGHT;
    const contentHeight = totalLines * lineHeightPx;

    return Math.ceil(contentHeight + this.BASE_PADDING + this.HEADER_HEIGHT);
  }

  /**
   * Calculate heights for multiple blocks
   */
  calculateHeights(
    blocks: BlockHeightData[],
    fontSize: number
  ): Record<string, number> {
    const heights: Record<string, number> = {};

    for (const block of blocks) {
      heights[block.id] = this.estimateHeight(block.content, fontSize);
    }

    return heights;
  }
}

// Initialize worker state
const searchIndex = new SearchIndex();
const heightCalculator = new HeightCalculator();

/**
 * Handle messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'index': {
        // Index all blocks
        for (const block of message.blocks) {
          searchIndex.indexBlock(block.id, block.content);
        }
        const response: WorkerResponse = {
          type: 'indexed',
          count: message.blocks.length,
        };
        self.postMessage(response);
        break;
      }

      case 'search': {
        const matches = searchIndex.search(message.query);
        const response: WorkerResponse = {
          type: 'searchResults',
          matches,
          query: message.query,
        };
        self.postMessage(response);
        break;
      }

      case 'calculateHeights': {
        const heights = heightCalculator.calculateHeights(
          message.blocks,
          message.fontSize
        );
        const response: WorkerResponse = { type: 'heights', data: heights };
        self.postMessage(response);
        break;
      }

      case 'updateBlock': {
        // Update single block in index
        searchIndex.indexBlock(message.block.id, message.block.content);
        const response: WorkerResponse = { type: 'indexed', count: 1 };
        self.postMessage(response);
        break;
      }

      case 'clear': {
        searchIndex.clear();
        const response: WorkerResponse = { type: 'indexed', count: 0 };
        self.postMessage(response);
        break;
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const response: WorkerResponse = { type: 'error', message: errorMessage };
    self.postMessage(response);
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
