# Changelog - Chess scouter

## [2.1.0] - 11 de abril de 2026

### ✨ Nuevas Funcionalidades

#### Análisis Bajo Demanda con Stockfish
- **Botón "🔍 Analizar Posición"**: Analiza cualquier posición específica cuando lo necesites
- **Panel de Análisis Detallado**: Muestra evaluación, mejor movimiento y línea principal
- **Profundidad Configurable**: Análisis con profundidad 18 para mayor precisión
- **Línea Principal (PV)**: Muestra los primeros 5 movimientos de la mejor continuación
- **Performance Optimizada**: Solo se analiza la posición actual, no toda la partida

#### Información Mostrada en el Análisis
- **📊 Evaluación**: Valor preciso desde el punto de vista de blancas
- **Mejor Movimiento**: Sugerido en notación algebraica estándar (SAN)
- **Línea Principal**: Secuencia óptima de movimientos
- **Profundidad**: Indica qué tan profundo fue el cálculo

### 🎨 Mejoras de UI

- Botón destacado con gradiente azul y efecto hover
- Panel de análisis con diseño moderno y legible
- Auto-limpieza del análisis al cambiar de posición
- Fuente monoespaciada para datos técnicos
- Estados de carga claros ("🔄 Analizando...")

### 🔧 Cambios Técnicos

- Actualizado `StockfishService.evaluate()` para aceptar parámetro de profundidad
- Extracción mejorada de la línea principal (PV) completa
- Propiedad `currentPositionAnalysis` para almacenar resultados
- Mayor tiempo de análisis (1500ms) para análisis bajo demanda
- Método `analyzeCurrentPosition()` para análisis específico

### ❌ Características Eliminadas

- Eliminadas explicaciones automáticas genéricas (no aportaban valor real)
- Función `generateMoveExplanation()` removida

### 🚀 Beneficios

- ✅ **Análisis Selectivo**: Solo analizas las posiciones que te interesan
- ✅ **Carga Rápida**: No penaliza la carga inicial de la partida
- ✅ **Mayor Profundidad**: 18 niveles vs 20 previos, pero solo cuando lo pides
- ✅ **Información Clara**: Datos técnicos presentados de forma comprensible
- ✅ **Eficiencia**: Limpieza automática al navegar

---

## [2.0.0] - 11 de abril de 2026

### Refactorización Principal

- Cambio de análisis local (Stockfish) a uso de análisis precalculados de Lichess
- Parser de PGN mejorado para extraer evaluaciones
- Soporte para PGN con formato `[%eval X.XX]`
- Clasificación automática de movimientos basada en pérdida de evaluación
- Sistema de colores para identificar calidad de movimientos
- Barra de evaluación vertical
- Detección de aperturas
- Navegación por teclado
