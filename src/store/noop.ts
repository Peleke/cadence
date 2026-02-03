/**
 * No-op store — default, signals are not persisted.
 * Use this when durability is not needed.
 */

import type { BaseSignal, SignalStore } from "../types.js";

export function createNoopStore<S extends BaseSignal = BaseSignal>(): SignalStore<S> {
  return {
    async save(_signal: S): Promise<void> {
      // No-op
    },
    async markAcked(_signalId: string): Promise<void> {
      // No-op
    },
    async getUnacked(): Promise<S[]> {
      return [];
    },
  };
}
