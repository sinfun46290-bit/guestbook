# Hunting notes — `asentum-network/social` (Mini-Twitter dApp)

Third public repo in the org with issues enabled. **Only 1 issue ever filed**
(`#2`, by `apienz`, on the upload endpoint's auth). 65 files, zero prior audit.
Same bounty rules as `asentum-explorer#36`.

Live app: https://social.asentum.com  ·  chain: testnet (1423)

## Contract addresses (from README)

```
AsentumProfile    ase1wzpl065lyld6h8kthew7jc3mudgu5wtgfdwawd  -> 0x7083f7ea9f27dbab9ecbbe5de9623be351ca3968
AsentumPosts      ase160qf2uyeaw4exdl9krxe5upah535mxksdcvw7p  -> 0xd3c0957099ebab9337e5b0cd9a703dbd234d9ad0
AsentumFollow     ase1mzcyhrckdx3xz8ede73yklkx2tx4l5alvzvgw3  -> 0xd8b04b8f1669a2611f2dcfa24b7ec652cd5fd3bf
AsentumGallery    ase18phq0ez264q9796zq87zkre9l76w5tl9e4cgse  -> 0x386e07e44ad5405f174201fc2b0f25ffb4ea2fe5
AsentumVotes      (truncated in README)
AsentumComments   0x18e0af7c834387228c6d4d98e1c1613117a688e9
AsentumPremium    0x82f98b9ab41969f24e7e81008425268d9be2ceac   (legacy weekly/monthly)
AsentumPremiumLT  0x9cff2863c6f623339d4908ee69ea96e8b79780b5   (1000 ASE lifetime)
```

## Live feed baseline (measured 2026-10-22)

```
GET https://social.asentum.com/api/feed
stats: {"window":2000,"shown":26,
        "hidden":{"too-short":367,"template":1003,"wallet-address":3,
                  "spam-author":39,"author-not-trusted":551,"author-cap":11}}
```

2,000-post window → **1,517 distinct authors**; of the first 120 sampled,
**58 had no profile at all**. `getProfile` on an unknown address returns
`null` (HTTP 200, `returnValue: null`) — it does **not** revert.

## Leads (not yet confirmed as reportable bugs)

| # | File:line | Lead | Status |
|---|---|---|---|
| 1 | `pages/api/upload.js:62` | Only `dataUri.startsWith('data:image/')` is checked — `data:image/svg+xml;base64,…` passes. SVG can carry script; the stored URL is rendered on-chain and shared via the post permalink. Need to confirm Cloudinary does not rasterise it (`fetch_format:'auto'` may). **Same file as existing #2** — different root cause, but flag the overlap. | needs verification |
| 2 | `components/PostCard.jsx:48-49` | `useState(initialScore)` / `useState(initialVote)` read the prop **only on first mount**. The feed refreshes every 15 s and re-renders with new `scores`/`myVotes`, but the card keeps the mount-time values. Like counts on a post never update while the page stays open. | high confidence, low severity |
| 3 | `components/PostCard.jsx:113-118` | `waitForReceipt` throws "Still confirming… this usually goes through" after 180 s. The catch block **rolls back the optimistic like**, so a transaction that actually landed shows as failed and the heart un-fills. | high confidence, UX |
| 4 | `lib/forYouFeed.js:140-143` | `engagementFor` issues **one `getCommentCount` view call per surviving post** (~588 per refresh) at concurrency 6, every 60 s. There is no batch getter used. | inefficiency, not a bug |
| 5 | `components/FeedPage.jsx:130-138` | The "my votes" check fires **one `getVote` view call per post** (26–30) every 15 s per open tab. `getScores` is batched but `getVote` is not. | inefficiency, not a bug |
| 6 | `lib/feedRank.js:180-187` | `duplicateInfo` is O(n²) over distinct keys — with ~1,500 distinct keys in a 2,000-post window that is ~1.1M Jaccard comparisons **on every feed compute** (server TTL 15 s). | perf |
| 7 | `lib/feedRank.js:180-187` | `similar` is a symmetric adjacency built from pairwise similarity but **not transitively closed**: A~B and B~C while A≁C gives A's group without C and C's group without A. Template counts are therefore asymmetric between copies of the same template. | correctness, subtle |
| 8 | `lib/forYouFeed.js:90-107` | `readAuthor` returns `ok: profile !== undefined`, so a **contract revert and an RPC failure are conflated**. Verified *not* exploitable for `getProfile` (returns `null`, not a revert) — but `getProfile` for an address that exists but is malformed may revert. | disproved for the common path |

## Confirmed NOT bugs (checked and dismissed)

* `lib/tx.js:14` — `fetch(RPC_URL + '/')` → `POST https://testnet.asentum.com/` returns **200** with a valid JSON-RPC body. The trailing slash is harmless.
* `lib/indexer.js:9` — `HTTP_BASE` defaults to `http://localhost:3001`, but the production bundle inlines `https://social.asentum.com/indexer`. Config is correct in prod.
* `lib/format.js` bech32 encode/decode — charset, checksum, and the `>1e11` ms-vs-seconds heuristic all check out.

## Best next move

Read `components/Composer.jsx` (372 lines, post creation) and
`components/CommentThread.jsx` (272 lines, threaded comments — parent-pointer
tree walking is a classic source of orphaned/looped threads) plus
`pages/post/[id].js`. Then reproduce against the live app rather than reading
only — the AsePad "Est. receive" bug was found by reading the deployed bundle,
and the deployed bundle is the ground truth.
