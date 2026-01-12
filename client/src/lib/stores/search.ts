/**
 * Search Store
 *
 * Provides search functionality using the Web Worker for performance.
 * Handles debouncing, match tracking, and navigation between matches.
 */

import { writable, derived, get } from 'svelte/store';
import { parserWorker } from '$lib/utils/worker-manager';
import { blocks } from './context';
import type { SearchMatch } from '$types';

// Search state
export const searchQuery = writable<string>('');
export const searchMatches = writable<SearchMatch[]>([]);
export const currentMatchIndex = writable<number>(0);
export const isSearching = writable<boolean>(false);

// Derived stores
export const matchCount = derived(searchMatches, ($matches) => $matches.length);
export const currentMatch = derived(
  [searchMatches, currentMatchIndex],
  ([$matches, $index]) => ($matches.length > 0 ? $matches[$index] : null)
);

// Debounce timer
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 150;

// Track if worker is initialized
let workerInitialized = false;

/**
 * Initialize the worker and index current blocks
 */
export async function initializeSearch(): Promise<void> {
  if (workerInitialized) return;

  try {
    await parserWorker.initialize();
    workerInitialized = true;

    // Index current blocks
    const currentBlocks = get(blocks);
    if (currentBlocks.length > 0) {
      await parserWorker.indexBlocks(currentBlocks);
    }
  } catch (error) {
    console.error('Failed to initialize search worker:', error);
  }
}

/**
 * Update the search index when blocks change
 */
export async function updateIndex(): Promise<void> {
  if (!workerInitialized) {
    await initializeSearch();
    return;
  }

  const currentBlocks = get(blocks);
  await parserWorker.indexBlocks(currentBlocks);

  // Re-run search if there's an active query
  const query = get(searchQuery);
  if (query.length >= 2) {
    await performSearch(query);
  }
}

/**
 * Perform search using the worker
 */
async function performSearch(query: string): Promise<void> {
  if (!workerInitialized) {
    await initializeSearch();
  }

  isSearching.set(true);

  try {
    const matches = await parserWorker.search(query);
    searchMatches.set(matches);
    currentMatchIndex.set(matches.length > 0 ? 0 : -1);
  } catch (error) {
    console.error('Search error:', error);
    searchMatches.set([]);
    currentMatchIndex.set(-1);
  } finally {
    isSearching.set(false);
  }
}

/**
 * Set the search query with debouncing
 */
export function setSearchQuery(query: string): void {
  searchQuery.set(query);

  // Clear previous timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  // Clear results if query is too short
  if (query.length < 2) {
    searchMatches.set([]);
    currentMatchIndex.set(-1);
    return;
  }

  // Debounce search
  searchDebounceTimer = setTimeout(() => {
    performSearch(query);
  }, SEARCH_DEBOUNCE_MS);
}

/**
 * Navigate to next match
 */
export function nextMatch(): void {
  const matches = get(searchMatches);
  if (matches.length === 0) return;

  const current = get(currentMatchIndex);
  const next = (current + 1) % matches.length;
  currentMatchIndex.set(next);
}

/**
 * Navigate to previous match
 */
export function prevMatch(): void {
  const matches = get(searchMatches);
  if (matches.length === 0) return;

  const current = get(currentMatchIndex);
  const prev = current <= 0 ? matches.length - 1 : current - 1;
  currentMatchIndex.set(prev);
}

/**
 * Clear search state
 */
export function clearSearch(): void {
  searchQuery.set('');
  searchMatches.set([]);
  currentMatchIndex.set(-1);

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

/**
 * Clean up worker on app unmount
 */
export function destroySearch(): void {
  parserWorker.terminate();
  workerInitialized = false;
}

// Subscribe to blocks changes to update index
blocks.subscribe((currentBlocks) => {
  if (workerInitialized && currentBlocks.length > 0) {
    // Debounce index updates
    setTimeout(() => {
      parserWorker.indexBlocks(currentBlocks);
    }, 100);
  }
});
