export const CV_TEMPLATE_OPTIONS = [
	{ id: 'default', label: 'Default' },
	{ id: 'executive', label: 'Executive' },
	{ id: 'minimal', label: 'Minimal' },
	{ id: 'serif', label: 'Serif' }
] as const;

export type CvTemplateId = (typeof CV_TEMPLATE_OPTIONS)[number]['id'];

export const DEFAULT_CV_TEMPLATE_ID: CvTemplateId = 'default';

const CV_TEMPLATE_ID_SET: ReadonlySet<string> = new Set(CV_TEMPLATE_OPTIONS.map((template) => template.id));

/**
 * Determina si un string pertenece al catálogo de plantillas soportadas.
 */
export const isCvTemplateId = (value: string): value is CvTemplateId => {
	return CV_TEMPLATE_ID_SET.has(value);
};

/**
 * Normaliza valores externos al id de plantilla por defecto.
 */
export const toCvTemplateId = (value: string | null | undefined): CvTemplateId => {
	if (typeof value !== 'string') {
		return DEFAULT_CV_TEMPLATE_ID;
	}

	return isCvTemplateId(value) ? value : DEFAULT_CV_TEMPLATE_ID;
};
