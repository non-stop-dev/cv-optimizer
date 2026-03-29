import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';

export const CV_TEMPLATE_OPTIONS = [
	{ id: 'default', label: 'Default' },
	{ id: 'executive', label: 'Executive' },
	{ id: 'minimal', label: 'Minimal' },
	{ id: 'serif', label: 'Serif' }
] as const;

export type CvTemplateId = (typeof CV_TEMPLATE_OPTIONS)[number]['id'];

export const DEFAULT_CV_TEMPLATE_ID: CvTemplateId = 'default';

const CV_TEMPLATE_ID_SET: ReadonlySet<string> = new Set(CV_TEMPLATE_OPTIONS.map((template) => template.id));

export const isCvTemplateId = (value: string): value is CvTemplateId => {
	return CV_TEMPLATE_ID_SET.has(value);
};

export const toCvTemplateId = (value: string | null | undefined): CvTemplateId => {
	if (typeof value !== 'string') {
		return DEFAULT_CV_TEMPLATE_ID;
	}

	return isCvTemplateId(value) ? value : DEFAULT_CV_TEMPLATE_ID;
};

export const toSafeFileName = (sourceName: string, extension: string): string => {
	const normalizedName = sourceName
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9-_]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();

	return `${normalizedName || 'cv-optimizado'}.${extension}`;
};

export const downloadTextFile = (fileName: string, content: string, mimeType: string): void => {
	const blob = new Blob([content], { type: mimeType });
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = objectUrl;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(objectUrl);
};

const buildDefaultTemplateCss = (selector: string): string => {
	return `
${selector} {
	line-height: 1.55;
	font-size: 15px;
	color: #41545c;
}
${selector} h1 {
	margin: 0;
	font-size: 35px;
	line-height: 1.15;
	color: #1a2a2f;
}
${selector} h2 {
	margin: 22px 0 9px;
	padding-bottom: 5px;
	border-bottom: 2px solid color-mix(in srgb, var(--cv-primary), white 65%);
	font-size: 16px;
	text-transform: uppercase;
	color: var(--cv-primary);
}
${selector} h3 {
	margin: 16px 0 5px;
	font-size: 15px;
	color: color-mix(in srgb, var(--cv-primary), #1a2a2f 52%);
}
${selector} p {
	margin: 6px 0;
}
${selector} section {
	margin-top: 12px;
	padding-left: 12px;
	border-left: 3px solid color-mix(in srgb, var(--cv-primary), white 76%);
}
${selector} ul,
${selector} ol {
	margin: 8px 0 11px;
	padding-left: 17px;
}
${selector} li {
	margin: 3px 0;
}
${selector} strong {
	color: #1a2a2f;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #0a3a35 18%);
	font-weight: 700;
	text-decoration: underline;
}
`;
};

const buildExecutiveTemplateCss = (selector: string): string => {
	return `
${selector} {
	line-height: 1.5;
	font-size: 14px;
	letter-spacing: 0.005em;
	color: #31424b;
}
${selector} h1 {
	margin: 0;
	font-size: 37px;
	line-height: 1.12;
	text-transform: uppercase;
	letter-spacing: 0.055em;
	color: #17262d;
}
${selector} h2 {
	margin: 24px 0 8px;
	padding: 0 0 4px;
	font-size: 12px;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	border-bottom: 1px solid color-mix(in srgb, var(--cv-primary), white 70%);
	color: color-mix(in srgb, var(--cv-primary), #12262d 30%);
}
${selector} h3 {
	margin: 14px 0 4px;
	font-size: 14px;
	color: #1f333b;
}
${selector} p {
	margin: 5px 0;
}
${selector} section {
	margin-top: 14px;
	padding-top: 9px;
	padding-left: 0;
	border-top: 1px solid color-mix(in srgb, var(--cv-primary), white 74%);
	border-left: 0;
}
${selector} ul,
${selector} ol {
	margin: 7px 0 10px;
	padding-left: 16px;
}
${selector} li {
	margin: 2px 0;
}
${selector} strong {
	font-weight: 800;
	color: #122028;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #13323d 38%);
	font-weight: 700;
	text-decoration: underline;
}
`;
};

const buildMinimalTemplateCss = (selector: string): string => {
	return `
${selector} {
	line-height: 1.48;
	font-size: 14px;
	color: #384852;
}
${selector} h1 {
	margin: 0;
	font-size: 34px;
	line-height: 1.16;
	font-weight: 800;
	color: #142229;
}
${selector} h2 {
	margin: 21px 0 7px;
	padding-bottom: 4px;
	font-size: 13px;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	border-bottom: 1px solid color-mix(in srgb, var(--cv-primary), white 72%);
	color: color-mix(in srgb, var(--cv-primary), #193740 28%);
}
${selector} h3 {
	margin: 12px 0 3px;
	font-size: 14px;
	color: #1f323a;
}
${selector} p {
	margin: 4px 0;
}
${selector} section {
	margin-top: 11px;
	padding-left: 8px;
	border-left: 2px solid color-mix(in srgb, var(--cv-primary), white 78%);
}
${selector} ul,
${selector} ol {
	margin: 6px 0 9px;
	padding-left: 15px;
}
${selector} li {
	margin: 2px 0;
}
${selector} strong {
	color: #142229;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #17353d 26%);
	font-weight: 700;
	text-decoration: underline;
}
`;
};

