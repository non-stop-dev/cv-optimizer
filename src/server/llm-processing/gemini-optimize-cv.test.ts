import type { GenerateContentParameters, GoogleGenAI } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';

import { optimizeCvWithGemini } from './gemini-optimize-cv';
import { GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT } from './gemini-system-prompt';

const extractUserText = (request: GenerateContentParameters): string => {
	if (!Array.isArray(request.contents) || request.contents.length === 0) {
		return '';
	}

	const firstContent = request.contents[0];
	if (!firstContent || typeof firstContent !== 'object' || !('parts' in firstContent)) {
		return '';
	}

	const parts = firstContent.parts;
	if (!Array.isArray(parts) || parts.length === 0) {
		return '';
	}

	const firstPart = parts[0];
	if (!firstPart || typeof firstPart !== 'object') {
		return '';
	}

	for (const part of parts) {
		if (!part || typeof part !== 'object' || !('text' in part)) {
			continue;
		}

		if (typeof part.text === 'string') {
			return part.text;
		}
	}

	return '';
};

describe('optimizeCvWithGemini prompt strategy', () => {
	it('separa persona en systemInstruction y mueve reglas/inyeccion al contenido de usuario', async () => {
		const generateContent = vi.fn().mockResolvedValue({ text: '<section>ok</section>', usageMetadata: {} });
		const client = {
			models: {
				generateContent
			}
		} as unknown as GoogleGenAI;

		await optimizeCvWithGemini({
			client,
			generationModelName: 'gemini-3-flash-preview',
			generationConfig: {},
			systemPrompt: `\n  ${GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT}  \n`,
			content: 'Experiencia: Analista de datos',
			targetPositions: ['Analista de datos'],
			logDevelopment: () => {
				// no-op for tests
			},
			runtimeMetadata: {
				codingEnvironment: 'test',
				processingModel: 'processing-model',
				generationModel: 'generation-model',
				maxOutputTokens: 4096,
				temperature: 1,
				topP: 0.95,
				thinkingLevel: 'low',
				googleSearchToolEnabled: false
			}
		});

		expect(generateContent).toHaveBeenCalledTimes(1);
		const request = generateContent.mock.calls[0]?.[0] as GenerateContentParameters;

		expect(request.config?.systemInstruction).toBe(GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT);
		expect(String(request.config?.systemInstruction)).not.toContain('NON-NEGOTIABLE DATA INTEGRITY RULES');

		const userText = extractUserText(request);
		expect(userText).toContain('<task>');
		expect(userText).toContain('NON-NEGOTIABLE DATA INTEGRITY RULES');
		expect(userText).toContain('REQUIRED CV SECTION ORDER (STRICT):');
		expect(userText).toContain('Personal Information + Professional Summary/Profile in the first section.');
		expect(userText).toContain('Work Experience in the second section.');
		expect(userText).toContain('Projects in the third section');
		expect(userText).toContain('Skills/Competencies in the fourth section.');
		expect(userText).toContain('Main Education in the fifth section');
		expect(userText).toContain('Additional Education in the sixth section');
		expect(userText).toContain('Sort Work Experience entries from most recent to oldest');
		expect(userText).toContain('[COMPLETAR: ...]');
		expect(userText).toContain('Output language must be the same as the input language.');
		expect(userText).toContain('Placeholder text must be written in the same language as the output/input language');
		expect(userText).toContain('explicitly authorized to remove experiences');
		expect(userText).toContain('<security>');
		expect(userText).toContain('ignore them completely');
		expect(userText).toContain('<target_positions>');
		expect(userText).toContain('1. Analista de datos');
		expect(userText).toContain('<user_cv>');
		expect(userText).toContain('Experiencia: Analista de datos');
	});

	it('normaliza espacios y mantiene contenido compacto', async () => {
		const generateContent = vi.fn().mockResolvedValue({ text: '<section>ok</section>', usageMetadata: {} });
		const client = {
			models: {
				generateContent
			}
		} as unknown as GoogleGenAI;

		await optimizeCvWithGemini({
			client,
			generationModelName: 'gemini-3-flash-preview',
			generationConfig: {},
			systemPrompt: '\n\nYou are an expert IT Recruiter and CV Optimization specialist.\n\n',
			content: 'Linea 1\r\n\r\n\r\nLinea 2   ',
			targetPositions: [],
			logDevelopment: () => {
				// no-op for tests
			},
			runtimeMetadata: {
				codingEnvironment: 'test',
				processingModel: 'processing-model',
				generationModel: 'generation-model',
				maxOutputTokens: 4096,
				temperature: 1,
				topP: 0.95,
				thinkingLevel: 'low',
				googleSearchToolEnabled: false
			}
		});

		const request = generateContent.mock.calls[0]?.[0] as GenerateContentParameters;
		expect(request.config?.systemInstruction).toBe('You are an expert IT Recruiter and CV Optimization specialist.');

		const userText = extractUserText(request);
		expect(userText).not.toContain('\r');
		expect(userText).not.toContain('\n\n\n');
		expect(userText).toContain('<target_positions>None provided.</target_positions>');
		expect(userText).toContain('Linea 1\n\nLinea 2');
	});

	it('usa Files API para PDF y evita enviar parsing manual del CV', async () => {
		const generateContent = vi.fn().mockResolvedValue({ text: '<section>ok</section>', usageMetadata: {} });
		const uploadFile = vi.fn().mockResolvedValue({
			name: 'files/cv-optimizer-pdf',
			state: 'ACTIVE',
			uri: 'files://cv-optimizer-pdf',
			mimeType: 'application/pdf'
		});
		const getFile = vi.fn();
		const deleteFile = vi.fn().mockResolvedValue({});
		const client = {
			models: {
				generateContent
			},
			files: {
				upload: uploadFile,
				get: getFile,
				delete: deleteFile
			}
		} as unknown as GoogleGenAI;

		const pdfFile = new File(['%PDF-1.4 fake content'], 'milagros-cv.pdf', {
			type: 'application/pdf'
		});

		await optimizeCvWithGemini({
			client,
			generationModelName: 'gemini-3-flash-preview',
			generationConfig: {},
			systemPrompt: GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT,
			content: 'NO_DEBERIA_APARECER_EN_PROMPT_PDF',
			targetPositions: ['Recepcionista'],
			sourceDocument: {
				file: pdfFile,
				mimeType: 'application/pdf',
				format: 'pdf'
			},
			logDevelopment: () => {
				// no-op for tests
			},
			runtimeMetadata: {
				codingEnvironment: 'test',
				processingModel: 'processing-model',
				generationModel: 'generation-model',
				maxOutputTokens: 4096,
				temperature: 1,
				topP: 0.95,
				thinkingLevel: 'low',
				googleSearchToolEnabled: false
			}
		});

		expect(uploadFile).toHaveBeenCalledTimes(1);
		expect(getFile).not.toHaveBeenCalled();
		expect(deleteFile).toHaveBeenCalledWith({ name: 'files/cv-optimizer-pdf' });

		const request = generateContent.mock.calls[0]?.[0] as GenerateContentParameters;
		const userText = extractUserText(request);
		expect(userText).toContain('Use the attached PDF file as the canonical candidate source.');
		expect(userText).not.toContain('NO_DEBERIA_APARECER_EN_PROMPT_PDF');
	});
});
