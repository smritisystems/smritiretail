/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : MetadataCache (High Performance LRU Cache Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export class MetadataCache<T = any> {
  private capacity: number;
  private cache: Map<string, { value: T; timestamp: number }>;
  private hits = 0;
  private misses = 0;

  constructor(capacity = 500) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest item
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): { size: number; capacity: number; hitRatio: string; hits: number; misses: number } {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : "100.0%";
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hitRatio,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const globalMetadataCache = new MetadataCache(1000);
