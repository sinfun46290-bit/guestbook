# Telegram post — chain runtime bugs (reports 1, 2, 3)

The chain core repo is not public, so the three runtime bugs go to the
Telegram channel (`t.me/asentum`, which the docs call the `#devlog` channel)
and as a DM to [@jst_Smiles](https://x.com/jst_Smiles), the ecosystem
developer whose role is the developer feedback loop.

**Post all three in one message** — they share a root cause (the docs describe
a contract API that the runtime does not implement) and the reviewer can see
the whole picture in one read. Do not split them into three messages: the
review clock is 24 hours and a single coherent report is more likely to be
triaged properly.

**Suggested channel topic:** `bug report — contract runtime vs. writing-contracts guide`
**Suggested tags:** `#devlog` (if the channel has topics)

---

## Post body (copy from here)

Three reproducible contract-runtime issues, found while shipping a guestbook
dApp against the public testnet. All three are cases where the Writing
Contracts guide documents an API the runtime does not implement. The contract
that triggered all three is deployed at
`ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` and its source is readable via
`eth_getCode`, so every reproduction below is verifiable on-chain without
trusting this message.

**1. `msg.block` is undefined — `msg.block.number` reverts**

The guide states `msg.block.number` is the current block height and
`msg.block.timestamp` is the block time. In the live runtime `msg.block` is
`undefined` and any contract that reads it reverts:

```
contract call failed: contract method 'sign' failed:
Cannot read properties of undefined (reading 'number')
```

The runtime actually exposes `chain.blockNumber` — the on-chain governance
contract uses that and never `msg.block`, which suggests the `msg.block`
form was never implemented. There also appears to be no timestamp primitive
at all.

Repro:

```javascript
({
  sign(name, message) {
    storage.set('block', String(msg.block.number));   // reverts
  }
})
```

**2. Neither documented contract format runs — only an object literal works**

Two pages document two incompatible formats, and neither is the one the VM
accepts:

- Writing Contracts guide → top-level `function init() { ... }`
- Tokenize guide → `export default class Counter { ... }`

`export default class` fails to deploy outright
(`deploy failed on chain … Nothing was deployed`). The top-level function
form deploys fine but the VM cannot bind it — `POST /view` returns
`{"ok":false,"reason":"contract did not export an object interface"}` and the
IDE Interact panel shows `0 methods` / "No callable methods detected".

The format that actually works is an object literal as the last expression of
the file, with helpers allowed at the top level:

```javascript
function helper() { ... }

({
  init() { ... },
  sign(name, message) { ... },
  getEntries() { ... },
});
```

That is the format the governance contract uses. It appears in neither guide.
It would also be good if the IDE's contract parser accepted it — right now
the Interact panel only populates for that shape, which is how I found it.

**3. `storage.get()` returns the raw string, not the parsed value**

The storage API docs say values are "anything JSON-serializable (including
BigInt and nested objects)", which reads as "the storage layer handles JSON
for you". It does not. On read you get the raw stored string, so a stored
array comes back as a string and `.push` is not a function:

```
contract call failed: contract method 'sign' failed: entries.push is not a function
```

`BigInt` has the same problem: `JSON.stringify` cannot serialise it.

Repro:

```javascript
({
  init() { storage.set('items', []); },
  add(x) { const items = storage.get('items'); items.push(x); },  // reverts
})
```

The governance contract works around this with `JSON.parse(storage.get(k))` /
`JSON.stringify(...)` on every write and by storing `BigInt` as a decimal
string. That is workable, but it is not what the docs describe, and it is
the kind of thing a new developer will get wrong on their first contract.

**Suggested fixes:** implement `msg.block` or correct the guide to
`chain.blockNumber` and document that no timestamp is exposed; update both
guides to show the object-literal format and make the IDE parser accept it;
either auto-deserialise on `get` (with `BigInt` stored as a decimal string)
or document the `JSON.parse`/`JSON.stringify` convention explicitly.

Happy to send a minimal reproduction contract for each, or to walk through
any of them live.

---

## DM to @jst_Smiles (shorter version)

Hi Smiles — submitting three reproducible contract-runtime bugs, full details
in the Telegram post. Short version: the Writing Contracts guide documents
`msg.block.number`, but `msg.block` is undefined at runtime (it's
`chain.blockNumber`); neither documented contract format actually runs (the
`export default class` form fails to deploy, the top-level function form
deploys but the VM can't bind it — only an object literal `({ ... })` as the
last expression works, and the IDE parser doesn't recognise that shape); and
`storage.get()` returns the raw string, so structured values need explicit
`JSON.parse`/`JSON.stringify` and `BigInt` has to be stored as a decimal
string. The contract that triggered all three is deployed at
`ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` and the source is readable
on-chain, so every repro is verifiable without trusting the report. I have
three more SDK/explorer reports going to GitHub as well. Happy to send
minimal repro contracts or walk through any of them live.
