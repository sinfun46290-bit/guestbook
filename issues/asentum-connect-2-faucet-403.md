**`AsentumWallet.requestFaucet()` always fails with 403 on the public testnet, and the SDK reference does not say it is development-only**

**Title:** `[testnet] requestFaucet() always 403s on the public testnet — undocumented dev-only endpoint`

### Environment

| | |
|---|---|
| Package | `@asentum/sdk@0.1.0` |
| Endpoint | `POST /dev/faucet` |
| Chain | testnet, chain id 1423 |

### Description

The SDK reference documents:

> `requestFaucet()` — Testnet convenience - asks the faucet for test ASE.

On the public testnet it never succeeds. The call returns:

```
POST /dev/faucet failed: 403 Forbidden
```

and the node responds with a message that describes a different path than the
one the SDK is calling:

```json
{"accepted":false,"reason":"unauthorized: the faucet is available through the airdrop dashboard, the Telegram wallet, or a validator install"}
```

`/dev/faucet` looks like a local-development-only route that is not available
on the public network. The SDK docs give no indication the method is
dev-only, so a browser dapp that follows the documented pattern
(`AsentumWallet.create()` → `requestFaucet()` → sign a tx) cannot self-fund.

### Reproduction

```js
import { AsentumClient, AsentumWallet } from '@asentum/sdk';

const client = new AsentumClient('https://testnet.asentum.com');
const wallet = AsentumWallet.create(client);
await wallet.requestFaucet();
// POST /dev/faucet failed: 403 Forbidden
```

### Impact

This is the documented "in-browser wallet" path, and it is the only one that
lets a fresh browser wallet fund itself. Without it, every dapp user has to
manually claim from the dashboard faucet (5 ASE per drip, rate limited) and
re-link their address, which is a hard stop for a first-time visitor who is
not already in the airdrop dashboard.

### Suggested fix

Either catch the 403 in `requestFaucet()` and throw a descriptive error that
points at `https://airdrop.asentum.com` and the dashboard flow, or mark the
method clearly as development-only in the reference. A dapp that detects the
403 and offers a "claim from dashboard" link in the UI would make the
documented pattern work in practice.
