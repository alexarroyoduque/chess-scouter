import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

// CORS simplificado - permitir todos los orígenes en desarrollo
app.use(cors({
  origin: true,  // Permite cualquier origen
  credentials: true
}));

app.use(express.json());

/**
 * Convierte un FEN en una lista explícita de piezas por casilla.
 * Resultado: "Blancas: Re1 Dd1 Tc1 Th1 Ac1 Cf3 Cc3 Pa2 Pb2 Pc4 Pd5 Pe4 Pf2 Pg2 Ph2\nNegras: re8 dd8 ta8 th8 ac8 cf6 cc6 pa7 pb7 pc5 pd6 pe5 pf7 pg7 ph7"
 */
function fenToPieceList(fen) {
  if (!fen) return "(posición no disponible)";

  const pieceNames = {
    K: 'Rey', Q: 'Dama', R: 'Torre', B: 'Alfil', N: 'Caballo', P: 'Peón',
    k: 'rey', q: 'dama', r: 'torre', b: 'alfil', n: 'caballo', p: 'peón'
  };

  const white = [];
  const black = [];
  const rows = fen.split(' ')[0].split('/');

  rows.forEach((row, rankIdx) => {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        fileIdx += parseInt(ch, 10);
      } else {
        const file = String.fromCharCode(97 + fileIdx);
        const square = `${file}${rank}`;
        const entry = `${pieceNames[ch]}(${square})`;
        if (ch === ch.toUpperCase()) white.push(entry);
        else black.push(entry);
        fileIdx++;
      }
    }
  });

  return `Blancas: ${white.join(', ')}\nNegras: ${black.join(', ')}`;
}
app.post("/api/explain-move", async (req, res) => {
  try {
    const data = req.body;
    const { apiKey } = data;

    if (!apiKey) {
      return res.status(400).json({
        title: "Error",
        diagnosis: "API key de Gemini no proporcionada",
        consequences: "",
        takeaway: ""
      });
    }

    // Crear cliente Gemini con la API key del request
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"  // Modelo estable según la API
    });

    const evalBeforeStr = data.evalBefore != null ? data.evalBefore.toFixed(2) : null;
    const evalAfterStr  = data.playedEval  != null ? data.playedEval.toFixed(2)  : null;

    // Las evaluaciones son SIEMPRE desde la perspectiva de BLANCAS (convención Stockfish/Lichess)
    // Positivo = ventaja blancas, negativo = ventaja negras
    // Calculamos la pérdida desde la perspectiva del jugador que mueve
    let playerLoss = null;
    let playerLossStr = "desconocida";
    if (data.evalBefore != null && data.playedEval != null) {
      playerLoss = data.playerColor === "white"
        ? data.evalBefore - data.playedEval   // blancas: pérdida si eval baja
        : data.playedEval - data.evalBefore;  // negras: pérdida si eval sube
      playerLossStr = playerLoss.toFixed(2);
    }

    const evalContext = evalBeforeStr && evalAfterStr
      ? `Eval (perspectiva blancas): ${evalBeforeStr} → ${evalAfterStr}. Pérdida del jugador: ${playerLossStr} peones (>0 = error, <0 = ganancia).`
      : "Evaluación no disponible.";

    const moveCtx = data.moveNumber ? `Jugada nº${data.moveNumber}` : "";
    const playerColorEs = data.playerColor === "white" ? "blancas" : "negras";
    const isVariantNote = data.isVariant
      ? "\n- CONTEXTO: variante alternativa, no la jugada real."
      : "";

    const piecesBefore = fenToPieceList(data.fenBefore);
    const piecesAfter  = fenToPieceList(data.fenAfter);

    const prompt = `Eres un coach de ajedrez. Feedback conciso y pedagógico.

REGLAS ESTRICTAS:
- Cada campo: MÁXIMO 25 palabras. Sin excepciones.
- Empieza siempre por el concepto táctico o estratégico (horquilla, clavada, desviación, sobrecarga, ataque descubierto, debilidad de color, activación de pieza, etc.).
- Sin frases introductorias ("Esta jugada…", "Stockfish…"). Directo al punto.
- Usa notación SAN para referirte a jugadas (Nc6, Bxd5, etc.).
- Basate ÚNICAMENTE en las piezas listadas abajo. Si una pieza no aparece en la lista, NO existe en el tablero.
- "mejor jugada" y "peor jugada" siempre desde la perspectiva del jugador indicado (${playerColorEs}).

Datos:
- Jugador: ${playerColorEs} | ${moveCtx} | Jugada: ${data.playedMove ?? "?"} (${data.classification ?? "?"})
- Mejor jugada para ${playerColorEs} según Stockfish: ${data.bestMove ?? "igual a la jugada realizada"}
- ${evalContext}${isVariantNote}

Posición ANTES de la jugada (${playerColorEs} van a mover):
${piecesBefore}

Posición DESPUÉS de la jugada:
${piecesAfter}

Devuelve ÚNICAMENTE este JSON (sin markdown):
{
  "title": "Nombre táctico/estratégico del concepto (5 palabras max)",
  "diagnosis": "Concepto aplicado + motivo concreto de la valoración. Usa la perspectiva de ${playerColorEs}. Máx 25 palabras.",
  "consequences": "Amenazas, planes o debilidades que ${playerColorEs} gana o pierde (basado en posición DESPUÉS). Máx 25 palabras.",
  "takeaway": "Lección memorable en una frase. Máx 12 palabras."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // limpiar markdown si aparece
    const clean = text.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(clean);

    res.json(parsed);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      title: "Error",
      explanation: "No se pudo generar explicación",
      takeaway: ""
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🧠 Coach IA corriendo en puerto ${PORT}`);
});