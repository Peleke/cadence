# Installation

## Prerequisites

- Node.js 22 or later
- TypeScript 5.7+ (for strict mode compatibility)

## Install

```bash
# pnpm (recommended)
pnpm add @peleke.s/cadence

# npm
npm install @peleke.s/cadence

# yarn
yarn add @peleke.s/cadence
```

## TypeScript Configuration

Cadence is written in strict TypeScript with ESM. Your `tsconfig.json` should include:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

## Verify Installation

```typescript
import { createSignalBus } from "@peleke.s/cadence";

const bus = createSignalBus();
console.log(bus.stats());
// { emitted: 0, handled: 0, errors: 0, handlers: 0, anyHandlers: 0, middleware: 0 }
```

## Dependencies

Cadence has two production dependencies:

| Package | Purpose |
|---------|---------|
| [chokidar](https://github.com/paulmillr/chokidar) | File system watching for `createFileWatcherSource` |
| [croner](https://github.com/hexagon/croner) | Cron expression parsing for `createCronSource` |

Both are lightweight with no native add-ons.
