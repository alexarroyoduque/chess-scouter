import { LitElement, html } from "lit";
import { ref, createRef } from "lit/directives/ref.js";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import { calculateCapturedMaterial } from "../lib/chess-logic.js";
import { soundManager } from "../lib/sounds.js";

export class CSChessBoard extends LitElement {
  static properties = {
    fen: { type: String },
    lastMove: { type: Object },
    bestMove: { type: Object },
    suggestedMove: { type: Object },
    alternativeMoves: { type: Array },
    inVariant: { type: Boolean },
    orientation: { type: String },
    whitePlayer: { type: String },
    blackPlayer: { type: String },
    winnerColor: { type: String },
    whiteAccuracy: { type: Number },
    blackAccuracy: { type: Number },
    moveClassification: { type: String },
    isNewGame: { type: Boolean }
  };

  constructor() {
    super();
    this.boardRef = createRef();
    this.containerRef = createRef();
    this.orientation = "white";
    this.whitePlayer = "White";
    this.blackPlayer = "Black";
    this.fen = "start";
    this.winnerColor = null;
    this.whiteAccuracy = null;
    this.blackAccuracy = null;
    this._previousLastMove = null;
    this.isNewGame = false;
  }

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    const el = this.boardRef.value;

    this.cg = Chessground(el, {
      fen: "start",
      orientation: this.orientation,
      movable: {
        free: false,
        color: 'white',
        dests: new Map(),
        events: {
          after: (orig, dest) => this.handleMove(orig, dest)
        }
      },
      drawable: {
        enabled: true,
        visible: true,
        eraseOnClick: false,
        brushes: {
          green: {
            key: "g",
            color: "#15781B",
            opacity: 1.0,
            lineWidth: 10
          },
          paleGreen: {
            key: "pg",
            color: "#15781B",
            opacity: 0.3,
            lineWidth: 12
          },
          blue: {
            key: "b",
            color: "#003088",
            opacity: 0.9,
            lineWidth: 10
          },
          orange: {
            key: "o",
            color: "#ff9800",
            opacity: 0.7,
            lineWidth: 10
          },
          yellow: {
            key: "y",
            color: "#ffeb3b",
            opacity: 0.7,
            lineWidth: 10
          },
          hint: {
            key: "hint",
            color: "#ffffff",
            opacity: 0.7,
            lineWidth: 8
          }
        }
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.resizeBoard());
    if (this.containerRef.value) {
      this.resizeObserver.observe(this.containerRef.value);
    }
    this.resizeBoard();
  }

  handleMove(orig, dest) {
    // Emitir evento para que app.js maneje el movimiento
    this.dispatchEvent(
      new CustomEvent("piece-moved", {
        detail: { from: orig, to: dest },
        bubbles: true,
        composed: true
      })
    );
  }

  getLegalMovesFromPosition(fen) {
    if (!fen || fen === "start") {
      fen = new Chess().fen();
    }
    
    const chess = new Chess(fen);
    const dests = new Map();
    
    chess.moves({ verbose: true }).forEach(move => {
      if (!dests.has(move.from)) {
        dests.set(move.from, []);
      }
      dests.get(move.from).push(move.to);
    });
    
    return {
      dests,
      color: chess.turn() === 'w' ? 'white' : 'black'
    };
  }

  getOtherColorMoves(fen) {
    // Obtener movimientos del color que NO tiene el turno
    // Esto es útil para crear variantes desde movimientos previos
    if (!fen || fen === "start") {
      fen = new Chess().fen();
    }
    
    try {
      // Cambiar el turno en el FEN para calcular movimientos del otro color
      const fenParts = fen.split(' ');
      fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w';
      // Resetear en passant ya que cambiar el turno la invalida
      fenParts[3] = '-';
      const modifiedFen = fenParts.join(' ');
      
      const chess = new Chess(modifiedFen);
      const dests = new Map();
      
      chess.moves({ verbose: true }).forEach(move => {
        if (!dests.has(move.from)) {
          dests.set(move.from, []);
        }
        dests.get(move.from).push(move.to);
      });
      
      return dests;
    } catch (e) {
      console.warn('Error obteniendo movimientos del otro color:', e);
      return new Map();
    }
  }

  resizeBoard() {
    if (this.cg) {
      this.cg.redrawAll();
    }
  }

  updated(changedProperties) {
    if (!this.cg) return;

    // Reproducir sonido cuando cambia el movimiento
    if (changedProperties.has('lastMove')) {
      const currentMove = this.lastMove;
      const previousMove = this._previousLastMove;
      
      // Solo reproducir si hay un movimiento nuevo y es diferente al anterior
      if (currentMove && 
          (!previousMove || 
           currentMove.from !== previousMove.from || 
           currentMove.to !== previousMove.to)) {
        
        // Detectar tipo de movimiento por SAN
        const san = currentMove.san || '';
        const isCheck = san.includes('+') || san.includes('#'); // Jaque o jaque mate
        const isCapture = san.includes('x') || san.includes('X');
        
        // Prioridad: jaque/mate > captura > movimiento normal
        if (isCheck) {
          soundManager.playCheck();
        } else if (isCapture) {
          soundManager.playCapture();
        } else {
          soundManager.playMove();
        }
      }
      
      this._previousLastMove = currentMove ? { ...currentMove } : null;
    }

    // Siempre permitir solo mover el color del turno actual
    const chess = new Chess(this.fen === "start" ? undefined : this.fen);
    const currentTurnColor = chess.turn() === 'w' ? 'white' : 'black';
    const movableColor = currentTurnColor;
    
    // Solo movimientos legales del turno actual
    const currentMoves = this.getLegalMovesFromPosition(this.fen);
    const combinedDests = new Map();
    
    currentMoves.dests.forEach((dests, from) => {
      if (!combinedDests.has(from)) {
        combinedDests.set(from, []);
      }
      dests.forEach(to => {
        if (!combinedDests.get(from).includes(to)) {
          combinedDests.get(from).push(to);
        }
      });
    });

    this.cg.set({
      fen: this.fen === "start" ? undefined : this.fen,
      orientation: this.orientation,
      turnColor: movableColor,
      lastMove: this.lastMove
        ? [this.lastMove.from, this.lastMove.to]
        : undefined,
      movable: {
        free: false,
        color: movableColor,
        dests: combinedDests,
        events: {
          after: (orig, dest) => this.handleMove(orig, dest)
        }
      }
    });

    const shapes = [];

    // Movimiento jugado - azul
    if (this.lastMove?.from && this.lastMove?.to) {
      shapes.push({
        orig: this.lastMove.from,
        dest: this.lastMove.to,
        brush: this.inVariant ? "yellow" : "blue"
      });
      
      // Añadir indicador de calidad del movimiento sobre la casilla de destino
      if (this.moveClassification) {
        const symbol = this.getMoveQualitySymbol(this.moveClassification);
        const color = this.getMoveQualityColor(this.moveClassification);
        
        if (symbol) {
          shapes.push({
            orig: this.lastMove.to,
            customSvg: this.createMoveQualitySvg(symbol, color)
          });
        }
      }
    }

    // Mejor movimiento de Stockfish para la posición ANTES - verde fuerte
    if (this.bestMove?.from && this.bestMove?.to) {
      shapes.push({
        orig: this.bestMove.from,
        dest: this.bestMove.to,
        brush: "green"
      });
    }

    // Mejor respuesta/continuación para la posición DESPUÉS - blanca sutil
    if (this.suggestedMove?.from && this.suggestedMove?.to) {
      shapes.push({
        orig: this.suggestedMove.from,
        dest: this.suggestedMove.to,
        brush: "hint"
      });
    }

    // Alternativas - flechas verdes suaves
    if (this.alternativeMoves && Array.isArray(this.alternativeMoves)) {
      this.alternativeMoves.forEach(alt => {
        if (alt?.from && alt?.to) {
          shapes.push({
            orig: alt.from,
            dest: alt.to,
            brush: "paleGreen"
          });
        }
      });
    }

    this.cg.setAutoShapes(shapes);
  }

  getMoveQualitySymbol(classification) {
    const symbols = {
      'checkmate': '#',
      'book': '📖',
      'best': '★',
      'good': '✓',
      'inaccuracy': '?!',
      'mistake': '?',
      'blunder': '??'
    };
    return symbols[classification] || '';
  }

  getMoveQualityColor(classification) {
    const colors = {
      'checkmate': '#15781B',
      'book': '#a88865',
      'best': '#96bc4b',
      'good': '#96bc4b',
      'inaccuracy': '#f0c15c',
      'mistake': '#e58f2a',
      'blunder': '#b33430'
    };
    return colors[classification] || '#ffffff';
  }

  createMoveQualitySvg(symbol, color) {
    return `
      <g>
        <circle cx="80" cy="20" r="16" fill="${color}" opacity="0.95"/>
        <text x="80" y="20" 
              text-anchor="middle" 
              dominant-baseline="central"
              font-size="20" 
              font-weight="bold" 
              fill="#fff" 
              font-family="Arial, sans-serif">${symbol}</text>
      </g>
    `;
  }

  getPieceSymbol(piece) {
    const symbols = {
      'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛',
      'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕'
    };
    return symbols[piece] || '';
  }

  renderCapturedMaterial(pieces, color) {
    if (!pieces || pieces.length === 0) return '';

    const order = color === 'white' ? ['q', 'r', 'b', 'n', 'p'] : ['Q', 'R', 'B', 'N', 'P'];
    const sorted = pieces.sort((a, b) => {
      return order.indexOf(a) - order.indexOf(b);
    });

    return html`
      <div class="captured-pieces">
        ${sorted.map(piece => html`
          <span class="piece-icon">${this.getPieceSymbol(piece)}</span>
        `)}
      </div>
    `;
  }

  renderMaterialAdvantage(diff, color) {
    if (diff === 0) return '';
    
    return html`
      <span class="material-advantage">+${diff}</span>
    `;
  }

  render() {
    const material = this.fen && this.fen !== "start" 
      ? calculateCapturedMaterial(this.fen)
      : { capturedByWhite: [], capturedByBlack: [], materialDiff: 0 };

    const topPlayer = this.orientation === "white" ? this.blackPlayer : this.whitePlayer;
    const bottomPlayer = this.orientation === "white" ? this.whitePlayer : this.blackPlayer;
    const topColor = this.orientation === "white" ? "black" : "white";
    const bottomColor = this.orientation === "white" ? "white" : "black";
    
    const topAccuracy = this.orientation === "white" ? this.blackAccuracy : this.whiteAccuracy;
    const bottomAccuracy = this.orientation === "white" ? this.whiteAccuracy : this.blackAccuracy;

    const topCaptured = topColor === "white" ? material.capturedByWhite : material.capturedByBlack;
    const bottomCaptured = bottomColor === "white" ? material.capturedByWhite : material.capturedByBlack;

    const topAdvantage = topColor === "white" && material.materialDiff > 0 ? material.materialDiff :
                        topColor === "black" && material.materialDiff < 0 ? Math.abs(material.materialDiff) : 0;
    const bottomAdvantage = bottomColor === "white" && material.materialDiff > 0 ? material.materialDiff :
                           bottomColor === "black" && material.materialDiff < 0 ? Math.abs(material.materialDiff) : 0;

    const topIsWinner = this.winnerColor === topColor;
    const bottomIsWinner = this.winnerColor === bottomColor;

    return html`
      <style>
        .cs-board-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .board-content {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100%;
          gap: 8px;
          justify-content: center;
        }

        .player-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: #312e2b;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          min-height: 40px;
          flex-shrink: 0;
          overflow: visible;
          gap: 8px;
          width: calc(100% - 96px);
          margin-left: 48px;
        }

        .player-info.winner {
          background: rgba(232, 181, 77, 0.25);
          border: 2px solid #e8b54d;
        }

        .player-main {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          flex: 1;
          min-width: 0;
        }

        .player-main span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.4;
        }

        .player-color {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #666;
          flex-shrink: 0;
        }

        .player-color.white {
          background: #fff;
        }

        .player-color.black {
          background: #000;
        }

        .winner-badge {
          background: #e8b54d;
          color: #1a1a1a;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          margin-left: 6px;
          flex-shrink: 0;
          line-height: 1.2;
        }
        
        .accuracy-badge {
          background: rgba(129, 182, 76, 0.2);
          color: #81b64c;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 700;
          margin-left: 6px;
          flex-shrink: 0;
          line-height: 1.2;
          border: 1px solid rgba(129, 182, 76, 0.3);
        }

        .captured-pieces {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .piece-icon {
          font-size: 16px;
          opacity: 0.8;
          line-height: 1;
        }

        .material-advantage {
          font-weight: bold;
          font-size: 11px;
          color: #9bc700;
          margin-left: 4px;
          flex-shrink: 0;
        }

        .board-shell {
          flex: 1;
          min-height: 0;
          min-width: 0;
          height: 100%;
          aspect-ratio: 1 / 1;
          align-self: center;
          display: flex;
        }

        .board-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .cg-wrap {
          width: 100% !important;
          height: 100% !important;
        }

        .player-materials {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
      </style>

      <div ${ref(this.containerRef)} class="cs-board-container">
        <div class="board-content">
          <div class="player-info ${topIsWinner ? 'winner' : ''}">
            <div class="player-main">
              <div class="player-color ${topColor}"></div>
              <span>${topPlayer}</span>
              ${topIsWinner ? html`<span class="winner-badge">Winner</span>` : ''}
            </div>
            <div class="player-materials">
              ${this.renderCapturedMaterial(topCaptured, topColor)}
              ${this.renderMaterialAdvantage(topAdvantage, topColor)}
            </div>
          </div>

          <div class="board-shell">
            <div class="board-wrapper">
              <div ${ref(this.boardRef)} class="cg-wrap"></div>
            </div>
          </div>

          <div class="player-info ${bottomIsWinner ? 'winner' : ''}">
            <div class="player-main">
              <div class="player-color ${bottomColor}"></div>
              <span>${bottomPlayer}</span>
              ${bottomIsWinner ? html`<span class="winner-badge">Winner</span>` : ''}
            </div>
            <div class="player-materials">
              ${this.renderCapturedMaterial(bottomCaptured, bottomColor)}
              ${this.renderMaterialAdvantage(bottomAdvantage, bottomColor)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    super.disconnectedCallback();
  }
}

customElements.define("cs-chess-board", CSChessBoard);