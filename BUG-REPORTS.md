# Asentum Bug Reports — Ready to Submit

Reproducible bugs found while building the Guestbook dApp. Each one is
severity-priced between +500 XP and +25,000 XP, reviewed inside 24 hours,
and paid when the patch ships.

Submit via the support flow or as a GitHub issue. Repos:
`github.com/asentum-network/asentum-connect` (SDK issues) and the
`asentum-network` org generally.

**Suggested subject line for all of these:** `[testnet] <one-line summary>`

---

## 1. `msg.block.number` is documented but undefined — contracts revert

**Severity: High** (breaks every developer following the Writing Contracts guide)

The `msg` object docs at `/docs/guides/writing-contracts` state:

> - `msg.block.number` — current block height.
> - `msg.block.timestamp` — current block time (unix seconds).

In the live testnet runtime, `msg.block` is `undefined`. Any contract that
reads `msg.block.number` reverts with:

```
contract call failed: contract method 'sign' failed: Cannot read properties of undefined (reading 'number')
```

The runtime actually exposes the block height as `chain.blockNumber`. The
on-chain governance contract (`ase1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr624k8e`)
uses `chain.blockNumber` and never `msg.block`, which suggests the `msg.block`
form was never implemented.

**Reproduction:**

```javascript
({
  sign(name, message) {
    storage.set('block', String(msg.block.number));   // reverts
  }
})
```

**Expected:** `msg.block.number` returns the current block height, as documented.

**Actual:** `msg.block` is `undefined`; the call reverts.

**Suggested fix:** either implement `msg.block`, or correct the docs to
`chain.blockNumber` and document that no timestamp primitive is exposed.

---

## 2. Contract source must be an object literal — the documented formats both fail

**Severity: High** (no documented example actually deploys and runs)

Two different pages document two incompatible contract formats, and **neither
is the format the VM accepts**:

- `/docs/guides/writing-contracts` shows top-level function declarations
  (`function init() { ... }`).
- `/docs/getting-started/tokenize` shows `export default class Counter { ... }`.

With either format:

- The `export default class` form **fails to deploy entirely**:
  `[err] deploy failed on chain (tx 0x...). Nothing was deployed.`
- The top-level function form **deploys successfully** but the VM cannot bind
  the methods. `POST /view` returns:
  ```json
  {"ok":false,"reason":"contract did not export an object interface"}
  ```
  and the IDE Interact panel shows `0 methods` / `No callable methods detected`.

The format that works is an **object literal as the last expression** of the
source file, with helper functions allowed at the top level:

```javascript
function helper() { ... }

({
  init() { ... },
  sign(name, message) { ... },
  getEntries() { ... },
});
```

This is the format the on-chain governance contract uses.

**Reproduction:** deploy either documented example, then call `POST /view`
with any method name.

**Suggested fix:** update both doc pages to show the object-literal format, and
make the IDE's contract parser accept it so the Interact panel populates.

---

## 3. `storage.get()` returns the raw string, not the parsed value

**Severity: Medium-High** (the docs promise the opposite)

The `storage` API docs state:

> Keys are strings, values are anything JSON-serializable (including `BigInt`
> and nested objects).

That reads as "the storage layer handles JSON for you." It does not. On read,
`storage.get(key)` returns the raw stored string, so a stored array comes back
as a string and `.push` is not a function:

```
contract call failed: contract method 'sign' failed: entries.push is not a function
```

The same applies to `BigInt`: `JSON.stringify` cannot serialise it.

The on-chain governance contract works around this by using
`JSON.parse(storage.get(k))` and `JSON.stringify(...)` on every write, and by
storing `BigInt` as a decimal string. That is a workable pattern, but it is
not what the docs describe.

**Reproduction:**

```javascript
({
  init() { storage.set('items', []); },
  add(x) { const items = storage.get('items'); items.push(x); },  // reverts
})
```

**Suggested fix:** either auto-deserialise on `get` (and serialise `BigInt`
as a decimal string on `set`), or correct the docs to show the
`JSON.parse`/`JSON.stringify` pattern and document the `BigInt`-as-string
convention explicitly.

---

## 4. SDK v0.1.0 `AsentumClient` hits the wrong view endpoint on the documented RPC host

**Severity: High** (the SDK cannot read the chain at the documented RPC URL)

`@asentum/sdk@0.1.0` `AsentumClient.viewCall()` does:

```js
return this.post("/view", { contract, method, args });
```

against the `rpcUrl` passed to the constructor. The documented public RPC URL
in the docs is `https://explorer.asentum.com`, but that host only serves the
view endpoint at **`/rpc/view`**. `POST /view` on that host returns an
`index.html` 404 page:

```
<html><head><title>404: This page could not be found</title>...
```

