# CV Optimizer

## Download

```sh
git clone https://github.com/non-stop-dev/cv-optimizer.git
```

## Open

```sh
cd cv-optimizer
```

## Install Node.js and pnpm

### macOS

```sh
brew install node pnpm
```

### Windows PowerShell

```powershell
winget install OpenJS.NodeJS.LTS pnpm.pnpm
```

### Linux

```sh
sudo apt update && sudo apt install -y nodejs npm && sudo npm install -g pnpm
```

## Install project dependencies

```sh
pnpm install
```

## Configure AI provider

```sh
cp .env.example .env
```

Use only one provider at a time in `.env`.

Do not mix:

- `AI_PROVIDER="gemini"` with `sk-or-...`
- `AI_PROVIDER="openrouter"` with `AIza...`
- a Gemini base URL with an OpenRouter model

Required variables:

- `AI_PROVIDER`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`

### Gemini example

```env
AI_PROVIDER="gemini"
AI_PROVIDER_API_KEY="AIza..."
AI_PROVIDER_MODEL="gemini-2.5-flash"
AI_PROVIDER_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"

AI_MAX_OUTPUT_TOKENS="10000"
AI_TEMPERATURE="0.7"
AI_TOP_P="0.95"
CODING_ENVIRONMENT="development"
```

### OpenRouter example

```env
AI_PROVIDER="openrouter"
AI_PROVIDER_API_KEY="sk-or-v1-..."
AI_PROVIDER_MODEL="qwen/qwen3.6-plus:free"
AI_PROVIDER_BASE_URL="https://openrouter.ai/api/v1"

AI_MAX_OUTPUT_TOKENS="10000"
AI_TEMPERATURE="0.7"
AI_TOP_P="0.95"
CODING_ENVIRONMENT="development"

AI_OPENROUTER_HTTP_REFERER="http://localhost:4321"
AI_OPENROUTER_TITLE="CV Optimizer"
```

## Run

```sh
pnpm dev
```
