import { LitElement, html } from "lit";
import './style.css';
import "./components/cs-chess-board.js";
import "./components/cs-move-list.js";
import "./components/cs-pgn-uploader.js";
import "./components/cs-explanation-panel.js";
import { Chess } from "chess.js";
import { version } from '../package.json';

import {
  loadGame,
  getFenAtMove,
  parseUciMove,
  getFenAfterMoveFromFen,
  getGameHeaders,
  getWinnerFromHeaders
} from "./lib/chess-logic.js";

import { StockfishService } from "./lib/stockfish.js";
import { classifyMove } from "./lib/move-classification.js";
import { buildOpeningsByMove } from "./lib/openings.js";
import { getCachedGame, cacheGame } from "./lib/game-cache.js";

export class CSChessApp extends LitElement {
  static properties = {
    moves: { type: Array },
    current: { type: Number },
    fen: { type: String },
    lastMove: { type: Object },
    bestMove: { type: Object },

    boardOrientation: { type: String },
    whitePlayer: { type: String },
    blackPlayer: { type: String },

    winnerColor: { type: String },
    winnerText: { type: String },

    whiteAccuracy: { type: Number },
    blackAccuracy: { type: Number },

    classifications: { type: Array },
    moveEvaluations: { type: Array },
    bestEvaluations: { type: Array },
    positionBestMoves: { type: Array },
    openingsByMove: { type: Array },
    pgnOpening: { type: String },
    pgnEco: { type: String },
    pgnVariation: { type: String },

    explanations: { type: Array },
    loadingExplanation: { type: Boolean },
    currentExplanation: { type: Object },
    
    aiApiKey: { type: String },
    aiApiKeyValid: { type: Boolean },
    aiApiKeyInput: { type: String },
    validatingApiKey: { type: Boolean },
    
    currentPositionAnalysis: { type: Object },
    analyzingPosition: { type: Boolean },

    isAnalyzing: { type: Boolean },
    analysisProgress: { type: Number },
    
    pgnText: { type: String },
    
    // Estado para variantes
    inVariant: { type: Boolean },
    variantPath: { type: Object },
    currentVariantClassification: { type: String },
    
    // Modo nueva partida
    isNewGame: { type: Boolean }
  };

  constructor() {
    super();

    this.moves = [];
    this.current = -1;
    this.fen = "start";
    this.lastMove = null;
    this.bestMove = null;

    this.boardOrientation = "white";
    this.whitePlayer = "";
    this.blackPlayer = "";

    this.winnerColor = null;
    this.winnerText = "";

    this.whiteAccuracy = null;
    this.blackAccuracy = null;

    this.classifications = [];
    this.moveEvaluations = [];
    this.bestEvaluations = [];
    this.positionBestMoves = [];
    this.positionAlternatives = [];
    this.openingsByMove = [];
    this.pgnOpening = "";
    this.pgnEco = "";
    this.pgnVariation = "";

    this.explanations = [];
    this.loadingExplanation = false;
    this.currentExplanation = null;
    this._explanationCache = new Map();
    
    // API Key para IA
    this.aiApiKey = localStorage.getItem('chess-scouter-ai-key') || '';
    this.aiApiKeyValid = false;
    this.aiApiKeyInput = this.aiApiKey; // Pre-rellenar input si existe la key
    this.validatingApiKey = false;
    
    this.currentPositionAnalysis = null;
    this.analyzingPosition = false;

    this.isAnalyzing = false;
    this.analysisProgress = 0;
    
    this.pgnText = "";
    
    // Estado de variantes
    this.inVariant = false;
    this.variantPath = null; // { mainMoveIndex, variantIndex, moveIndexInVariant, subVariantPath }
    // Estructura: { moveIndex: [{ moves, evaluations, bestMoves, bestEvaluations, startFen, subVariants }] }
    // subVariants tiene la misma estructura recursiva
    this.userVariants = {};
    this.currentVariantClassification = null;
    
    // Modo nueva partida
    this.isNewGame = false;

    this.engine = new StockfishService();
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKey);
    
