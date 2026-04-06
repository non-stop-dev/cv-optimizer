import type {
	File as GeminiFile,
	GenerateContentParameters,
	GoogleGenAI
} from '@google/genai';
import { createPartFromUri, createUserContent } from '@google/genai';

import { AiProviderRequestError } from './ai-provider-errors';
import { buildOptimizeCvUserContent } from './ai-provider-openai-compatible-request';
import type { AiProviderRuntimeMetadata, AiSourceDocument } from './ai-provider-types';
import type { TargetPositions } from './upload/types';

const FILE_READY_POLL_INTERVAL_MS = 1000;
const FILE_READY_MAX_ATTEMPTS = 60;

interface OptimizeCvWithGeminiNativePdfParams {
	client: GoogleGenAI;
	model: string;
	systemPrompt: string;
	content: string;
	targetPositions: TargetPositions;
	sourceDocument: AiSourceDocument;
	logDevelopment: (title: string, payload: string) => void;
	runtimeMetadata: AiProviderRuntimeMetadata;
}

const wait = async (ms: number): Promise<void> => {
	await new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

const waitForUploadedFileToBecomeActive = async (
	client: GoogleGenAI,
	fileName: string
): Promise<GeminiFile> => {
	for (let attempt = 1; attempt <= FILE_READY_MAX_ATTEMPTS; attempt += 1) {
		const file = await client.files.get({ name: fileName });
		if (file.state === 'ACTIVE') {
			return file;
		}

		if (file.state === 'FAILED') {
			throw new AiProviderRequestError(
				typeof file.error?.message === 'string' && file.error.message.trim().length > 0
					? file.error.message
					: 'El proveedor Gemini no pudo procesar el PDF subido.'
			);
		}

		if (attempt < FILE_READY_MAX_ATTEMPTS) {
			await wait(FILE_READY_POLL_INTERVAL_MS);
		}
	}

	throw new AiProviderRequestError('El PDF tardó demasiado en estar listo para procesamiento nativo.');
};

const uploadPdfForNativeProcessing = async (
	client: GoogleGenAI,
	sourceDocument: AiSourceDocument
): Promise<GeminiFile> => {
	let uploadedFile: GeminiFile;
	try {
		uploadedFile = await client.files.upload({
			file: sourceDocument.file,
			config: {
				displayName: sourceDocument.file.name || 'cv.pdf',
				mimeType: sourceDocument.mimeType || 'application/pdf'
			}
		});
	} catch (error) {
		throw new AiProviderRequestError(
			'No se pudo subir el PDF al Files API de Gemini para procesamiento nativo.',
			error
		);
	}

	if (!uploadedFile.name) {
		throw new AiProviderRequestError(
			'La subida del PDF no devolvio un identificador de archivo valido.'
		);
	}

	if (uploadedFile.state === 'ACTIVE') {
		return uploadedFile;
	}

	return waitForUploadedFileToBecomeActive(client, uploadedFile.name);
};

/**
 * Uses Gemini Files API for the PDF-native optimization path while keeping the public service generic.
 */
export const optimizeCvWithGeminiNativePdf = async ({
	client,
	model,
	systemPrompt,
	content,
	targetPositions,
	sourceDocument,
	logDevelopment,
	runtimeMetadata
}: OptimizeCvWithGeminiNativePdfParams): Promise<string> => {
	const userContent = buildOptimizeCvUserContent(content, targetPositions, true);
	let uploadedPdfName: string | null = null;

	logDevelopment(
		'Gemini PDF native request metadata',
		JSON.stringify(
			{
				codingEnvironment: runtimeMetadata.codingEnvironment,
				provider: runtimeMetadata.provider,
				model,
				rawContentLength: content.length,
				normalizedContentLength: userContent.length,
				maxOutputTokens: runtimeMetadata.maxOutputTokens,
				temperature: runtimeMetadata.temperature,
				topP: runtimeMetadata.topP,
				targetPositions,
				targetPositionsCount: targetPositions.length,
				hasPdfAttachment: true
			},
			null,
			2
		)
	);
	logDevelopment('System prompt', systemPrompt);
	logDevelopment('Content sent to AI', userContent);

	try {
		const uploadedPdf = await uploadPdfForNativeProcessing(client, sourceDocument);
		uploadedPdfName = uploadedPdf.name ?? null;

		if (!uploadedPdf.uri || !uploadedPdf.mimeType) {
			throw new AiProviderRequestError(
				'No se recibio una URI valida del PDF subido para Gemini.'
			);
		}

		const request: GenerateContentParameters = {
			model,
			contents: [
				createUserContent([createPartFromUri(uploadedPdf.uri, uploadedPdf.mimeType), userContent])
			],
			config: {
				systemInstruction: systemPrompt,
				maxOutputTokens: runtimeMetadata.maxOutputTokens,
				temperature: runtimeMetadata.temperature,
				topP: runtimeMetadata.topP
			}
		};

		const result = await client.models.generateContent(request);
		const text = result.text?.trim();
		if (!text) {
			throw new AiProviderRequestError('La IA no devolvio contenido util para el CV.');
		}

		logDevelopment('Gemini PDF native usage metadata', JSON.stringify(result.usageMetadata ?? {}, null, 2));
		logDevelopment('AI response', text);
		return text;
	} finally {
		if (uploadedPdfName) {
			try {
				await client.files.delete({ name: uploadedPdfName });
			} catch (error) {
				logDevelopment(
					'Gemini PDF cleanup warning',
					error instanceof Error ? error.message : 'No se pudo eliminar el archivo temporal.'
				);
			}
		}
	}
};
