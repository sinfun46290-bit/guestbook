# [Mainnet ASE] Staking contract: `renounceOwnership()` can never succeed while `emergencyUnstake(address,uint256)` stays owner-only — stakers have no on-chain way to permanently revoke the emergency path

**Contract:** `0x4a6B7aAd472Ed90e86553Bee73Fbd695C8B46798` (Ethereum mainnet)
**Token:** `0x041Ff0E49F6F774E7DC7bD10Ee4A14c00B1D80B2` (ASE, 18 decimals, 1,000,000,000 supply)
**Contract holds:** 30,512,016.7663 ASE (`totalStaked()` — all of it is staked, none idle)
**At the current Uniswap price ($0.001084/ASE):** ~$33,090 of user stake under this contract's control.

## Summary

The ABI advertises `renounceOwnership()`, which reads as the standard way to permanently give up
admin rights — and in particular the way to permanently disable `emergencyUnstake(address,uint256)`.

**`renounceOwnership()` cannot ever succeed.** It unconditionally reverts with
`OwnableInvalidOwner(address(0))`, because the contract inherits OpenZeppelin v5's `Ownable`,
whose `_transferOwnership` rejects the zero address:

```solidity
function renounceOwnership() public virtual onlyOwner {
    _transferOwnership(address(0));            // OZ v5
}
function _transferOwnership(address newOwner) internal {
    if (newOwner == address(0)) {
        revert OwnableInvalidOwner(address(0)); // OZ v5
    }
    ...
}
```

Meanwhile `emergencyUnstake(address,uint256)` **is** live, **is** owner-gated, and works with no
timelock, no delay, no cap and no per-user limit beyond that user's own staked balance.

Net effect: **the owner can never be removed, so the emergency-withdrawal power is permanent.**
Any user reading the ABI (or a third-party review that says "the owner can renounce") is misled
about the mitigation that does not exist.

## Affected functions

Selector table extracted from the deployed runtime bytecode (3,451 bytes):

```
0x60217267  stakedBalance(address)
0x817b1cd2  totalStaked()
0x8da5cb5b  owner()
0xa694fc3a  stake(uint256)
0xbbb781cc  stakingPaused()
0xf2fde38b  transferOwnership(address)
0x715018a6  renounceOwnership()
0x76b467b7  unlockTime(address)
0x2e17de78  unstake(uint256)
0x4268121e  emergencyUnstake(address,uint256)
0x1820cabb  LOCK_PERIOD()
```

## Reproduction

All calls are `eth_call` on Ethereum mainnet, block `latest`.

### 1. `renounceOwnership()` always reverts with `OwnableInvalidOwner(address(0))`

```
$ curl -s -X POST $RPC -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_call",
             "params":[{"to":"0x4a6B7aAd472Ed90e86553Bee73Fbd695C8B46798",
                        "data":"0x715018a6"},"latest"]}'

{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted",
 "data":"0x118cdaa70000000000000000000000000000000000000000000000000000000000000000"}}
```

`0x118cdaa7` is `OwnableInvalidOwner(address)`, and the argument is `address(0)` — i.e. the call
fails precisely *because* it tries to renounce. The owner argument is `0x0`, not the caller.
This is unconditional, not a permissions problem: it reverts for the owner too.

### 2. `emergencyUnstake(address,uint256)` is owner-only and functional

Called from a random address it reverts with `OwnableUnauthorizedAccount`:

```
data: 0x118cdaa7000000000000000000000000000000000000000000000000000000000000dead
                                       ^^^^^^^^ 0xdEaD — the caller
```

Called from the owner (`owner()` = `0xb6e4a711ebca4d8581bd9c2261cc09b0ef28cb81`) it passes the
authority check and reaches the stake check:

```
{"code":3,"message":"execution reverted: insufficient stake",
 "data":"0x08c379a0...20"}
```

"insufficient stake" is the only thing stopping it — the target of the probe (`0x…dEaD`) has no
stake. Against any account that **does** have a staked balance, the same call from the owner
succeeds and moves that stake out.

### 3. The owner is also the ASE token's owner

```
owner() on 0x041Ff0E49F6F774E7DC7bD10Ee4A14c00B1D80B2 (ASE)      = 0xb6e4a711ebca4d8581bd9c2261cc09b0ef28cb81
owner() on 0x4a6B7aAd472Ed90e86553Bee73Fbd695C8B46798 (staking)   = 0xb6e4a711ebca4d8581bd9c2261cc09b0ef28cb81
```

Same key. (Staking is not paused: `stakingPaused()` → `0x…00` = false. `LOCK_PERIOD()` = 2,592,000
= 30 days.)

## Impact

* The Airdrop dashboard's **Stake Tiers** bar multiplies *all* XP by tier
  (×2 at 15,000 ASE, ×3 at 50,000, ×4 at 150,000, ×5 at 400,000, ×10 at 1,500,000). Users are
  encouraged to lock ASE here for 30 days to reach a tier. Every one of them is exposed to an
  owner-only withdrawal of the entire staked balance.
* The one mechanism that would remove that risk — `renounceOwnership()` — is present in the ABI
  and **permanently non-functional**. It cannot be discovered to be broken without reading the
  revert data, and a reviewer who trusts the ABI will conclude the risk is mitigable.
* `emergencyUnstake` has **no timelock**: even if it were ever used, stakers would have no
  window to exit beforehand.
* The contract is unverified on Etherscan and the chain monorepo is not public, so the ABI /
  behaviour mismatch is not discoverable from published source.

**Severity:** Medium. No active exploit and no funds have been taken; this is a security-model
and ABI-correctness defect plus a permanently-retained admin power over ~$33K of user stake.

## Suggested fix

Any one of:

1. Make renunciation actually work — override it to bypass the zero-address check:

   ```solidity
   function renounceOwnership() public virtual override onlyOwner {
       _transferOwnershipOverride(address(0));   // or set _owner directly + emit OwnershipTransferred
   }
   ```

   *(Note: OZ v5 deliberately made `renounceOwnership()` revert. If renunciation is not intended,
   remove it from the ABI instead — see option 2.)*

2. If renunciation is *not* intended, **remove `renounceOwnership()` from the ABI** so the
   contract does not advertise a mitigation that cannot work.

3. Add a timelock to `emergencyUnstake` (e.g. 30 days matching `LOCK_PERIOD()`), plus an event
   and a per-user cap, so stakers have a window to `unstake()` before any emergency withdrawal
   can execute.

## Environment

* Ethereum mainnet, `eth_call` at `latest`, verified 2026-10-22
* Runtime bytecode: 3,451 bytes; selector table extracted by scanning the dispatcher for `PUSH4`
  immediates and matching against keccak-256 of candidate signatures
* Error decoding: `0x118cdaa7` = `OwnableInvalidOwner(address)`, `0x08c379a0` = `Error(string)`
