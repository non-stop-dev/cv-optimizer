# Security Policy

## Alcance

Este proyecto procesa documentos de usuario y se integra con proveedores externos de IA, así que los reportes de seguridad son relevantes sobre todo en estas áreas:

- sanitización de archivos subidos
- manejo de HTML generado
- almacenamiento local en el navegador
- integración con proveedores de IA
- exposición accidental de secretos o credenciales

## Cómo reportar un problema

- No publiques secretos, API keys, tokens ni payloads sensibles en issues públicos.
- Si GitHub Private Vulnerability Reporting está disponible en el repo, úsalo.
- Si no está disponible, abre un issue público solo con una descripción mínima del problema y sin detalles sensibles, indicando que se trata de un problema de seguridad.

## Buenas prácticas para contribuidores

- Nunca subas `.env`, claves reales o documentos privados.
- Redacta cualquier CV de ejemplo antes de compartirlo.
- Mantén la sanitización y las validaciones activas cuando cambies el flujo de upload o exportación.

## Versiones soportadas

Por ahora, la rama principal (`main`) es la única versión soportada.
