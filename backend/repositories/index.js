const clone = value => value === undefined ? null : structuredClone(value);
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

function segments(path = '') {
  const keys = path.split('/').filter(Boolean);
  if (keys.some(key => forbiddenKeys.has(key) || /[.#$\[\]]/.test(key))) {
    throw new Error('Invalid repository path');
  }
  return keys;
}

function at(root, path) {
  return segments(path).reduce((value, key) => value?.[key], root) ?? null;
}

function put(root, path, value) {
  const keys = segments(path);
  if (!keys.length) return clone(value) || {};
  let target = root;
  for (const key of keys.slice(0, -1)) target = target[key] ||= {};
  if (value === null) delete target[keys.at(-1)];
  else target[keys.at(-1)] = clone(value);
  return root;
}

// This adapter is only for isolated tests and explicitly selected local demos.
// Its serialized commits exercise the same whole-root conditional operation as RTDB.
function createMemoryRepository(seed = {}) {
  let state = clone(seed);
  let queue = Promise.resolve();
  return {
    kind: 'memory',
    async read(path = '') { await queue; return clone(at(state, path)); },
    async transaction(updateFn) {
      const operation = queue.then(() => {
        const next = updateFn(clone(state) || {});
        if (next && typeof next.then === 'function') throw new Error('Transaction callback must be synchronous');
        if (next === undefined) return { committed: false, snapshot: clone(state) };
        state = clone(next);
        return { committed: true, snapshot: clone(state) };
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    },
    async set(path, value) { return this.transaction(root => put(root, path, value)); },
    async update(patch) {
      return this.transaction(root => Object.entries(patch).reduce((value, [path, data]) => put(value, path, data), root));
    },
    async close() { await queue; },
  };
}

function createFirebaseRepository(realtimeDb) {
  return {
    kind: 'firebase',
    async read(path = '') {
      segments(path);
      const ref = path ? realtimeDb.ref(path) : realtimeDb.ref();
      return (await ref.get()).val();
    },
    async transaction(updateFn) {
      const ref = realtimeDb.ref();
      const retainCache = () => {};
      ref.on('value', retainCache);
      try {
        // Keep the listener active until commit: RTDB may otherwise begin on an empty cache.
        await ref.once('value');
        const result = await ref.transaction(current => {
          const next = updateFn(current || {});
          if (next && typeof next.then === 'function') throw new Error('Transaction callback must be synchronous');
          return next;
        }, undefined, false);
        return { committed: result.committed, snapshot: result.snapshot.val() };
      } finally { ref.off('value', retainCache); }
    },
    async set(path, value) { segments(path); await realtimeDb.ref(path).set(value); },
    async update(patch) { Object.keys(patch).forEach(segments); await realtimeDb.ref().update(patch); },
    async close() { realtimeDb.goOffline(); },
  };
}

module.exports = { createMemoryRepository, createFirebaseRepository, at, put };
