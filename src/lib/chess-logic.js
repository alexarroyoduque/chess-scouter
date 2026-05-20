import { Chess } from "chess.js";

export function cleanPgn(pgn) {
  return pgn
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .replace(/�/g, "")
    .trim();
}

export function splitGames(pgn) {
  return cleanPgn(pgn).split(/\n(?=\[Event )/g);
}

export function loadGame(pgn) {
  const chess = new Chess();
  
  // console.log('📥 loadGame - PGN completo:', pgn);
  // console.log('📏 Longitud del PGN:', pgn.length);
  
  // Validar que el PGN tenga contenido
  if (!pgn || pgn.trim().length === 0) {
    throw new Error('PGN vacío');
  }
  
  // Parsear variantes ANTES de limpiar el PGN
  const variants = parseVariantsFromPgn(pgn);
  
  // Separar headers de movimientos
  const lines = pgn.split('\n');
  const allHeaderLines = [];
  const moveLines = [];
  let inMoves = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      allHeaderLines.push(line);
    } else if (trimmed.length > 0) {
      inMoves = true;
      moveLines.push(trimmed);
    } else if (inMoves) {
      moveLines.push(trimmed);
    }
  }
  
  // Filtrar solo los headers estándar que chess.js reconoce
  const standardHeaders = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 
                           'WhiteElo', 'BlackElo', 'TimeControl', 'ECO', 'Termination'];
  const headerLines = allHeaderLines.filter(line => {
    const headerMatch = line.match(/\[(\w+)\s/);
    return headerMatch && standardHeaders.includes(headerMatch[1]);
  });
  
  // console.log('📋 Headers totales:', allHeaderLines.length, '| Headers estándar:', headerLines.length);
  // console.log('🎯 Líneas de movimientos:', moveLines.join(' ').substring(0, 500));
  
  // Limpiar solo la parte de movimientos
  let movesText = moveLines.join(' ')
    // Eliminar variantes (paréntesis anidados) - múltiples pasadas
    .replace(/\([^()]*\)/g, '')
    .replace(/\([^()]*\)/g, '')
    .replace(/\([^()]*\)/g, '')
    // Eliminar comentarios con evaluaciones [%eval X.XX], [%clk X:XX:XX], etc.
    .replace(/\[%[^\]]*\]/g, '')
    // Eliminar comentarios con llaves { ... }
    .replace(/\{[^}]*\}/g, '')
    // Eliminar anotaciones NAG ($1, $2, etc.)
    .replace(/\$\d+/g, '')
    // Eliminar anotaciones como ??, !!, ?!, !?
    .replace(/[\?\!]+/g, '')
    // Corregir formato: eliminar números de movimiento duplicados para jugadas negras
    // Convertir "1. e4 1... d5 2. f3 2... e5" a "1. e4 d5 2. f3 e5"
    .replace(/(\d+)\.\.\./g, '')
    // Limpiar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim();
  
  // Reconstruir PGN con headers y movimientos limpios
  const cleanedPgn = [...headerLines, '', movesText].join('\n');
  
  // console.log('🧹 loadGame - PGN limpiado:', cleanedPgn);
  
  // Validar que el PGN limpiado tenga movimientos
  if (!movesText.match(/1\./)) {
    console.error('❌ No se encontró "1." en los movimientos');
    console.error('📄 Movimientos originales:', moveLines.join(' '));
    console.error('📄 Movimientos limpiados:', movesText);
    throw new Error('El PGN no contiene movimientos válidos');
  }
  
  // Chess.com PGN suele fallar con chess.loadPgn() aunque sea válido
  // Usar siempre el parser manual que es más robusto
  
  // Extraer solo los movimientos sin números
  const moveMatches = movesText.match(/\b[NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:=[NBRQ])?[+#]?|O-O(?:-O)?/g);
  
  if (!moveMatches) {
    console.error('❌ No se encontraron movimientos válidos');
    throw new Error('No se pudo parsear el PGN - no hay movimientos válidos');
  }
  
  // Crear un nuevo Chess y aplicar movimiento por movimiento
  const chessManual = new Chess();
  const movesApplied = [];
  
  for (let i = 0; i < moveMatches.length; i++) {
    const move = moveMatches[i];
    try {
      const result = chessManual.move(move, { sloppy: true });
      if (!result) {
        console.error(`❌ Movimiento ${i+1} falló: "${move}"`);
        console.error(`📊 Posición actual FEN: ${chessManual.fen()}`);
        break;
      }
      movesApplied.push(result);
    } catch (e) {
      console.error(`❌ Excepción en movimiento ${i+1} "${move}": ${e.message}`);
      break;
    }
  }
  
  if (movesApplied.length === 0) {
    throw new Error('No se pudo aplicar ningún movimiento');
  }
  
  // Adjuntar variantes a cada movimiento
  movesApplied.forEach((move, index) => {
    if (variants[index]) {
      move.variants = variants[index];
    } else {
      move.variants = [];
    }
  });
  
  return { chess: chessManual, moves: movesApplied, variants };
}

export function getFenAtMove(moves, index) {
  const chess = new Chess();
  for (let i = 0; i <= index; i++) {
    chess.move(moves[i]);
  }
  return chess.fen();
}

export function parseUciMove(uci) {
  if (!uci) return null;
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
  return { from, to, promotion };
}

export function getFenAfterMoveFromFen(fen, move) {
  const chess = new Chess(fen === "startpos" ? undefined : fen);
  try {
    chess.move(move);
    return chess.fen();
  } catch (e) {
    return fen;
  }
}

export function getGameHeaders(pgn) {
  const headers = {};
  const lines = pgn.split('\n');
  
  for (const line of lines) {
    const match = line.match(/\[(\w+)\s+"(.+)"\]/);
    if (match) {
      headers[match[1]] = match[2];
    }
  }
  
  return headers;
}

export function getWinnerFromHeaders(headers) {
  const result = headers.Result;
  if (result === "1-0") return "white";
  if (result === "0-1") return "black";
  return null;
}

/**
 * Extrae las evaluaciones de Lichess del PGN analizado
 * Formato: { [%eval 0.18] } o { [%eval #3] } para mates
 * Retorna array de evaluaciones normalizadas desde perspectiva de blancas
 */
export function parseEvaluationsFromPgn(pgn) {
  const evaluations = [];
  
  // Buscar todas las evaluaciones en el formato [%eval X.XX]
  // Mejorado para manejar diferentes formatos de espacios
  const evalRegex = /\[%eval\s+([#\-\d.]+)\]/g;
  let match;
  
  while ((match = evalRegex.exec(pgn)) !== null) {
    const evalStr = match[1];
    
    // Manejar evaluaciones de mate (#3, #-2, etc.)
    if (evalStr.startsWith('#')) {
      const mateIn = parseInt(evalStr.substring(1));
      // Mate: usar un valor muy alto/bajo
      evaluations.push(mateIn > 0 ? 100 : -100);
    } else {
      // Evaluación normal en peones
      const evalValue = parseFloat(evalStr);
      if (!isNaN(evalValue)) {
        evaluations.push(evalValue);
      }
    }
  }
  
  return evaluations;
}

/**
 * Extrae variantes alternativas del PGN de Lichess
 * Las variantes están entre paréntesis después de comentarios  
 * Formato: (6... Nf6 7. Qe2 Nbd7 8. O-O Nxe4 9. Bxe4)
 * Retorna un mapa: { moveIndex: variantMovesArray }
 */
export function parseVariantsFromPgn(pgn) {
  const variants = {};
  
  // Buscar directamente todas las variantes en formato (N... Move ...)
  // donde N es un número y Move es un movimiento de ajedrez
  const variantRegex = /\((\d+\.{1,3}\s+[A-Za-z][^\)]*)\)/g;
  let match;
  
  // Array para rastrear todos los movimientos principales sin comentarios ni variantes
  const cleanPgn = pgn
    .replace(/\([^)]+\)/g, '') // Eliminar variantes primero
    .replace(/\{[^}]+\}/g, ''); // Luego comentarios
    
  const mainMoves = [];
  const mainRegex = /(\d+)\.{1,3}\s+(\S+)/g;
  let mainMatch;
  
  while ((mainMatch = mainRegex.exec(cleanPgn)) !== null) {
    mainMoves.push({
      fullNotation: mainMatch[0],
      moveNum: parseInt(mainMatch[1]),
      san: mainMatch[2],
      globalIndex: mainMoves.length
    });
  }
  
  // Ahora buscar variantes y asociarlas al movimiento correspondiente
  while ((match = variantRegex.exec(pgn)) !== null) {
    const variantText = match[1];
    
    // Extraer el número de movimiento y determinar si es blanco o negro
    const variantMoveNumMatch = variantText.match(/^(\d+)(\.{1,3})/);
    if (!variantMoveNumMatch) continue;
    
    const variantMoveNum = parseInt(variantMoveNumMatch[1]);
    const dots = variantMoveNumMatch[2];
    const isBlackMove = dots === '...'; // Tres puntos = movimiento negro
    
    // Parsear los movimientos de la variante
    const variantMoves = parseVariantMoves(variantText);
    
    if (variantMoves.length === 0) {
      continue;
    }
    
    // Calcular el índice global correcto
    // Movimiento 1 blanco = índice 0, movimiento 1 negro = índice 1
    // Movimiento N blanco = (N-1)*2, movimiento N negro = (N-1)*2 + 1
    const targetIndex = isBlackMove 
      ? (variantMoveNum - 1) * 2 + 1  // Negro
      : (variantMoveNum - 1) * 2;      // Blanco
    
    // Verificar que el índice está en rango
    if (targetIndex >= 0 && targetIndex < mainMoves.length) {
      if (!variants[targetIndex]) {
        variants[targetIndex] = [];
      }
      variants[targetIndex].push(variantMoves);
    }
  }
  
  return variants;
}

/**
 * Parsea una secuencia de movimientos de una variante
 * Entrada: "6... Nf6 7. Qe2 Nbd7 8. O-O"
 * Salida: ["Nf6", "Qe2", "Nbd7", "O-O"]
 */
function parseVariantMoves(variantText) {
  const moves = [];
  
  // Eliminar comentarios internos
  const cleaned = variantText.replace(/\{[^}]*\}/g, '').trim();
  
  // Estrategia: dividir por números de movimiento y extraer todos los movimientos
  // Los movimientos pueden aparecer como:
  // - "6... Nf6" (negro con número)
  // - "7. Qe2" (blanco con número)
  // - "7. Qe2 Nbd7" (blanco con número, negro sin número en el mismo grupo)
  
  // Primero eliminar los números de movimiento
  let withoutNumbers = cleaned.replace(/\d+\.{1,3}\s*/g, '');
  
  // Ahora tenemos algo como: "Nf6 Qe2 Nbd7 O-O Nxe4 Bxe4"
  // Dividir por espacios y filtrar tokens válidos
  const tokens = withoutNumbers.split(/\s+/).filter(t => t.length > 0);
  
  for (const token of tokens) {
    // Validar que es un movimiento de ajedrez válido
    if (/^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?[+#]?$/.test(token) || 
        token === 'O-O' || token === 'O-O-O') {
      moves.push(token);
    }
  }
  
  return moves;
}

/**
 * Extrae comentarios con sugerencias de mejores movimientos del PGN
 * Formato: (6... Nf6 was best)
 */
export function parseBestMovesFromPgn(pgn) {
  const suggestions = [];
  
  // Buscar comentarios con "was best"
  const suggestionRegex = /\([\d.]+\s+(\w+)\s+was best\)/gi;
  let match;
  
  while ((match = suggestionRegex.exec(pgn)) !== null) {
    suggestions.push(match[1]); // El movimiento sugerido en notación SAN
  }
  
  return suggestions;
}

export function calculateCapturedMaterial(fen) {
  const pieceValues = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9,
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9
  };

  const startingMaterial = {
    'p': 8, 'n': 2, 'b': 2, 'r': 2, 'q': 1,
    'P': 8, 'N': 2, 'B': 2, 'R': 2, 'Q': 1
  };

  const currentMaterial = {
    'p': 0, 'n': 0, 'b': 0, 'r': 0, 'q': 0,
    'P': 0, 'N': 0, 'B': 0, 'R': 0, 'Q': 0
  };

  const fenParts = fen.split(' ');
  const position = fenParts[0];

  for (const char of position) {
    if (currentMaterial.hasOwnProperty(char)) {
      currentMaterial[char]++;
    }
  }

  const capturedByWhite = [];
  const capturedByBlack = [];

  for (const piece in startingMaterial) {
    const captured = startingMaterial[piece] - currentMaterial[piece];
    for (let i = 0; i < captured; i++) {
      if (piece === piece.toLowerCase()) {
        capturedByWhite.push(piece);
      } else {
        capturedByBlack.push(piece);
      }
    }
  }

  let whiteValue = 0;
  let blackValue = 0;

  for (const piece of capturedByWhite) {
    whiteValue += pieceValues[piece];
  }

  for (const piece of capturedByBlack) {
    blackValue += pieceValues[piece];
  }

  const materialDiff = whiteValue - blackValue;

  return {
    capturedByWhite,
    capturedByBlack,
    materialDiff
  };
}

