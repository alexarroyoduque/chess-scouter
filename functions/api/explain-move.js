// Cloudflare Pages Function - API endpoint
// Este archivo se ejecuta automáticamente en /api/explain-move

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173'
  // Cloudflare Pages Functions aceptan automáticamente requests del mismo dominio
];

function handleCORS(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Pages Functions permiten CORS del mismo dominio automáticamente
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

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

// Pages Function handler
export async function onRequestPost(context) {
  const { request } = context;

  try {
    const data = await request.json();
    const { apiKey } = data;

    if (!apiKey) {
      return new Response(JSON.stringify({
        title: "Error",
        diagnosis: "API key de Gemini no proporcionada",
        consequences: "",
        takeaway: ""
      }), {
        status: 400,
        headers: handleCORS(request)
      });
    }

    const evalBeforeStr = data.evalBefore != null ? data.evalBefore.toFixed(2) : null;
    const evalAfterStr = data.playedEval != null ? data.playedEval.toFixed(2) : null;

    let playerLoss = null;
    let playerLossStr = "desconocida";
    if (data.evalBefore != null && data.playedEval != null) {
      playerLoss = data.playerColor === "white"
        ? data.evalBefore - data.playedEval
        : data.playedEval - data.evalBefore;
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
    const piecesAfter = fenToPieceList(data.fenAfter);

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

    // Llamar a Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: handleCORS(request)
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({
      title: "Error",
      diagnosis: "No se pudo generar explicación",
      consequences: "",
      takeaway: ""
    }), {
      status: 500,
      headers: handleCORS(request)
    });
  }
}

// Handle OPTIONS for CORS preflight
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: handleCORS(context.request)
  });
}
