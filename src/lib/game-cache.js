/**
 * Sistema de caché para partidas analizadas
 * Mantiene en localStorage los últimos 10 análisis completos
 */

const CACHE_KEY = 'chess-scouter-game-cache';
const CACHE_INDEX_KEY = 'chess-scouter-cache-index';
const MAX_CACHED_GAMES = 10;

/**
 * Genera un hash simple del PGN para usarlo como clave de caché
 */
function hashPgn(pgn) {
  // Usar los primeros 500 caracteres del PGN (incluye headers y primeros movimientos)
  // que son únicos por partida
  const normalized = pgn.trim().substring(0, 500);
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  
  return `game_${Math.abs(hash).toString(36)}`;
}

/**
 * Obtiene el índice de partidas cacheadas (orden FIFO)
 */
function getCacheIndex() {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    return indexStr ? JSON.parse(indexStr) : [];
  } catch (e) {
    console.warn('Error leyendo índice de caché:', e);
    return [];
  }
}

/**
 * Guarda el índice actualizado
 */
function saveCacheIndex(index) {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn('Error guardando índice de caché:', e);
  }
}

/**
 * Busca una partida en caché
 * @param {string} pgn - El PGN de la partida
 * @returns {Object|null} - Los datos del análisis o null si no está en caché
 */
export function getCachedGame(pgn) {
  try {
    const gameHash = hashPgn(pgn);
    const cacheStr = localStorage.getItem(`${CACHE_KEY}_${gameHash}`);
    
    if (!cacheStr) {
      return null;
    }
    
    const cached = JSON.parse(cacheStr);
    console.log(`✅ Partida encontrada en caché (hash: ${gameHash})`);
    
    return {
      classifications: cached.classifications,
      moveEvaluations: cached.moveEvaluations,
      bestEvaluations: cached.bestEvaluations,
      positionBestMoves: cached.positionBestMoves,
      positionAlternatives: cached.positionAlternatives || []
    };
  } catch (e) {
    console.warn('Error leyendo caché:', e);
    return null;
  }
}

/**
 * Guarda una partida analizada en caché
 * @param {string} pgn - El PGN de la partida
 * @param {Object} analysisData - Los datos del análisis
 */
export function cacheGame(pgn, analysisData) {
  try {
    const gameHash = hashPgn(pgn);
    const cacheKey = `${CACHE_KEY}_${gameHash}`;
    
    // Obtener índice actual
    let index = getCacheIndex();
    
    // Si esta partida ya está en caché, eliminarla del índice primero
    index = index.filter(key => key !== gameHash);
    
    // Añadir al final (más reciente)
    index.push(gameHash);
    
    // Si excedemos el máximo, eliminar las más antiguas
    while (index.length > MAX_CACHED_GAMES) {
      const oldestHash = index.shift();
      localStorage.removeItem(`${CACHE_KEY}_${oldestHash}`);
      console.log(`🗑️ Eliminada partida antigua de caché: ${oldestHash}`);
    }
    
    // Guardar los datos de análisis
    const cacheData = {
      classifications: analysisData.classifications,
      moveEvaluations: analysisData.moveEvaluations,
      bestEvaluations: analysisData.bestEvaluations,
      positionBestMoves: analysisData.positionBestMoves,
      positionAlternatives: analysisData.positionAlternatives || [],
      timestamp: Date.now()
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    saveCacheIndex(index);
    
    console.log(`💾 Partida guardada en caché (${index.length}/${MAX_CACHED_GAMES})`);
  } catch (e) {
    console.warn('Error guardando en caché:', e);
    // Si hay error (posiblemente quota exceeded), limpiar caché antigua
    clearOldestCachedGames(3);
  }
}

/**
 * Limpia las N partidas más antiguas del caché
 */
function clearOldestCachedGames(count) {
  try {
    let index = getCacheIndex();
    
    for (let i = 0; i < count && index.length > 0; i++) {
      const oldestHash = index.shift();
      localStorage.removeItem(`${CACHE_KEY}_${oldestHash}`);
    }
    
    saveCacheIndex(index);
    console.log(`🗑️ Limpiadas ${count} partidas del caché`);
  } catch (e) {
    console.warn('Error limpiando caché:', e);
  }
}

/**
 * Limpia todo el caché de partidas
 */
export function clearGameCache() {
  try {
    const index = getCacheIndex();
    
    index.forEach(gameHash => {
      localStorage.removeItem(`${CACHE_KEY}_${gameHash}`);
    });
    
    localStorage.removeItem(CACHE_INDEX_KEY);
    console.log('🗑️ Caché de partidas limpiado completamente');
  } catch (e) {
    console.warn('Error limpiando caché:', e);
  }
}

/**
 * Obtiene estadísticas del caché
 */
export function getCacheStats() {
  const index = getCacheIndex();
  return {
    count: index.length,
    maxCapacity: MAX_CACHED_GAMES
  };
}
