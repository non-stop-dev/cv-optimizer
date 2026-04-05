import {
	normalizeHistoryEntryTargetPositions,
	type HistoryEntry
} from './history-entry';

const normalizeHistoryEntry = (entry: HistoryEntry): HistoryEntry => {
	return {
		...entry,
		targetPositions: normalizeHistoryEntryTargetPositions(entry.targetPositions)
	};
};

export const HISTORY_DB_NAME = 'cv-optimizer-browser-memory';
export const HISTORY_STORE_NAME = 'cv-history';

const openHistoryDatabase = async (): Promise<IDBDatabase> => {
	if (!('indexedDB' in window)) {
		throw new Error('IndexedDB no esta disponible en este navegador.');
	}

	return await new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(HISTORY_DB_NAME, 1);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
				database.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
	});
};

const closeDatabase = (database: IDBDatabase): void => {
	try {
		database.close();
	} catch {
		// Ignore close failures from already-closed handles.
	}
};

export const readHistoryEntries = async (): Promise<HistoryEntry[]> => {
	const database = await openHistoryDatabase();
	return await new Promise<HistoryEntry[]>((resolve, reject) => {
		const transaction = database.transaction(HISTORY_STORE_NAME, 'readonly');
		const store = transaction.objectStore(HISTORY_STORE_NAME);
		const request = store.getAll();

		request.onsuccess = () => {
			const entries = Array.isArray(request.result)
				? (request.result as HistoryEntry[]).map(normalizeHistoryEntry)
				: [];
			entries.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
			resolve(entries);
		};
		request.onerror = () => reject(request.error ?? new Error('No se pudo leer el historial.'));
		transaction.oncomplete = () => closeDatabase(database);
		transaction.onabort = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('La lectura del historial fue cancelada.'));
		};
		transaction.onerror = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('No se pudo leer el historial.'));
		};
	});
};

export const readHistoryEntryById = async (historyId: string): Promise<HistoryEntry | null> => {
	if (!historyId) {
		return null;
	}

	const database = await openHistoryDatabase();
	return await new Promise<HistoryEntry | null>((resolve, reject) => {
		const transaction = database.transaction(HISTORY_STORE_NAME, 'readonly');
		const store = transaction.objectStore(HISTORY_STORE_NAME);
		const request = store.get(historyId);

		request.onsuccess = () => {
			const result = request.result;
			resolve(
				result && typeof result === 'object'
					? normalizeHistoryEntry(result as HistoryEntry)
					: null
			);
		};
		request.onerror = () => reject(request.error ?? new Error('No se pudo leer la version solicitada.'));
		transaction.oncomplete = () => closeDatabase(database);
		transaction.onabort = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('La lectura de la version fue cancelada.'));
		};
		transaction.onerror = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('No se pudo leer la version solicitada.'));
		};
	});
};

export const writeHistoryEntry = async (entry: HistoryEntry, maxEntries = 20): Promise<void> => {
	const database = await openHistoryDatabase();
	await new Promise<void>((resolve, reject) => {
		const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
		const store = transaction.objectStore(HISTORY_STORE_NAME);

		store.put(normalizeHistoryEntry(entry));
		const readRequest = store.getAll();
		readRequest.onsuccess = () => {
			const allEntries = Array.isArray(readRequest.result)
				? (readRequest.result as HistoryEntry[])
				: [];
			allEntries.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
			const overflowEntries = allEntries.slice(maxEntries);
			for (const overflowEntry of overflowEntries) {
				if (typeof overflowEntry?.id === 'string') {
					store.delete(overflowEntry.id);
				}
			}
		};

		transaction.oncomplete = () => {
			closeDatabase(database);
			resolve();
		};
		transaction.onabort = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('La operacion de historial fue cancelada.'));
		};
		transaction.onerror = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('No se pudo guardar el historial.'));
		};
	});
};

export const upsertHistoryEntry = async (entry: HistoryEntry): Promise<void> => {
	const database = await openHistoryDatabase();
	await new Promise<void>((resolve, reject) => {
		const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
		const store = transaction.objectStore(HISTORY_STORE_NAME);
		store.put(normalizeHistoryEntry(entry));

		transaction.oncomplete = () => {
			closeDatabase(database);
			resolve();
		};
		transaction.onabort = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('El guardado local fue cancelado.'));
		};
		transaction.onerror = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('No se pudieron guardar los cambios en historial local.'));
		};
	});
};

export const clearHistoryEntries = async (): Promise<void> => {
	const database = await openHistoryDatabase();
	await new Promise<void>((resolve, reject) => {
		const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
		const store = transaction.objectStore(HISTORY_STORE_NAME);
		store.clear();

		transaction.oncomplete = () => {
			closeDatabase(database);
			resolve();
		};
		transaction.onabort = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('La limpieza de historial fue cancelada.'));
		};
		transaction.onerror = () => {
			closeDatabase(database);
			reject(transaction.error ?? new Error('No se pudo limpiar el historial.'));
		};
	});
};
