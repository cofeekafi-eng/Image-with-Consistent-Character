import { Character } from '../types';

const DB_NAME = 'CharConsistentDB';
const STORE_NAME = 'characters';
const DB_VERSION = 1;

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Check for support
    if (!window.indexedDB) {
      reject("IndexedDB is not supported in this browser.");
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject('Failed to open database');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const loadSavedCharacters = async (): Promise<Character[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject('Failed to load characters');
    });
  } catch (error) {
    console.error("Storage load error:", error);
    return [];
  }
};

export const saveCharacterToStorage = async (character: Character): Promise<Character[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put(character);

      transaction.oncomplete = async () => {
         // Return fresh list after successful save
         const all = await loadSavedCharacters();
         resolve(all);
      };
      
      transaction.onerror = (e) => {
        console.error("Transaction error:", e);
        reject('Failed to save character. The database might be full or corrupted.');
      };
    });
  } catch (e) {
    throw new Error('Database connection failed.');
  }
};

export const deleteCharacterFromStorage = async (id: string): Promise<Character[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);

      transaction.oncomplete = async () => {
          const all = await loadSavedCharacters();
          resolve(all);
      };
      
      transaction.onerror = () => reject('Failed to delete character');
    });
  } catch (e) {
    throw new Error('Database connection failed during delete.');
  }
};