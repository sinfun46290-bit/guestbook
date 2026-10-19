# Telegram post — chain runtime bugs (reports 1, 2, 3)

**Post to:** [t.me/asentum](https://t.me/asentum) — the docs call this the `#devlog` channel.
**Also DM:** [@jst_Smiles](https://x.com/jst_Smiles) — Ecosystem Developer, whose role is the developer feedback loop.
**Topic (if the channel has them):** `bug report — contract runtime vs. Writing Contracts guide`
**Tags:** `#devlog`

**Post all three in ONE message.** They share a root cause — the Writing Contracts
guide documents a contract API the runtime does not implement — and the review
clock is 24 hours. One coherent report gets triaged; three fragments may not.

---

## Post body (copy everything from here down)

Three reproducible contract-runtime issues, found while shipping a guestbook
dApp on the public testnet. All three are cases where the Writing Contracts
guide documents an API the runtime does not implement — which means every new
developer hits them on their first contract.

The contract that triggered all three is deployed at
`ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl`. Its source is readable on-chain
via `eth_getCode`, so every reproduction below is verifiable without trusting
this message.

Happy to send a minimal repro contract for each, or walk through any of them live.

---

**1. `msg.block` is undefined — `msg.block.number` reverts**

The guide states `msg.block.number` is the current block height and
`msg.block.timestamp` is the block time. In the live runtime `msg.block` is
`undefined` and any contract that reads it reverts:

```
contract call failed: contract method 'sign' failed:
Cannot read properties of undefined (reading 'number')
```

The runtime actually exposes `chain.blockNumber` — the on-chain governance
contract uses that and never `msg.block`, which suggests the `msg.block` form
was never implemented. There also appears to be no timestamp primitive at all.

Repro:

```javascript
({
  sign(name, message) {
    storage.set('block', String(msg.block.number));   // reverts
  }
})
```

---

**2. Neither documented contract format runs — only an object literal works**

Two pages document two incompatible formats, and neither is the one the VM accepts:

- Writing Contracts guide → top-level `function init() { ... }`
- Tokenize guide → `export default class Counter { ... }`

`export default class` fails to deploy outright:

```
deploy failed on chain (tx 0x1f60...). Nothing was deployed.
```

The top-level function form deploys fine but the VM cannot bind it —
`POST /view` returns:

```json
{"ok":false,"reason":"contract did not export an object interface"}
```

and the IDE Interact panel shows `0 methods` / "No callable methods detected".

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

Worth fixing alongside the docs: the IDE's contract parser doesn't recognise
that shape either, so the Interact panel stays empty until you do. That's how
I found the format — by making the IDE work.

---

**3. `storage.get()` returns the raw string, not the parsed value**

The storage API docs say values are "anything JSON-serializable (including
BigInt and nested objects)", which reads as "the storage layer handles JSON
for you". It does not. On read you get the raw stored string, so a stored
array comes back as a string and `.push` is not a function:

```
contract call failed: contract method 'sign' failed: entries.push is not a function
```

`BigInt` has the same problem — `JSON.stringify` cannot serialise it.

Repro:

```javascript
({
  init() { storage.set('items', []); },
  add(x) { const items = storage.get('items'); items.push(x); },  // reverts
})
```

The governance contract works around this with `JSON.parse(storage.get(k))` /
`JSON.stringify(...)` on every write, and by storing `BigInt` as a decimal
string. That is workable — but it is not what the docs describe, and it is
exactly what a new developer gets wrong on their first contract.

---

**Suggested fixes**

1. Implement `msg.block`, or correct the guide to `chain.blockNumber` and state that no timestamp is exposed.
2. Update both guides to show the object-literal format, and make the IDE parser accept it.
3. Either auto-deserialise on `get` (storing `BigInt` as a decimal string), or document the `JSON.parse`/`JSON.stringify` convention explicitly.

**Also filed on GitHub** — three more reports against the SDK and the explorer:

- `asentum-network/asentum-connect` #3, #4, #5
- `asentum-network/asentum-explorer` #46, #47

The guestbook dApp that surfaced all of this is live at
`https://sinfun46290-bit.github.io/guestbook/`
(source: `github.com/sinfun46290-bit/guestbook`).

---

## If Telegram truncates

Telegram splits long messages. If the post gets cut, send it in two parts —
everything above the `---` after the intro paragraph as part 1, the rest as
part 2 — or fall back to the DM version below, then post a one-liner in the
channel pointing at the DM.

---

## DM to @jst_Smiles (shorter version)

Hi Smiles — submitting three reproducible contract-runtime bugs; full details
in the Telegram post.

Short version: the Writing Contracts guide documents `msg.block.number`, but
`msg.block` is undefined at runtime (it's `chain.blockNumber`, and there seems
to be no timestamp primitive). Neither documented contract format actually
runs — `export default class` fails to deploy outright, the top-level function
form deploys but the VM can't bind it, and only an object literal `({ ... })`
as the last expression works. The IDE parser doesn't recognise that shape
either, so the Interact panel stays empty. And `storage.get()` returns the raw
string, so structured values need explicit `JSON.parse`/`JSON.stringify` and
`BigInt` has to be stored as a decimal string.

The contract that triggered all three is deployed at
`ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` and its source is readable
on-chain, so every repro is verifiable without trusting the report.

Three more reports (SDK + explorer) are going to GitHub as well. Happy to send
minimal repro contracts or walk through any of them live.
