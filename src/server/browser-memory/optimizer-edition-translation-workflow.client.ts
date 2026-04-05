import {
	detectBrowserTranslationCapability,
	translateHtmlWithBrowserLocalApi,
	type TranslationCapability
} from './optimizer-edition-translation-browser-local.client';
import { translateCvToEnglishWithLlmRemote } from './optimizer-edition-translation-llm-remote.client';

type StatusTone = 'proceso' | 'exito' | 'error';
type TranslationSource = 'browser-api' | 'llm-remote';

interface TranslationEditorSnapshot {
	optimizedHTML: string;
}

interface CreateOptimizerEditionTranslationWorkflowOptions {
	translateToEnglishButton: HTMLButtonElement;
	translateToEnglishButtonLabel: HTMLElement;
	translateSourceTooltip: HTMLElement;
	getEditorSnapshot: () => TranslationEditorSnapshot | null;
	applyTranslatedHtmlToEditor: (safeTranslatedHtml: string) => void;
	sanitizeHtml: (html: string) => string;
	setStatus: (tone: StatusTone, title: string, message: string) => void;
}

interface OptimizerEditionTranslationWorkflow {
	initializeTranslationTooltip: () => Promise<void>;
	translateCurrentCvToEnglish: () => Promise<void>;
}

export const createOptimizerEditionTranslationWorkflow = (
	options: CreateOptimizerEditionTranslationWorkflowOptions
): OptimizerEditionTranslationWorkflow => {
	const {
		translateToEnglishButton,
		translateToEnglishButtonLabel,
		translateSourceTooltip,
		getEditorSnapshot,
		applyTranslatedHtmlToEditor,
		sanitizeHtml,
		setStatus
	} = options;

	let translatingToEnglish = false;
	let detectedTranslationCapability: TranslationCapability = 'llm-remote-only';

	const setTranslateButtonLoadingState = (isLoading: boolean): void => {
		translateToEnglishButton.disabled = isLoading;
		translateToEnglishButtonLabel.textContent = isLoading ? 'Traduciendo...' : 'Traducir al inglés';
	};

	const setTranslationSourceTooltip = (message: string): void => {
		translateSourceTooltip.textContent = message;
		translateToEnglishButton.removeAttribute('title');
	};

	const reportTranslationSourceToServer = async (source: TranslationSource): Promise<void> => {
		try {
			await fetch('/api/translation-source-log', {
				method: 'POST',
				headers: {
					'content-type': 'application/json; charset=utf-8'
				},
				body: JSON.stringify({ source })
			});
		} catch {
			// El reporte de logging no debe bloquear la traduccion del usuario.
		}
	};

	const refreshTranslationSourceTooltipFromAvailability = async (): Promise<void> => {
		detectedTranslationCapability = await detectBrowserTranslationCapability();
		setTranslationSourceTooltip(
			detectedTranslationCapability === 'browser-local-available'
				? 'Deteccion actual: API de traduccion local disponible. Al tocar el boton se intentara traduccion local del navegador.'
				: 'Deteccion actual: API local no disponible. Al tocar el boton se usara un LLM externo.'
		);
	};

	const initializeTranslationTooltip = async (): Promise<void> => {
		setTranslateButtonLoadingState(false);
		await refreshTranslationSourceTooltipFromAvailability();
	};

	const translateCurrentCvToEnglish = async (): Promise<void> => {
		if (translatingToEnglish) {
			return;
		}

		const snapshot = getEditorSnapshot();
		if (!snapshot) {
			setStatus('error', 'No hay contenido para traducir', 'Edita o carga un CV antes de traducir.');
			return;
		}

		await refreshTranslationSourceTooltipFromAvailability();

		translatingToEnglish = true;
		setTranslateButtonLoadingState(true);
		setStatus(
			'proceso',
			'Traduciendo CV',
			detectedTranslationCapability === 'browser-local-available'
				? 'API local disponible. Intentando primero la traduccion del navegador.'
				: 'API local no disponible. Se usara un LLM externo.'
		);

		try {
			const localTranslatedHtml = await translateHtmlWithBrowserLocalApi({
				safeHtml: snapshot.optimizedHTML,
				onDownloadProgress: (progressPercentage) => {
					setStatus(
						'proceso',
						'Descargando modelo local',
						`Descargando recursos de traduccion local (${progressPercentage}%).`
					);
				}
			});

			if (typeof localTranslatedHtml === 'string' && localTranslatedHtml.trim().length > 0) {
				const safeLocalTranslatedHtml = sanitizeHtml(localTranslatedHtml);
				if (safeLocalTranslatedHtml.trim()) {
					applyTranslatedHtmlToEditor(safeLocalTranslatedHtml);
					setTranslationSourceTooltip('Ultima traduccion: API de traduccion del navegador.');
					await reportTranslationSourceToServer('browser-api');
					setStatus('exito', 'CV traducido', 'Se actualizo el editor con la version en ingles.');
					return;
				}
			}

			setStatus('proceso', 'Traduciendo CV', 'Traduccion local no disponible. Usando un LLM externo...');
			const backendTranslatedHtml = await translateCvToEnglishWithLlmRemote(snapshot.optimizedHTML);
			applyTranslatedHtmlToEditor(backendTranslatedHtml);
			setTranslationSourceTooltip('Ultima traduccion: LLM externo.');
			await reportTranslationSourceToServer('llm-remote');
			setStatus('exito', 'CV traducido', 'Se actualizo el editor con la version en ingles.');
		} catch (error) {
			setStatus(
				'error',
				'No se pudo traducir',
				error instanceof Error ? error.message : 'Fallo inesperado al traducir el CV.'
			);
		} finally {
			translatingToEnglish = false;
			setTranslateButtonLoadingState(false);
		}
	};

	return {
		initializeTranslationTooltip,
		translateCurrentCvToEnglish
	};
};
