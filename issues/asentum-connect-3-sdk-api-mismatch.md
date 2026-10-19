**The docs reference two mutually incompatible SDK APIs; only one of them is exported, and the other throws at module load**

**Title:** `[testnet] Docs document Chain/Wallet/Contract imports that @asentum/sdk does not export`

### Environment

| | |
|---|---|
| Package | `@asentum/sdk@0.1.0` (and `@asentum/connect@0.1.9`) |
| Docs pages | `/docs/reference/sdk`, `/docs/getting-started/advanced-features`, `/docs/getting-started/wallet-integration` |

### Description

Two different SDK surfaces are documented, and only the first one exists.

`/docs/reference/sdk` shows:

```js
import { AsentumClient, AsentumWallet, AsentumContract } from '@asentum/sdk';
```

`/docs/getting-started/advanced-features` and `/docs/getting-started/wallet-integration` show:

```js
import { Chain, Wallet, Contract } from '@asentum/sdk';
```

The published package exports exactly:

```
AsentumClient, AsentumContract, AsentumWallet, formatAse, parseAse
```

`Chain`, `Wallet` and `Contract` are not exported, so the second form throws
at module load:

```
SyntaxError: The requested module '@asentum/sdk' does not provide an export named 'Chain'
```

The same pages also use instance methods that do not exist on the published
classes:

- `await chain.contract(addr)` — no such method on `AsentumClient`
- `Wallet.fromKeystore(...)` — the published `AsentumWallet` exposes
  `create`, `fromSeed` and `fromSecretKey` instead

### Reproduction

```js
import { Chain, Wallet, Contract } from '@asentum/sdk';
// SyntaxError: does not provide an export named 'Chain'
```

versus

```js
import { AsentumClient, AsentumWallet, AsentumContract } from '@asentum/sdk';
// works
```

### Impact

A developer copying from the "advanced features" or "wallet integration" page
gets an error at import time, before any code runs. It reads as a broken
package rather than a stale doc, and it is the first thing you hit if you
follow the tutorial path instead of the reference path.

### Suggested fix

Correct the `advanced-features` and `wallet-integration` pages to use the
`AsentumClient` / `AsentumWallet` / `AsentumContract` API, and either
re-export the `Chain` / `Wallet` / `Contract` aliases from the package or
remove the older surface from the docs so there is a single documented API.