/**
 * Analiza por qué un movimiento es malo comparándolo con el mejor movimiento
 * @param {string} fenBefore - FEN antes del movimiento
 * @param {Object} playedMove - El movimiento que se jugó
 * @param {Object} bestMove - El mejor movimiento sugerido
 * @param {string} classification - Clasificación del movimiento (best, good, inaccuracy, mistake, blunder)
 * @returns {Array<string>} - Lista de razones por las que el movimiento es malo
 */
export function analyzeBadMove(fenBefore, playedMove, bestMove, classification) {
  const reasons = [];
  
  // Solo analizar movimientos malos
  if (!classification || classification === 'best' || classification === 'good' || classification === 'book') {
    return reasons;
  }
  
  if (!fenBefore || !playedMove || !bestMove) {
    return reasons;
  }
  
  // Obtener el símbolo del error
  const errorSymbols = {
    'inaccuracy': '?!',
    'mistake': '?',
    'blunder': '??'
  };
  const symbol = errorSymbols[classification] || '?';
  
  try {
    const chess = new Chess(fenBefore);
    const playerColor = chess.turn();
    
    // Aplicar el movimiento jugado para ver la posición resultante
    const playedResult = chess.move(playedMove);
    if (!playedResult) return reasons;
    
    const fenAfterPlayed = chess.fen();
    const playedPiece = getPieceNameInSpanish(playedResult.piece);
    const playedSan = playedResult.san;
    
    // Volver y aplicar el mejor movimiento
    chess.undo();
    const bestResult = chess.move(bestMove);
    if (!bestResult) return reasons;
    
    const fenAfterBest = chess.fen();
    const bestPiece = getPieceNameInSpanish(bestResult.piece);
    const bestSan = bestResult.san;
    
    // 1. Detectar si el mejor movimiento era una captura valiosa
    if (bestResult.captured && !playedResult.captured) {
      const capturedPiece = getPieceNameInSpanish(bestResult.captured);
      reasons.push(`Mejor era capturar ${capturedPiece}: ${bestSan}`);
    }
    
    // 2. Detectar pérdidas materiales directas
    const materialBeforeMove = calculateMaterialFromFen(fenBefore);
    const materialAfterPlayed = calculateMaterialFromFen(fenAfterPlayed);
    const materialAfterBest = calculateMaterialFromFen(fenAfterBest);
    
    const materialLossPlayed = playerColor === 'w' 
      ? materialAfterPlayed - materialBeforeMove
      : -(materialAfterPlayed - materialBeforeMove);
    
    const materialLossBest = playerColor === 'w'
      ? materialAfterBest - materialBeforeMove
      : -(materialAfterBest - materialBeforeMove);
    
    // Si el movimiento jugado pierde material comparado con el mejor
    if (materialLossPlayed < materialLossBest - 0.5) {
      const diff = Math.abs(materialLossPlayed - materialLossBest);
      const pieceLost = getPieceLostDescription(diff);
      if (pieceLost) {
        reasons.push(`Este movimiento pierde ${pieceLost.toLowerCase()}`);
      }
    }
    
    // 3. Comparar tipos de piezas movidas
    if (bestResult.piece !== playedResult.piece && reasons.length === 0) {
      reasons.push(`Mejor era mover ${bestPiece}: ${bestSan}`);
    }
    
    // 4. Si hay captura jugada pero era mejor otra captura
    if (playedResult.captured && bestResult.captured && playedResult.captured !== bestResult.captured) {
      const playedCaptured = getPieceNameInSpanish(playedResult.captured);
      const bestCaptured = getPieceNameInSpanish(bestResult.captured);
      reasons.push(`Capturaste ${playedCaptured}, mejor era ${bestCaptured}`);
    }
    
    // 5. Detectar si se movió a una casilla peligrosa (quedó atacada)
    chess.undo(); // volver a posición antes del mejor movimiento
    chess.move(playedMove); // aplicar el movimiento jugado
    const attackedSquares = getAttackedSquares(chess, playerColor === 'w' ? 'b' : 'w');
    if (attackedSquares.includes(playedResult.to) && reasons.length < 2) {
      reasons.push(`La pieza quedó expuesta en ${playedResult.to}`);
    }
    
    // 6. Si no encontramos nada específico, dar contexto del error
    if (reasons.length === 0) {
      if (classification === 'blunder') {
        reasons.push(`Error grave: ${bestSan} era mucho mejor`);
      } else if (classification === 'mistake') {
        reasons.push(`${bestSan} era claramente mejor`);
      } else {
        reasons.push(`Imprecisión: considera ${bestSan}`);
      }
    }
    
  } catch (error) {
    console.error('Error analizando mal movimiento:', error);
    // Asegurar que siempre hay al menos una razón
    if (reasons.length === 0) {
      reasons.push(`Considera el mejor movimiento sugerido`);
    }
  }
  
  // Añadir el símbolo solo a la primera razón
  if (reasons.length > 0) {
    reasons[0] = `${symbol} ${reasons[0]}`;
  }
  
  return reasons;
}

