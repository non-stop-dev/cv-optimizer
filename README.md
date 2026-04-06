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

Set these variables in `.env`:

- `AI_PROVIDER`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`

## Run

```sh
pnpm dev
```
