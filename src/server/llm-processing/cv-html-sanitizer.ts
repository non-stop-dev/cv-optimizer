import DOMPurify from 'dompurify';

const CV_SANITIZE_CONFIG = {
	ALLOWED_TAGS: [
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
	ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
	ALLOW_DATA_ATTR: false,
	ALLOW_UNKNOWN_PROTOCOLS: false,
	ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
};

export const sanitizeCvHtml = (html: string): string => {
	if (typeof html !== 'string' || html.length === 0) {
		return '';
	}

	return DOMPurify.sanitize(html, CV_SANITIZE_CONFIG);
};
