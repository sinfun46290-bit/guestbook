# Support ticket — runtime API ground truth (correction + probe results)

**Portal:** https://support.asentum.com → "Open a ticket" (sign in required)
**Reply to:** in the ticket thread, and via email if you opt in

---

## Title

`Runtime API ground truth — probe results for 6 disputed/undocumented APIs (correction to my #devlog post)`

---

## Body (copy from here)

Follow-up to my earlier `#devlog` post. I deployed a probe contract to establish
ground truth for the APIs that post and the docs disagree on. Two corrections
and one upgraded severity, plus four new findings.

**Correction 1 — I was wrong about timestamps.** My earlier post said there
"appears to be no timestamp primitive at all." There is one: `chain.blockTimestamp`.
It returns a BigInt in **milliseconds** (`1792442587086n`), not the seconds the
`msg.block.timestamp` docs imply. `chain.timestamp` — the property the
developers page uses in its own code sample — does not exist.

**Correction 2 — the storage finding is worse than I described it.** I said
`storage.get()` returns the raw stored string. Correct, but the consequence is
silent corruption, not a type annoyance. Details below.

**The `msg.block` finding from the original post stands.** `msg.block` is
`undefined`; `msg.block.number` and `msg.block.timestamp` both throw
`Cannot read properties of undefined`.

---

### Probe contract

Deployed at `ase18s2ka546638c7s0rhkhan5wy3q7x77a632f3ek`.
Source is readable on-chain via `eth_getCode` — the probe is independently
verifiable without trusting this ticket. It has 8 view methods, each returning
a per-call `{ api: "OK type=... value=..." | "ERR <message>" }` map so a
failure in one probe does not abort the others.

```bash
curl -s -X POST https://testnet.asentum.com/view \
  -H 'Content-Type: application/json' \
  -d '{"contract":"ase18s2ka546638c7s0rhkhan5wy3q7x77a632f3ek","method":"probeStorageRoundTrip","args":[]}'
```

---

### Finding A — `storage` coerces every value to a string on write (severity: high)

The storage API docs say:

> Keys are strings, values are anything JSON-serializable (including `BigInt`
> and nested objects).

Measured round-trip through `storage.set` → `storage.get`:

| Written | `storage.get()` returns | `typeof` |
|---|---|---|
| `42` | `"42"` | `string` |
| `true` | `"true"` | `string` |
| `[1, 2, 3]` | `"1,2,3"` | `string` |
| `{ a: 1, b: 'two' }` | `"[object Object]"` | `string` |
| `7n` | `"7"` | `string` |

Three consequences:

**1. Objects are destroyed on write.** `{ a: 1, b: 'two' }` becomes the literal
string `"[object Object]"`. The value is not merely unreadable — it is gone.
`storage.get('p_obj').b` returns `undefined`.

**2. Arrays are not JSON.** `[1, 2, 3]` becomes `"1,2,3"` — `Array.prototype.toString`,
not `JSON.stringify`. So the `JSON.parse(storage.get(k))` pattern that works
around this (and which the on-chain governance contract uses) will **throw** on
a value written as a raw array.

**3. BigInt arithmetic silently concatenates.**

```javascript
storage.set('p_big', 7n);
storage.get('p_big')       // "7"   (string)
storage.get('p_big') + 1n  // "71"  (string concat — NOT 8n)
```

This is the dangerous one. It does not revert, does not throw, does not emit an
event. A balance of `"100"` incremented by `1n` becomes `"1001"`. A counter at
`"9"` becomes `"91"`. A contract that reads a stored amount and adds to it
computes a wrong number and carries on. Any contract following the docs' "use
BigInt for every token balance, amount, nonce" advice is exposed to this,
because the round-trip through storage silently un-types the value.

**Affects the developers page example directly.** `asentum.com/developers`
shows:

```javascript
storage.set('sub:' + msg.sender, {
  amount:     amountPerWeek,
  nextCharge: chain.timestamp + 7 * 86400,
});
```

Both halves of that line are wrong against the runtime: the object is written as
`"[object Object]"` (data lost), and `chain.timestamp` is `undefined` (throws).
`storage.entries('sub:')` in the same example is also not a function.

**Suggested fix.** Either (a) make storage type-preserving — serialise on write
with a type tag and deserialise on read, so `BigInt` survives and objects round
trip, or (b) keep the string behaviour but change the docs to state it
explicitly and prominently, including that `+` on a stored BigInt concatenates.

Either way the current wording — "values are anything JSON-serializable
(including BigInt and nested objects)" — needs to change. It is the opposite of
what the runtime does, and it is the kind of thing that costs a token balance.

---

### Finding B — `storage.entries()` does not exist; `storage.keys()` does (undocumented)

`asentum.com/developers` uses `storage.entries('sub:')` to iterate a prefix.

```
storage.entries        → undefined
storage.entries('p_')  → ERR "storage.entries is not a function"
storage.entries()      → ERR "storage.entries is not a function"
```

But `storage.keys()` works and returns a `string[]` of every key in the
contract:

```
storage.keys() → ["p_arr","p_big","p_bool","p_num","p_obj","p_str"]
```

`storage.keys()` appears in **no** documentation I could find — not the Writing
Contracts guide, not the Hardened JavaScript guide, not the developers page.
It is the only way to iterate storage that I could get to work, so please
document it.

---

### Finding C — `this` is undefined inside contract methods

```
typeof this        → "undefined"
this.address       → ERR "Cannot read properties of undefined (reading 'address')"
Object.keys(this)  → ERR "Cannot convert undefined or null to object"
```

The developers page uses `this.address` in the cron example. There is no `this`
binding. If contracts are meant to expose their own address, that needs to be
documented and implemented; if not, the example should be corrected.

