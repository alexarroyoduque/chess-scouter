export class StockfishService {
  constructor() {
    this.worker = new Worker(
      new URL("../workers/stockfish-worker.js", import.meta.url),
      { type: "module" }
    );

    this.callback = null;
    this.currentEval = null;
    this.currentBestMove = null;
    this.currentDepth = 0;
    this.currentPv = [];
    this.alternatives = []; // Para almacenar multipv
    this.isReady = false;
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.worker.onmessage = (e) => {
      const line = e.data;
      if (typeof line !== "string") return;
      
      // Detectar cuando Stockfish está completamente listo
      if (line === "STOCKFISH_READY") {
        this.isReady = true;
        if (this.resolveReady) {
          this.resolveReady();
          this.resolveReady = null;
        }
        return;
      }

      if (line.includes("depth")) {
        const depthMatch = line.match(/depth (\d+)/);
        if (depthMatch) {
          this.currentDepth = parseInt(depthMatch[1], 10);
        }
      }

      // Aceptar evaluaciones con profundidad >= 8 (para WASM más lento)
      if ((line.includes("score cp") || line.includes("score mate")) && this.currentDepth >= 8) {
        const evalValue = this.parseEvaluation(line);
        
        // Detectar si es multipv
        const multipvMatch = line.match(/multipv (\d+)/);
        const multipvIndex = multipvMatch ? parseInt(multipvMatch[1], 10) - 1 : 0;
        
        // Extraer línea principal (PV)
        const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?\s*)+/);
        let moves = [];
        let firstMove = null;
        
        if (pvMatch) {
          const pvPart = pvMatch[0].replace(/^pv\s+/, '');
          moves = pvPart.trim().split(/\s+/).filter(m => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
          firstMove = moves[0];
        }
        
        if (multipvIndex === 0) {
          // Primera línea (mejor movimiento)
          this.currentEval = evalValue;
          this.currentPv = moves;
          this.currentBestMove = firstMove;
        }
        
        // Almacenar en alternatives
        if (evalValue !== null && firstMove) {
          this.alternatives[multipvIndex] = {
            evaluation: evalValue,
            bestMove: firstMove,
            pv: moves
          };
        }
      }

      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        const bestMove = parts[1] || null;
        
        if (!this.currentBestMove) {
          this.currentBestMove = bestMove;
        }

        if (this.callback) {
          const cb = this.callback;
          this.callback = null;

          const result = {
            evaluation: this.currentEval || 0,
            bestMove: this.currentBestMove,
            depth: this.currentDepth,
            pv: this.currentPv,
            alternatives: this.alternatives.filter(a => a) // Filtrar undefined
          };
          
          cb(result);
        }
      }
    };
  }

  evaluate(fen, depth = 20, movetime = 250, multipv = 1) {
    return new Promise((resolve) => {
      this.callback = resolve;
      this.currentEval = null;
      this.currentBestMove = null;
      this.currentDepth = 0;
      this.currentPv = [];
      this.alternatives = [];

      this.worker.postMessage("stop");
      this.worker.postMessage("ucinewgame");
      this.worker.postMessage(`setoption name MultiPV value ${multipv}`);

      if (fen === "start" || fen === "startpos") {
        this.worker.postMessage("position startpos");
      } else {
        this.worker.postMessage("position fen " + fen);
      }

      // SF17: depth y movetime configurables
      // Si movetime es null/undefined, solo usar depth (análisis más profundo sin límite de tiempo)
      if (movetime === null || movetime === undefined) {
        this.worker.postMessage(`go depth ${depth}`);
      } else {
        this.worker.postMessage(`go depth ${depth} movetime ${movetime}`);
      }
    });
  }

  waitUntilReady() {
    return this.readyPromise;
  }

  parseEvaluation(line) {
    const match = line.match(/score (cp|mate) (-?\d+)/);
    if (!match) return null;

    const type = match[1];
    const value = parseInt(match[2], 10);

    if (type === "cp") {
      return value / 100;
    }

    return value > 0 ? 100 : -100;
  }
}