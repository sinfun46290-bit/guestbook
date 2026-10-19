# Bug report submission plan

Eight reproducible bugs were found while building the Guestbook dApp against the
public testnet. Each one is severity-priced between +500 XP and +25,000 XP by the
airdrop's "Feedback & Bugs" pillar, and paid when the patch ships.

## Where each one goes

| # | Report | Channel | Why there |
|---|--------|---------|-----------|
| 4 | SDK `AsentumClient` hits `/view`, not `/rpc/view` | **GitHub** → `asentum-network/asentum-connect` | Bug is in the SDK package |
| 5 | `AsentumWallet.requestFaucet()` always 403s | **GitHub** → `asentum-network/asentum-connect` | Bug is in the SDK package |
| 6 | Docs reference two incompatible SDK APIs | **GitHub** → `asentum-network/asentum-connect` | SDK export surface |
| 7 | `asentum_getContractHash` documented, not implemented | **GitHub** → `asentum-network/asentum-explorer` | Explorer serves the JSON-RPC surface |
| 8 | Explorer source does not match the displayed hash | **GitHub** → `asentum-network/asentum-explorer` | Explorer rendering/normalisation |
| 1 | `msg.block.number` documented but undefined | **Telegram** + X DM | Chain runtime — no public core repo |
| 2 | Both documented contract formats fail to run | **Telegram** + X DM | Chain runtime + IDE parser |
| 3 | `storage.get()` returns the raw string | **Telegram** + X DM | Chain runtime semantics |

`asentum-network` public repos with issues enabled: `asentum-connect`,
`asentum-explorer`, `social`. The chain core repo is not public, so runtime
bugs (1–3) go to Telegram — the docs themselves point at
[t.me/asentum](https://t.me/asentum) as the `#devlog` channel, and
[@jst_Smiles](https://x.com/jst_Smiles) is the ecosystem developer whose role
is the developer feedback loop.

## Files

| File | Use it as |
|------|-----------|
| `asentum-connect-1-view-endpoint.md` | Issue body — `asentum-connect` |
| `asentum-connect-2-faucet-403.md` | Issue body — `asentum-connect` |
| `asentum-connect-3-sdk-api-mismatch.md` | Issue body — `asentum-connect` |
| `asentum-explorer-1-contract-hash-rpc.md` | Issue body — `asentum-explorer` |
| `asentum-explorer-2-source-hash-mismatch.md` | Issue body — `asentum-explorer` |
| `runtime-telegram-post.md` | Telegram message (reports 1–3 in one post) |

## Before you post

Each body opens with a bold one-line summary. Paste the **title** from the
first line of each file into the issue title field, and the rest into the body
field. The reproductions are independently verifiable on-chain: the contract
that triggered 1–3 is deployed at
`ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` and its source is readable via
`eth_getCode`, so a reviewer does not have to trust the report.
