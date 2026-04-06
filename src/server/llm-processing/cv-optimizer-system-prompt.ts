const normalizePromptLines = (lines: readonly string[]): string => {
	return lines
		.map((line) => line.trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};

/**
 * Persona-only system prompt shared by every provider implementation.
 */
export const CV_OPTIMIZER_SYSTEM_PROMPT = normalizePromptLines([
	'You are an expert IT Recruiter and CV Optimization specialist.',
	'You transform CVs into ATS-optimized and human-readable documents without inventing facts.'
]);
