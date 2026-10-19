**The explorer does not serve contract source that hashes to the digest it displays, and the normalisation is undocumented**

**Title:** `[testnet] Explorer-served contract source does not match the displayed BLAKE3 hash (trailing newline) — no documented normalisation`

### Environment

| | |
|---|---|
| Host | `https://explorer.asentum.com` |
| Hash | BLAKE3 |
| Contract | `ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` |
| Deployed source size | 2787 bytes |
| Local source size | 2788 bytes |

### Description

The chain's headline property is that a contract is "verifiable by a single
hash compare": you fetch the source, hash it, and compare. There is no
documented way to obtain the digest of a deployed contract, and the source
the explorer renders does not hash to the value the explorer displays, so the
comparison fails by default.

During this work:

- `eth_getCode` returned **2787 bytes** of source.
- The file written to disk was **2788 bytes** — the same content plus a
  trailing newline. The IDE strips the trailing newline on deploy, the local
  file keeps it.
- `b3sum guestbook-v2.js` on the local file therefore produced
  `74d2d2ae8ea0c1258a21194a21254e001b6d6b79dc747604fb0cbaaaabf958d5`
  **only after** the trailing newline was stripped; hashing the file as
  written gives a different digest.

The explorer's contract page displays a hash, but the source it serves
alongside it hashes to something else, and no doc says which normalisation
(strip trailing newline, normalise line endings, BOM handling) the explorer
applies before display.

### Reproduction

```bash
# 1. fetch deployed source
curl -s -X POST https://explorer.asentum.com \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl","latest"],"id":1}'

# 2. hash it (note: the file you saved locally will have a trailing newline)
b3sum guestbook-v2.js

# 3. compare with the hash the explorer displays -> mismatch
```

### Impact

This is the last step of the verification workflow the chain is built around,
and it currently fails without knowing the secret normalisation rule. A
reviewer cannot tell whether the mismatch means the contract was tampered
with or that they hashed a different byte string. That is exactly the
ambiguity a "verifiable by default" design should not have.

### Suggested fix

Two options, either is fine:

1. Document the exact normalisation the explorer applies before display
   (strip trailing newline, normalise CRLF/LF, state whether the digest is
   over UTF-8 bytes of the source with or without the final newline), and
   publish the same rule for `eth_getCode` output.
2. Serve the source from the explorer pre-normalised, so that hashing the
   bytes the explorer hands you produces the digest the explorer displays.

Bonus: exposing the digest through a working endpoint (see the companion
report on `asentum_getContractHash`) would remove the guesswork entirely.
