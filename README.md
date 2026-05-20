# ♟️ Chess Scouter

Herramienta de análisis de partidas de ajedrez con Stockfish 17 en el navegador + análisis con IA (Google Gemini).

**Despliegue automático**: Push a GitHub → Cloudflare despliega todo  
**Guía rápida**: [QUICKSTART.md](QUICKSTART.md) (2 pasos)


## 🎯 Características

- **Análisis Visual**: Visualiza la evaluación de cada movimiento con códigos de color
- **Clasificación de Movimientos**: Identifica movimientos excelentes, buenos, imprecisiones, errores y blunders
- **Análisis con IA**: Explicaciones pedagógicas de cada movimiento con Google Gemini
- **Movimientos Alternativos**: Visualiza las 3 mejores opciones según Stockfish
- **Análisis Bajo Demanda**: Usa Stockfish local para analizar cualquier posición específica
- **Barra de Evaluación**: Muestra gráficamente cómo evoluciona la partida
- **Detección de Aperturas**: Identifica aperturas y variantes automáticamente
- **Navegación Intuitiva**: Revisa la partida movimiento por movimiento
- **Sonidos Profesionales**: Efectos de audio tipo chess.com

## 📋 Requisitos

- **PGN Analizado**: Debes exportar tu partida desde Lichess con el análisis incluido
- El PGN debe contener las evaluaciones en formato `[%eval X.XX]`

## 🚀 Cómo Obtener un PGN Analizado de Lichess

1. Ve a tu partida en Lichess
2. Haz clic en el botón **"Solicitar análisis por computadora"** (si no lo has hecho ya)
3. Una vez completado el análisis, haz clic en el menú (☰) y selecciona **"Exportar partida"**
4. Asegúrate de marcar la opción **"Include computer analysis"** o **"Incluir análisis por computadora"**
5. Descarga el archivo PGN

## 📖 Cómo Usar

### Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Terminal 1: Iniciar frontend
npm run dev

# 3. Terminal 2: Iniciar backend (para probar IA localmente)
npm run server
```

Abre `http://localhost:5173` en tu navegador.

**Nota**: En desarrollo local usamos servidor Express (`server/server.js`). En producción Cloudflare usa Pages Functions (`functions/`) automáticamente.

### Producción (Cloudflare Pages) 🌟

**Despliegue automático con un solo push a GitHub:**

1. **Crea repositorio en GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU-USUARIO/chess-scouter.git
   git push -u origin main
   ```

2. **Conecta con Cloudflare Pages**
   - Ve a Cloudflare Dashboard → Pages → Create project
   - Conecta tu repo de GitHub
   - Build command: `npm run build`
   - Build output: `dist`
   - Node version: 18
   - Click "Save and Deploy"

✅ **¡Listo!** El frontend y backend se despliegan automáticamente.

El backend (IA) se sirve automáticamente mediante **Pages Functions** en `/api/explain-move`. No necesitas desplegar Worker separado ni configurar variables de entorno.

**Actualizaciones**: Solo haz `git push` y Cloudflare redespliega todo automáticamente.

Ver [QUICKSTART.md](QUICKSTART.md) para guía de despliegue completa.

### Usar la Aplicación

1. Carga una partida PGN de Lichess (con análisis incluido)
2. Para usar IA:
   - Obtén API key de Gemini: https://aistudio.google.com/app/apikey
   - Introdúcela en "🔑 Configurar API Key"
   - Click "✓ Conectar"
3. Navega por la partida y usa "Analizar con IA" cuando quieras

6. Explora la partida:
   - Usa las flechas ←→ del teclado o los botones para navegar
   - Los movimientos se colorean según su calidad:
     - 🟢 Verde: Movimiento excelente o bueno
     - 🟡 Amarillo: Imprecisión
     - 🟠 Naranja: Error
     - 🔴 Rojo: Blunder (error garrafal)
   - 📖 Marrón: Movimiento de apertura (teoría)

## 🎨 Clasificación de Movimientos

El sistema clasifica cada movimiento según la diferencia de evaluación:

- **Best/Good** (≤0.70): Movimiento excelente o bueno
- **Inaccuracy** (0.70-1.50): Pérdida moderada
- **Mistake** (1.50-3.00): Pérdida significativa
- **Blunder** (>3.00): Pérdida grave

### � Análisis Bajo Demanda con Stockfish

Cuando navegues por la partida, puedes hacer clic en **"🔍 Analizar Posición"** para obtener:

- **Evaluación precisa** de Stockfish con profundidad 18
- **Mejor movimiento** sugerido en notación algebraica
- **Línea principal (PV)**: Los primeros 5 movimientos de la mejor continuación
- **Profundidad del análisis**: Para que sepas qué tan profundo fue el cálculo

Este análisis es bajo demanda, por lo que:
- ✅ Solo se calcula cuando tú lo pides
- ✅ No ralentiza la carga inicial
- ✅ Puedes analizar las posiciones críticas que te interesen
- ✅ El análisis se limpia al cambiar de movimiento
### 🤖 Análisis con IA (Google Gemini)

Además del análisis técnico de Stockfish, puedes obtener explicaciones pedagógicas con IA:

- **Configuración**: Introduce tu API key de Google Gemini (https://aistudio.google.com/app/apikey)
- **Explicaciones en lenguaje natural**: Comprende por qué un movimiento es bueno o malo
- **Contexto táctico y estratégico**: Identifica patrones, amenazas y planes
- **Lecciones claras**: Extrae aprendizajes de cada posición

El servidor de IA debe estar corriendo (`npm run server`) para usar esta funcionalidad.
## 🔧 Tecnologías

### Frontend
- **Lit** - Web Components ligeros
- **Chessground** - Tablero de ajedrez interactivo
- **chess.js** - Lógica de ajedrez y validación
- **Stockfish 17** - Motor de análisis (WASM en el navegador)
- **Vite** - Build tool y dev server
- **Cloudflare Pages** - Hosting y CDN

### Backend
- **Cloudflare Pages Functions** - Serverless edge computing (producción)
- **Express.js** - Servidor local para desarrollo
- **Google Gemini API** - Análisis con IA

## 📝 Formato del PGN

El PGN debe incluir evaluaciones en este formato:

```pgn
1. e4 { [%eval 0.18] } 1... c6 { [%eval 0.31] } 2. d4 { [%eval 0.24] }
```

Las evaluaciones representan la ventaja de las blancas en peones (positivo = ventaja blanca, negativo = ventaja negra).

## 🎯 Ventajas de Este Enfoque

- ✅ **Rápido**: No necesita calcular nada, usa análisis precalculado
- ✅ **Preciso**: Usa el análisis de Stockfish de Lichess (más profundo)
- ✅ **Sin Dependencias Pesadas**: No requiere ejecutar Stockfish localmente
- ✅ **Offline**: Una vez cargado el PGN, funciona sin conexión

## 🐛 Solución de Problemas

### "No se encontraron evaluaciones en el PGN"

Asegúrate de que:
- El PGN fue exportado desde Lichess
- Marcaste la opción "Include computer analysis" al exportar
- El análisis se completó antes de exportar (puede tardar unos minutos en partidas largas)

### Los movimientos no se clasifican correctamente

Verifica que:
- El PGN tenga el formato correcto con `[%eval X.XX]`
- Las evaluaciones aparezcan después de cada movimiento
- El archivo no esté corrupto o mal formateado

## 📄 Licencia

MIT

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Abre un issue o pull request en GitHub.
