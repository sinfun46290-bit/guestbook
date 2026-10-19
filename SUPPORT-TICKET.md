# Support ticket — runtime API ground truth

**URL:** https://support.asentum.com/new  (sign in first — Google / Apple / Asentum wallet)
**Character limit:** 6,000 on the "What" field.

**Field mapping**
| Field | Value |
|---|---|
| **What** | body below |
| **Product** | closest match (Node / Wallet / Other) |
| **Ethereum wallet** | `0x702d…7203` (the one linked on the airdrop dashboard) |
| **Asentum address** | `ase1v2zm5cnw0hkl5mcudlc9cxyaqhhqm0w4d8z774` |

---

## Body (copy from here

Follow-up to my earlier `#devlog` post. I deployed a probe contract to establish ground truth for the APIs the docs disagree on. Two corrections, one upgraded severity, four new findings.

**Correction 1 - I was wrong about timestamps.** I said there "appears to be no timestamp primitive at all." There is: `chain.blockTimestamp`, a BigInt in **milliseconds** (`1792442587086n`), not the seconds `msg.block.timestamp` implies. `chain.timestamp` - used in the developers page's own code sample - does not exist.

**Correction 2 - the storage finding is worse than I described.** `storage.get()` does return a raw string, but the consequence is silent value corruption, not a type annoyance. The `msg.block` finding stands: `msg.block` is `undefined`, and `msg.block.number` / `msg.block.timestamp` both throw.

### A. `storage` stringifies every value on write - BigInt arithmetic silently concatenates

Docs say: *"Keys are strings, values are anything JSON-serializable (including `BigInt` and nested objects)."* Measured round-trip:

| Written | `storage.get()` returns |
|---|---|
| `42` | `"42"` |
| `true` | `"true"` |
| `[1,2,3]` | `"1,2,3"` (not JSON) |
| `{a:1,b:'two'}` | `"[object Object]"` (value destroyed) |
| `7n` | `"7"` |

Objects are destroyed on write, not just unreadable - `storage.get('p_obj').b` is `undefined`. Arrays are `Array.toString`, so the `JSON.parse(storage.get(k))` pattern throws on a raw array.

The dangerous part:

```javascript
storage.set('p_big', 7n);
storage.get('p_big')       // "7"
storage.get('p_big') + 1n  // "71"  (string concat, NOT 8n)
```

No revert, no throw, no event. A stored balance of `"100"` incremented by `1n` becomes `"1001"`. A counter at `"9"` becomes `"91"`. The contract computes a wrong number and carries on. The docs tell developers to use BigInt for exactly these values, and the round-trip silently un-types them.

This also breaks the developers page example - `storage.set('sub:'+msg.sender, { amount, nextCharge: chain.timestamp + 7*86400 })` writes the object as `"[object Object]"` (data lost) and throws on `chain.timestamp`; `storage.entries('sub:')` in the same example is also not a function.

**Fix:** either make storage type-preserving (serialise with a type tag, deserialise on read) or state the string behaviour prominently - including that `+` on a stored BigInt concatenates. The current wording is the opposite of runtime behaviour and is dangerous for balances.

### B. `storage.entries()` doesn't exist; `storage.keys()` does (undocumented)

```
storage.entries        -> undefined
storage.entries('p_')  -> ERR "storage.entries is not a function"
storage.keys()         -> ["p_arr","p_big","p_bool","p_num","p_obj","p_str"]
```

`storage.keys()` works and is the only iteration primitive I could get to work, but it appears in **no** documentation I could find. Please document it.

### C. `this` is undefined inside contract methods

```
typeof this       -> "undefined"
this.address      -> ERR "Cannot read properties of undefined (reading 'address')"
```

The developers page uses `this.address` in its cron example. There is no `this` binding.

### D. `cron` is not an injected global

Developers page: `cron.schedule(this.address, 'chargeAll', '@daily')`. But the complete injected-globals list is:

```
Object.keys(globalThis) -> ["E","assert","chain","emit","msg","storage","transfer"]
```

`cron` is not in it, and `typeof cron` is `undefined`. The Hardened JavaScript guide lists the globals as "storage, emit, msg, E, transfer" - omitting `chain` and `assert`, both of which exist. If cron is scheduled some other way (CLI, Vault worker, IDE action), please document that route - the only documented way to schedule a call is a snippet that throws.

### E. `chain.blockTimestamp` is milliseconds

```
chain.blockNumber    -> bigint 553046n
chain.blockTimestamp -> bigint 1792442587086n   // milliseconds
chain.chainId        -> bigint 1423n
chain.timestamp      -> undefined
```

If `chain.blockTimestamp` is the intended replacement for `msg.block.timestamp`, the unit needs stating: `chain.blockTimestamp + 7*86400` is ~7 seconds, not 7 days. `assert` and `throw` both work and revert with their message; minor gotcha - `assert('truthy','msg')` does **not** fire, the condition isn't coerced to boolean.

### Docs vs runtime

Absent at runtime despite being documented: `msg.block.number`, `msg.block.timestamp`, `chain.timestamp`, `cron`, `this.address`, `storage.entries()`. Present but undocumented: `chain` (blockNumber/blockTimestamp/chainId), `assert`, `storage.keys()`. Documented but different: objects -> `"[object Object]"`, BigInt -> string with `+` concatenating, contract shape -> object literal required.

The contract-shape issue from my original post still stands and blocks first-time developers hardest - neither documented format runs.

### Probe contract

`ase18s2ka546638c7s0rhkhan5wy3q7x77a632f3ek` - source readable on-chain via `eth_getCode`, so this is independently verifiable without trusting the ticket. 8 free view methods, each returning a per-call `OK type=... value=...` / `ERR ...` map so one failure doesn't abort the rest: `probeChain`, `probeMsg`, `probeStorageRoundTrip`, `probeStorageEntries`, `probeThis`, `probeGlobals`, `probeAssertVsThrow`, `probeIteration`.

### Also filed on GitHub (SDK + explorer, not the VM)

`asentum-connect` #3, #4, #5 and `asentum-explorer` #46, #47. I have emailed `security@asentum.com` as well and can pull the public issues if you prefer them private.

### Fix priority

1. **`storage` type preservation** - or state the string behaviour and the `+` concatenation hazard.
2. **Fix `asentum.com/developers`** - cron, `this.address`, `storage.entries()`, `chain.timestamp` all throw as written. That page is the first thing a new builder reads.
3. **Document `storage.keys()`; one canonical contract format; fix the globals list; state the timestamp unit.**

Happy to send the probe source, or walk through any of it live.

## Fallback: email

If sign-in is a hassle, the FAQ sanctions this directly:

> "Still stuck? Email **hello@asentum.com** or file an issue on GitHub. We'd rather help you now than have you work around it."

Subject: `Runtime API ground truth — probe results for 6 disputed/undocumented APIs`
Body: same as above. `SECURITY-EMAIL.md` in this repo is a shorter, security-framed version for `security@asentum.com` (cc `hello@asentum.com`).
