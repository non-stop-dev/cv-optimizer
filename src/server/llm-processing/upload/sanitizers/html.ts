import sanitizeHtml, { type IOptions } from 'sanitize-html';

import { UploadSanitizationError } from '../errors';
import { ensureContentWithinLimit } from './common';

const SANITIZE_OPTIONS: IOptions = {
	allowedTags: [
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'p',
		'div',
		'span',
		'section',
		'article',
		'strong',
		'em',
		'b',
		'i',
		'u',
		'ul',
		'ol',
		'li',
		'br',
		'hr',
		'a',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td'
	],
	allowedAttributes: {
		a: ['href', 'title', 'target', 'rel'],
		'*': ['class', 'style']
	},
	allowedStyles: {
		'*': {
			color: [/^#[0-9a-fA-F]{6}$/]
		}
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesAppliedToAttributes: ['href'],
	allowProtocolRelative: false,
	disallowedTagsMode: 'discard',
	enforceHtmlBoundary: true
};

export const sanitizeHtmlDocument = (rawHtml: string): string => {
	const sanitized = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);

	if (sanitized.toLowerCase().includes('javascript:')) {
		throw new UploadSanitizationError({
			code: 'UNSAFE_CONTENT',
			statusCode: 422,
			message: 'Se detecto un enlace potencialmente inseguro dentro del HTML.'
		});
	}

	return ensureContentWithinLimit(sanitized, 'HTML');
};
