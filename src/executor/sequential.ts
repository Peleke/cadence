/**
 * Sequential executor — default, handlers run one at a time.
 * Simple and predictable. Slow handlers block subsequent signals.
 */

import type { AnySignalHandler, BaseSignal, HandlerExecutor } from "../types.js";

export function createSequentialExecutor<
  S extends BaseSignal = BaseSignal,
>(): HandlerExecutor<S> {
  let processing = 0;

  async function execute(handler: AnySignalHandler<S>, signal: S): Promise<void> {
    processing++;
    try {
      await handler(signal);
    } finally {
      processing--;
    }
  }

  function stats(): { queued: number; processing: number } {
    return { queued: 0, processing };
  }

  return { execute, stats };
}
