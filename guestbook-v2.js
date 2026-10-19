// Guestbook v2 — on-chain message board with likes
// Anyone can sign. Anyone can read. Anyone can like. Immutable forever.

({
  init() {
    assert(!storage.has('initialized'), 'already initialized');
    storage.set('initialized', 'true');
    storage.set('entries', JSON.stringify([]));
    storage.set('count', '0');
    storage.set('likes', JSON.stringify({}));
    emit('Initialized', { by: msg.sender });
  },

  sign(name, message) {
    assert(name && name.trim().length > 0, 'name required');
    assert(message && message.trim().length > 0, 'message required');
    assert(message.length <= 280, 'message too long (max 280)');

    const entries = JSON.parse(storage.get('entries'));
    const id = BigInt(storage.get('count')) + 1n;

    const entry = {
      id: String(id),
      signer: msg.sender,
      name: name.trim(),
      message: message.trim(),
      block: String(chain.blockNumber),
      likes: 0,
    };

    entries.push(entry);
    storage.set('entries', JSON.stringify(entries));
    storage.set('count', String(id));

    emit('Signed', { id: String(id), signer: msg.sender, name: name.trim() });
    return String(id);
  },

  like(id) {
    const entries = JSON.parse(storage.get('entries'));
    const idx = entries.findIndex(e => e.id === String(id));
    assert(idx >= 0, 'entry not found');

    // Prevent self-liking
    assert(entries[idx].signer !== msg.sender, 'cannot like your own entry');

    // Track who liked what to prevent double-liking
    const likesMap = JSON.parse(storage.get('likes'));
    const key = String(id) + ':' + msg.sender;
    assert(!likesMap[key], 'already liked');

    likesMap[key] = true;
    storage.set('likes', JSON.stringify(likesMap));

    entries[idx].likes = (entries[idx].likes || 0) + 1;
    storage.set('entries', JSON.stringify(entries));

    emit('Liked', { id: String(id), by: msg.sender, totalLikes: entries[idx].likes });
    return entries[idx].likes;
  },

  getEntries() {
    return JSON.parse(storage.get('entries'));
  },

  getCount() {
    return storage.get('count');
  },

  getEntry(id) {
    const entries = JSON.parse(storage.get('entries'));
    for (const e of entries) {
      if (e.id === String(id)) return e;
    }
    return null;
  },

  getLastEntries(n) {
    const entries = JSON.parse(storage.get('entries'));
    const start = entries.length > n ? entries.length - n : 0;
    return entries.slice(start);
  },

  getTopEntries(n) {
    const entries = JSON.parse(storage.get('entries'));
    const sorted = [...entries].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return sorted.slice(0, n);
  },

  hasLiked(id, address) {
    const likesMap = JSON.parse(storage.get('likes'));
    const key = String(id) + ':' + address;
    return !!likesMap[key];
  },
});
