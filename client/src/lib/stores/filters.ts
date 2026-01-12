/**
 * Filter Store
 *
 * Manages which content types are visible in the viewer.
 */

import { writable, derived } from 'svelte/store';
import { ContentType } from '$types';

// All content types that can be filtered
export const ALL_CONTENT_TYPES = Object.values(ContentType);

// Active filters (empty = show all)
export const activeFilters = writable<Set<ContentType>>(new Set());

/**
 * Toggle a filter on/off
 */
export function toggleFilter(type: ContentType): void {
  activeFilters.update((filters) => {
    const newFilters = new Set(filters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    return newFilters;
  });
}

/**
 * Set a single filter (exclusive)
 */
export function setExclusiveFilter(type: ContentType): void {
  activeFilters.set(new Set([type]));
}

/**
 * Show all content types
 */
export function showAll(): void {
  activeFilters.set(new Set());
}

/**
 * Check if a filter is active
 */
export function isFilterActive(type: ContentType): boolean {
  let result = false;
  activeFilters.subscribe((filters) => {
    result = filters.size === 0 || filters.has(type);
  })();
  return result;
}

/**
 * Derived: whether "show all" is currently active
 */
export const isShowingAll = derived(
  activeFilters,
  ($filters) => $filters.size === 0
);

/**
 * Derived: count of active filters
 */
export const activeFilterCount = derived(
  activeFilters,
  ($filters) => $filters.size
);
