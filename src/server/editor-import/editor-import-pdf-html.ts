import { sanitizeHtmlDocument } from '../llm-processing/upload/sanitizers/html';

const HEADING_PHRASES = [
	'perfil profesional',
	'experiencia laboral',
	'experiencia',
	'education',
	'educacion',
	'formacion academica',
	'formacion',
	'contacto',
	'contact',
	'habilidades',
	'skills',
	'idiomas',
	'languages',
	'certificaciones',
	'certifications',
	'proyectos',
	'projects',
	'resumen',
	'logros',
	'achievements',
	'sobre mi',
	'about me'
] as const;
const HEADING_KEYWORDS = new RegExp(HEADING_PHRASES.join('|'), 'i');
const BULLET_PREFIX = /^(?:[-*•●▪◦]|(?:\d+[\.\)]))\s+/;
const CONTROL_SPACES = /\s+/g;
const MONTH_NAME_PATTERN =
	'(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';
const DATE_RANGE_PATTERN = new RegExp(
	`\\b${MONTH_NAME_PATTERN}\\s+\\d{4}\\s*[-–]\\s*(?:actual|presente|${MONTH_NAME_PATTERN}\\s+\\d{4})\\b`,
	'i'
);
const PIPE_JOB_ENTRY_BREAK_PATTERN = new RegExp(
	`\\.\\s+(?=[A-ZÁÉÍÓÚÜÑ][^\\n.]{6,160}\\|\\s*${MONTH_NAME_PATTERN}\\s+\\d{4})`,
	'g'
);

