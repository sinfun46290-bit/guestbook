# [AsePad] Create Token form: "Est. receive" always shows `0` — dead guard `0n>0n`, and the live branch is a BigInt division by zero

**Repo:** `asentum-network/asentum-explorer`
**Component:** AsePad web app — Create Token page
**URL:** https://asepad.fun/asepad/create
**Bundle:** `https://asepad.fun/_next/static/chunks/app/asepad/create/page-637c6c595d07d3f4.js`
**Chain:** testnet (chain 1423)
**Severity:** Medium — user-facing incorrect disclosure on the token-creation form. No funds at risk (display-only), but it is the only pre-creation indication of what the initial ASE buy nets, and it silently misinforms every creator.

---

## Summary

On the **Create Token** page in AsePad mode, the **"Est. receive …"** field is hard-wired to `0`.

It is not a rounding issue, a stale price, or a missing config value. The value is computed by a
ternary whose condition is a **constant-false comparison of two BigInt zeros**, so the estimate
branch is never taken and the field always renders the literal string `"0"`.

Byte-exact from the shipped chunk:

```js
ec=ei>0n&&0n>0n?ed*ei/0n:0n
```

rendered as:

```js
"Est. receive ", <span className="font-mono text-white/70">{ec>0n?(0,m.yj)(ec):"0"}</span>,
" after the ", <feeBps>, "bps creation fee"
```

`0n>0n` is `false` for every input, therefore `ec === 0n` always, therefore the span always
renders `"0"`.

---

## Steps to reproduce

1. Open https://asepad.fun/asepad/create
2. Connect a wallet on testnet (chain 1423)
3. Select the **AsePad** launch mode
4. Enter any name/symbol, keep the default **Initial buy (ASE)** empty, then type e.g. `100`
5. Observe the **"Est. receive"** line

**Expected:** a non-zero token amount, net of the creation fee.

**Actual:** `Est. receive 0 TOKEN after the 30bps creation fee`, for every value of
`Initial buy (ASE)` — `1`, `100`, `1000000`, and also for an empty field.

The same value is shown for every decimals value (18 / 6 / 9 / …), every supply value, and every
"Initial buy" amount. The field is effectively constant.

---

## Root cause

From `page-637c6c595d07d3f4.js` (AsePad mode branch of the create form):

```js
el = "asepad"===K ? 18 : (/^\d+$/.test(Q.decimals.trim()) ? Number(Q.decimals.trim()) : NaN);
ei = Number.isInteger(el) && el>=0 && el<=38 ? 10n ** BigInt(el) : 0n;      // 10^decimals
er = "asepad"===K ? 1000000000n*ei
                   : (/^\d+$/.test(Q.supply.trim()) ? BigInt(Q.supply.trim())*ei : 0n);  // total supply, base units
eo = /^\d+(\.\d{1,18})?$/.test(Q.initialBuy.trim()) && Q.initialBuy.trim()
       ? BigInt(toWei(Q.initialBuy)) : 0n;                                  // initial buy, wei (ASE)
ed = eo - eo * BigInt(config?.feeBps ?? "30") / 10000n;                     // net of creation fee, wei
ec = ei>0n && 0n>0n ? ed*ei/0n : 0n;                                        // <-- BUG
```

Two coupled defects in one expression:

| # | Defect | Effect |
|---|--------|--------|
| 1 | Guard is `0n>0n` (constant `false`) | `ec` is **always** `0n`; the estimate is never computed. |
| 2 | Live branch divides by `0n` | `ed*ei/0n` is **BigInt division by zero** → `RangeError: Division by zero`. |

Defect 2 is currently masked by defect 1 (the ternary short-circuits, so the division is never
evaluated). **Fixing only the guard turns a wrong number into a crash** — see below.

### Why the intended code is recoverable

The variables show exactly what the expression was meant to compute:

* `ed` = net ASE **in wei** (wei-denominated integer)
* `ei` = `10^decimals` (token base units per whole token)
* desired result = **token base units** for that net ASE

So the arithmetic should be `netWei * 10^decimals / 1e18` — i.e. the divisor `0n` is a corrupted
`1000000000000000000n` (`1e18n`, wei → whole-token conversion), and the guard `0n>0n` is a
corrupted `ed>0n` ("is there a non-zero net buy?").

**Proposed fix (both parts together):**

```js
ec = ei > 0n && ed > 0n ? ed * ei / 1000000000000000000n : 0n;
```

Fixing the guard to `ed>0n` **while leaving the `/0n`** makes every keystroke in "Initial buy"
throw `RangeError: Division by zero` and white-screen the create form. This is worth calling out
explicitly because the two defects are one line apart and the obvious partial fix is the crashing
one.

### Expected value for the default config

With `feeBps = 30` (0.30 %) and `decimals = 18`, an initial buy of `100 ASE` yields:

* `eo` = `100e18` wei
* `ed` = `100e18 - 100e18*30/10000` = `99.7e18` wei
* `ec` = `99.7e18 * 1e18 / 1e18` = `99.7e18` = `99.7` tokens (18 decimals)

i.e. the field should read **`Est. receive 99.7 TOKEN after the 30bps creation fee`**, not `0`.

---

## Secondary observation (please confirm)

The estimate and the amount actually charged appear to use **two different fee models**:

* the estimate subtracts a **percentage** of the buy — `ed = eo - eo*feeBps/10000`, labelled in the
  UI as *"after the {feeBps}bps creation fee"*;
* the amount actually sent is a **flat** fee plus the full buy —
  `ep = config.creationFeeWei + eo` (AsePad mode), rendered as *"Total {ep} ASE + gas"*, and sent
  as `valueWei: ep.toString()` in the `createLaunch` call:

```js
let s = await (0,f.Kj)({
  to: t, method: "createLaunch",
  args: [n, Q.name, Q.symbol, er.toString(), er.toString(), 0n.toString(), e],
  valueWei: ep.toString()
});
```

So `feeBps` is applied to the estimate while `creationFeeWei` is what is actually charged. This may
be intentional (a bps pad take vs. a flat creation fee), but if `feeBps` is meant to be the
creation fee, the estimate and the charge disagree and the displayed "Total" and "Est. receive"
would not be reconcilable by the reader. Flagging for confirmation rather than asserting a bug.

---

## Environment

* Chain: testnet, chain id 1423 (`https://testnet.asentum.com`)
* App: https://asepad.fun/asepad/create
* Chunk: `/_next/static/chunks/app/asepad/create/page-637c6c595d07d3f4.js` (41,942 bytes, fetched 2026-10-22)
* Mode: **AsePad** (the `standard` and `tax` modes use different fee fields and are not affected by this expression)
* Browser: Chromium 122, Windows 11

## Impact

* Every AsePad creator sees `Est. receive 0` and gets no information about what their initial
  ASE buy converts to in tokens. The field is the only disclosure of the effective price.
* Combined with the fact that the live branch divides by zero, a partial fix regresses the create
  form into a hard crash.
* No funds are at risk: `ec` is display-only and is never used in the `createLaunch` arguments or
  in `valueWei`.

## Suggested fix location

The Create Token page component in the AsePad web app, in the `useMemo`/derivation block that
computes `eo` / `ed` / `ec` for the create form — the expression
`ei>0n&&0n>0n?ed*ei/0n:0n` in `app/asepad/create/page.tsx` (minified into
`page-637c6c595d07d3f4.js`).
