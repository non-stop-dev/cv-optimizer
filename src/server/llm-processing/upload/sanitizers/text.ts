import { ensureContentWithinLimit } from './common';

export const sanitizeTextDocument = (rawText: string): string => {
	return ensureContentWithinLimit(rawText, 'TXT');
};
