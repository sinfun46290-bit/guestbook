**`asentum_getContractHash` is documented in the Verifying Contracts guide but is not implemented on the node**

**Title:** `[testnet] asentum_getContractHash is documented in the Verifying Contracts guide but returns "method not found"`

### Environment

| | |
|---|---|
| Host | `https://explorer.asentum.com` |
| Method | `asentum_getContractHash` |
| Chain | testnet, chain id 1423 |
| Contract used | `ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` |

### Description

`/docs/guides/verifying-contracts` documents a JSON-RPC method for retrieving
the hash of a deployed contract, and states that it is the intended way to
verify a contract against its source:

```bash
curl -s https://explorer.asentum.com \
  -d '{"jsonrpc":"2.0","method":"asentum_getContractHash","params":["ase1…abc"]}'
```

> The hash is recorded in the contract's state at deploy time, retrievable at
> any time via `asentum_getContractHash`, and displayed on the contract page
> in the explorer.

The method does not exist on the node:

```json
{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found: asentum_getContractHash"}}
```

This also directly contradicts `/docs/reference/json-rpc`, which says:

> There are no `asentum_*` JSON-RPC methods.

Both pages are live at the same time, and they disagree about whether the
method exists.

### Reproduction

```bash
curl -s https://explorer.asentum.com \
  -d '{"jsonrpc":"2.0","method":"asentum_getContractHash","params":["ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl"]}'
# {"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found: asentum_getContractHash"}}
```

### Impact

"Verifiable by a single hash compare" is a headline property of the chain, and
this is the documented way to perform the comparison. Right now a developer
has to fetch the source with `eth_getCode`, hash it locally with BLAKE3, and
guess the normalisation the explorer applied (see the companion report on
source/hash mismatch) before the comparison can succeed.

### Suggested fix

Either implement `asentum_getContractHash` and return the BLAKE3 digest
recorded at deploy time, or rewrite the Verifying Contracts guide to use an
endpoint that exists and remove the `asentum_*` mention from the JSON-RPC
reference so the two pages stop contradicting each other.
