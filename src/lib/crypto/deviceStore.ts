// The non-extractable diary key is stored as a CryptoKey object in IndexedDB
// so full page loads within a sign-in session do not demand the passphrase
// again. It can be used by this origin's scripts but never read out. By
// default it expires with the auth session (12 h) and is cleared on sign-out
// or lock; "keep this device unlocked" removes the expiry. It is dropped
// whenever the key material changes (scope = passphrase salt).

const DB_NAME = "oportfolio-diary-lock";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export interface DeviceKeyRecord {
  key: CryptoKey;
  keyVersion: number;
  // Epoch ms; null = keep until explicitly locked or signed out.
  expiresAt: number | null;
}

export async function storeDeviceKey(scope: string, record: DeviceKeyRecord): Promise<void> {
  try {
    await tx("readwrite", (store) => store.put(record, scope));
  } catch {
    // Private browsing / storage blocked: the diary simply locks on reload.
  }
}

export async function loadDeviceKey(scope: string): Promise<DeviceKeyRecord | null> {
  try {
    const record = (await tx("readonly", (store) => store.get(scope))) as DeviceKeyRecord | undefined;
    if (!record || !(record.key instanceof CryptoKey)) return null;
    if (record.expiresAt !== null && record.expiresAt !== undefined && record.expiresAt <= Date.now()) {
      await clearDeviceKeys();
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function clearDeviceKeys(): Promise<void> {
  try {
    await tx("readwrite", (store) => store.clear());
  } catch {
    // nothing stored
  }
}
