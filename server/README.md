# 🧠 Chess Scouter - Servidor IA

Servidor Express para desarrollo local del análisis con Google Gemini.

## 🔧 Desarrollo Local

Para probar el análisis IA localmente:

```bash
npm install
npm start
```

El servidor estará en `http://localhost:3001`

## 📝 Uso

Este servidor **solo se usa en desarrollo local**. En producción, Cloudflare Pages Functions (`/functions/api/explain-move.js`) maneja las requests automáticamente.

## 📁 Archivos

- **`server.js`**: Servidor Express para desarrollo local
- **`package.json`**: Dependencias y scripts

## 🌐 Producción

En producción (Cloudflare Pages), el backend se despliega automáticamente desde `functions/api/explain-move.js`. No necesitas desplegar este servidor por separado.