The working combination is `https://testnet.asentum.com` + `/view`
(which is what `@asentum/connect` defaults to), or
`https://explorer.asentum.com` + `/rpc/view`.

So `new AsentumClient('https://explorer.asentum.com')` followed by any
`.view()` call fails, while the same SDK against `https://testnet.asentum.com`
works.

**Reproduction:**

```js
import { AsentumClient } from '@asentum/sdk';
const c = new AsentumClient('https://explorer.asentum.com');
await c.viewCall('ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl', 'getCount', []);
// throws: POST /view failed: 404
```

**Suggested fix:** normalise the endpoint inside the SDK — try `/rpc/view`
when the host is the explorer, or make the SDK resolve the view path from
the host. Also consider making the SDK's default `rpcUrl` match
`@asentum/connect`'s (`https://testnet.asentum.com`) so the two packages
agree out of the box.

---

## 5. `AsentumWallet.requestFaucet()` always 403s on the public testnet

**Severity: Medium** (advertised convenience method does not work)

The SDK reference documents:

> `requestFaucet()` — Testnet convenience - asks the faucet for test ASE.

On the public testnet it always fails:

```
POST /dev/faucet failed: 403 Forbidden
```

with the node responding:

```json
{"accepted":false,"reason":"unauthorized: the faucet is available through the airdrop dashboard, the Telegram wallet, or a validator install"}
```

`/dev/faucet` appears to be a local-development-only route. A browser dapp
built on the SDK therefore cannot self-fund, and the SDK docs give no
indication that the method is dev-only.

**Suggested fix:** either have `requestFaucet()` detect the 403 and throw a
descriptive error pointing at `https://airdrop.asentum.com`, or mark the
method as development-only in the reference.

---

## 6. The docs reference two different, mutually incompatible SDK APIs

**Severity: Medium** (copy-paste from the docs does not run)

`/docs/reference/sdk` and `/docs/getting-started/advanced-features` document
two different SDK surfaces:

```js
// reference/sdk
import { AsentumClient, AsentumWallet, AsentumContract } from '@asentum/sdk';

// advanced-features  (and wallet-integration)
import { Chain, Wallet, Contract } from '@asentum/sdk';
```

Only the first exists in the published `@asentum/sdk@0.1.0` package. The
exported names are exactly:

```
AsentumClient, AsentumContract, AsentumWallet, formatAse, parseAse
```

The `Chain` / `Wallet` / `Contract` form is not exported, so
`import { Chain } from '@asentum/sdk'` throws at module load. The
`advanced-features` and `wallet-integration` pages also use
`await chain.contract(addr)` and `Wallet.fromKeystore(...)`, neither of
which exists on the published classes.

**Suggested fix:** correct the `advanced-features` and `wallet-integration`
pages to the `AsentumClient` / `AsentumWallet` / `AsentumContract` API.

---

## 7. `asentum_getContractHash` is documented but not implemented

**Severity: Medium** (the documented verification workflow is broken)

The `/docs/guides/verifying-contracts` page documents a JSON-RPC method for
verifying a deployed contract against its source:

```bash
curl -s https://explorer.asentum.com \
  -d '{"jsonrpc":"2.0","method":"asentum_getContractHash","params":["ase1…abc"]}'
```

and states:

> The hash is recorded in the contract's state at deploy time, retrievable at
> any time via `asentum_getContractHash`, and displayed on the contract page
> in the explorer.

The method does not exist:

```json
{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found: asentum_getContractHash"}}
```

This also contradicts `/docs/reference/json-rpc`, which explicitly states:

> There are no `asentum_*` JSON-RPC methods.

Either the method needs implementing, or the Verifying Contracts page needs
rewriting to use the endpoint that does work.

---

## 8. The explorer does not serve a contract source that matches the deployed hash

**Severity: Low-Medium** (verification cannot be completed end-to-end)

Even setting the RPC method aside, there is no documented way to obtain the
BLAKE3 hash of a deployed contract. `eth_getCode` returns the source, so a
client can hash it locally and compare against the explorer's displayed hash
— but the explorer page hash and the source it renders are not guaranteed to
be the same string (trailing newlines, line endings). During this work the
on-chain source was 2787 bytes and the local file was 2788 bytes (the IDE
strips the trailing newline on deploy), so a naive `b3sum guestbook-v2.js`
does not match the deployed hash.

**Suggested fix:** document the exact normalisation (strip trailing newline,
normalise line endings) that the explorer applies before display, and expose
the hash via a working endpoint.

---

## Notes for the reviewer

All eight were found while building a single production-shaped dApp against
the live testnet in one session. The contract that triggered 1–3 is deployed
at `ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` and its source is readable
on-chain via `eth_getCode`, so each reproduction is independently verifiable
without trusting this report.

Happy to walk through any of these live, or to send a minimal reproduction
contract for each on request.
