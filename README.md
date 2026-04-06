# CV Optimizer

Aplicación local-first para optimizar y editar CVs con `OpenAI`, `Gemini` o `OpenRouter`.

https://github.com/user-attachments/assets/d872ef2a-b064-4cca-b9df-f42b408d0162

La idea del proyecto es simple:

- clonas o descargas el repo
- lo ejecutas en tu ordenador
- configuras tu propia API key
- subes tu CV
- editas el resultado en el navegador

Licencia: [Apache-2.0](./LICENSE)

## Qué hace

- Acepta CVs en `PDF`, `HTML`, `TXT`, `YAML` y `YML`.
- Sanitiza el contenido antes de enviarlo al proveedor de IA.
- Genera HTML semántico editable.
- Mantiene historial local en el navegador para seguir editando.
- Permite exportar a `HTML`, `TXT` y vista de impresión para `PDF`.
- Soporta `OpenAI`, `Gemini` y `OpenRouter`.

## Requisitos

- `Node.js 22.12.0` o superior
- `pnpm`
- una API key de `OpenAI`, `Gemini` o `OpenRouter`

## Recomendaciones importantes

- Se recomienda usar `Google Chrome`.
- El proyecto usa APIs del navegador y almacenamiento local del navegador, y el flujo ha sido probado solo en `Chrome`.
- El proyecto ha sido probado mayormente con API keys de prueba de `Gemini` desde `GCP (Google Cloud Platform)`.
- `OpenAI` y `OpenRouter` están soportados, pero en la práctica pueden presentar una tasa de errores mayor porque han sido menos probados en este repo.

## Instalación paso a paso

### 1. Descarga el proyecto

Si usas Git:

```sh
git clone https://github.com/non-stop-dev/cv-optimizer.git
cd cv-optimizer
```

Si no usas Git:

1. Descarga el repositorio como ZIP desde GitHub.
2. Descomprímelo.
3. Abre una terminal dentro de la carpeta.
4. Entra al proyecto con:

```sh
cd cv-optimizer
```

### 2. Instala Node.js

Instala una versión LTS moderna de Node.js y comprueba que quedó bien:

```sh
node --version
```

Debe devolver `22.12.0` o superior.

### 3. Activa `pnpm`

Con Node moderno, normalmente basta con:

```sh
corepack enable pnpm
pnpm --version
```

### 4. Instala dependencias

```sh
pnpm install
```

### 5. Crea tu `.env`

```sh
cp .env.example .env
```

Importante:

- `.env` no debe subirse al repositorio.
- `.env.example` sí está pensado para versionarse.
- usa solo un proveedor a la vez
- no mezcles API keys, modelos o base URLs entre proveedores

## Configuración del proveedor de IA

Abre `.env` y deja activa solo una plantilla.

Variables obligatorias:

- `AI_PROVIDER`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`

Variables comunes:

- `AI_MAX_OUTPUT_TOKENS`
- `AI_TEMPERATURE`
- `AI_TOP_P`
- `CODING_ENVIRONMENT`

Variables extra para OpenRouter:

- `AI_OPENROUTER_HTTP_REFERER`
- `AI_OPENROUTER_TITLE`

### Plantilla OpenAI

```env
AI_MAX_OUTPUT_TOKENS="10000"
AI_TEMPERATURE="0.7"
AI_TOP_P="0.95"
CODING_ENVIRONMENT="development"

AI_PROVIDER="openai"
AI_PROVIDER_API_KEY="PASTE_YOUR_OPENAI_API_KEY_HERE"
AI_PROVIDER_MODEL="PASTE_OPENAI_MODEL_NAME_HERE"
AI_PROVIDER_BASE_URL="https://api.openai.com/v1"
```

Ejemplos de modelo:

- `gpt-4o-mini`
- `gpt-4.1-mini`

### Plantilla Gemini

```env
AI_MAX_OUTPUT_TOKENS="10000"
AI_TEMPERATURE="0.7"
AI_TOP_P="0.95"
CODING_ENVIRONMENT="development"

AI_PROVIDER="gemini"
AI_PROVIDER_API_KEY="PASTE_YOUR_GEMINI_API_KEY_HERE"
AI_PROVIDER_MODEL="PASTE_GEMINI_MODEL_NAME_HERE"
AI_PROVIDER_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"
```

Ejemplos de modelo:

- `gemini-2.5-flash`
- `gemini-2.5-pro`

### Plantilla OpenRouter

```env
AI_MAX_OUTPUT_TOKENS="10000"
AI_TEMPERATURE="0.7"
AI_TOP_P="0.95"
CODING_ENVIRONMENT="development"

AI_PROVIDER="openrouter"
AI_PROVIDER_API_KEY="PASTE_YOUR_OPENROUTER_API_KEY_HERE"
AI_PROVIDER_MODEL="PASTE_OPENROUTER_MODEL_NAME_HERE"
AI_PROVIDER_BASE_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER_HTTP_REFERER="http://localhost:4321"
AI_OPENROUTER_TITLE="CV Optimizer"
```

Ejemplos de modelo:

- `openai/gpt-4o-mini`
- `qwen/qwen3.6-plus:free`

## Ejecutar la app

```sh
pnpm dev
```

Luego abre:

[http://localhost:4321](http://localhost:4321)

## Comandos útiles

```sh
pnpm dev
```

Levanta la aplicación en local.

```sh
pnpm test
```

Ejecuta los tests.

```sh
pnpm build
```

Construye la app para producción.

```sh
pnpm exec astro check
```

Ejecuta validación de Astro y TypeScript.

## Flujo básico de uso

1. Arranca la app con `pnpm dev`.
2. Abre `http://localhost:4321`.
3. Sube tu CV.
4. Espera a que termine la optimización.
5. Edita el contenido directamente en el navegador.
6. Exporta a HTML, TXT o abre la vista de impresión para PDF.

## Límites actuales

- tamaño máximo por archivo: `10 MB`
- máximo de páginas PDF: `35`
- máximo de posiciones objetivo: `3`
- la exportación PDF actual usa impresión del navegador; no hay todavía un exportador automático de servidor

## Solución rápida de problemas

### `pnpm: command not found`

Ejecuta:

```sh
corepack enable pnpm
```

### `AI_NOT_CONFIGURED`

Revisa que en `.env` existan:

- `AI_PROVIDER`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`

### El modelo no existe o no es compatible

Tu API key puede ser válida, pero el modelo no corresponde con el proveedor configurado. Revisa `AI_PROVIDER_MODEL`.

### El puerto `4321` ya está ocupado

Prueba:

```sh
pnpm dev -- --port 4322
```

Y abre [http://localhost:4322](http://localhost:4322).

## Estructura del proyecto

- [`AGENTS.md`](./AGENTS.md)
- [`src/server/llm-processing/README.md`](./src/server/llm-processing/README.md)
- [`src/server/llm-processing/pdf-processing/README.md`](./src/server/llm-processing/pdf-processing/README.md)
- [`src/server/browser-memory/README.md`](./src/server/browser-memory/README.md)
- [`src/server/export-cv/README.md`](./src/server/export-cv/README.md)
- [`src/server/text-editor/README.md`](./src/server/text-editor/README.md)
- [`src/styles/cv-templates/README.md`](./src/styles/cv-templates/README.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)

## Contribuir

Si quieres contribuir, revisa primero [CONTRIBUTING.md](./CONTRIBUTING.md).

## Seguridad

Si encuentras un problema de seguridad, revisa [SECURITY.md](./SECURITY.md).
