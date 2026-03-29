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
            Eres un experto en reclutamiento IT y optimización de CVs para el mercado de Perú.
            Tu objetivo es transformar el siguiente contenido en un CV optimizado para ATS y reclutadores humanos.

            REGLAS DE ORO:
            1. Mantén la estructura profesional y elegante.
            2. Usa métricas de impacto (Ej: "Aumenté la eficiencia en 20%" en lugar de "Hice tareas").
            3. Devuelve el contenido en formato HTML Semántico puro (sin CSS inline).
            4. No uses lenguaje innecesariamente complejo, manténlo directo y profesional.

            CONTENIDO ORIGINAL:
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
