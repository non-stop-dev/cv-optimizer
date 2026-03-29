const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.html', '.yaml', '.yml', '.txt']);

export const HISTORY_MAX_ENTRIES = 20;

export const PROCESS_STAGES = {
	validating: 'Validando documento localmente',
	uploading: 'Subiendo documento al servidor',
	optimizing: 'Optimizando CV con IA',
	rendering: 'Renderizando resultado'
};

export type StageKey = keyof typeof PROCESS_STAGES;
export type StageState = 'en-progreso' | 'completado' | 'error';

export class UploadFlowError extends Error {
	code: string;

	constructor(message: string, code = 'UNKNOWN') {
		super(message);
		this.name = 'UploadFlowError';
		this.code = code;
	}
}

export const toDisplayDate = (timestamp: number): string => {
	return new Date(timestamp).toLocaleString('es-ES', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
};

export const toOptimizerResultPath = (historyId: string): string => {
	return `/optimizer/${encodeURIComponent(historyId)}`;
};

export const validateFileSelection = (file: File): string | null => {
	const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';

	if (!ALLOWED_EXTENSIONS.has(extension)) {
		return 'Formato no permitido. Usa PDF, HTML, YAML, YML o TXT.';
	}

	if (file.size > MAX_SIZE_BYTES) {
		return 'El archivo supera el tamano maximo de 10 MB.';
	}

	if (file.size === 0) {
		return 'El archivo esta vacio. Selecciona un documento valido.';
	}

	return null;
};

export const toFriendlyErrorMessage = (statusCode: number): string => {
	if (statusCode === 413) {
		return 'El archivo excede el tamano permitido. Usa un documento de hasta 10 MB.';
	}
	if (statusCode === 415) {
		return 'Ese formato no esta permitido. Sube PDF, HTML, YAML, YML o TXT.';
	}
	if (statusCode === 422) {
		return 'No se pudo procesar este archivo. Prueba con otra exportacion del CV.';
	}
	if (statusCode === 429) {
		return 'Se alcanzo el limite de cuota del proveedor de IA. Revisa plan, billing y rate limits.';
	}
	if (statusCode === 502) {
		return 'No se pudo completar la optimizacion del CV por un problema del servicio de IA.';
	}
	if (statusCode === 503) {
		return 'La optimizacion no esta disponible en este entorno. Falta configurar GEMINI_API_KEY.';
	}

	return 'No pudimos procesar tu documento por ahora. Intenta nuevamente.';
};
