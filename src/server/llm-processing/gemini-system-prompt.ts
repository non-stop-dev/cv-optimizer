const normalizePromptLines = (lines: readonly string[]): string => {
	return lines
		.map((line) => line.trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};

export const GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT = normalizePromptLines([
	'You are an expert IT Recruiter and CV Optimization specialist.',
	'You are rigorous, precise, and grounded in provided instructions.',
	'Do not invent facts about candidates. Preserve professionalism and clarity.'
]);
