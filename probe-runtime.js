// PROBE — ground-truth test of the disputed Asentum runtime APIs.
// Deploy this, call each method, and read the results.
// Every method returns a string describing what actually happened.

function safe(fn) {
  try {
    const v = fn();
    return 'OK  type=' + (typeof v) + '  value=' + safeStr(v);
  } catch (e) {
    return 'ERR ' + (e && e.message ? e.message : String(e));
  }
}

function safeStr(v) {
  try {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'bigint') return v.toString() + 'n';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (e) {
    return '<unstringifiable>';
  }
}

({
  // ── 1. chain global ────────────────────────────────────────────────
  probeChain() {
    const out = {};
    out.blockNumber = safe(() => chain.blockNumber);
    out.blockTimestamp = safe(() => chain.blockTimestamp);
    out.timestamp = safe(() => chain.timestamp);
    out.chainId = safe(() => chain.chainId);
    out.block = safe(() => chain.block);
    return out;
  },

  // ── 2. msg global ──────────────────────────────────────────────────
  probeMsg() {
    const out = {};
    out.sender = safe(() => msg.sender);
    out.value = safe(() => msg.value);
    out.blockNumber = safe(() => msg.block.number);
    out.blockTimestamp = safe(() => msg.block.timestamp);
    out.block = safe(() => msg.block);
    return out;
  },

  // ── 3. storage value typing ────────────────────────────────────────
  // Does storage round-trip the exact type you put in?
  probeStorageRoundTrip() {
    const out = {};
    storage.set('p_num', 42);
    storage.set('p_str', 'hello');
    storage.set('p_bool', true);
    storage.set('p_arr', [1, 2, 3]);
    storage.set('p_obj', { a: 1, b: 'two' });
    storage.set('p_big', 7n);

    out.num = safe(() => storage.get('p_num'));
    out.str = safe(() => storage.get('p_str'));
    out.bool = safe(() => storage.get('p_bool'));
    out.arr = safe(() => storage.get('p_arr'));
    out.arr_has_push = safe(() => typeof storage.get('p_arr').push);
    out.arr_push_works = safe(() => {
      const a = storage.get('p_arr');
      a.push(4);
      return storage.get('p_arr');
    });
    out.obj = safe(() => storage.get('p_obj'));
    out.obj_field = safe(() => storage.get('p_obj').b);
    out.big = safe(() => storage.get('p_big'));
    out.big_add = safe(() => storage.get('p_big') + 1n);
    return out;
  },

  // ── 4. storage.entries — iterable storage ──────────────────────────
  probeStorageEntries() {
    const out = {};
    out.has_entries = safe(() => typeof storage.entries);
    out.entries_call = safe(() => storage.entries('p_'));
    out.keys_call = safe(() => storage.keys());
    out.entries_undefined = safe(() => storage.entries());
    return out;
  },

  // ── 5. this binding inside a contract method ────────────────────────
  probeThis() {
    const out = {};
    out.this_type = safe(() => typeof this);
    out.this_address = safe(() => this.address);
    out.this_keys = safe(() => Object.keys(this));
    return out;
  },

  // ── 6. other injected globals ───────────────────────────────────────
  probeGlobals() {
    const out = {};
    out.assert = safe(() => typeof assert);
    out.cron = safe(() => typeof cron);
    out.transfer = safe(() => typeof transfer);
    out.E = safe(() => typeof E);
    out.emit = safe(() => typeof emit);
    out.chain_id = safe(() => typeof chain);
    out.globalThis_keys = safe(() => Object.keys(globalThis).sort().join(','));
    return out;
  },

  // ── 7. assert vs throw ─────────────────────────────────────────────
  probeAssertVsThrow() {
    const out = {};
    out.assert_pass = safe(() => { assert(1 === 1, 'never'); return 'no revert'; });
    out.assert_fail = safe(() => { assert(1 === 2, 'assert fired'); return 'no revert'; });
    out.throw_fail = safe(() => { throw new Error('throw fired'); });
    out.assert_nonbool = safe(() => { assert('truthy', 'msg'); return 'no revert'; });
    return out;
  },

  // ── 8. spread/iteration on storage values ──────────────────────────
  probeIteration() {
    const out = {};
    out.arr_spread = safe(() => [...storage.get('p_arr')].join('|'));
    out.obj_spread = safe(() => JSON.stringify({ ...storage.get('p_obj') }));
    out.arr_of = safe(() => storage.get('p_arr').length);
    return out;
  },
});