    // NO validar automáticamente - el usuario debe hacer clic en "Conectar"
    // Solo pre-rellenar el input si hay una key guardada
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKey);
    super.disconnectedCallback();
  }

  async validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
      this.aiApiKeyValid = false;
      return false;
    }

    this.validatingApiKey = true;
    this.requestUpdate();

    try {
      // Validar con Gemini API directamente (no requiere servidor local)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
        {
          method: 'GET',
        }
      );

      if (response.ok) {
        this.aiApiKey = apiKey;
        this.aiApiKeyValid = true;
        localStorage.setItem('chess-scouter-ai-key', apiKey);
        this.validatingApiKey = false;
        this.requestUpdate();
        return true;
      } else {
        // API key inválida
        this.aiApiKeyValid = false;
        this.aiApiKey = '';
        this.aiApiKeyInput = apiKey; // Mantener para que usuario vea qué escribió
        localStorage.removeItem('chess-scouter-ai-key');
        this.validatingApiKey = false;
        this.requestUpdate();
        alert('❌ API Key de Gemini inválida.\n\nVerifica:\n1. Que sea una key de Google AI Studio\n2. Que comience con "AIza..."\n3. Que esté activa en https://aistudio.google.com/app/apikey');
        return false;
      }
    } catch (error) {
      console.error('Error validando API key:', error);
      this.aiApiKeyValid = false;
      this.aiApiKey = '';
      this.aiApiKeyInput = apiKey;
      localStorage.removeItem('chess-scouter-ai-key');
      this.validatingApiKey = false;
      this.requestUpdate();
      alert('❌ Error de conexión al validar la API key.\n\nVerifica tu conexión a internet.');
      return false;
    }
  }

  handleApiKeySubmit = async (e) => {
    e.preventDefault();
    await this.validateApiKey(this.aiApiKeyInput);
  }

  handleApiKeyInput = (e) => {
    this.aiApiKeyInput = e.target.value;
  }

  disconnectApiKey = () => {
    this.aiApiKey = '';
    this.aiApiKeyValid = false;
    this.aiApiKeyInput = '';
    localStorage.removeItem('chess-scouter-ai-key');
    this.requestUpdate();
  }

  render() {

    return html`
      <div class="app-header">
        <h1>
          ♟Chess Scouter♙
          <span style="font-size: 0.45em; color: #999; font-weight: normal; margin-left: 8px;">@AlexArroyoDuque</span>
        </h1>
      </div>

      <div class="main-layout">
        <!-- Columna izquierda: Barra de evaluación + Tablero -->
        <div class="board-column">
          <div class="board-with-eval">
            <!-- Barra de evaluación vertical -->
            ${this.moves.length > 0
              ? html`
                  <div class="eval-bar-vertical">
                    ${this.renderVerticalEvalBar()}
                  </div>
                `
              : ""}

            <!-- Tablero -->
            <cs-chess-board
              .whitePlayer=${this.whitePlayer}
              .blackPlayer=${this.blackPlayer}
              .fen=${this.fen}
              .lastMove=${this.lastMove}
              .bestMove=${this.bestMove}
              .suggestedMove=${this.currentPositionAnalysis?.bestMoveObj}
              .alternativeMoves=${this.inVariant 
                ? (this.currentPositionAnalysis?.alternatives || [])
                : (this.positionAlternatives?.[this.current] || [])}
              .inVariant=${this.inVariant}
              .orientation=${this.boardOrientation}
              .winnerColor=${this.winnerColor}
              .moveClassification=${this.inVariant ? this.currentVariantClassification : (this.current >= 0 ? this.classifications?.[this.current] : null)}
              .isNewGame=${this.isNewGame}
              @piece-moved=${this.handlePieceMoved}
            ></cs-chess-board>
          </div>
        </div>

        <!-- Columna derecha: Movimientos y análisis -->
        <div class="moves-column">
          ${!this.moves.length && !this.isNewGame
            ? html`
                <div class="panel">
                  <cs-pgn-uploader @pgn-loaded=${this.loadPgn}></cs-pgn-uploader>
                  
                  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #333;">
                    <button 
                      class="new-game-btn" 
                      @click=${this.startNewGame}
                      style="padding: 12px 24px; font-size: 16px; background: linear-gradient(135deg, #81b64c 0%, #5a8536 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: transform 0.2s;"
                      @mouseover=${e => e.target.style.transform = 'scale(1.05)'}
                      @mouseout=${e => e.target.style.transform = 'scale(1)'}
                    >
                      🆕 Nueva Partida
                    </button>
                    <div style="margin-top: 12px; color: #999; font-size: 13px;">
                      Crea tu propia partida con análisis en tiempo real
                    </div>
                  </div>
                </div>
              `
            : ""}
          
          ${this.isNewGame && this.moves.length === 0
            ? html`
                <div class="panel">
                  <div class="new-game-info" style="text-align: center; padding: 20px;">
                    <h2 style="color: #81b64c; margin: 0 0 10px 0;">🆕 Nueva Partida</h2>
                    <p style="color: #ccc; margin: 0 0 20px 0;">
                      Mueve las piezas en el tablero
                      <br>
                      <small style="color: #999;">Stockfish analizará cada posición</small>
                    </p>
                  </div>
                </div>
              `
            : ""}

          ${this.isAnalyzing
            ? html`
                <div class="panel">
                  <div class="analysis-progress">
                    <div class="analysis-text">
                      <strong>🔍 Analizando con Stockfish 17...</strong>
                      <br>
                      <span style="font-size: 24px; font-weight: bold; color: #81b64c;">
                        ${this.analysisProgress}/${this.moves.length}
                      </span>
                      <span style="color: #999; font-size: 13px;">movimientos</span>
                    </div>
                    <div class="progress-bar">
                      <div 
                        class="progress-fill" 
                        style="width: ${(this.analysisProgress / this.moves.length) * 100}%"
                      ></div>
                    </div>
                    <div style="text-align: center; margin-top: 12px; color: #999; font-size: 12px;">
                      Por favor espera, no navegues durante el análisis
                    </div>
                  </div>
                </div>
              `
            : ""}

          ${this.moves.length > 0 && !this.isAnalyzing
            ? html`
                <div class="panel">
                  ${this.pgnOpening ? html`
                    <div class="opening-info">
                      <div class="opening-name">${this.pgnOpening}</div>
                      <div class="opening-eco">
                        ${this.pgnVariation ? html`${this.pgnVariation} · ` : ""}
                        ${this.pgnEco ? html`ECO ${this.pgnEco}` : ""}
                      </div>
                    </div>
                  ` : ""}
                  
                  <!-- Banner del mejor movimiento - siempre visible para evitar saltos -->
                  ${this.current >= 0 || this.inVariant ? html`
                    <div class="best-move-banner">
                      ${(() => {
                        let bestMoveToShow = null;
                        let bestMoveSan = null;
                        let bestEval = null;
                        
                        if (this.inVariant && this.variantPath) {
                          if (this.bestMove && this.bestMove.san) {
                            bestMoveToShow = this.bestMove;
                            bestMoveSan = this.bestMove.san;
                            const variant = this.getVariantAtPath(this.variantPath.path);
                            const moveIdx = this.variantPath.moveIndexInVariant;
                            bestEval = variant?.bestEvaluations?.[moveIdx];
                          } else {
                            const variant = this.getVariantAtPath(this.variantPath.path);
                            const moveIdx = this.variantPath.moveIndexInVariant;
                            
                            if (variant && variant.bestMoves && variant.bestMoves[moveIdx]) {
                              bestMoveToShow = variant.bestMoves[moveIdx];
                              bestMoveSan = typeof bestMoveToShow === 'string' 
                                ? bestMoveToShow 
                                : bestMoveToShow?.san;
                              bestEval = variant.bestEvaluations?.[moveIdx];
                            }
                          }
                        } else if (this.current >= 0) {
                          // En línea principal
                          bestMoveToShow = this.bestMove;
                          bestMoveSan = bestMoveToShow?.san;
                          bestEval = this.bestEvaluations?.[this.current];
                        }
                        
        if (bestMoveSan && typeof bestMoveSan === 'string') {
                          const alternatives = this.inVariant 
                            ? (this.currentPositionAnalysis?.alternatives || [])
                            : (this.positionAlternatives?.[this.current] || []);
                          return html`
                            <div class="best-move-content">
                              <div class="best-move-text">
                                <span class="best-move-san">${this.formatSanWithSymbols(bestMoveSan)}</span>
                                <span class="best-move-label">es el mejor</span>
                              </div>
                              <span class="best-move-eval">
                                ${this.formatEval(bestEval ?? 0)}
                              </span>
                            </div>
                            ${alternatives.length > 0 ? html`
                              <div class="alternatives">
                                ${alternatives.map(alt => html`
                                  <div class="alternative">
                                    <span class="alternative-move">${this.formatSanWithSymbols(alt.san)}</span>
                                    <span class="alternative-eval">${this.formatEval(alt.evaluation)}</span>
                                  </div>
                                `)}
                              </div>
                            ` : ''}
                          `;
                        } else if (this.inVariant && this.analyzingPosition) {
                          // En variante pero aún analizando
                          return html`
                            <div class="best-move-text">
                              <span class="best-move-placeholder">🔍 Analizando posición...</span>
                            </div>
                          `;
                        } else {
                          return html`
                            <div class="best-move-text">
                              <span class="best-move-placeholder">Movimiento de libro</span>
                            </div>
                          `;
                        }
                      })()}
                    </div>
                  ` : ""}
                  
                  <cs-move-list
                    .moves=${this.moves}
                    .current=${this.current}
                    .classifications=${this.classifications}
                    .moveEvaluations=${this.moveEvaluations}
                    .openingsByMove=${this.openingsByMove}
                    .inVariant=${this.inVariant}
                    .variantPath=${this.variantPath}
                    .userVariants=${this.userVariants}
                    @move-selected=${this.selectMove}
                    @variant-selected=${this.selectVariantMove}
                  ></cs-move-list>
                  
                  <div class="nav-controls" style="margin-top: 12px;">
                    <button @click=${this.goStart} ?disabled=${this.current < 0}>
                      ⏮
                    </button>
                    <button @click=${this.goPrev} ?disabled=${this.current < 0}>
                      ◀
                    </button>
                    <button @click=${this.goNext} ?disabled=${this.current >= this.moves.length - 1}>
                      ▶
                    </button>
                    <button @click=${this.goEnd} ?disabled=${this.current >= this.moves.length - 1}>
                      ⏭
                    </button>
                    <button class="flip-btn" @click=${this.toggleBoardOrientation}>
                      🔄
                    </button>
                  </div>
                </div>
              `
            : ""}

          ${this.current >= 0 && !this.isAnalyzing
            ? html`
                <div class="panel">
                  <!-- Sistema de API Key para IA -->
                  ${!this.aiApiKeyValid
                    ? html`
                        <div class="ai-api-key-setup">
                          <h3>🔑 Configurar API Key</h3>
                          <p style="font-size: 13px; color: #999; margin-bottom: 12px;">
                            Introduce tu API key de Google Gemini para habilitar el análisis con IA
                          </p>
                          <form @submit=${this.handleApiKeySubmit} class="api-key-form">
                            <input
                              type="password"
                              placeholder="AIza..."
                              .value=${this.aiApiKeyInput}
                              @input=${this.handleApiKeyInput}
                              class="api-key-input"
                              ?disabled=${this.validatingApiKey}
                            />
                            <button
                              type="submit"
                              class="api-key-submit-btn"
                              ?disabled=${this.validatingApiKey || !this.aiApiKeyInput}
                            >
                              ${this.validatingApiKey
                                ? html`<span class="ai-btn-spinner"></span> Validando...`
                                : '✓ Conectar'}
                            </button>
                          </form>
                        </div>
                      `
                    : html`
                        <div class="ai-section">
                          <div class="ai-header">
                            <span class="ai-status">✓ IA Conectada: <strong>gemini-2.5-flash</strong></span>
                            <button class="disconnect-api-btn" @click=${this.disconnectApiKey}>
                              🔓 Desconectar
                            </button>
                          </div>
                          
                          ${this.inVariant || this.classifications[this.current] !== 'book'
                            ? html`
                                <button
                                  class="ai-analyze-btn"
                                  @click=${this.explainCurrentMove}
                                  ?disabled=${this.loadingExplanation}
                                >
                                  ${this.loadingExplanation
                                    ? html`<span class="ai-btn-spinner"></span> Analizando…`
                                    : '🧠 Analizar con IA'}
                                </button>
                              `
                            : ''}
                        </div>
                      `}

                  <cs-explanation-panel
                    .explanation=${this.currentExplanation}
                    .loading=${this.loadingExplanation}
                  ></cs-explanation-panel>
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  renderVerticalEvalBar() {
    // Si estamos en una variante y tenemos análisis, usar esa evaluación
    // Si no, usar la evaluación de la línea principal
    const evalValue = this.inVariant && this.currentPositionAnalysis?.evaluation != null
      ? this.currentPositionAnalysis.evaluation
      : this.moveEvaluations[this.current];
    
    const evalText = this.formatEval(evalValue);
    
    if (evalValue == null) {
      return html`
        <div class="eval-bar-fill white-bar" style="height: 50%;">
          <span class="eval-number dark-text">+0.00</span>
        </div>
        <div class="eval-bar-fill black-bar" style="height: 50%;"></div>
      `;
    }

    const whiteOnTop = this.boardOrientation === "black";

    const clampedEval = Math.max(-10, Math.min(10, evalValue));
    const whitePercentage = ((clampedEval + 10) / 20) * 100;
    const blackPercentage = 100 - whitePercentage;

    // Mostrar número si la parte superior tiene al menos 15% de altura
    const topPercentage = whiteOnTop ? whitePercentage : blackPercentage;
    const showNumber = topPercentage > 15;
    
    // Determinar el color del texto según el fondo de la parte superior
    const textClass = whiteOnTop ? 'dark-text' : 'light-text';

    if (whiteOnTop) {
      return html`
        <div class="eval-bar-fill white-bar" style="height: ${whitePercentage}%;">
          ${showNumber ? html`<span class="eval-number ${textClass}">${evalText}</span>` : ''}
        </div>
        <div class="eval-bar-fill black-bar" style="height: ${blackPercentage}%;"></div>
      `;
    } else {
      return html`
        <div class="eval-bar-fill black-bar" style="height: ${blackPercentage}%;">
          ${showNumber ? html`<span class="eval-number ${textClass}">${evalText}</span>` : ''}
        </div>
        <div class="eval-bar-fill white-bar" style="height: ${whitePercentage}%;"></div>
      `;
    }
  }

  handleKey = (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        this.goNext();
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.goPrev();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.goStart();
        break;
      case "ArrowDown":
        e.preventDefault();
        this.goEnd();
        break;
    }
  };

  toggleBoardOrientation = () => {
    this.boardOrientation =
      this.boardOrientation === "white" ? "black" : "white";
  };

  loadPgn = async (e) => {
    console.log('app.js loadPgn recibió evento:', e.detail.substring(0, 200));
    console.log('Longitud total del PGN:', e.detail.length);
    
    // Desactivar modo nueva partida si estaba activo
    this.isNewGame = false;
    
    this.pgnText = e.detail;
    
    // Marcar como analizando ANTES de cargar los movimientos
    // para que no se muestre el listado sin clasificaciones
    this.isAnalyzing = true;
    this.analysisProgress = 0;
    
    try {
      const result = loadGame(this.pgnText);
      this.moves = result.moves;
      console.log(`✅ Partida cargada: ${this.moves.length} movimientos`);
    } catch (error) {
      console.error('❌ Error al cargar PGN:', error);
      alert(`Error al cargar la partida: ${error.message}\n\nVerifica que el PGN sea válido.`);
      this.isAnalyzing = false;
      return;
    }
    
    if (this.moves.length === 0) {
      console.error('❌ No se encontraron movimientos en el PGN');
      alert('No se encontraron movimientos en el PGN. Verifica que el archivo sea correcto.');
      this.isAnalyzing = false;
      return;
    }
    
    this.current = -1;
    this.fen = "start";
    this.lastMove = null;
    this.bestMove = null;

    const headers = getGameHeaders(this.pgnText);
    this.whitePlayer = headers.White || "White";
    this.blackPlayer = headers.Black || "Black";
    this.winnerColor = getWinnerFromHeaders(headers);
    this.pgnOpening = headers.Opening || "";
    this.pgnEco = headers.ECO || "";
    this.pgnVariation = headers.Variation || "";

    if (this.winnerColor === "white") {
      this.winnerText = `${this.whitePlayer} wins`;
    } else if (this.winnerColor === "black") {
      this.winnerText = `${this.blackPlayer} wins`;
    } else if (headers.Result === "1/2-1/2") {
      this.winnerText = "Draw";
    } else {
      this.winnerText = "";
    }

    this.classifications = new Array(this.moves.length).fill(null);
    this.moveEvaluations = new Array(this.moves.length).fill(null);
    this.bestEvaluations = new Array(this.moves.length).fill(null);
    this.positionBestMoves = new Array(this.moves.length).fill(null);
    this.positionAlternatives = new Array(this.moves.length).fill(null);
    this.explanations = new Array(this.moves.length).fill(null);
    this.currentExplanation = null;
    this._explanationCache.clear();
    this.openingsByMove = buildOpeningsByMove(this.moves);
    
    // Limpiar variantes y modo variante
    this.userVariants = {};
    this.inVariant = false;
    this.variantPath = null;
    this.currentVariantClassification = null;

    // Verificar si esta partida ya está en caché
    const cachedData = getCachedGame(this.pgnText);
    
    // Solo usar caché si tiene alternativas (caché válido y actualizado)
    if (cachedData && cachedData.positionAlternatives) {
      // Usar datos cacheados - análisis instantáneo
      console.log('⚡ Usando análisis cacheado - carga instantánea');
      this.classifications = [...cachedData.classifications];
      this.moveEvaluations = [...cachedData.moveEvaluations];
      this.bestEvaluations = [...cachedData.bestEvaluations];
      this.positionBestMoves = [...cachedData.positionBestMoves];
      this.positionAlternatives = [...cachedData.positionAlternatives];
      
      this.isAnalyzing = false;
      this.requestUpdate();
      
      // Avanzar al primer movimiento
      if (this.moves.length > 0) {
        this.updatePosition(0);
      }
    } else {
      // Analizar desde cero con Stockfish (caché no existe, es obsoleto, o no tiene alternativas)
      if (cachedData && !cachedData.positionAlternatives) {
        console.log('⚠️ Caché obsoleto detectado (sin alternativas) - forzando re-análisis');
      }
      this.analyzeEntireGame();
    }
    
    this.requestUpdate();
  };

  startNewGame = () => {
    console.log('🆕 Iniciando nueva partida desde cero...');
    
    // Reiniciar todo el estado
    this.isNewGame = true;
    this.moves = [];
    this.current = -1;
    this.fen = "start";
    this.lastMove = null;
    this.bestMove = null;
    
    this.whitePlayer = "Blancas";
    this.blackPlayer = "Negras";
    this.winnerColor = null;
    this.winnerText = "";
    
    this.classifications = [];
    this.moveEvaluations = [];
    this.bestEvaluations = [];
    this.positionBestMoves = [];
    this.positionAlternatives = [];
    this.openingsByMove = [];
    this.pgnOpening = "";
    this.pgnEco = "";
    this.pgnVariation = "";
    
    this.explanations = [];
    this.currentExplanation = null;
    this._explanationCache = new Map();
    
    this.isAnalyzing = false;
    this.analysisProgress = 0;
    this.pgnText = "";
    
    this.inVariant = false;
    this.variantPath = null;
    this.userVariants = {};
    this.currentVariantClassification = null;
    
    console.log('✅ Nueva partida iniciada - tablero listo para jugar');
    this.requestUpdate();
  };

  async analyzeEntireGame() {
    console.log('🔍 Iniciando análisis con Stockfish 17...');
    
    // Esperar a que Stockfish esté completamente cargado
    await this.engine.waitUntilReady();
    console.log('✅ Stockfish listo, comenzando análisis...');
    
    const chess = new Chess();
    this.isAnalyzing = true;
    this.analysisProgress = 0;

    const bestMoves = new Array(this.moves.length).fill(null);
    const classifications = new Array(this.moves.length).fill(null);
    const moveEvaluations = new Array(this.moves.length).fill(null);
    const bestEvaluations = new Array(this.moves.length).fill(null);
    const positionAlternatives = new Array(this.moves.length).fill(null);

    // Pre-evaluar todas las posiciones (solo UNA vez por posición)
    const positionEvals = [];
    
    for (let i = 0; i < this.moves.length; i++) {
      const fenBefore = chess.fen();
      const playerColor = chess.turn();
      
      // Evaluar posición ANTES del movimiento con multipv para obtener alternativas
      const result = await this.engine.evaluate(fenBefore, 22, 350, 3);
      let evaluation = result.evaluation;
      
      // Normalizar a perspectiva de blancas
      if (playerColor === 'b') {
        evaluation = -evaluation;
      }
      
      positionEvals.push({
        evaluation,
        bestMoveUci: result.bestMove,
        playerColor: playerColor === 'w' ? 'white' : 'black',
        alternatives: result.alternatives || []
      });
      
      // Hacer el movimiento para la siguiente iteración
      chess.move(this.moves[i]);
      
      this.analysisProgress = i + 1;
      this.requestUpdate();
    }
    
    // Evaluar posición final (después del último movimiento)
    const finalFen = chess.fen();
    const finalResult = await this.engine.evaluate(finalFen, 22, 350, 3);
    let finalEval = finalResult.evaluation;
    if (chess.turn() === 'b') {
      finalEval = -finalEval;
    }
    positionEvals.push({ evaluation: finalEval, bestMoveUci: null, playerColor: null });

    // Ahora clasificar todos los movimientos usando las evaluaciones pre-calculadas
    for (let i = 0; i < this.moves.length; i++) {
      const playedMove = this.moves[i];
      const isBook = !!this.openingsByMove[i]?.isBook;
      
      const evalBefore = positionEvals[i].evaluation; // Eval "óptima" antes del movimiento
      const evalAfter = positionEvals[i + 1].evaluation; // Eval después del movimiento jugado
      const bestMoveUci = positionEvals[i].bestMoveUci;
      const playerColor = positionEvals[i].playerColor;
      
      moveEvaluations[i] = evalAfter;
      bestEvaluations[i] = evalBefore;

      // Convertir mejor movimiento UCI a SAN y guardar el objeto completo
      if (bestMoveUci) {
        const chessCopy = new Chess();
        // Reconstruir la posición hasta antes de este movimiento
        for (let j = 0; j < i; j++) {
          // Asegurarse de usar el SAN del movimiento
          const moveToApply = typeof this.moves[j] === 'string' ? this.moves[j] : this.moves[j].san;
          chessCopy.move(moveToApply);
        }
        
        try {
          const moveObj = chessCopy.move({
            from: bestMoveUci.substring(0, 2),
            to: bestMoveUci.substring(2, 4),
            promotion: bestMoveUci.length > 4 ? bestMoveUci[4] : undefined
          });
          // Guardar el objeto completo para tener acceso a from/to
          bestMoves[i] = moveObj;
        } catch (e) {
          // Silenciosamente ignorar errores de conversión (es normal con posiciones complejas)
          bestMoves[i] = null;
        }
      }

      // Procesar alternativas (multipv 2 y 3)
      const alternatives = positionEvals[i].alternatives || [];
      if (alternatives.length > 0) {
        const chessCopy = new Chess();
        for (let j = 0; j < i; j++) {
          const moveToApply = typeof this.moves[j] === 'string' ? this.moves[j] : this.moves[j].san;
          chessCopy.move(moveToApply);
        }
        
        const processedAlternatives = [];
        // Empezar desde índice 1 (saltar el mejor que ya tenemos)
        for (let altIdx = 1; altIdx < Math.min(alternatives.length, 3); altIdx++) {
          const alt = alternatives[altIdx];
          if (alt && alt.bestMove) {
            try {
              const chessClone = new Chess(chessCopy.fen());
              const from = alt.bestMove.substring(0, 2);
              const to = alt.bestMove.substring(2, 4);
              const promotion = alt.bestMove.length > 4 ? alt.bestMove[4] : undefined;
              
              const moveObj = chessClone.move({ from, to, promotion });
              if (moveObj) {
                // Normalizar evaluación
                let altEval = alt.evaluation;
                if (playerColor === 'black') {
                  altEval = -altEval;
                }
                processedAlternatives.push({
                  san: moveObj.san,
                  from: from,
                  to: to,
                  promotion: promotion,
                  evaluation: altEval
                });
              }
            } catch (e) {
              // Ignorar movimientos inválidos
            }
          }
        }
        positionAlternatives[i] = processedAlternatives;
      }

      // Clasificar el movimiento
      if (isBook) {
        classifications[i] = "book";
      } else {
        classifications[i] = classifyMove({
          playedMove,
          bestMove: bestMoves[i],
          playedEval: evalAfter,
          bestEval: evalBefore,
          playerColor,
          isBook
        });

        // Debug logging (deshabilitado en producción)
        // const loss = playerColor === "white"
        //   ? (evalBefore - evalAfter)
        //   : (evalAfter - evalBefore);
        // console.log(`${i + 1}. ${playerColor} ${playedMove.san}`, {
        //   before: evalBefore.toFixed(2),
        //   after: evalAfter.toFixed(2),
        //   loss: loss.toFixed(2),
        //   bestMove: bestMoves[i] || '(igual)',
        //   class: classifications[i]
        // });
      }
    }

    // Actualizar estado final
    this.positionBestMoves = [...bestMoves];
    this.classifications = [...classifications];
    this.moveEvaluations = [...moveEvaluations];
    this.bestEvaluations = [...bestEvaluations];
    this.positionAlternatives = [...positionAlternatives];
    
    // Guardar análisis en caché
    cacheGame(this.pgnText, {
      classifications: this.classifications,
      moveEvaluations: this.moveEvaluations,
      bestEvaluations: this.bestEvaluations,
      positionBestMoves: this.positionBestMoves,
      positionAlternatives: this.positionAlternatives
    });
    
    // Calcular precisión de cada jugador
    // this.calculateAccuracy(); // DESHABILITADO - no funciona correctamente
    
    this.requestUpdate();

    console.log('✅ Análisis completado con Stockfish 17');
    this.isAnalyzing = false;
    
    // Avanzar al primer movimiento después del análisis
    if (this.moves.length > 0) {
      this.updatePosition(0);
    }
    
    this.requestUpdate();
  }

  /* DESHABILITADO - Cálculo de precisión no funciona correctamente
  calculateAccuracy() {
    if (this.classifications.length === 0) return;

    let whiteAccuracies = [];
    let blackAccuracies = [];
    let whiteCpLosses = [];
    let blackCpLosses = [];

    console.log('🎯 === CÁLCULO DE PRECISIÓN (método Lichess) ===');
    console.log(`Total movimientos: ${this.moves.length}`);

    // Función de Lichess: convertir centipawns a win percentage (0-100)
    const cpToWinP = (cp) => {
      return 100 / (1 + Math.exp(-0.00368208 * cp));
    };

    for (let i = 0; i < this.moves.length; i++) {
      const classification = this.classifications[i];
      const isWhite = i % 2 === 0;
      const move = this.moves[i];
      const moveSan = move.san || move;
      
      // Saltar movimientos de libro
      if (classification === 'book') {
        console.log(`${i + 1}. ${moveSan} (${isWhite ? 'W' : 'B'}) - LIBRO (saltado)`);
        continue;
      }

      const evalBefore = this.bestEvaluations[i];
      const evalAfter = this.moveEvaluations[i];
      
      if (typeof evalBefore !== 'number' || typeof evalAfter !== 'number') {
        console.log(`${i + 1}. ${moveSan} (${isWhite ? 'W' : 'B'}) - Sin eval completa`);
        continue;
      }

      // Convertir a centipeones
      const evalBeforeCp = evalBefore * 100;
      const evalAfterCp = evalAfter * 100;

      // Convertir a win% desde perspectiva de BLANCAS
      const winPBeforeWhite = cpToWinP(evalBeforeCp);
      const winPAfterWhite = cpToWinP(evalAfterCp);
      
      // Convertir a perspectiva del jugador que mueve
      const winPBeforePlayer = isWhite ? winPBeforeWhite : (100 - winPBeforeWhite);
      const winPAfterPlayer = isWhite ? winPAfterWhite : (100 - winPAfterWhite);
      
      // Pérdida de win% (positiva cuando empeora)
      const winPLoss = Math.max(0, winPBeforePlayer - winPAfterPlayer);
      
      // Pérdida en centipeones
      const cpLoss = isWhite ? Math.max(0, evalBeforeCp - evalAfterCp) : Math.max(0, evalAfterCp - evalBeforeCp);

      // Fórmula de Lichess para accuracy del movimiento (con signo correcto)
      // accuracy = -103.1668 * e^(-0.04354 * winPLoss) + 103.1669
      const moveAccuracy = -103.1668 * Math.exp(-0.04354 * winPLoss) + 103.1669;
      const clampedAccuracy = Math.max(0, Math.min(100, moveAccuracy));

      console.log(`${i + 1}. ${moveSan} (${isWhite ? 'W' : 'B'}): eval ${evalBeforeCp.toFixed(0)} → ${evalAfterCp.toFixed(0)} cp | winP loss ${winPLoss.toFixed(2)}% | accuracy ${clampedAccuracy.toFixed(1)}%`);

      if (isWhite) {
        whiteAccuracies.push(clampedAccuracy);
        whiteCpLosses.push(cpLoss);
      } else {
        blackAccuracies.push(clampedAccuracy);
        blackCpLosses.push(cpLoss);
      }
    }

    console.log(`\n📊 Movimientos contados: Blancas=${whiteAccuracies.length}, Negras=${blackAccuracies.length}`);

    // Promediar las accuracies de cada movimiento
    const calcPlayerAccuracy = (accuracies) => {
      if (accuracies.length === 0) return null;
      const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      return Math.round(avg);
    };

    this.whiteAccuracy = calcPlayerAccuracy(whiteAccuracies);
    this.blackAccuracy = calcPlayerAccuracy(blackAccuracies);

    const whiteAvgCpLoss = whiteCpLosses.length > 0 ? whiteCpLosses.reduce((a, b) => a + b, 0) / whiteCpLosses.length : 0;
    const blackAvgCpLoss = blackCpLosses.length > 0 ? blackCpLosses.reduce((a, b) => a + b, 0) / blackCpLosses.length : 0;

    console.log(`\n✅ RESULTADO FINAL:`);
    console.log(`   Blancas: ${this.whiteAccuracy}% (pérdida promedio: ${whiteAvgCpLoss.toFixed(0)} cp)`);
    console.log(`   Negras: ${this.blackAccuracy}% (pérdida promedio: ${blackAvgCpLoss.toFixed(0)} cp)`);
    console.log(`\n📌 Esperado Lichess: Blancas 74% (39 cp), Negras 69% (101 cp)`);
  }
  */

  /** Clave única para cachear la explicación de la posición actual */
  _explanationKey() {
    if (this.inVariant && this.variantPath) {
      const { mainMoveIndex, variantIndex, moveIndexInVariant } = this.variantPath;
      return `var:${mainMoveIndex}:${variantIndex}:${moveIndexInVariant}`;
    }
    return `main:${this.current}`;
  }

  async explainCurrentMove() {
    if (this.loadingExplanation) return;

    // Para línea principal necesitamos al menos un movimiento seleccionado
    if (!this.inVariant && this.current < 0) return;

    const key = this._explanationKey();

    // Devolver del caché si ya existe
    if (this._explanationCache.has(key)) {
      this.currentExplanation = this._explanationCache.get(key);
      return;
    }

    let payload;

    if (this.inVariant && this.variantPath) {
      // --- VARIANTE ---
      const { mainMoveIndex, variantIndex, moveIndexInVariant } = this.variantPath;
      const variant = this.moves[mainMoveIndex]?.variants?.[variantIndex];
      if (!variant) return;

      // Reconstruir FEN antes del último movimiento de la variante
      const fenStart = mainMoveIndex === 0
        ? new Chess().fen()
        : getFenAtMove(this.moves, mainMoveIndex - 1);

      const chessTmp = new Chess(fenStart);
      for (let i = 0; i < moveIndexInVariant; i++) {
        chessTmp.move(variant[i]);
      }
      const fenBeforeLastMove = chessTmp.fen();
      const playerColor = chessTmp.turn() === 'w' ? 'white' : 'black';
      chessTmp.move(variant[moveIndexInVariant]);
      const fenAfterLastMove = chessTmp.fen();

      payload = {
        playedMove: variant[moveIndexInVariant],
        playerColor,
        evalBefore: null,
        playedEval: this.currentPositionAnalysis?.evaluation ?? null,
        bestMove: this.currentPositionAnalysis?.bestMoveSan ?? null,
        classification: 'variante',
        fenBefore: fenBeforeLastMove,
        fenAfter: fenAfterLastMove,
        moveNumber: mainMoveIndex + 1,
        isVariant: true
      };

    } else {
      // --- LÍNEA PRINCIPAL ---
      if (this.classifications[this.current] === 'book') return;

      const fenBefore = this.current === 0
        ? new Chess().fen()
        : getFenAtMove(this.moves, this.current - 1);
      const fenAfter = getFenAtMove(this.moves, this.current);

      // evalBefore: evaluación de la posición ANTES del movimiento (Stockfish en tiempo real)
      // evalAfter:  evaluación DESPUÉS del movimiento (datos de Lichess / PGN)
      const evalBefore = this.currentPositionAnalysis?.evaluation ?? this.bestEvaluations[this.current];
      const evalAfter  = this.moveEvaluations[this.current];

      const bestMove = this.currentPositionAnalysis?.bestMoveSan
        ?? (this.bestMove ? this.bestMoveUciText() : null);

      payload = {
        playedMove: this.moves[this.current]?.san ?? null,
        playerColor: this.current % 2 === 0 ? 'white' : 'black',
        evalBefore,
        playedEval: evalAfter,
        bestMove,
        classification: this.classifications[this.current],
        fenBefore,
        fenAfter,
        moveNumber: Math.floor(this.current / 2) + 1,
        isVariant: false
      };
    }

    this.loadingExplanation = true;
    this.currentExplanation = null;
    this.requestUpdate();

    console.log('🤖 === ENVIANDO A IA ===');
    console.log('📍 Posición:', this.inVariant ? `Variante (mov ${payload.moveNumber})` : `Movimiento ${payload.moveNumber}`);
    console.log('🎯 Movimiento jugado:', payload.playedMove);
    console.log('📊 Eval ANTES:', payload.evalBefore);
    console.log('📊 Eval DESPUÉS:', payload.playedEval);
    console.log('✨ Mejor movimiento:', payload.bestMove);
    console.log('🏷️ Clasificación:', payload.classification);
    console.log('♟️ FEN antes:', payload.fenBefore);
    console.log('♟️ FEN después:', payload.fenAfter);
    console.log('👤 Jugador:', payload.playerColor);
    console.log('📦 Payload completo:', JSON.stringify(payload, null, 2));

    try {
      // En producción (Cloudflare Pages) usa ruta relativa
      // En desarrollo usa la variable de entorno o localhost
      const apiUrl = import.meta.env.PROD 
        ? '/api/explain-move'  // Cloudflare Pages Functions (ruta relativa)
        : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/explain-move');
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          apiKey: this.aiApiKey
        })
      });

      const text = await res.text();
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      this._explanationCache.set(key, parsed);
      this.currentExplanation = parsed;

      // Mantener compatibilidad con el array legacy para línea principal
      if (!this.inVariant && this.current >= 0) {
        const next = [...this.explanations];
        next[this.current] = parsed;
        this.explanations = next;
      }

    } catch (err) {
      console.error("Error al obtener explicación IA:", err);
      const errorObj = {
        title: "Error de conexión",
        quality: "No se pudo contactar con el servidor de análisis. Asegúrate de que está en marcha (npm run server).",
        stockfishReasoning: "",
        opportunities: "",
        takeaway: ""
      };
      this._explanationCache.set(key, errorObj);
      this.currentExplanation = errorObj;
    }

    this.loadingExplanation = false;
    this.requestUpdate();
  }

  formatEval(value) {
    if (value == null) return "+0.00";
    if (Math.abs(value) > 50) {
      return value > 0 ? "M+" : "M-";
    }
    return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  }

  bestMoveUciText() {
    if (!this.bestMove) return "—";
    return `${this.bestMove.from}${this.bestMove.to}${this.bestMove.promotion ?? ""}`;
  }

  // Convierte notación SAN a símbolos Unicode (Nc3 → ♘c3)
  formatSanWithSymbols(san) {
    if (!san || typeof san !== 'string') return san || "";
    
    const pieceMap = {
      'K': '♔',
      'Q': '♕',
      'R': '♖',
      'B': '♗',
      'N': '♘'
    };
    
    const firstChar = san.charAt(0);
    if (pieceMap[firstChar]) {
      return pieceMap[firstChar] + san.slice(1);
    }
    return san;
  }

  bestMoveSAN() {
    if (!this.bestMove) return "—";
    
    const fenBefore = this.current === 0 ? "startpos" : getFenAtMove(this.moves, this.current - 1);
    const chess = new Chess(fenBefore === "startpos" ? undefined : fenBefore);
    
    try {
      const move = chess.move({
        from: this.bestMove.from,
        to: this.bestMove.to,
        promotion: this.bestMove.promotion
      });
      
      if (move) {
        return this.formatSanWithSymbols(move.san);
      }
    } catch (e) {
      console.error("Error converting UCI to SAN:", e);
    }
    
    return this.bestMoveUciText();
  }

  selectMove = (e) => {
    // Navegar en línea principal - resetear variante
    this.inVariant = false;
    this.variantPath = null;
    this.currentVariantClassification = null;
    this.currentPositionAnalysis = null; // Limpiar análisis de variante
    this.updatePosition(e.detail);
  };

  selectVariantMove = (e) => {
    const { variantPath, moveIndexInVariant } = e.detail;
    
    if (!variantPath || !variantPath.path) {
      // Formato antiguo para compatibilidad con variantes del PGN
      const { mainMoveIndex, variantIndex } = e.detail;
      this.inVariant = true;
      this.variantPath = { 
        path: [{ mainMoveIndex, variantIndex }],
        moveIndexInVariant: moveIndexInVariant ?? 0 
      };
      
      const varKey = `var:${mainMoveIndex}:${variantIndex}:${moveIndexInVariant ?? 0}`;
      this.currentExplanation = this._explanationCache.get(varKey) ?? null;
      
      this.showVariantPosition(
        this.variantPath, 
        moveIndexInVariant ?? 0
      );
      return;
    }
    
    // Nuevo formato con path completo
    this.inVariant = true;
    this.variantPath = {
      path: variantPath.path,
      moveIndexInVariant: moveIndexInVariant ?? 0
    };
    
    // Restaurar explicación desde caché (si existe)
    const pathStr = variantPath.path.map(p => `${p.mainMoveIndex}:${p.variantIndex}`).join('-');
    const varKey = `var:${pathStr}:${moveIndexInVariant ?? 0}`;
    this.currentExplanation = this._explanationCache.get(varKey) ?? null;
    
    // Calcular FEN para esta posición en la variante
    this.showVariantPosition(
      this.variantPath, 
      moveIndexInVariant ?? 0
    );
  };
  
  getVariantAtPath(path) {
    if (!path || path.length === 0) return null;
    
    let current = this.userVariants[path[0].mainMoveIndex]?.[path[0].variantIndex];
    
    for (let i = 1; i < path.length; i++) {
      if (!current || !current.subVariants) {
        return null;
      }
      current = current.subVariants[path[i].mainMoveIndex]?.[path[i].variantIndex];
    }
    
    return current;
  }

  showVariantPosition(variantPath, moveIndexInVariant) {
    try {
      if (!variantPath || !variantPath.path || variantPath.path.length === 0) {
        console.error('variantPath inválido');
        return;
      }
      
      // Obtener la variante usando el path
      const variant = this.getVariantAtPath(variantPath.path);
      
      if (!variant) {
        // Si no es variante de usuario, intentar con variante del PGN
        const mainMoveIndex = variantPath.path[0].mainMoveIndex;
        const variantIndex = variantPath.path[0].variantIndex;
        
        if (this.moves[mainMoveIndex]?.variants?.[variantIndex]) {
          // Variante del PGN original - obtener FEN desde la línea principal
          const pgnVariant = this.moves[mainMoveIndex].variants[variantIndex];
          const variantMoves = pgnVariant.map(moveSan => ({ san: moveSan }));
          const fenBefore = mainMoveIndex === 0 
            ? new Chess().fen()
            : getFenAtMove(this.moves, mainMoveIndex);
          
          // Aplicar movimientos
          const chess = new Chess(fenBefore);
          let lastMoveResult = null;
          
          for (let i = 0; i <= moveIndexInVariant; i++) {
            const moveObj = variantMoves[i];
            const result = chess.move(moveObj.san || moveObj);
            if (!result) {
              console.error(`Error aplicando movimiento de variante PGN: "${moveObj.san || moveObj}"`);
              throw new Error(`Invalid move: ${moveObj.san || moveObj}`);
            }
            
            if (i === moveIndexInVariant) {
              lastMoveResult = result;
            }
          }
          
          this.fen = chess.fen();
          this.lastMove = lastMoveResult ? {
            from: lastMoveResult.from,
            to: lastMoveResult.to,
            san: lastMoveResult.san
          } : null;
          
          this.bestMove = null;
          this.requestUpdate();
          this.analyzeVariantPosition(this.fen);
          return;
        }
        
        console.error('Variante no encontrada');
        return;
      }
      
      // Variante de usuario encontrada
      const chess = new Chess(variant.startFen);
      let lastMoveResult = null;
      
      for (let i = 0; i <= moveIndexInVariant; i++) {
        const moveObj = variant.moves[i];
        if (!moveObj) break;
        
        const result = chess.move(moveObj.san || moveObj);
        if (!result) {
          console.error(`Error aplicando movimiento de variante: "${moveObj.san || moveObj}"`);
          throw new Error(`Invalid move: ${moveObj.san || moveObj}`);
        }
        
        if (i === moveIndexInVariant) {
          lastMoveResult = result;
        }
      }
      
      const finalFen = chess.fen();
      this.fen = finalFen;
      
      // Establecer lastMove para mostrar flecha amarilla del movimiento de la variante
      this.lastMove = lastMoveResult ? {
        from: lastMoveResult.from,
        to: lastMoveResult.to,
        san: lastMoveResult.san
      } : null;
      
      // Obtener bestMove de la variante si está disponible
      const bestMoveAtPos = variant.bestMoves?.[moveIndexInVariant] || null;
      this.bestMove = bestMoveAtPos;
      
      // Calcular clasificación del movimiento actual de la variante
      if (moveIndexInVariant >= 0 && variant.evaluations && variant.bestEvaluations) {
        // Para clasificar movimiento i necesitamos:
        // - bestEval: evaluación ANTES del movimiento (índice i)
        // - playedEval: evaluación DESPUÉS del movimiento (índice i + 1)
        // Ambos usan bestEvaluations que considera la mejor respuesta del oponente
        const bestEval = variant.bestEvaluations[moveIndexInVariant];
        const playedEval = variant.bestEvaluations[moveIndexInVariant + 1];
        const playedMove = variant.moves[moveIndexInVariant];
        const bestMove = variant.bestMoves[moveIndexInVariant];
        
        if (typeof playedEval === 'number' && typeof bestEval === 'number') {
          // Determinar color del jugador basado en el FEN inicial de la variante
          const startChess = new Chess(variant.startFen);
          const startingTurn = startChess.turn();
          // Calcular turno actual: si empezamos con blancas y moveIndex es par, es turno de blancas
          const isWhiteMove = (startingTurn === 'w' && moveIndexInVariant % 2 === 0) ||
                             (startingTurn === 'b' && moveIndexInVariant % 2 === 1);
          const playerColor = isWhiteMove ? 'white' : 'black';
          
          this.currentVariantClassification = classifyMove({
            playedMove,
            bestMove,
            playedEval,
            bestEval,
            playerColor,
            isBook: false
          });
        } else {
          this.currentVariantClassification = null;
        }
      } else {
        this.currentVariantClassification = null;
      }
      
      this.requestUpdate();
      
      // Analizar la posición resultante de la variante
      this.analyzeVariantPosition(finalFen);
      
    } catch (error) {
      console.error('Error mostrando posición de variante:', error);
    }
  }

  async analyzeVariantPosition(fen) {
    this.currentPositionAnalysis = null;
    this.analyzingPosition = true;
    this.requestUpdate();

    try {
      // Analizar con Stockfish - multipv 3 para alternativas
      const analysis = await this.engine.evaluate(fen, 20, 250, 3);
      
      // Normalizar evaluación a perspectiva de blancas
      const chess = new Chess(fen);
      let normalizedEval = analysis.evaluation;
      if (chess.turn() === 'b') {
        normalizedEval = -normalizedEval;
      }
      
      // Convertir el mejor movimiento UCI a objeto
      let bestMoveObj = null;
      let bestMoveSan = "";
      
      if (analysis.bestMove && typeof analysis.bestMove === 'string' && analysis.bestMove.length >= 4) {
        const chess = new Chess(fen);
        const from = analysis.bestMove.substring(0, 2);
        const to = analysis.bestMove.substring(2, 4);
        const promotion = analysis.bestMove.length > 4 ? analysis.bestMove.substring(4, 5) : undefined;
        
        bestMoveObj = { from, to, promotion };
        
        try {
          const move = chess.move({ from, to, promotion });
          if (move) {
            bestMoveSan = move.san;
          } else {
            bestMoveSan = analysis.bestMove;
          }
        } catch (e) {
          console.warn('No se pudo convertir bestMove a SAN:', analysis.bestMove);
          bestMoveSan = analysis.bestMove;
        }
      }
      
      // Procesar alternativas
      const alternatives = [];
      if (analysis.alternatives && analysis.alternatives.length > 1) {
        for (let i = 1; i < Math.min(analysis.alternatives.length, 3); i++) {
          const alt = analysis.alternatives[i];
          if (alt && alt.bestMove) {
            const from = alt.bestMove.substring(0, 2);
            const to = alt.bestMove.substring(2, 4);
            const promotion = alt.bestMove.length > 4 ? alt.bestMove.substring(4, 5) : undefined;
            
            try {
              const chessClone = new Chess(fen);
              const move = chessClone.move({ from, to, promotion });
              if (move) {
                // Normalizar evaluación según perspectiva
                let altEval = alt.evaluation;
                if (chess.turn() === 'b') {
                  altEval = -altEval;
                }
                alternatives.push({
                  san: move.san,
                  from: from,
                  to: to,
                  promotion: promotion,
                  evaluation: altEval
                });
              }
            } catch (e) {
              // Ignorar movimientos inválidos
            }
          }
        }
      }
      
      this.currentPositionAnalysis = {
        evaluation: normalizedEval,
        depth: analysis.depth,
        bestMove: bestMoveSan,
        bestMoveObj: bestMoveObj,
        isVariant: true,
        alternatives: alternatives
      };

    } catch (error) {
      console.error('Error al analizar variante:', error);
      this.currentPositionAnalysis = null;
    } finally {
      this.analyzingPosition = false;
      this.requestUpdate();
    }
  }

  analyzeCurrentPosition = async () => {
    if (this.current < 0) return;
    if (this.analyzingPosition) return;

    this.analyzingPosition = true;
    this.currentPositionAnalysis = null;
    this.requestUpdate();

    try {
      // Obtener FEN ANTES del movimiento actual
      const fenBefore = this.current === 0 
        ? "startpos" 
        : getFenAtMove(this.moves, this.current - 1);
      
      const fen = fenBefore === "startpos" ? new Chess().fen() : fenBefore;
      
      console.log(`🔍 Analizando posición ${this.current + 1}...`);
      
      // Análisis profundo bajo demanda: depth 30 con multipv 3 para obtener alternativas
      const analysis = await this.engine.evaluate(fen, 30, 10000, 3); // Depth 30, 10 segundos, 3 líneas
      
      // Convertir el mejor movimiento UCI a SAN
      let bestMoveSan = "";
      if (analysis.bestMove) {
        const chess = new Chess(fen);
        const from = analysis.bestMove.substring(0, 2);
        const to = analysis.bestMove.substring(2, 4);
        const promotion = analysis.bestMove.length > 4 ? analysis.bestMove.substring(4, 5) : undefined;
        
        try {
          const move = chess.move({ from, to, promotion });
          if (move) {
            bestMoveSan = move.san;
          }
        } catch (e) {
          bestMoveSan = analysis.bestMove;
        }
      }

      // Obtener línea principal (si está disponible)
      const pv = analysis.pv || [];

      // Procesar alternativas (multipv)
      const alternatives = [];
      if (analysis.alternatives && analysis.alternatives.length > 1) {
        const chess = new Chess(fen);
        // Empezar desde índice 1 (saltar la mejor que ya tenemos)
        for (let i = 1; i < Math.min(analysis.alternatives.length, 3); i++) {
          const alt = analysis.alternatives[i];
          if (alt && alt.bestMove) {
            const from = alt.bestMove.substring(0, 2);
            const to = alt.bestMove.substring(2, 4);
            const promotion = alt.bestMove.length > 4 ? alt.bestMove.substring(4, 5) : undefined;
            
            try {
              const chessClone = new Chess(fen);
              const move = chessClone.move({ from, to, promotion });
              if (move) {
                alternatives.push({
                  san: move.san,
                  from: from,
                  to: to,
                  promotion: promotion,
                  evaluation: alt.evaluation
                });
              }
            } catch (e) {
              // Ignorar movimientos inválidos
            }
          }
        }
      }

      this.currentPositionAnalysis = {
        evaluation: analysis.evaluation,
        depth: analysis.depth,
        bestMove: bestMoveSan,
        bestMoveSan: bestMoveSan,
        pv: pv.slice(0, 8),
        alternatives: alternatives
      };

      console.log('✅ Análisis completado:', this.currentPositionAnalysis);
    } catch (error) {
      console.error('❌ Error al analizar posición:', error);
      alert('Error al analizar la posición. Inténtalo de nuevo.');
    } finally {
      this.analyzingPosition = false;
      this.requestUpdate();
    }
  };

  updatePosition(index) {
    if (index < 0) {
      this.current = -1;
      this.fen = "start";
      this.lastMove = null;
      this.bestMove = null;
      this.currentPositionAnalysis = null;
      this.currentExplanation = null;
      
      // Salir del modo variante
      this.inVariant = false;
      this.variantPath = null;
      
      this.requestUpdate();
      return;
    }

    this.current = index;
    this.fen = getFenAtMove(this.moves, index);
    this.lastMove = this.moves[index];
    
    // Salir del modo variante al volver a la línea principal
    this.inVariant = false;
    this.variantPath = null;

    if (this.openingsByMove[index]?.isBook) {
      this.bestMove = null;
    } else {
      this.bestMove = this.positionBestMoves?.[index] ?? null;
    }

    // Restaurar explicación desde caché (si existe)
    const cacheKey = `main:${index}`;
    this.currentExplanation = this._explanationCache.get(cacheKey) ?? null;

    // Analizar automáticamente la posición
    this.analyzeCurrentPositionAuto();
    
    this.requestUpdate();
  }

  handlePieceMoved = async (e) => {
    const { from, to } = e.detail;
    
    // MODO NUEVA PARTIDA: Añadir movimiento a la línea principal O crear variante
    if (this.isNewGame && !this.inVariant) {
      // Solo aplicar lógica de nueva partida si estamos en la línea principal (no en variante)
      // Verificar si estamos en medio de la partida o al final
      const isAtEnd = this.current === this.moves.length - 1;
      
      if (isAtEnd || this.moves.length === 0) {
        // Estamos al final o es el primer movimiento - añadir movimiento normalmente
        const chess = new Chess(this.fen === "start" ? undefined : this.fen);
        let move = null;
        
        try {
          move = chess.move({ from, to, promotion: 'q' });
        } catch (error) {
          console.warn('Movimiento ilegal:', error);
          return;
        }
        
        if (!move) return;
        
        console.log(`➕ Nuevo movimiento añadido: ${move.san}`);
        
        // Análizar la posición ANTES del movimiento si es el primer movimiento
        if (this.moves.length === 0) {
          await this.engine.waitUntilReady();
          const tempChessBefore = new Chess();
          const initialAnalysis = await this.engine.evaluate(tempChessBefore.fen(), 20, 250, 3);
          
          // Normalizar evaluación a perspectiva de blancas
          let evalBefore = initialAnalysis.evaluation || 0;
          if (tempChessBefore.turn() === 'b') {
            evalBefore = -evalBefore;
          }
          
          // Convertir bestMove UCI a objeto
          let bestMoveObj = null;
          if (initialAnalysis.bestMove) {
            try {
              bestMoveObj = tempChessBefore.move({
                from: initialAnalysis.bestMove.substring(0, 2),
                to: initialAnalysis.bestMove.substring(2, 4),
                promotion: initialAnalysis.bestMove.length > 4 ? initialAnalysis.bestMove[4] : undefined
              });
            } catch (e) {
              console.warn('Error convirtiendo bestMove:', e);
            }
          }
          
          this.bestEvaluations.push(evalBefore);
          this.positionBestMoves.push(bestMoveObj);
          this.positionAlternatives.push(initialAnalysis.alternatives || []);
        }
        
        // Añadir movimiento a la lista
        this.moves.push(move);
        this.current = this.moves.length - 1;
        this.fen = chess.fen();
        this.lastMove = { from: move.from, to: move.to, san: move.san };
        
        // Analizar la nueva posición
        const tempChessAfter = new Chess(this.fen);
        const analysis = await this.engine.evaluate(this.fen, 20, 250, 3);
        
        // Normalizar evaluación a perspectiva de blancas
        let evalAfter = analysis.evaluation || 0;
        if (tempChessAfter.turn() === 'b') {
          evalAfter = -evalAfter;
        }
        
        // Convertir bestMove UCI a objeto
        let bestMoveObj = null;
        if (analysis.bestMove) {
          try {
            bestMoveObj = tempChessAfter.move({
              from: analysis.bestMove.substring(0, 2),
              to: analysis.bestMove.substring(2, 4),
              promotion: analysis.bestMove.length > 4 ? analysis.bestMove[4] : undefined
            });
          } catch (e) {
            console.warn('Error convirtiendo bestMove:', e);
          }
        }
        
        // Guardar evaluación y mejor movimiento de esta posición
        this.bestEvaluations.push(evalAfter);
        this.positionBestMoves.push(bestMoveObj);
        this.positionAlternatives.push(analysis.alternatives || []);
        
        // Clasificar el movimiento que acabamos de hacer
        const moveIdx = this.moves.length - 1;
        const evalBeforeMove = this.bestEvaluations[moveIdx] || 0;
        const evalAfterMove = this.bestEvaluations[moveIdx + 1] || 0;
        const bestMoveBefore = this.positionBestMoves[moveIdx];
        
        const startChess = new Chess();
        for (let i = 0; i < moveIdx; i++) {
          startChess.move(this.moves[i].san);
        }
        const isWhiteMove = startChess.turn() === 'w';
        const playerColor = isWhiteMove ? 'white' : 'black';
        
        const classification = classifyMove({
          playedMove: move,
          bestMove: bestMoveBefore,
          playedEval: evalAfterMove,
          bestEval: evalBeforeMove,
          playerColor: playerColor,
          isBook: false
        });
        
        this.classifications.push(classification);
        this.moveEvaluations.push(evalAfterMove);
        
        // Actualizar aperturas
        this.openingsByMove = buildOpeningsByMove(this.moves);
        
        this.requestUpdate();
        
        // Analizar posición actual para mostrar sugerencias
        await this.analyzeCurrentPositionAuto();
        
        return;
      }
    }
    
    // MODO NORMAL O VARIANTE DESDE NUEVA PARTIDA: Crear variantes
    // Asegurarse de que tenemos análisis de la posición actual
    // Si no hay análisis en tiempo real, analizar ahora
    if (!this.currentPositionAnalysis && !this.analyzingPosition) {
      console.log(`⏳ Analizando posición antes de crear variante...`);
      await this.analyzeCurrentPositionAuto();
    }
    
    // Guardar el análisis de la posición actual
    // La evaluación actual ES la evaluación "óptima" (Stockfish asume mejor movimiento)
    let previousBestMove = this.currentPositionAnalysis?.bestMoveObj 
      ? {
          ...this.currentPositionAnalysis.bestMoveObj,
          san: this.currentPositionAnalysis.bestMove
        }
      : null;
    let previousBestEval = this.currentPositionAnalysis?.evaluation;
    
    // Si aún no hay evaluación (por ejemplo en posición inicial), usar fallback
    if (previousBestEval === undefined || previousBestEval === null) {
      if (!this.inVariant && this.current >= 0 && this.current < this.bestEvaluations.length) {
        previousBestEval = this.bestEvaluations[this.current];
        previousBestMove = this.positionBestMoves[this.current] || null;
      } else {
        previousBestEval = 0;
      }
    }
    
    // Intentar validar y aplicar el movimiento en la posición actual
    let chess = new Chess(this.fen === "start" ? undefined : this.fen);
    let testMove = null;
    
    try {
      testMove = chess.move({ from, to, promotion: 'q' });
    } catch (e) {
      // El movimiento no es legal en la posición actual
    }
    
    if (!testMove) {
      // Si no es legal, puede ser que queramos crear variante/sub-variante desde posición anterior
      if (!this.inVariant && this.current >= 0) {
        // En línea principal: crear variante desde movimiento anterior
        const previousIndex = this.current - 1;
        const fenBefore = previousIndex < 0 ? new Chess().fen() : getFenAtMove(this.moves, previousIndex);
        
        chess = new Chess(fenBefore);
        try {
          testMove = chess.move({ from, to, promotion: 'q' });
          if (testMove) {
            // Crear variante desde el movimiento actual
            const baseMove = this.current;
            const fenToUse = fenBefore;
            
            if (this.current >= 0 && this.current < this.positionBestMoves.length) {
              previousBestMove = this.positionBestMoves[this.current] || null;
              previousBestEval = this.bestEvaluations?.[this.current] || 0;
            } else {
              previousBestMove = null;
              previousBestEval = 0;
            }
            
            if (!this.userVariants[baseMove]) {
              this.userVariants[baseMove] = [];
            }
            
            this.userVariants[baseMove].push({
              moves: [testMove],
              evaluations: [previousBestEval],
              bestMoves: [previousBestMove],
              bestEvaluations: [previousBestEval],
              startFen: fenToUse,
              subVariants: {}
            });
            
            this.userVariants = { ...this.userVariants };
            this.inVariant = true;
            this.variantPath = {
              path: [{ mainMoveIndex: baseMove, variantIndex: this.userVariants[baseMove].length - 1 }],
              moveIndexInVariant: 0
            };
            
            this.fen = chess.fen();
            this.lastMove = { from: testMove.from, to: testMove.to, san: testMove.san };
            this.bestMove = previousBestMove;
            this.currentPositionAnalysis = null;
            this.currentExplanation = null;
            this.requestUpdate();
            
            await this.analyzeCurrentPositionAuto();
            
            const variant = this.getVariantAtPath(this.variantPath.path);
            if (variant && variant.evaluations.length <= 1) {
              const evalAfterMove = this.currentPositionAnalysis?.evaluation || 0;
              console.log(`📊 Después del movimiento:`);
              console.log(`   FEN resultante: ${this.fen}`);
              console.log(`   Turno resultante:`, new Chess(this.fen === "start" ? undefined : this.fen).turn());
              console.log(`   Eval después del movimiento: ${evalAfterMove.toFixed(2)}`);
              console.log(`   Diferencia: ${previousBestEval.toFixed(2)} → ${evalAfterMove.toFixed(2)} = ${(previousBestEval - evalAfterMove).toFixed(2)}`);
              variant.evaluations.push(evalAfterMove);
              variant.bestEvaluations.push(evalAfterMove);
              this.userVariants = { ...this.userVariants };
              
              // Calcular clasificación del primer movimiento de la variante
              const moveIdx = 0;
              const bestEval = variant.bestEvaluations[moveIdx];
              const playedEval = variant.bestEvaluations[moveIdx + 1];
              const playedMove = variant.moves[moveIdx];
              const bestMove = variant.bestMoves[moveIdx];
              
              if (typeof playedEval === 'number' && typeof bestEval === 'number') {
                const startChess = new Chess(variant.startFen);
                const startingTurn = startChess.turn();
                const isWhiteMove = (startingTurn === 'w' && moveIdx % 2 === 0) ||
                                   (startingTurn === 'b' && moveIdx % 2 === 1);
                const playerColor = isWhiteMove ? 'white' : 'black';
                
                this.currentVariantClassification = classifyMove({
                  playedMove,
                  bestMove,
                  playedEval,
                  bestEval,
                  playerColor,
                  isBook: false
                });
              }
            }
            
            this.requestUpdate();
            return;
          }
        } catch (e) {}
      } else if (this.inVariant) {
        // En variante: crear sub-variante desde movimiento anterior de la variante
        const variant = this.getVariantAtPath(this.variantPath.path);
        if (!variant || this.variantPath.moveIndexInVariant < 0) {
          return;
        }
        
        // Obtener FEN ANTES del movimiento actual en la variante
        const previousMoveIdx = this.variantPath.moveIndexInVariant - 1;
        let fenBefore;
        
        if (previousMoveIdx < 0) {
          // Estamos en el primer movimiento de la variante
          fenBefore = variant.startFen;
        } else {
          // Reconstruir FEN hasta el movimiento anterior
          const tempChess = new Chess(variant.startFen);
          for (let i = 0; i <= previousMoveIdx; i++) {
            tempChess.move(variant.moves[i].san || variant.moves[i]);
          }
          fenBefore = tempChess.fen();
        }
        
        chess = new Chess(fenBefore);
        try {
          testMove = chess.move({ from, to, promotion: 'q' });
          if (testMove) {
            // Crear sub-variante en el movimiento actual (alternativa a este movimiento)
            const subVariantKey = this.variantPath.moveIndexInVariant;
            
            if (!variant.subVariants[subVariantKey]) {
              variant.subVariants[subVariantKey] = [];
            }
            
            // Obtener análisis ANTES del movimiento actual en la variante
            const currentMoveInVariant = this.variantPath.moveIndexInVariant;
            previousBestMove = variant.bestMoves?.[currentMoveInVariant] || null;
            previousBestEval = variant.bestEvaluations?.[currentMoveInVariant] || variant.evaluations?.[currentMoveInVariant] || 0;
            
            variant.subVariants[subVariantKey].push({
              moves: [testMove],
              evaluations: [previousBestEval],
              bestMoves: [previousBestMove],
              bestEvaluations: [previousBestEval],
              startFen: fenBefore,
              subVariants: {}
            });
            
            this.userVariants = { ...this.userVariants };
            
            // Actualizar path para incluir la sub-variante
            const newPath = [...this.variantPath.path, {
              mainMoveIndex: subVariantKey,
              variantIndex: variant.subVariants[subVariantKey].length - 1
            }];
            
            this.variantPath = {
              path: newPath,
              moveIndexInVariant: 0
            };
            
            this.fen = chess.fen();
            this.lastMove = { from: testMove.from, to: testMove.to, san: testMove.san };
            this.bestMove = previousBestMove;
            this.currentPositionAnalysis = null;
            this.currentExplanation = null;
            this.requestUpdate();
            
            await this.analyzeCurrentPositionAuto();
            
            const newVariant = this.getVariantAtPath(newPath);
            if (newVariant && newVariant.evaluations.length <= 1) {
              newVariant.evaluations.push(this.currentPositionAnalysis?.evaluation || 0);
              newVariant.bestEvaluations.push(this.currentPositionAnalysis?.evaluation || 0);
              this.userVariants = { ...this.userVariants };
              
              // Calcular clasificación del primer movimiento de la sub-variante
              const moveIdx = 0;
              const bestEval = newVariant.bestEvaluations[moveIdx];
              const playedEval = newVariant.bestEvaluations[moveIdx + 1];
              const playedMove = newVariant.moves[moveIdx];
              const bestMove = newVariant.bestMoves[moveIdx];
              
              if (typeof playedEval === 'number' && typeof bestEval === 'number') {
                const startChess = new Chess(newVariant.startFen);
                const startingTurn = startChess.turn();
                const isWhiteMove = (startingTurn === 'w' && moveIdx % 2 === 0) ||
                                   (startingTurn === 'b' && moveIdx % 2 === 1);
                const playerColor = isWhiteMove ? 'white' : 'black';
                
                this.currentVariantClassification = classifyMove({
                  playedMove,
                  bestMove,
                  playedEval,
                  bestEval,
                  playerColor,
                  isBook: false
                });
              }
            }
            
            this.requestUpdate();
            return;
          }
        } catch (e) {}
      }
      
      return;
    }
    
    const move = testMove;
    
    try {
      if (!this.inVariant) {
        // Crear nueva variante desde línea principal
        const baseMove = this.current;
        
        if (!this.userVariants[baseMove]) {
          this.userVariants[baseMove] = [];
        }
        
        this.userVariants[baseMove].push({
          moves: [move],
          evaluations: [previousBestEval],
          bestMoves: [previousBestMove],
          bestEvaluations: [previousBestEval],
          startFen: this.fen === "start" ? new Chess().fen() : this.fen,
          subVariants: {}
        });
        
        this.userVariants = { ...this.userVariants };
        this.inVariant = true;
        this.variantPath = {
          path: [{ mainMoveIndex: baseMove, variantIndex: this.userVariants[baseMove].length - 1 }],
          moveIndexInVariant: 0
        };
      } else {
        // Estamos en una variante
        const variant = this.getVariantAtPath(this.variantPath.path);
        const currentMoveIdx = this.variantPath.moveIndexInVariant;
        const nextMoveIdx = currentMoveIdx + 1;
        
        // Verificar si hay un siguiente movimiento en la variante
        const hasNextMove = variant.moves.length > nextMoveIdx;
        
        // Si hay un siguiente movimiento y es diferente al que queremos hacer, crear sub-variante
        if (hasNextMove) {
          const nextMove = variant.moves[nextMoveIdx];
          const isSameMove = 
            nextMove.from === move.from && 
            nextMove.to === move.to && 
            (nextMove.promotion || '') === (move.promotion || '');
          
          if (!isSameMove) {
            // El movimiento es diferente al siguiente de la variante
            // Crear sub-variante desde el movimiento actual
            const subVariantKey = currentMoveIdx;
            
            if (!variant.subVariants[subVariantKey]) {
              variant.subVariants[subVariantKey] = [];
            }
            
            variant.subVariants[subVariantKey].push({
              moves: [move],
              evaluations: [previousBestEval],
              bestMoves: [previousBestMove],
              bestEvaluations: [previousBestEval],
              startFen: this.fen === "start" ? new Chess().fen() : this.fen,
              subVariants: {}
            });
            
            this.userVariants = { ...this.userVariants };
            
            // Actualizar path para incluir la sub-variante
            const newPath = [...this.variantPath.path, {
              mainMoveIndex: subVariantKey,
              variantIndex: variant.subVariants[subVariantKey].length - 1
            }];
            
            this.variantPath = {
              path: newPath,
              moveIndexInVariant: 0
            };
          } else {
            // Es el mismo movimiento, avanzar en la variante
            this.variantPath.moveIndexInVariant = nextMoveIdx;
          }
        } else {
          // No hay siguiente movimiento, continuar la variante
          variant.moves.push(move);
          variant.evaluations.push(previousBestEval);
          variant.bestMoves.push(previousBestMove);
          // NO agregar a bestEvaluations aquí - se agregará después del análisis
          
          this.variantPath.moveIndexInVariant = variant.moves.length - 1;
          this.userVariants = { ...this.userVariants };
        }
      }
      
      this.fen = chess.fen();
      this.lastMove = { from: move.from, to: move.to, san: move.san };
      this.bestMove = previousBestMove;
      this.currentPositionAnalysis = null;
      this.currentExplanation = null;
      this.requestUpdate();
      
      await this.analyzeCurrentPositionAuto();
      
      const variant = this.getVariantAtPath(this.variantPath.path);
      const moveIdx = this.variantPath.moveIndexInVariant;
      
      // Agregar la evaluación después del último movimiento si hace falta
      // bestEvaluations debe tener moves.length + 1 elementos (eval antes de cada mov + eval final)
      if (variant && variant.bestEvaluations.length <= variant.moves.length) {
        variant.evaluations.push(this.currentPositionAnalysis?.evaluation || 0);
        variant.bestEvaluations.push(this.currentPositionAnalysis?.evaluation || 0);
        this.userVariants = { ...this.userVariants };
      }
      
      // Calcular clasificación del movimiento recién creado
      if (variant && moveIdx >= 0 && variant.evaluations && variant.bestEvaluations) {
        // Para clasificar movimiento i necesitamos:
        // - bestEval: evaluación ANTES del movimiento (índice i)
        // - playedEval: evaluación DESPUÉS del movimiento (índice i + 1)
        // Ambos usan bestEvaluations que considera la mejor respuesta del oponente
        const bestEval = variant.bestEvaluations[moveIdx];
        const playedEval = variant.bestEvaluations[moveIdx + 1];
        const playedMove = variant.moves[moveIdx];
        const bestMove = variant.bestMoves[moveIdx];
        
        if (typeof playedEval === 'number' && typeof bestEval === 'number') {
          // Determinar color del jugador basado en el FEN inicial de la variante
          const startChess = new Chess(variant.startFen);
          const startingTurn = startChess.turn();
          // Calcular turno actual: si empezamos con blancas y moveIndex es par, es turno de blancas
          const isWhiteMove = (startingTurn === 'w' && moveIdx % 2 === 0) ||
                             (startingTurn === 'b' && moveIdx % 2 === 1);
          const playerColor = isWhiteMove ? 'white' : 'black';
          
          this.currentVariantClassification = classifyMove({
            playedMove,
            bestMove,
            playedEval,
            bestEval,
            playerColor,
            isBook: false
          });
        } else {
          this.currentVariantClassification = null;
        }
      }
      
      this.requestUpdate();
    } catch (error) {
      console.error('Error en handlePieceMoved:', error);
    }
  };

  async analyzeCurrentPositionAuto() {
    if (this.current < 0) return;
    
    // Limpiar análisis anterior
    this.currentPositionAnalysis = null;
    this.analyzingPosition = true;

    try {
      // Obtener FEN DESPUÉS del movimiento actual (posición actual en pantalla)
      const fen = this.fen === "start" ? new Chess().fen() : this.fen;
      
      // Analizar con Stockfish (profundidad 20)
      const analysis = await this.engine.evaluate(fen, 20);
      
      // Normalizar evaluación a perspectiva de blancas
      const chess = new Chess(fen);
      let normalizedEval = analysis.evaluation;
      const turn = chess.turn();
      
      if (turn === 'b') {
        normalizedEval = -normalizedEval;
      }
      
      // Convertir el mejor movimiento UCI a SAN
      let bestMoveSan = "";
      let bestMoveObj = null;
      
      if (analysis.bestMove && typeof analysis.bestMove === 'string' && analysis.bestMove.length >= 4) {
        const from = analysis.bestMove.substring(0, 2);
        const to = analysis.bestMove.substring(2, 4);
        const promotion = analysis.bestMove.length > 4 ? analysis.bestMove.substring(4, 5) : undefined;
        
        bestMoveObj = { from, to, promotion };
        
        try {
          const move = chess.move({ from, to, promotion });
          if (move) {
            bestMoveSan = move.san;
          } else {
            bestMoveSan = analysis.bestMove;
          }
        } catch (e) {
          bestMoveSan = analysis.bestMove;
        }
      }

      this.currentPositionAnalysis = {
        evaluation: normalizedEval,
        depth: analysis.depth,
        bestMove: bestMoveSan,
        bestMoveObj: bestMoveObj,
        bestMoveSan: bestMoveSan
      };

    } catch (error) {
      console.error('Error al analizar posición:', error);
    } finally {
      this.analyzingPosition = false;
      this.requestUpdate();
    }
  }

  goStart = () => {
    // Solo navegar en línea principal
    if (this.inVariant) return;
    this.updatePosition(-1);
  };

  goPrev = () => {
    // Solo navegar en línea principal
    if (this.inVariant) return;
    if (this.current > -1) this.updatePosition(this.current - 1);
  };

  goNext = () => {
    // Solo navegar en línea principal
    if (this.inVariant) return;
    if (this.current < this.moves.length - 1) {
      this.updatePosition(this.current + 1);
    }
  };

  goEnd = () => {
    // Solo navegar en línea principal
    if (this.inVariant) return;
    if (this.moves.length > 0) {
      this.updatePosition(this.moves.length - 1);
    }
  };
}

customElements.define("cs-chess-app", CSChessApp);