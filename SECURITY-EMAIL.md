# Email to security@asentum.com

**To:** security@asentum.com
**Cc:** hello@asentum.com
**Subject:** `Storage layer silently stringifies values — BigInt arithmetic concatenates (silent value corruption) + 5 public SDK/explorer issues`

---

Reporting privately per the Security Best Practices page, before anything
public. I have a support ticket open at support.asentum.com with the full
probe output — this email is so the storage item gets treated as a
correctness/security issue rather than a documentation nit.

## The one that concerns me

`storage` coerces every value to a string on write, and `storage.get()`
returns a string. The docs say the opposite:

> Keys are strings, values are anything JSON-serializable (including `BigInt`
> and nested objects).

Measured round-trip on the live testnet:

| Written | `storage.get()` returns |
|---|---|
| `42` | `"42"` |
| `true` | `"true"` |
| `[1, 2, 3]` | `"1,2,3"` (not JSON) |
| `{ a: 1, b: 'two' }` | `"[object Object]"` (value destroyed) |
| `7n` | `"7"` |

And then, with no revert, no exception and no event:

```javascript
storage.set('p_big', 7n);
storage.get('p_big')       // "7"
storage.get('p_big') + 1n  // "71"   <-- string concatenation, not 8n
```

A stored balance of `"100"` incremented by `1n` becomes `"1001"`. A counter at
`"9"` becomes `"91"`. The contract computes a wrong number and continues as
if nothing happened.

I don't think this is exploitable by a third party on its own — it is a
correctness bug, not an access-control one. But it is silent, it hits the
single most important thing a contract does (track an amount), and the docs
actively tell developers to use BigInt for exactly the values that break.
`asentum.com/developers` ships a working example that stores an object and
then reads `sub.nextCharge` off it — that write produces `"[object Object]"`,
so the subscription data is lost on write, not just unreadable.

The on-chain governance contract works around this correctly
(`JSON.parse`/`JSON.stringify` on every write, BigInt stored as a decimal
string), which is what makes me think the intended contract is JSON-serialised
values and the `storage` layer is not doing it.

## Probe

Deployed at `ase18s2ka546638c7s0rhkhan5wy3q7x77a632f3ek`. Source is readable
on-chain via `eth_getCode`, so this is independently verifiable. Every finding
is a free `view` call:

```bash
curl -s -X POST https://testnet.asentum.com/view \
  -H 'Content-Type: application/json' \
  -d '{"contract":"ase18s2ka546638c7s0rhkhan5wy3q7x77a632f3ek","method":"probeStorageRoundTrip","args":[]}'
```

The support ticket has the full output for the other seven probes, covering
`chain`, `msg`, `storage.entries`/`storage.keys`, `this`, the injected-globals
list, `assert` vs `throw`, and iteration over stored values.

## Public issues, offered for pulling

These are documentation/UX defects in the SDK and the explorer, not
vulnerabilities — no exploit path, no funds at risk. They are public because
the airdrop's Feedback & Bugs pillar pays for reproducible reports filed as
GitHub issues, and because the SDK is a public package. If you would rather
they were private, say the word and I will close them:

- `asentum-network/asentum-connect` #3 — `AsentumClient.viewCall()` posts to `/view`; the documented RPC host serves `/rpc/view`
- `asentum-network/asentum-connect` #4 — `requestFaucet()` always 403s on the public testnet
- `asentum-network/asentum-connect` #5 — docs document `Chain`/`Wallet`/`Contract` imports the package does not export
- `asentum-network/asentum-explorer` #46 — `asentum_getContractHash` is documented but returns "method not found"
- `asentum-network/asentum-explorer` #47 — explorer-served source does not hash to the displayed digest, and no normalisation is documented

## One more thing

`asentum.com/developers` has a "native cron" example
(`cron.schedule(this.address, 'chargeAll', '@daily')`), a `storage.entries()`
call, a `this.address`, and `chain.timestamp`. None of those exist at runtime:
`cron` is not among the injected globals (`E, assert, chain, emit, msg,
storage, transfer`), `storage.entries` is not a function, `this` is undefined,
and `chain.timestamp` is undefined — the real one is `chain.blockTimestamp`,
in milliseconds.

That page is the first thing a new builder reads, and every snippet on it
that touches those APIs throws. Flagging it separately from the storage issue
because it is a docs fix rather than a runtime fix, and I would rather you
triage it at a different priority than the string-coercion one.

Happy to send the probe source as a file, or to walk through any of it live.

— sinfun46290-bit
