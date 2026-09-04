"use client";

/**
 * Four functions over IndexedDB, so nothing else has to touch its event API.
 *
 * localStorage would have been less code, but it is synchronous, capped at
 * about five megabytes for the whole origin, and the character builder is
 * already living in it. A campaign's notes are the first thing here that grows
 * without bound, so they get the store built for that.
 *
 * Every call resolves rather than rejects on failure. Private browsing, a
 * blocked origin and a browser that has never heard of IndexedDB all end up in
 * the same place: no cache, and the caller falls back to reading from the
 * network. A cache that can take the page down is worse than no cache.
 */

const DB_NAME = "qf";
const DB_VERSION = 1;
const STORE = "kv";

let open: Promise<IDBDatabase | null> | null = null;

function database(): Promise<IDBDatabase | null> {
  if (open) return open;

  open = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return open;
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return database().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }

        try {
          const request = work(db.transaction(STORE, mode).objectStore(STORE));
          /* IndexedDB answers a missing key with `undefined`, not null, and a
             signature promising `T | null` has to mean it. Missing and failed
             collapse into the same answer on purpose: every caller here treats
             both as "no cache", and telling them apart would only invite
             somebody to handle one and forget the other. */
          request.onsuccess = () => resolve((request.result ?? null) as T | null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const idbGet = <T>(key: string) => run<T>("readonly", (store) => store.get(key));

export const idbPut = (key: string, value: unknown) =>
  run<undefined>("readwrite", (store) => store.put(value, key));

export const idbDelete = (key: string) =>
  run<undefined>("readwrite", (store) => store.delete(key));

/**
 * Every key, so signing out can drop the lot. Anything cached here belongs to
 * whoever was signed in, and the next person at this browser is not them.
 */
export const idbKeys = () => run<string[]>("readonly", (store) => store.getAllKeys() as IDBRequest);

export async function idbClear(prefix?: string): Promise<void> {
  if (!prefix) {
    await run<undefined>("readwrite", (store) => store.clear());
    return;
  }

  const keys = (await idbKeys()) ?? [];
  await Promise.all(keys.filter((key) => key.startsWith(prefix)).map(idbDelete));
}
