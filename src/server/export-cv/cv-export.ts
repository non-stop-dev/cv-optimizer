import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import { buildCvTemplateCss } from '../../styles/cv-templates/cv-template-css';
import { buildPrintableEditablePayloadBlock } from './cv-printable-editable-payload';
import {
	CV_TEMPLATE_OPTIONS,
	DEFAULT_CV_TEMPLATE_ID,
	isCvTemplateId,
	toCvTemplateId,
	type CvTemplateId
} from '../../styles/cv-templates/cv-template-options';

export {
	CV_TEMPLATE_OPTIONS,
	DEFAULT_CV_TEMPLATE_ID,
	isCvTemplateId,
	toCvTemplateId,
	type CvTemplateId
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
${buildCvTemplateCss('.cv-doc', safeTemplateId)}
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
.cv-editable-payload {
	margin: 0;
	padding: 0;
	font-size: 0.8px;
	line-height: 0.85;
	letter-spacing: 0;
	word-break: break-all;
	white-space: pre-wrap;
	color: #ffffff;
	opacity: 0.01;
}
@media screen {
	.cv-editable-payload {
		display: none !important;
	}
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

export const buildPrintableHtmlSimple = (
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

export const buildPrintableHtmlEditable = (
	html: string,
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const safeEditorHtml = sanitizeCvHtml(html);
	const printablePayloadBlock = buildPrintableEditablePayloadBlock(
		safeEditorHtml,
		primaryColor,
		templateId
	);
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
  ${printablePayloadBlock}
</body>
</html>`;
};

export const buildWordExportDocument = (
	html: string,
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const safeEditorHtml = sanitizeCvHtml(html);
	return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="CV Optimizer" />
  <meta name="Originator" content="CV Optimizer" />
  <title>CV optimizado</title>
  <style>
    ${buildExportCss(primaryColor, templateId)}
    @page {
      size: A4;
      margin: 1.7cm;
    }
  </style>
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
