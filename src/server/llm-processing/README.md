# LLM Processing

This folder contains the server-side AI integration for CV optimization and HTML translation.

## Main entry point

- [`ai-provider-service.ts`](./ai-provider-service.ts): provider-neutral facade used by `/api/upload` and `/api/translate`.

## File guide

- [`ai-provider-config.ts`](./ai-provider-config.ts): reads env vars, validates provider selection, resolves base URLs, and exposes the shared runtime config.
- [`ai-provider-openai-compatible-client.ts`](./ai-provider-openai-compatible-client.ts): runs the shared OpenAI-compatible `chat.completions` requests.
- [`ai-provider-openai-compatible-request.ts`](./ai-provider-openai-compatible-request.ts): builds shared prompts, messages, PDF file parts, and optional structured output settings.
- [`ai-provider-gemini-native-pdf.ts`](./ai-provider-gemini-native-pdf.ts): keeps Gemini’s native Files API PDF flow behind the generic facade.
- [`pdf-processing/README.md`](/Users/leonardoleon/developer-stuff/cv-optimizer/src/server/llm-processing/pdf-processing/README.md): documents native PDF processing, extraction quality gates, and fallback rules.
- [`cv-optimizer-system-prompt.ts`](./cv-optimizer-system-prompt.ts): provider-neutral system prompt persona for CV optimization.

## Provider switching

Use `.env` or server env vars only:

- `AI_PROVIDER=openai`
- `AI_PROVIDER=gemini`
- `AI_PROVIDER=openrouter`

Required variables:

- `AI_PROVIDER`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`

Optional variables:

- `AI_PROVIDER_BASE_URL`
- `AI_TEMPERATURE`
- `AI_MAX_OUTPUT_TOKENS`
- `AI_TOP_P`
- `AI_OPENROUTER_HTTP_REFERER`
- `AI_OPENROUTER_TITLE`

## Data flow

```mermaid
flowchart TD
    Upload["/api/upload or /api/translate"] --> Facade["ai-provider-service.ts"]
    Facade --> Shared["OpenAI-compatible chat builder/client"]
    Facade --> GeminiPdf["Gemini native PDF adapter"]
    Facade --> PdfFallback["Validated PDF text fallback workflow"]
    Shared --> Providers["OpenAI | Gemini OpenAI endpoint | OpenRouter"]
    GeminiPdf --> Gemini["Gemini Files API + generateContent"]
    PdfFallback --> PdfExtract["Page-by-page extraction + quality gates"]
    PdfExtract --> Providers
```

## Important behavior

- Browser translation still runs first in the client; the server provider is only the fallback.
- The remote translation fallback reuses `AI_PROVIDER_MODEL`; there is no separate translation model env var anymore.
- Gemini-specific naming from the previous integration was removed from the public service layer.
- PDF handling is provider-aware:
  - `gemini`: native Files API branch first, then validated text fallback when the failure is explicitly file/PDF-related
  - `openai` and `openrouter`: OpenAI-compatible file content parts first, then validated text fallback when the failure is explicitly file/PDF-related
- Generic provider failures do not trigger PDF fallback.
- If extracted PDF text looks incomplete or unreliable, the workflow fails with an explicit no-OCR error instead of sending partial text to the LLM.
- There is no provider fallback chain. Missing env vars or unsupported models return explicit errors.
