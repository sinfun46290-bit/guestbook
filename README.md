# Asentum Guestbook

An on-chain guestbook dApp for the [Asentum](https://asentum.com) L1 testnet.

Anyone can post a message. Anyone can like a message. Everything is permanent.

**Live contract:** `ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl`
**Source hash (BLAKE3):** `74d2d2ae8ea0c1258a21194a21254e001b6d6b79dc747604fb0cbaaaabf958d5`

Because Asentum deploys contracts as plain source and hashes it with BLAKE3, you can verify that what you read is exactly what runs:

```bash
b3sum guestbook-v2.js
# 74d2d2ae8ea0c1258a21194a21254e001b6d6b79dc747604fb0cbaaaabf958d5
```

(Strip the trailing newline before hashing, or compare against the explorer's stored hash.)

## How it works

| Layer | What it does |
|---|---|
| `guestbook-v2.js` | The contract. Plain JavaScript, no compiler, immutable at deploy. |
| `index.html` | The frontend. Vanilla JS, no framework, no build step required. |
| `vite.config.js` | Dev server + production build config. |

**Reads are free.** The frontend calls `POST /view` on `https://testnet.asentum.com`
— no wallet, no gas, instant. (The explorer host serves the same endpoint at
`/rpc/view`; see `issues/asentum-connect-1-view-endpoint.md`.)

**Writes cost gas.** Signing and liking go through the Asentum Wallet Chrome extension, which prompts the user to approve each transaction.

## Contract API

| Method | Type | Description |
|---|---|---|
| `init()` | tx | One-time setup. Guarded against replay. |
| `sign(name, message)` | tx | Post an entry. Name + message (max 280 chars). |
| `like(id)` | tx | Like an entry. Blocks self-likes and double-likes. |
| `getEntries()` | view | All entries. |
| `getCount()` | view | Total entry count. |
| `getEntry(id)` | view | A single entry. |
| `getLastEntries(n)` | view | The last N entries. |
| `getTopEntries(n)` | view | Top N entries sorted by likes. |
| `hasLiked(id, address)` | view | Whether an address already liked an entry. |

## Run it locally

```bash
npm install
npm run dev
```

Opens `http://localhost:3000`. Click **Connect Wallet** and approve in the
[Asentum Wallet](https://www.asentum.com/docs/getting-started/wallet-integration) extension.

You need test ASE for gas — get it from the
[airdrop dashboard](https://airdrop.asentum.com) (faucet drip, 5 ASE per
drip; the dashboard enforces a cooldown of roughly 6 hours per wallet).

## Build for production

```bash
npm run build
```

Outputs a static site to `dist/`. Deploy it anywhere: GitHub Pages, Vercel,
Netlify, IPFS, or a plain nginx directory. There is no server component —
the dapp talks directly to the Asentum RPC and the chain is the database.

## Status

| Item | State |
|---|---|
| Contract v2 | Live: `ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl`, `init()` called |
| Frontend | Working — connect, sign, like, recent/top tabs, auto-refresh |
| Production build | `npm run build` → `dist/` (5.9 kB html + 6.1 kB js) |
| Hosting | Not deployed yet — see `DEPLOY.md` |
| Bug reports | 8 written up, not yet submitted — see `issues/` |

## More in this repo

| File | What it is |
|---|---|
| `issues/README.md` | Which of the 8 bug reports goes to which repo/channel, and why |
| `issues/*.md` | Copy-paste-ready GitHub issue bodies and the Telegram post |
| `POSTS.md` | ASocial / X launch copy, and the rules for how to post it |
| `DEPLOY.md` | Netlify Drop, GitHub Pages, Vercel, IPFS — with verification steps |

## Notes on the Asentum runtime

Things that differ from a normal JS environment, learned the hard way:

- Contract methods must live in an **object literal** as the last expression
  of the source file: `({ init() {}, sign() {} })`. Top-level function
  declarations deploy fine but the VM cannot bind them to an object interface.
- `storage.get()` returns the **raw stored string**. Use `JSON.parse` /
  `JSON.stringify` for structured values, and store `BigInt` as a string.
- `msg.block` does not exist. Use `chain.blockNumber`. There is no timestamp
  primitive.
- `assert(condition, message)` reverts the transaction. Throwing also works.
- There is no `Date.now()`, `Math.random()`, `fetch`, or `setTimeout` in the sandbox.

## License

MIT
