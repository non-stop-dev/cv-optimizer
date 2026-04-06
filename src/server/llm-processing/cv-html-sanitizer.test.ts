// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { sanitizeCvHtml } from './cv-html-sanitizer';

describe('sanitizeCvHtml', () => {
	it('removes dangerous link protocols from anchor tags', () => {
		const sanitized = sanitizeCvHtml(
			'<a href="javascript:alert(1)">bad</a><a href="data:text/html,1">data</a>'
		);

		expect(sanitized).toBe('<a>bad</a><a>data</a>');
	});

	it('keeps allowed schemes and relative URLs', () => {
		const sanitized = sanitizeCvHtml(
			'<a href="https://example.com">external</a><a href="foo/bar">relative</a><a href="abc1">slug</a>'
		);

		expect(sanitized).toBe(
			'<a href="https://example.com">external</a><a href="foo/bar">relative</a><a href="abc1">slug</a>'
		);
	});
});
