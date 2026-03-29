import type { CvTemplateId } from './cv-template-options';

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
	text-wrap: balance;
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
	text-decoration-thickness: 1px;
	text-underline-offset: 2px;
}
`;
};

const buildExecutiveTemplateCss = (selector: string): string => {
	return `
${selector} {
	line-height: 1.5;
	font-size: 14px;
	letter-spacing: 0.004em;
	color: #31424b;
}
${selector} h1 {
	margin: 0 0 10px;
	padding-bottom: 10px;
	border-bottom: 3px solid color-mix(in srgb, var(--cv-primary), white 72%);
	font-size: 37px;
	line-height: 1.08;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: #17262d;
	text-wrap: balance;
}
${selector} h2 {
	display: inline-block;
	margin: 24px 0 10px;
	padding: 4px 10px;
	border: 1px solid color-mix(in srgb, var(--cv-primary), white 74%);
	border-radius: 999px;
	background: color-mix(in srgb, var(--cv-primary), white 92%);
	font-size: 11px;
	letter-spacing: 0.18em;
	text-transform: uppercase;
	color: color-mix(in srgb, var(--cv-primary), #12262d 34%);
}
${selector} h3 {
	margin: 14px 0 4px;
	font-size: 13px;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	color: #1d3038;
}
${selector} p {
	margin: 5px 0;
}
${selector} section {
	margin-top: 16px;
	padding-top: 12px;
	border-top: 1px solid color-mix(in srgb, var(--cv-primary), white 76%);
}
${selector} ul,
${selector} ol {
	margin: 8px 0 10px;
	padding-left: 18px;
}
${selector} li {
	margin: 2px 0;
}
${selector} ul li::marker,
${selector} ol li::marker {
	color: var(--cv-primary);
}
${selector} strong {
	font-weight: 800;
	letter-spacing: 0.01em;
	color: #122028;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #13323d 38%);
	font-weight: 700;
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 2px;
}
${selector} hr {
	margin: 14px 0;
	border: 0;
	border-top: 1px solid color-mix(in srgb, var(--cv-primary), white 74%);
}
`;
};

const buildMinimalTemplateCss = (selector: string): string => {
	return `
${selector} {
	line-height: 1.55;
	font-size: 14px;
	color: #314047;
}
${selector} h1 {
	margin: 0;
	font-size: 32px;
	line-height: 1.08;
	font-weight: 700;
	letter-spacing: -0.02em;
	color: #111b20;
	text-wrap: balance;
}
${selector} h2 {
	display: flex;
	align-items: center;
	gap: 12px;
	margin: 24px 0 10px;
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.22em;
	text-transform: uppercase;
	color: #122028;
}
${selector} h2::after {
	content: "";
	flex: 1;
	min-width: 24px;
	height: 1px;
	background: color-mix(in srgb, var(--cv-primary), white 72%);
}
${selector} h3 {
	margin: 12px 0 3px;
	font-size: 14px;
	font-weight: 700;
	color: #16242b;
}
${selector} p {
	margin: 4px 0;
	color: #41515a;
}
${selector} section {
	margin-top: 16px;
}
${selector} ul,
${selector} ol {
	margin: 6px 0 8px;
	padding-left: 16px;
}
${selector} li {
	margin: 2px 0;
	color: #41515a;
}
${selector} ul li::marker,
${selector} ol li::marker {
	color: color-mix(in srgb, var(--cv-primary), #24343c 35%);
}
${selector} strong {
	color: #111b20;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #14363f 28%);
	font-weight: 600;
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 2px;
}
${selector} hr {
	margin: 16px 0;
	border: 0;
	border-top: 1px solid color-mix(in srgb, var(--cv-primary), white 78%);
}
`;
};

const buildSerifTemplateCss = (selector: string): string => {
	return `
${selector} {
	font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Times New Roman", serif;
	line-height: 1.66;
	font-size: 15px;
	color: #3b444a;
}
${selector} h1 {
	margin: 0 0 6px;
	font-size: 36px;
	line-height: 1.08;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: #1c2328;
	text-wrap: balance;
}
${selector} h1 + p {
	margin-top: 7px;
	font-size: 14px;
	font-style: italic;
	color: #59656c;
}
${selector} h2 {
	margin: 24px 0 8px;
	padding-top: 8px;
	border-top: 1px solid color-mix(in srgb, var(--cv-primary), white 62%);
	font-size: 14px;
	font-weight: 700;
	font-variant-caps: small-caps;
	letter-spacing: 0.08em;
	color: color-mix(in srgb, var(--cv-primary), #203038 44%);
}
${selector} h3 {
	margin: 13px 0 4px;
	font-size: 15px;
	font-style: italic;
	font-weight: 600;
	color: #29343b;
}
${selector} p {
	margin: 6px 0;
}
${selector} section {
	margin-top: 14px;
}
${selector} ul,
${selector} ol {
	margin: 8px 0 11px;
	padding-left: 20px;
}
${selector} li {
	margin: 3px 0;
}
${selector} ul li::marker,
${selector} ol li::marker {
	color: color-mix(in srgb, var(--cv-primary), #3a4247 55%);
}
${selector} strong {
	color: #1b2328;
	font-weight: 700;
}
${selector} a {
	color: color-mix(in srgb, var(--cv-primary), #17363f 42%);
	font-weight: 600;
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 2px;
}
${selector} hr {
	margin: 16px 0;
	border: 0;
	border-top: 1px solid color-mix(in srgb, var(--cv-primary), white 68%);
}
`;
};

/**
 * Genera el CSS completo de la variante seleccionada para un selector concreto.
 */
export const buildCvTemplateCss = (selector: string, templateId: CvTemplateId): string => {
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