/**
 * Obtiene las casillas atacadas por un color
 */
function getAttackedSquares(chess, attackerColor) {
  const attacked = [];
  const allSquares = [
    'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
    'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
    'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
    'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
    'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
    'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
    'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
    'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'
  ];
  
  // Guardar el turno actual
  const currentTurn = chess.turn();
  
  // Cambiar al turno del atacante para ver sus movimientos
  const fen = chess.fen();
  const fenParts = fen.split(' ');
  fenParts[1] = attackerColor;
  const modifiedFen = fenParts.join(' ');
  
  try {
    const testChess = new Chess(modifiedFen);
    const moves = testChess.moves({ verbose: true });
    
    for (const move of moves) {
      if (!attacked.includes(move.to)) {
        attacked.push(move.to);
      }
    }
  } catch (e) {
    // Si falla, devolver array vacío
  }
  
  return attacked;
}

/**
 * Calcula el valor material total de una posición
 */
function calculateMaterialFromFen(fen) {
  const pieceValues = {
    p: 1, n: 3, b: 3, r: 5, q: 9,
    P: 1, N: 3, B: 3, R: 5, Q: 9
  };
  
  const position = fen.split(' ')[0];
  let total = 0;
  
  for (const char of position) {
    if (pieceValues[char]) {
      total += char === char.toUpperCase() ? pieceValues[char] : -pieceValues[char];
    }
  }
  
  return total;
}

/**
 * Convierte una diferencia de material en descripción de pieza
 */
function getPieceLostDescription(value) {
  if (value >= 8.5) return 'Dama';
  if (value >= 4.5) return 'Torre';
  if (value >= 2.5) return 'Pieza menor';
  if (value >= 0.8) return 'Peón';
  return null;
}

/**
 * Obtiene el nombre de la pieza en español
 */
function getPieceNameInSpanish(piece) {
  const names = {
    p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama',
    k: 'rey'
  };
  return names[piece.toLowerCase()] || 'pieza';
}