const buildSerifTemplateCss = (selector: string): string => {
	return `
${selector} {
	font-family: "Iowan Old Style", "Baskerville", "Times New Roman", serif;
	line-height: 1.62;
	font-size: 15px;
	color: #3b454d;
}
${selector} h1 {
	margin: 0;
	font-size: 36px;
	line-height: 1.14;
	letter-spacing: 0.01em;
	color: #1b2328;
}
${selector} h2 {
	margin: 23px 0 8px;
	padding-bottom: 5px;
	font-size: 15px;
	letter-spacing: 0.015em;
	text-transform: none;
	border-bottom: 1px solid color-mix(in srgb, var(--cv-primary), white 65%);
	color: color-mix(in srgb, var(--cv-primary), #1d2d33 42%);
}
${selector} h3 {
	margin: 14px 0 4px;
	font-size: 15px;
	color: #24323a;
}
${selector} p {
	margin: 6px 0;
}
${selector} section {
	margin-top: 13px;
	padding-left: 13px;
	border-left: 3px double color-mix(in srgb, var(--cv-primary), white 72%);
}
${selector} ul,
${selector} ol {
	margin: 7px 0 11px;
	padding-left: 18px;
}
${selector} li {
	margin: 3px 0;
}
${selector} strong {
	color: #1b2328;
	font-weight: 700;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #17363f 40%);
	font-weight: 600;
	text-decoration: underline;
}
`;
};

const buildTemplateCss = (selector: string, templateId: CvTemplateId): string => {
	switch (templateId) {
		case 'executive':
			return buildExecutiveTemplateCss(selector);
		case 'minimal':
			return buildMinimalTemplateCss(selector);
		case 'serif':
			return buildSerifTemplateCss(selector);
		case 'default':
		default:
			return buildDefaultTemplateCss(selector);
	}
};

export const buildExportCss = (
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const safeTemplateId = toCvTemplateId(templateId);
	return `
body {
	margin: 0;
	padding: 26px;
	font-family: "Manrope", "Avenir Next", "Segoe UI", sans-serif;
	color: #1a2a2f;
	background: #ffffff;
}
.cv-doc {
	font-family: "Manrope", "Avenir Next", "Segoe UI", sans-serif;
	color: #1a2a2f;
	--cv-primary: ${primaryColor};
}
${buildTemplateCss('.cv-doc', safeTemplateId)}
.cv-doc .cv-placeholder {
	display: inline-block;
	margin: 0 2px;
	padding: 2px 6px;
	border-radius: 6px;
	font-weight: 800;
	letter-spacing: 0.01em;
}
.cv-doc .cv-placeholder-critical {
	color: #9f1239;
	background: #ffe4e6;
	border: 1px solid #fb7185;
}
`;
};

export const buildHtmlExportDocument = (
	html: string,
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const safeEditorHtml = sanitizeCvHtml(html);
	const cvMarkup = `<article class="cv-doc">${safeEditorHtml}</article>`;
	return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CV optimizado</title>
  <style>${buildExportCss(primaryColor, templateId)}</style>
</head>
<body>
${cvMarkup}
</body>
</html>`;
};

export const buildPrintableHtml = (
	html: string,
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const safeEditorHtml = sanitizeCvHtml(html);
	return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CV optimizado</title>
  <style>${buildExportCss(primaryColor, templateId)}</style>
</head>
<body>
  <article class="cv-doc">${safeEditorHtml}</article>
</body>
</html>`;
};

export const openPrintPreview = (printableHtml: string): boolean => {
	const printableBlob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' });
	const printableUrl = URL.createObjectURL(printableBlob);
	const printWindow = window.open(printableUrl, '_blank');

	if (!printWindow) {
		URL.revokeObjectURL(printableUrl);
		return false;
	}

	const releasePrintableUrl = () => {
		URL.revokeObjectURL(printableUrl);
	};

	const triggerNativePrint = () => {
		printWindow.focus();
		try {
			printWindow.print();
		} catch (printError) {
			console.warn('No se pudo lanzar impresion automatica. Usa Cmd/Ctrl+P manualmente.', printError);
		}
	};

	printWindow.addEventListener(
		'load',
		() => {
			triggerNativePrint();
		},
		{ once: true }
	);
	printWindow.addEventListener(
		'afterprint',
		() => {
			releasePrintableUrl();
			printWindow.close();
		},
		{ once: true }
	);

	setTimeout(() => {
		releasePrintableUrl();
	}, 120000);

	return true;
};