const escapeHtml = (value: string): string => {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

const normalizeLine = (value: string): string => {
	return value.replace(CONTROL_SPACES, ' ').trim();
};

const toHeadingPattern = (): RegExp => {
	const escapedPhrases = HEADING_PHRASES.map((phrase) =>
		phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
	);

	return new RegExp(`\\b(${escapedPhrases.join('|')})\\b`, 'i');
};

const INLINE_HEADING_PATTERN = toHeadingPattern();

const isLikelyContactLine = (value: string): boolean => {
	return /@|https?:\/\/|www\.|linkedin|github|portfolio|tel(?:efo)?no|phone|\+?\d[\d\s()./-]{6,}/i.test(
		value
	);
};

const isLikelyTimelineLine = (value: string): boolean => {
	const normalizedValue = normalizeLine(value);
	return DATE_RANGE_PATTERN.test(normalizedValue);
};

const isLikelyHeading = (value: string, index: number): boolean => {
	const normalizedValue = normalizeLine(value).replace(/:$/, '');
	if (!normalizedValue || normalizedValue.length > 80) {
		return false;
	}

	if (isLikelyContactLine(normalizedValue)) {
		return false;
	}

	if (HEADING_KEYWORDS.test(normalizedValue)) {
		return true;
	}

	const lettersOnly = normalizedValue.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
	const wordCount = normalizedValue.split(/\s+/).filter(Boolean).length;
	if (
		index > 0 &&
		lettersOnly.length >= 4 &&
		normalizedValue === normalizedValue.toUpperCase() &&
		wordCount <= 6
	) {
		return true;
	}

	return normalizedValue.endsWith(':') && wordCount <= 6;
};

const isLikelyName = (value: string): boolean => {
	const normalizedValue = normalizeLine(value);
	const wordCount = normalizedValue.split(/\s+/).filter(Boolean).length;
	if (wordCount < 2 || wordCount > 6) {
		return false;
	}

	if (normalizedValue.length > 90 || isLikelyContactLine(normalizedValue) || /\d/.test(normalizedValue)) {
		return false;
	}

	return !HEADING_KEYWORDS.test(normalizedValue);
};

const isLikelyLabelValueLine = (value: string): boolean => {
	const match = normalizeLine(value).match(/^([^:]{1,32}):\s+(.+)$/);
	if (!match) {
		return false;
	}

	return !HEADING_KEYWORDS.test(match[1]);
};

const splitPipeSegments = (line: string): string[] => {
	const normalizedLine = normalizeLine(line).replace(/\s+I\s+/g, ' | ');
	if (!normalizedLine.includes(' | ') || isLikelyTimelineLine(normalizedLine)) {
		return [normalizedLine];
	}

	const segments = normalizedLine
		.split(' | ')
		.map((segment) => normalizeLine(segment))
		.filter(Boolean);
	if (segments.length <= 1) {
		return [normalizedLine];
	}

	const allSegmentsAreCompact =
		segments.length <= 4 && segments.every((segment) => segment.length <= 90);
	const allSegmentsAreContactual = segments.every(
		(segment) => isLikelyContactLine(segment) || isLikelyLabelValueLine(segment)
	);

	if (allSegmentsAreContactual || allSegmentsAreCompact) {
		return segments;
	}

	return [normalizedLine];
};

const splitLineAroundInlineHeadings = (line: string): string[] => {
	const normalizedLine = normalizeLine(line);
	if (!normalizedLine) {
		return [];
	}

	const fragments: string[] = [];
	let remaining = normalizedLine;

	while (remaining.length > 0) {
		const headingMatch = INLINE_HEADING_PATTERN.exec(remaining);
		INLINE_HEADING_PATTERN.lastIndex = 0;
		if (!headingMatch || headingMatch.index < 0) {
			fragments.push(remaining);
			break;
		}

		const headingIndex = headingMatch.index;
		const headingText = normalizeLine(headingMatch[0]).replace(/:$/, '');
		const beforeHeading = normalizeLine(remaining.slice(0, headingIndex));
		const afterHeading = normalizeLine(
			remaining.slice(headingIndex + headingMatch[0].length).replace(/^:\s*/, '')
		);

		if (beforeHeading) {
			fragments.push(beforeHeading);
		}

		fragments.push(headingText);
		remaining = afterHeading;

		if (!remaining) {
			break;
		}

		if (isLikelyHeading(remaining, fragments.length)) {
			fragments.push(remaining);
			break;
		}
	}

	return fragments.filter(Boolean);
};

const splitTimelineHeaderFromDescription = (line: string): string[] => {
	const normalizedLine = normalizeLine(line);
	if (!isLikelyTimelineLine(normalizedLine)) {
		return [normalizedLine];
	}

	const dateRangeMatch = normalizedLine.match(DATE_RANGE_PATTERN);
	if (!dateRangeMatch || typeof dateRangeMatch.index !== 'number') {
		return [normalizedLine];
	}

	const dateRangeStart = dateRangeMatch.index;
	const dateRangeEnd = dateRangeStart + dateRangeMatch[0].length;
	const afterDateRange = normalizeLine(normalizedLine.slice(dateRangeEnd));
	if (!afterDateRange) {
		return [normalizedLine];
	}

	const titleLine = normalizeLine(normalizedLine.slice(0, dateRangeEnd));
	return [titleLine, afterDateRange].filter(Boolean);
};

const splitEmbeddedTimelineEntries = (line: string): string[] => {
	const normalizedLine = normalizeLine(line);
	const dateMatches = Array.from(
		normalizedLine.matchAll(new RegExp(DATE_RANGE_PATTERN.source, 'ig'))
	);
	if (dateMatches.length < 2) {
		return [normalizedLine];
	}

	const secondDateMatch = dateMatches[1];
	if (typeof secondDateMatch.index !== 'number') {
		return [normalizedLine];
	}

	const splitStart = normalizedLine.lastIndexOf('. ', secondDateMatch.index);
	if (splitStart < 0) {
		return [normalizedLine];
	}

	const firstPart = normalizeLine(normalizedLine.slice(0, splitStart + 1));
	const secondPart = normalizeLine(normalizedLine.slice(splitStart + 1));
	return [firstPart, secondPart].filter(Boolean);
};

const normalizePdfTextForEditorStructure = (pdfText: string): string[] => {
	const normalizedText = pdfText
		.replace(/\s+I\s+/g, ' | ')
		.replace(PIPE_JOB_ENTRY_BREAK_PATTERN, '.\n');

	const sourceLines = normalizedText
		.split('\n')
		.map(normalizeLine)
		.filter(Boolean);
	const structuredLines: string[] = [];

	for (const sourceLine of sourceLines) {
		const headingFragments = splitLineAroundInlineHeadings(sourceLine);
		for (const headingFragment of headingFragments) {
			for (const timelineCandidate of splitEmbeddedTimelineEntries(headingFragment)) {
				const timelineFragments = splitTimelineHeaderFromDescription(timelineCandidate);
				for (const timelineFragment of timelineFragments) {
					for (const pipeFragment of splitPipeSegments(timelineFragment)) {
						if (pipeFragment) {
							structuredLines.push(pipeFragment);
						}
					}
				}
			}
		}
	}

	return structuredLines;
};

const renderParagraphText = (lines: string[]): string => {
	const mergedText = lines.reduce((accumulator, line) => {
		const normalizedLine = normalizeLine(line);
		if (!normalizedLine) {
			return accumulator;
		}

		if (!accumulator) {
			return normalizedLine;
		}

		if (accumulator.endsWith('-')) {
			return `${accumulator.slice(0, -1)}${normalizedLine}`;
		}

		return `${accumulator} ${normalizedLine}`;
	}, '');

	return escapeHtml(mergedText);
};

const renderLabelValueParagraph = (line: string): string => {
	const match = normalizeLine(line).match(/^([^:]{1,32}):\s+(.+)$/);
	if (!match) {
		return `<p>${escapeHtml(normalizeLine(line))}</p>`;
	}

	return `<p><strong>${escapeHtml(match[1])}:</strong> ${escapeHtml(match[2])}</p>`;
};

const renderBulletList = (lines: string[]): string => {
	const items = lines
		.map((line) => normalizeLine(line).replace(BULLET_PREFIX, '').trim())
		.filter(Boolean)
		.map((line) => `<li>${escapeHtml(line)}</li>`)
		.join('');

	return items ? `<ul>${items}</ul>` : '';
};

const renderTimelineHeading = (line: string): string => {
	return `<h3>${escapeHtml(normalizeLine(line))}</h3>`;
};

const renderNarrativeLines = (lines: string[]): string => {
	if (lines.length === 0) {
		return '';
	}

	if (lines.every(isLikelyLabelValueLine)) {
		return lines.map(renderLabelValueParagraph).join('');
	}

	if (lines.length <= 3 && lines.every(isLikelyContactLine)) {
		return lines
			.map((line) => `<p>${escapeHtml(normalizeLine(line))}</p>`)
			.join('');
	}

	if (lines.length >= 2 && lines.every((line) => normalizeLine(line).length <= 110)) {
		return lines
			.map((line) => `<p>${escapeHtml(normalizeLine(line))}</p>`)
			.join('');
	}

	return `<p>${renderParagraphText(lines)}</p>`;
};

const renderBlockContent = (lines: string[]): string => {
	const fragments: string[] = [];
	let paragraphLines: string[] = [];
	let bulletLines: string[] = [];

	const flushParagraph = (): void => {
		if (paragraphLines.length === 0) {
			return;
		}

		fragments.push(renderNarrativeLines(paragraphLines));
		paragraphLines = [];
	};

	const flushBullets = (): void => {
		if (bulletLines.length === 0) {
			return;
		}

		fragments.push(renderBulletList(bulletLines));
		bulletLines = [];
	};

	for (const line of lines) {
		if (isLikelyHeading(line, fragments.length + paragraphLines.length + bulletLines.length)) {
			flushParagraph();
			flushBullets();
			fragments.push(`<h2>${escapeHtml(normalizeLine(line).replace(/:$/, ''))}</h2>`);
			continue;
		}

		if (isLikelyTimelineLine(line)) {
			flushParagraph();
			flushBullets();
			fragments.push(renderTimelineHeading(line));
			continue;
		}

		if (BULLET_PREFIX.test(normalizeLine(line))) {
			flushParagraph();
			bulletLines.push(line);
			continue;
		}

		flushBullets();
		paragraphLines.push(line);
	}

	flushParagraph();
	flushBullets();

	return fragments.join('');
};

/**
 * Rebuilds lightweight semantic HTML from extracted PDF text so the browser
 * editor can open PDFs without routing through the optimization step.
 */
export const buildEditorHtmlFromPdfText = (pdfText: string): string => {
	const rawBlocks = normalizePdfTextForEditorStructure(pdfText)
		.join('\n')
		.split(/\n{2,}/)
		.map((block) => block.split('\n').map(normalizeLine).filter(Boolean))
		.filter((block) => block.length > 0);

	if (rawBlocks.length === 0) {
		return '';
	}

	const fragments: string[] = [];
	let sectionFragments: string[] = [];
	let blockCursor = 0;

	const flushSection = (): void => {
		if (sectionFragments.length === 0) {
			return;
		}

		fragments.push(`<section>${sectionFragments.join('')}</section>`);
		sectionFragments = [];
	};

	const firstBlock = rawBlocks[0];
	if (firstBlock && isLikelyName(firstBlock[0]) && !isLikelyHeading(firstBlock[0], 0)) {
		fragments.push(`<h1>${escapeHtml(firstBlock[0])}</h1>`);
		if (firstBlock.length > 1) {
			sectionFragments.push(renderBlockContent(firstBlock.slice(1)));
		}
		blockCursor = 1;
	}

	for (; blockCursor < rawBlocks.length; blockCursor += 1) {
		const block = rawBlocks[blockCursor];
		const [firstLine, ...remainingLines] = block;

		if (isLikelyHeading(firstLine, blockCursor)) {
			flushSection();
			sectionFragments.push(`<h2>${escapeHtml(firstLine.replace(/:$/, ''))}</h2>`);
			if (remainingLines.length > 0) {
				sectionFragments.push(renderBlockContent(remainingLines));
			}
			continue;
		}

		sectionFragments.push(renderBlockContent(block));
	}

	flushSection();
	return sanitizeHtmlDocument(fragments.join(''));
};
