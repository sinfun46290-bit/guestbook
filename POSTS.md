# Launch posts

Every post earns XP **and** recruits referees, and referees are worth 5% of
their XP forever. A post that produces sign-ups pays twice — once for the
post, once for every XP those users earn.

Post on ASocial (social.asentum.com) for **+20 XP** per post (cap 100/day)
and on X with **#asentum** for **+15 XP** per post (cap 45/day). Post the
dApp link *after* it is deployed (see `DEPLOY.md`) — a link that 404s burns
the XP and the impression.

---

## ASocial — dApp launch

```
Built a guestbook dApp on @asentum — the first post-quantum L1 where contracts
are plain JavaScript and every signature is quantum-safe from genesis.

Live contract: ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl
Contract source is on-chain and verifiable with a single BLAKE3 hash compare.
No backend: the chain is the database. Reads are free, writes cost gas.

Tech worth stealing: the VM binds methods from an object literal
`({ init(){}, sign(){} })` — not from a class, not from top-level functions.
And `storage.get()` hands you back the raw string, so you JSON.parse
everything. I lost three deploys learning that.

Try it, sign the book, tell me what breaks:
<URL>

#asentum
```

## X — dApp launch

```
Built a guestbook dApp on Asentum, the post-quantum L1.

Contract: ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl
UI: <URL>

Contracts are plain JS. No compiler, no backend, and the source is
verifiable with one hash compare.

Three runtime gotchas I hit (docs don't mention them):
- methods must be in an object literal `({...})`, not a class
- `msg.block` doesn't exist, it's `chain.blockNumber`
- `storage.get()` returns a raw string, JSON.parse it

#asentum
```

## X — follow-up post (24h later)

```
Update on the Asentum guestbook: <N> entries, <M> likes, and 3 contract-runtime
bugs reported to the team (msg.block undefined, object-literal-only contract
format, storage.get returning raw strings).

All reproducible against a live contract:
ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl

If you're building on Asentum, check those three first.

#asentum
```

## Bug-report post (Telegram `#devlog` topic)

Use `issues/runtime-telegram-post.md` — it is the full post body. Post it
once the GitHub issues are open so you can link them:

```
GitHub versions of the SDK/explorer reports:
- https://github.com/asentum-network/asentum-connect/issues/…
- https://github.com/asentum-network/asentum-explorer/issues/…
```

---

## Rules of thumb

- One post per platform per topic. The caps are per-post-value, not per
  account, so five identical posts earn five times the XP — but the same
  content five times looks like spam and the team's social boost tracks
  sustained, varied sharing.
- Lead with the contract address and the technical gotchas. That is the part
  other developers actually want; the screenshots come second.
- Never claim the token has value. The payout is a share of a 60M ASE testnet
  pool, not a listing. "My dApp on Asentum" is honest and still earns XP.
