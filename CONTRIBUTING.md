# Contribuir a CV Optimizer

Gracias por querer contribuir.

## Antes de abrir un PR

- Usa `Node.js 22.12.0` o superior.
- Usa `pnpm`.
- Crea tu `.env` a partir de `.env.example` si necesitas probar integración con IA.
- No subas secretos, API keys ni archivos `.env`.

## Configuración local

```sh
corepack enable pnpm
pnpm install
cp .env.example .env
pnpm dev
```

## Checklist mínimo

Antes de abrir un PR, ejecuta:

```sh
pnpm check
```

Eso corre:

- typecheck
- tests
- build

## Reglas del proyecto

- El stack de estilos preferido es `Tailwind CSS v4`.
- La organización del código debe seguir `Screaming Architecture`: dominios y casos de uso primero, no carpetas genéricas por capa técnica.
- La dirección visual del producto debe mantenerse en estilo `neobrutalism`; evita introducir UI genérica o visualmente neutra si rompe esa identidad.
- Mantén los archivos por debajo de `500` líneas.
- Si tocas una feature folder, actualiza su `README.md` cuando cambie la estructura o el flujo.
- Mantén el HTML semántico y la sanitización como fuente única de verdad.
- No introduzcas dependencias nuevas si no son realmente necesarias.
- No rompas la separación entre contenido generado y estilos de plantilla.

## Pull requests

- Describe claramente qué cambia y por qué.
- Si corriges un bug, añade o actualiza tests.
- Si cambias documentación o setup, verifica que el README siga siendo suficiente para alguien que no conoce el proyecto.
