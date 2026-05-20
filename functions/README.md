# Cloudflare Pages Functions

Este directorio contiene las funciones serverless que se ejecutan en el edge.

## 📁 Estructura

```
functions/
└── api/
    └── explain-move.js  → Endpoint: /api/explain-move
```

## 🚀 Cómo Funciona

Cloudflare Pages detecta automáticamente archivos en `functions/` y los despliega como endpoints serverless.

- **Ruta del archivo**: `functions/api/explain-move.js`
- **URL resultante**: `https://tu-dominio.pages.dev/api/explain-move`

## 📝 Estructura de una Function

```javascript
// functions/api/ejemplo.js

// Handler para POST requests
export async function onRequestPost(context) {
  const { request, env } = context;
  // Tu lógica aquí
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handler para GET requests
export async function onRequestGet(context) {
  return new Response('Hello World');
}

// Handler para OPTIONS (CORS)
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}
```

## 🔧 Desarrollo Local

Las Pages Functions se ejecutan automáticamente con:

```bash
npm run dev
```

El endpoint estará disponible en:
```
http://localhost:5173/api/explain-move
```

## 📚 Más Info

Documentación oficial de Cloudflare Pages Functions:
https://developers.cloudflare.com/pages/platform/functions/
