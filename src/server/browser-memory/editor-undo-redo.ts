import type { CvTemplateId } from '../export-cv/cv-export';

export interface EditorSnapshot {
	optimizedHTML: string;
	primaryColor: string;
	templateId: CvTemplateId;
	timestamp: number;
}

export interface UndoRedoController {
	captureSnapshot: (snapshot: EditorSnapshot) => void;
	undo: () => EditorSnapshot | null;
	redo: () => EditorSnapshot | null;
	clear: () => void;
	canUndo: () => boolean;
	canRedo: () => boolean;
}

interface UndoRedoOptions {
	retentionMs: number;
	maxSnapshots: number;
}

const sameSnapshot = (left: EditorSnapshot, right: EditorSnapshot): boolean => {
	return (
		left.optimizedHTML === right.optimizedHTML &&
		left.primaryColor === right.primaryColor &&
		left.templateId === right.templateId
	);
};

const keepWithinWindow = (
	stack: EditorSnapshot[],
	referenceTimestamp: number,
	retentionMs: number
): EditorSnapshot[] => {
	const threshold = referenceTimestamp - retentionMs;
	return stack.filter((snapshot) => snapshot.timestamp >= threshold);
};

const cloneSnapshot = (snapshot: EditorSnapshot): EditorSnapshot => {
	return {
		optimizedHTML: snapshot.optimizedHTML,
		primaryColor: snapshot.primaryColor,
		templateId: snapshot.templateId,
		timestamp: snapshot.timestamp
	};
};

export const createUndoRedoController = (options: UndoRedoOptions): UndoRedoController => {
	let undoStack: EditorSnapshot[] = [];
	let redoStack: EditorSnapshot[] = [];

	const prune = (referenceTimestamp: number): void => {
		undoStack = keepWithinWindow(undoStack, referenceTimestamp, options.retentionMs);
		redoStack = keepWithinWindow(redoStack, referenceTimestamp, options.retentionMs);

		if (undoStack.length > options.maxSnapshots) {
			undoStack = undoStack.slice(undoStack.length - options.maxSnapshots);
		}
		if (redoStack.length > options.maxSnapshots) {
			redoStack = redoStack.slice(redoStack.length - options.maxSnapshots);
		}
	};

	const captureSnapshot = (snapshot: EditorSnapshot): void => {
		const normalized = cloneSnapshot(snapshot);
		const latest = undoStack[undoStack.length - 1];
		if (latest && sameSnapshot(latest, normalized)) {
			latest.timestamp = normalized.timestamp;
			prune(normalized.timestamp);
			return;
		}

		undoStack.push(normalized);
		redoStack = [];
		prune(normalized.timestamp);
	};

	const undo = (): EditorSnapshot | null => {
		if (undoStack.length <= 1) {
			return null;
		}

		const current = undoStack.pop();
		if (!current) {
			return null;
		}

		redoStack.push(current);
		const target = undoStack[undoStack.length - 1] ?? null;
		if (!target) {
			return null;
		}

		prune(Date.now());
		return cloneSnapshot(target);
	};

	const redo = (): EditorSnapshot | null => {
		const target = redoStack.pop() ?? null;
		if (!target) {
			return null;
		}

		undoStack.push(target);
		prune(Date.now());
		return cloneSnapshot(target);
	};

	return {
		captureSnapshot,
		undo,
		redo,
		clear: () => {
			undoStack = [];
			redoStack = [];
		},
		canUndo: () => undoStack.length > 1,
		canRedo: () => redoStack.length > 0
	};
};
