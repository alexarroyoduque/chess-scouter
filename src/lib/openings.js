export const OPENINGS = [
  {
    eco: "C20",
    name: "Apertura del peón de rey",
    variation: "",
    moves: "e4 e5"
  },
  {
    eco: "C50",
    name: "Juego italiano",
    variation: "",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5"
  },
  {
    eco: "C53",
    name: "Juego italiano",
    variation: "Giuoco Piano",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3"
  },
  {
    eco: "C54",
    name: "Juego italiano",
    variation: "Giuoco Piano clásico",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4"
  },
  {
    eco: "C60",
    name: "Apertura Española",
    variation: "",
    moves: "e4 e5 Nf3 Nc6 Bb5"
  },
  {
    eco: "C65",
    name: "Apertura Española",
    variation: "Defensa Berlinesa",
    moves: "e4 e5 Nf3 Nc6 Bb5 Nf6"
  },
  {
    eco: "B20",
    name: "Defensa Siciliana",
    variation: "",
    moves: "e4 c5"
  },
  {
    eco: "B10",
    name: "Defensa Caro-Kann",
    variation: "",
    moves: "e4 c6"
  },
  {
    eco: "B12",
    name: "Defensa Caro-Kann",
    variation: "Variante clásica",
    moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4"
  },
  {
    eco: "B18",
    name: "Defensa Caro-Kann",
    variation: "Variante clásica, línea principal",
    moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5"
  },
  {
    eco: "C00",
    name: "Defensa Francesa",
    variation: "",
    moves: "e4 e6"
  },
  {
    eco: "D00",
    name: "Partida de peón de dama",
    variation: "",
    moves: "d4 d5"
  },
  {
    eco: "D06",
    name: "Gambito de dama",
    variation: "",
    moves: "d4 d5 c4"
  },
  {
    eco: "D30",
    name: "Gambito de dama rehusado",
    variation: "",
    moves: "d4 d5 c4 e6"
  },
  {
    eco: "A40",
    name: "Sistema Londres",
    variation: "",
    moves: "d4 d5 Nf3 Nf6 Bf4"
  },
  {
    eco: "E60",
    name: "Defensa india de rey",
    variation: "",
    moves: "d4 Nf6 c4 g6"
  }
];

export function getMoveSequenceSan(moves, index) {
  return moves
    .slice(0, index + 1)
    .map((m) => m.san)
    .join(" ");
}

function isSequenceStillBook(sequence, openingMoves) {
  return openingMoves === sequence || openingMoves.startsWith(sequence + " ");
}

function isOpeningAlreadyMatched(sequence, openingMoves) {
  return sequence === openingMoves || sequence.startsWith(openingMoves + " ");
}

export function getOpeningStateForSequence(sequence, openings = OPENINGS) {
  // ¿Seguimos dentro de alguna línea conocida?
  const stillBook = openings.some((opening) =>
    isSequenceStillBook(sequence, opening.moves)
  );

  // ¿Cuál es la línea más larga que ya hemos recorrido?
  let matchedOpening = null;

  for (const opening of openings) {
    if (isOpeningAlreadyMatched(sequence, opening.moves)) {
      if (!matchedOpening || opening.moves.length > matchedOpening.moves.length) {
        matchedOpening = opening;
      }
    }
  }

  return {
    isBook: stillBook,
    opening: matchedOpening
  };
}

export function buildOpeningsByMove(moves, openings = OPENINGS) {
  const result = new Array(moves.length).fill(null);

  for (let i = 0; i < moves.length; i++) {
    const sequence = getMoveSequenceSan(moves, i);
    result[i] = getOpeningStateForSequence(sequence, openings);
  }

  return result;
}