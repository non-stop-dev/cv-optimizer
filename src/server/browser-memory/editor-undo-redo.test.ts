import { describe, expect, it } from 'vitest';

import { createUndoRedoController } from './editor-undo-redo';

describe('createUndoRedoController', () => {
	it('aplica undo y redo sobre snapshots consecutivos', () => {
		const now = Date.now();
		const controller = createUndoRedoController({
			retentionMs: 20 * 60 * 1000,
			maxSnapshots: 20
		});

		controller.captureSnapshot({
			optimizedHTML: '<p>base</p>',
			primaryColor: '#0f766e',
			templateId: 'default',
			timestamp: now - 1_000
		});
		controller.captureSnapshot({
			optimizedHTML: '<p>edicion</p>',
			primaryColor: '#0f766e',
			templateId: 'default',
			timestamp: now
		});

		expect(controller.canUndo()).toBe(true);
		expect(controller.canRedo()).toBe(false);

		const undoSnapshot = controller.undo();
		expect(undoSnapshot?.optimizedHTML).toBe('<p>base</p>');
		expect(controller.canRedo()).toBe(true);

		const redoSnapshot = controller.redo();
		expect(redoSnapshot?.optimizedHTML).toBe('<p>edicion</p>');
		expect(controller.canUndo()).toBe(true);
	});

	it('descarta snapshots fuera de la ventana de retencion', () => {
		const controller = createUndoRedoController({
			retentionMs: 1_000,
			maxSnapshots: 20
		});

		controller.captureSnapshot({
			optimizedHTML: '<p>muy-antiguo</p>',
			primaryColor: '#0f766e',
			templateId: 'default',
			timestamp: 1_000
		});
		controller.captureSnapshot({
			optimizedHTML: '<p>reciente</p>',
			primaryColor: '#0f766e',
			templateId: 'default',
			timestamp: 2_500
		});

		expect(controller.canUndo()).toBe(false);
		expect(controller.undo()).toBeNull();
	});

	it('limita snapshots al maximo configurado', () => {
		const now = Date.now();
		const controller = createUndoRedoController({
			retentionMs: 50_000,
			maxSnapshots: 3
		});

		controller.captureSnapshot({
			optimizedHTML: '<p>1</p>',
			primaryColor: '#111111',
			templateId: 'default',
			timestamp: now - 3_000
		});
		controller.captureSnapshot({
			optimizedHTML: '<p>2</p>',
			primaryColor: '#222222',
			templateId: 'default',
			timestamp: now - 2_000
		});
		controller.captureSnapshot({
			optimizedHTML: '<p>3</p>',
			primaryColor: '#333333',
			templateId: 'default',
			timestamp: now - 1_000
		});
		controller.captureSnapshot({
			optimizedHTML: '<p>4</p>',
			primaryColor: '#444444',
			templateId: 'default',
			timestamp: now
		});

		const firstUndo = controller.undo();
		expect(firstUndo?.optimizedHTML).toBe('<p>3</p>');
		const secondUndo = controller.undo();
		expect(secondUndo?.optimizedHTML).toBe('<p>2</p>');
		expect(controller.undo()).toBeNull();
	});

	it('considera cambios de plantilla como snapshots distintos', () => {
		const now = Date.now();
		const controller = createUndoRedoController({
			retentionMs: 20 * 60 * 1000,
			maxSnapshots: 20
		});

		controller.captureSnapshot({
			optimizedHTML: '<p>base</p>',
			primaryColor: '#0f766e',
			templateId: 'default',
			timestamp: now - 1_000
		});
		controller.captureSnapshot({
			optimizedHTML: '<p>base</p>',
			primaryColor: '#0f766e',
			templateId: 'serif',
			timestamp: now
		});

		expect(controller.canUndo()).toBe(true);

		const undoSnapshot = controller.undo();
		expect(undoSnapshot?.templateId).toBe('default');

		const redoSnapshot = controller.redo();
		expect(redoSnapshot?.templateId).toBe('serif');
	});
});
