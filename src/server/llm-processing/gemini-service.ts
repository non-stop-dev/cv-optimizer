import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';

/**
 * Singleton para gestionar la conexión con Gemini (Vertex AI / Google AI SDK)
 */
class GeminiService {
	private static instance: GeminiService;
	private ai: GoogleGenAI;
	private modelName = 'gemini-3-flash-preview';

	private constructor() {
		const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;

		if (!apiKey) {
			console.warn('⚠️ GEMINI_API_KEY no configurada. Las llamadas a la IA fallarán.');
		}

		this.ai = new GoogleGenAI({
			apiKey: apiKey ?? ''
		});
	}

	public static getInstance(): GeminiService {
		if (!GeminiService.instance) {
			GeminiService.instance = new GeminiService();
		}
		return GeminiService.instance;
	}

	/**
	 * Configuración base para optimización de CV
	 */
	private getGenerationConfig() {
		return {
			maxOutputTokens: 65535,
			temperature: 0.6,
			topP: 0.95,
			thinkingConfig: {
				thinkingLevel: 'MEDIUM'
			},
			safetySettings: [
				{ category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
				{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
				{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
				{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
			],
			tools: [{ googleSearch: {} }]
		};
	}

	/**
	 * Procesa el contenido del CV para optimizarlo
	 * @param content Texto sanitizado del CV
	 */
	public async optimizeCV(content: string) {
		const prompt = `
            You are an expert IT Recruiter and CV Optimization specialist. Your goal is to transform the following content into a CV optimized for both ATS (Applicant Tracking Systems) and human recruiters, making it attractive for AI-based recruitment algorithms and easily scannable for the human eye.

            GOLDEN RULES:
            1. Maintain a professional and elegant structure. It must sound natural, avoiding "AI-written" patterns, redundancies, or empty verbosity. Every sentence must add concrete value.
            2. Use impact metrics ONLY if they are available in the base curriculum; NEVER invent data. (e.g., "Increased efficiency by 20%" instead of "Improved efficiency" or "Did X thing").
            3. Return the content in pure Semantic HTML format (NO inline CSS, NO style tags). Use tags like <header>, <section>, <h1>, <h2>, <h3>, <ul>, <li>, <p>, etc.
            4. Do not use unnecessarily complex language; keep it direct, impactful, and professional.
            5. Include clear semantic headers for: "Work Experience", "Education", "Skills", "Projects", and "Summary/Profile".
            6. Start bullet points with strong action verbs: Led, Developed, Achieved, Spearheaded, Optimized.
            7. Embed industry-specific keywords relevant to the candidate's target role naturally within the text rather than just listing them in a separate section.
            8. Aim for a length equivalent to 1-2 pages (approx. 400-800 words).
            9. Use clear bullet points to list achievements and specific responsibilities.
            10. Output language: same as the input content.

            ORIGINAL CONTENT:
            ${content}
        `;

		try {
			const req: GenerateContentParameters = {
				model: this.modelName,
				contents: [{ role: 'user', parts: [{ text: prompt }] }],
				config: this.getGenerationConfig() as any
			};

			const result = await this.ai.models.generateContent(req);
			const candidates = (result as any).candidates;
			const text = candidates?.[0]?.content?.parts?.[0]?.text;
			return text ?? '';
		} catch (error) {
			console.error('❌ Error llamando a Gemini:', error);
			throw new Error('No se pudo procesar el CV con la IA.', { cause: error });
		}
	}
}

export const gemini = GeminiService.getInstance();
