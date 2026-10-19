**SDK v0.1.0 `AsentumClient` posts view calls to `/view`, which does not exist on the documented RPC host**

**Title:** `[testnet] AsentumClient.viewCall() posts to /view but the documented RPC host only serves /rpc/view`

### Environment

| | |
|---|---|
| Package | `@asentum/sdk@0.1.0` |
| Documented RPC host | `https://explorer.asentum.com` |
| Alternate host | `https://testnet.asentum.com` (default used by `@asentum/connect`) |
| Chain | testnet, chain id 1423 |
| Contract used | `ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl` |

### Description

`AsentumClient.viewCall()` does:

```js
return this.post("/view", { contract, method, args });
```

against the `rpcUrl` given to the constructor. The public RPC URL published in
the docs is `https://explorer.asentum.com`, but that host serves the view
endpoint at **`/rpc/view`**. A `POST /view` there returns the Next.js 404
page rather than JSON:

```
<html><head><title>404: This page could not be found</title>...
```

so the SDK throws:

```
POST /view failed: 404
```

The working combinations are:

- `https://testnet.asentum.com` + `/view` (what `@asentum/connect` defaults to), or
- `https://explorer.asentum.com` + `/rpc/view`.

Because the SDK's default and the docs' URL disagree, the most natural line of
code from the docs does not work:

```js
import { AsentumClient } from '@asentum/sdk';
const c = new AsentumClient('https://explorer.asentum.com');
await c.viewCall('ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl', 'getCount', []);
// throws: POST /view failed: 404
```

The same call against `https://testnet.asentum.com` returns:

```json
{"ok":true,"returnValue":"2","events":[],"gasUsed":"21800","blockNumber":"551638","finalized":false}
```

### Reproduction

```js
import { AsentumClient } from '@asentum/sdk';

const explorer = new AsentumClient('https://explorer.asentum.com');
await explorer.viewCall('ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl', 'getCount', []);
// POST /view failed: 404

const testnet = new AsentumClient('https://testnet.asentum.com');
await testnet.viewCall('ase1f7mkunhejpq3aj0y9pdmvra7z739mre8c0q7sl', 'getCount', []);
// {"ok":true,"returnValue":"2",...}
```

### Suggested fix

Resolve the view path from the host inside the SDK — try `/rpc/view` when the
host is the explorer — or make the SDK's default `rpcUrl` match
`@asentum/connect`'s (`https://testnet.asentum.com`) so the two packages agree
out of the box. A clearer error than `404` would also help: the response body
is an HTML page, which is why the failure surfaces as a generic status error.
