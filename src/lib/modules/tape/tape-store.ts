/**
 * IndexedDB persistence for user-imported audio tracks.
 *
 * Stores raw compressed audio bytes (MP3/WAV/OGG), NOT decoded PCM.
 * Uses a separate database to avoid version conflicts.
 */

const DB_NAME = 'mycelium-tape';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

export interface StoredTrack {
  id: string;
  title: string;
  artist: string;
  data: ArrayBuffer;
  mimeType: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTrack(track: StoredTrack): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(track);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadAllUserTracks(): Promise<StoredTrack[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as StoredTrack[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function loadTrackData(id: string): Promise<StoredTrack | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => { db.close(); resolve(request.result as StoredTrack | null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