---

### Finding D — `cron` is not an injected global

The developers page shows `cron.schedule(this.address, 'chargeAll', '@daily')`
as the "native cron" primitive, and the IDE has a Cron tab. But the complete
set of injected globals is:

```
Object.keys(globalThis) → ["E","assert","chain","emit","msg","storage","transfer"]
```

`cron` is not in it, and `typeof cron` is `undefined`. The Hardened JavaScript
guide lists the injected globals as "storage, emit, msg, E, transfer" — which
omits `chain` and `assert`, both of which do exist.

So the globals list is wrong in two directions: `chain` and `assert` are
missing from the docs, and `cron` is documented but absent. If cron is
scheduled through a different mechanism (a CLI call, a Vault worker, an IDE
action), please document that route — right now the only documented way to
schedule a call is a snippet that throws.

---

### Finding E — `chain.blockTimestamp` is milliseconds, and `chain.timestamp` is undefined

```
chain.blockNumber     → bigint 553046n
chain.blockTimestamp  → bigint 1792442587086n   // milliseconds
chain.chainId         → bigint 1423n
chain.timestamp       → undefined
chain.block           → undefined
```

`1792442587086` is a millisecond epoch. The `msg.block.timestamp` docs describe
"current block time (unix seconds)", and the developers page does
`chain.timestamp + 7 * 86400` — which assumes seconds. If `chain.blockTimestamp`
is the intended replacement, the unit needs to be stated, because
`chain.blockTimestamp + 7 * 86400` is roughly seven seconds, not seven days.

---

### Finding F — `assert` works; `throw` also works

Both revert with the message, confirmed:

```
assert(1 === 1, 'never')      → no revert
assert(1 === 2, 'assert fired') → ERR "assert fired"
throw new Error('throw fired') → ERR "throw fired"
```

Minor note: `assert('truthy', 'msg')` does not fire — the condition is not
coerced to a boolean. Worth documenting as a gotcha so nobody relies on a
truthy non-boolean passing.

---

### Summary of what is documented where

| API | Writing Contracts | Hardened JS | Developers page | Runtime |
|---|---|---|---|---|
| `msg.block.number` | documented | documented | — | **undefined** |
| `msg.block.timestamp` | documented | documented | — | **undefined** |
| `chain.blockNumber` | — | — | documented | ✅ |
| `chain.blockTimestamp` | — | — | documented | ✅ (ms) |
| `chain.timestamp` | — | — | used in sample | **undefined** |
| `chain.chainId` | — | — | documented | ✅ |
| `cron` | — | — | documented | **not a global** |
| `this.address` | — | — | used in sample | **undefined** |
| `storage.entries()` | — | — | used in sample | **not a function** |
| `storage.keys()` | — | — | — | ✅ (undocumented) |
| `assert` | — | — | documented | ✅ |
| object round-trip | "nested objects" | — | shown in sample | **"[object Object]"** |
| BigInt round-trip | "including BigInt" | "use BigInt for balances" | — | **string; `+` concatenates** |
| contract shape | top-level functions | — | — | **object literal required** |

Four pages, four different pictures of the same API. The contract-shape issue
from my original post still stands and is the one that blocks a first-time
developer hardest: neither documented format runs.

---

### Also filed on GitHub (SDK + explorer, not the VM)

- `asentum-network/asentum-connect` #3, #4, #5
- `asentum-network/asentum-explorer` #46, #47

Per the Security Best Practices page I have emailed `security@asentum.com` as
well, and I am happy to pull any of the public issues if you would rather they
were private.

---

### Reproduction

Everything above is a `view` call against the probe contract, no gas, no wallet:

```bash
curl -s -X POST https://testnet.asentum.com/view \
  -H 'Content-Type: application/json' \
  -d '{"contract":"ase18s2ka546638c7s0rhkhan5wy3q7x77a632f3ek","method":"probeStorageRoundTrip","args":[]}'
```

`probeChain`, `probeMsg`, `probeStorageEntries`, `probeThis`, `probeGlobals`,
`probeAssertVsThrow` and `probeIteration` are all views on the same contract.

Happy to send the probe source as a file, or to walk through any of it live.

---

## Suggested fixes, in priority order

1. **`storage` type preservation.** Either make the round-trip type-safe, or
   state the string behaviour prominently in the docs — and say that `+` on a
   stored BigInt concatenates. The current wording is actively dangerous for
   balances.
2. **Fix `asentum.com/developers`.** The cron, `this.address`,
   `storage.entries()` and `chain.timestamp` snippets all throw as written.
   That page is the first thing a new builder reads.
3. **Document `storage.keys()`.** It works and it is the only iteration
   primitive I could find.
4. **One canonical contract format.** The object-literal form works. Neither
   guide shows it. The IDE parser only recognises that shape, which is how I
   found it.
5. **Fix the globals list.** `chain` and `assert` are missing from the
   Hardened JavaScript guide; `cron` is documented but absent.
6. **State the timestamp unit.** `chain.blockTimestamp` is milliseconds.

---

## Before you send — optional extras

If you also want to apply for the **Airdrop Ecosystem Program** in the same
ticket (it says "Open a ticket in the support panel"), add:

1. Project name and domain
2. Telegram username (required)
3. Short description
4. Contract addresses (`ase1...`)
5. Actions you want turned into tasks
6. X account

⚠️ The program requires **your own domain on a TLD/ccTLD** — it explicitly
does not accept `*.github.io` or `*.vercel.app`. My guestbook dApp is currently
on GitHub Pages, so I need a real domain before I can apply. I will reply in
this ticket once I have one.
