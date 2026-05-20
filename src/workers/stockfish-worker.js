// Importar Stockfish 17.1 desde lila-stockfish-web
import StockfishModule from "lila-stockfish-web/sf171-79.js";

let stockfish = null;
let isReady = false;
let nnueLoaded = false;

// Funciones para cargar NNUE desde Lichess
async function loadNnue(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch NNUE: ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Inicializar Stockfish WASM
StockfishModule().then(async (sf) => {
  stockfish = sf;
  
  // Configurar listener para mensajes de salida
  stockfish.listen = (line) => {
    // Enviar mensajes al thread principal
    self.postMessage(line);
    
    if (line === "uciok") {
      // Cargar NNUE antes de configurar opciones
      if (!nnueLoaded) {
        loadNnueFiles();
      }
    }
    
    if (line === "readyok") {
      isReady = true;
      // Notificar al main thread que Stockfish está listo
      self.postMessage("STOCKFISH_READY");
    }
  };
  
  // Configurar handler de errores
  stockfish.onError = (msg) => {
    console.error("Stockfish error:", msg);
    self.postMessage("error: " + msg);
  };
  
  // Inicializar UCI
  stockfish.uci("uci");
}).catch((error) => {
  console.error("Error loading Stockfish:", error);
  self.postMessage("error: Failed to load Stockfish");
});

async function loadNnueFiles() {
  try {
    self.postMessage("info string Cargando red neuronal NNUE...");
    
    // Cargar NNUE desde archivos locales (3.4 MB)
    const nnueData = await loadNnue("/nnue/nn-37f18f62d772.nnue");
    stockfish.setNnueBuffer(nnueData, 0);
    
    nnueLoaded = true;
    self.postMessage("info string NNUE cargada correctamente");
    
    // Configurar opciones de Stockfish después de cargar NNUE
    stockfish.uci("setoption name Hash value 256");
    stockfish.uci("setoption name Threads value 4");
    stockfish.uci("setoption name MultiPV value 1");
    stockfish.uci("setoption name UCI_ShowWDL value false");
    stockfish.uci("isready");
  } catch (error) {
    console.error("Error loading NNUE:", error);
    self.postMessage("error Failed to load NNUE: " + error.message);
    // Continuar sin NNUE (evaluación clásica)
    nnueLoaded = true;
    stockfish.uci("setoption name Hash value 256");
    stockfish.uci("setoption name Threads value 4");
    stockfish.uci("setoption name MultiPV value 1");
    stockfish.uci("isready");
  }
}

// Recibir comandos del thread principal
self.onmessage = (e) => {
  if (!stockfish) {
    console.warn("Stockfish not yet loaded");
    return;
  }
  
  const command = e.data;
  
  if (!isReady && command === "stop") {
    stockfish.uci("uci");
    return;
  }
  
  // Enviar comando a Stockfish
  stockfish.uci(command);
};