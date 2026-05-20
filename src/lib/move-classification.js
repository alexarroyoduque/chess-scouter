export function movesEqual(a, b) {
  if (!a || !b) return false;

  return (
    a.from === b.from &&
    a.to === b.to &&
    (a.promotion ?? undefined) === (b.promotion ?? undefined)
  );
}

export function classifyMove({
  playedMove,
  bestMove,
  playedEval,
  bestEval,
  playerColor,
  isBook
}) {
  // Detectar jaque mate (#) en el SAN
  if (playedMove?.san && playedMove.san.includes('#')) {
    return "checkmate";
  }
  
  if (isBook) {
    return "book";
  }

  if (typeof playedEval !== "number" || typeof bestEval !== "number") {
    return null;
  }

  // Ambas evaluaciones están en perspectiva de blancas
  // Para blancas: si eval baja = malo
  // Para negras: si eval sube = malo
  const loss = playerColor === "white"
    ? (bestEval - playedEval)
    : (playedEval - bestEval);

  // Umbrales más permisivos y realistas
  if (loss <= 0.30) {
    // Pérdida muy pequeña o movimiento mejor - excelente
    return "best";
  } else if (loss <= 0.70) {
    // Pérdida pequeña - buen movimiento
    return "good";
  } else if (loss <= 1.50) {
    // Pérdida moderada - imprecisión
    return "inaccuracy";
  } else if (loss <= 3.00) {
    // Pérdida significativa - error
    return "mistake";
  } else {
    // Pérdida grave - error garrafal
    return "blunder";
  }
}

export function getMoveStyle(classification) {
  const styles = {
    checkmate: { color: "#15781B", icon: "#", label: "Checkmate" },
    book: { color: "#a88865", icon: "📖", label: "Book move" },
    best: { color: "#96bc4b", icon: "★", label: "Best move" },
    good: { color: "#96bc4b", icon: "✓", label: "Good move" },
    inaccuracy: { color: "#f0c15c", icon: "?!", label: "Inaccuracy" },
    mistake: { color: "#e58f2a", icon: "?", label: "Mistake" },
    blunder: { color: "#b33430", icon: "??", label: "Blunder" }
  };

  return styles[classification] || null;
}
/**
 * Genera una explicación básica del movimiento basada en su clasificación
 * y el cambio de evaluación
 */
export function generateMoveExplanation({
  classification,
  moveSan,
  playerColor,
  evalBefore,
  evalAfter,
  loss
}) {
  const colorName = playerColor === "white" ? "Blancas" : "Negras";
  const opponent = playerColor === "white" ? "Negras" : "Blancas";
  
  // Formatear evaluación
  const formatEval = (val) => {
    if (val > 20) return "+" + Math.abs(val).toFixed(1);
    if (val < -20) return "-" + Math.abs(val).toFixed(1);
    return val > 0 ? "+" + val.toFixed(2) : val.toFixed(2);
  };

  const evalBeforeStr = formatEval(evalBefore);
  const evalAfterStr = formatEval(evalAfter);

  switch (classification) {
    case "checkmate":
      return {
        title: "# ¡Jaque Mate!",
        summary: `${moveSan} termina la partida.`,
        detail: `${colorName} ha dado jaque mate. ¡Victoria!`,
        evaluation: `Partida terminada`
      };

    case "book":
      return {
        title: "📖 Movimiento de Apertura",
        summary: `${moveSan} es un movimiento teórico común en esta apertura.`,
        detail: "Sigue la teoría de aperturas establecida. No se evalúa la calidad ya que es parte del libro de aperturas.",
        evaluation: `Posición: ${evalAfterStr}`
      };

    case "best":
      if (Math.abs(loss) <= 0.15) {
        return {
          title: "✓ Movimiento Excelente",
          summary: `${moveSan} es el mejor movimiento o muy cercano.`,
          detail: loss <= 0 
            ? `${colorName} mejora su posición o mantiene la ventaja perfectamente.`
            : `Pérdida mínima de ${loss.toFixed(2)}. Prácticamente perfecto.`,
          evaluation: `${evalBeforeStr} → ${evalAfterStr}`
        };
      } else {
        return {
          title: "○ Buen Movimiento",
          summary: `${moveSan} es un movimiento sólido.`,
          detail: `Pérdida leve de ${loss.toFixed(2)} peones. No hay consecuencias graves, pero existían opciones ligeramente mejores.`,
          evaluation: `${evalBeforeStr} → ${evalAfterStr}`
        };
      }

    case "good":
      return {
        title: "○ Buen Movimiento",
        summary: `${moveSan} es un movimiento razonable.`,
        detail: `Pérdida de ${loss.toFixed(2)} peones. La posición sigue siendo defendible, aunque había opciones mejores.`,
        evaluation: `${evalBeforeStr} → ${evalAfterStr}`
      };

    case "inaccuracy":
      return {
        title: "?! Imprecisión",
        summary: `${moveSan} no es la mejor opción.`,
        detail: `Pérdida de ${loss.toFixed(2)} peones. Este movimiento facilita un poco las cosas a ${opponent}. Se podía jugar mejor sin complicarse.`,
        evaluation: `${evalBeforeStr} → ${evalAfterStr}`
      };

    case "mistake":
      return {
        title: "? Error",
        summary: `${moveSan} entrega ventaja significativa.`,
        detail: `Pérdida de ${loss.toFixed(2)} peones. Este error cambia la evaluación considerablemente a favor de ${opponent}. La posición ahora es más difícil de defender.`,
        evaluation: `${evalBeforeStr} → ${evalAfterStr}`
      };

    case "blunder":
      const isMateOrHeavyLoss = Math.abs(evalAfter) > 10 || Math.abs(evalBefore) > 10;
      return {
        title: "?? Blunder",
        summary: `${moveSan} es un error garrafal.`,
        detail: isMateOrHeavyLoss
          ? `Pérdida de ${loss.toFixed(2)} peones. Este movimiento pierde la partida o entrega ventaja decisiva. ${opponent} ahora tiene ventaja ganadora.`
          : `Pérdida de ${loss.toFixed(2)} peones. Error muy grave que cambia completamente la evaluación a favor de ${opponent}.`,
        evaluation: `${evalBeforeStr} → ${evalAfterStr}`
      };

    default:
      return {
        title: "Movimiento",
        summary: `${moveSan} fue jugado.`,
        detail: "Sin análisis disponible para este movimiento.",
        evaluation: `${evalBeforeStr} → ${evalAfterStr}`
      };
  }
}