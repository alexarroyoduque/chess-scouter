# Guía Rápida de Despliegue - Chess Scouter

## 🚀 Despliegue en 2 Pasos (Automático)

### 1️⃣ Sube a GitHub

```bash
git init
git add .
git commit -m "Initial commit - Chess Scouter"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/chess-scouter.git
git push -u origin main
```

### 2️⃣ Despliega en Cloudflare Pages

1. Ve a **Cloudflare Dashboard** → **Pages** → **Create a project**
2. Conecta tu repositorio de GitHub
3. Configuración:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Node version**: 18

4. Click **Save and Deploy**

✅ **¡Listo!** Tu app estará en: `https://tu-proyecto.pages.dev`

**El backend (IA) se despliega automáticamente** con Pages Functions en `/api/explain-move`. No necesitas configurar nada más.

---

## 🎯 Actualizaciones Futuras

Solo haz push a GitHub:

```bash
git add .
git commit -m "Update feature"
git push
```

Cloudflare despliega automáticamente frontend + backend en ~1 minuto.

---

## 💰 Costo

- **$0/mes** (plan gratuito de Cloudflare)
- 500 builds/mes
- Requests ilimitadas
- Backend incluido (Pages Functions)

---

## 📚 Desarrollo Local

Ver [README.md](README.md) para instrucciones de desarrollo local.
