/**
 * In-memory transport — default, simplest implementation.
 * Signals are delivered synchronously to all subscribers in-process.
 */

import type { AnySignalHandler, BaseSignal, Transport } from "../types.js";

export function createMemoryTransport<S extends BaseSignal = BaseSignal>(): Transport<S> {
  const subscribers = new Set<AnySignalHandler<S>>();

  async function emit(signal: S): Promise<void> {
    // Deliver to all subscribers
    // Note: errors should be caught by the bus, not here
    for (const handler of subscribers) {
      await handler(signal);
    }
  }

  function subscribe(handler: AnySignalHandler<S>): () => void {
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }

  return { emit, subscribe };
}
