import { LitElement, html, css } from "lit";
import { getMoveStyle, classifyMove, movesEqual } from "../lib/move-classification.js";

export class CSMoveList extends LitElement {
  static properties = {
    moves: { type: Array },
    current: { type: Number },
    classifications: { type: Array },
    moveEvaluations: { type: Array },
    openingsByMove: { type: Array },
    inVariant: { type: Boolean },
    variantPath: { type: Object },
    userVariants: { type: Object }
  };

  static styles = css`
    :host {
      display: block;
      max-height: 450px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    /* Estilo del scrollbar para navegadores webkit */
    :host::-webkit-scrollbar {
      width: 8px;
    }

    :host::-webkit-scrollbar-track {
      background: #2b2826;
      border-radius: 4px;
    }

    :host::-webkit-scrollbar-thumb {
      background: #4a4543;
      border-radius: 4px;
    }

    :host::-webkit-scrollbar-thumb:hover {
      background: #5a5553;
    }

    .move-row {
      display: flex;
    }

    .move-number {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      padding: 5px 4px;
      font-size: 11px;
      font-weight: 600;
      color: #777;
      background: transparent;
      user-select: none;
    }

    .move {
      flex: 1;
      padding: 4px 6px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      color: #ffffff;
      transition: background 0.1s ease;
      position: relative;
      min-width: 0;
      border-radius: 4px;
    }

    .move:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .move.active {
      background: #2d4a6a;
      font-weight: 600;
    }

    .move.active:hover {
      background: #2d4a6a;
    }

    .move.white {
      background: transparent;
    }

    .move.white:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .move.white.active {
      background: #2d4a6a;
    }

    .move::after {
      display: none;
    }

    .left {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .move-text {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }

    .right {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .icon {
      font-weight: 700;
      font-size: 14px;
      min-width: 20px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .eval {
      color: #bababa;
      font-size: 12px;
      min-width: 42px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }

    .move.active .eval {
      color: rgba(255, 255, 255, 0.9);
    }

    /* Piezas grandes + texto del movimiento */
    .piece {
      font-size: 20px;
      line-height: 1;
      font-family:
        "Noto Sans Symbols2",
        "Noto Sans Symbols",
        "Segoe UI Symbol",
        "Apple Symbols",
        "DejaVu Sans",
        sans-serif;
    }

    .rest {
      font-size: 14px;
      letter-spacing: 0.3px;
      line-height: 1.2;
    }

    /* Indicador de turno */
    .turn-indicator {
      width: 3px;
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      background: transparent;
    }

    .move.active .turn-indicator {
      background: #0aacfc;
    }

    /* Variantes */
    .variant-container {
      padding: 4px 0 4px 56px;
      background: rgba(0, 0, 0, 0.15);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      max-width: 100%;
      box-sizing: border-box;
      overflow-wrap: break-word;
    }

    .variant-container-inline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      max-width: 100%;
    }

    .variant-move {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 6px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      color: #bababa;
      font-size: 13px;
      transition: all 0.15s ease;
    }

    .variant-move:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .variant-move .move-number {
      font-size: 10px;
      color: #888;
      font-weight: 600;
      margin-right: 2px;
    }

    .variant-move .piece {
      font-size: 16px;
    }

    .variant-move .rest {
      font-size: 12px;
    }

    .variant-move.active {
      background: rgba(240, 165, 0, 0.2);
      color: #f0d060;
      outline: 1px solid rgba(240, 165, 0, 0.4);
    }

    .variant-move.active .move-number {
      color: rgba(240, 165, 0, 0.8);
    }

    /* Mantener .variant para compatibilidad si se necesita */
    .variant {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      margin: 2px 4px 2px 0;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      color: #bababa;
      font-size: 13px;
      transition: all 0.15s ease;
    }

    .variant:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .variant .piece {
      font-size: 16px;
    }

    .variant .rest {
      font-size: 12px;
    }

    .variant.active {
      background: rgba(240, 165, 0, 0.2);
      color: #f0d060;
      outline: 1px solid rgba(240, 165, 0, 0.4);
    }

    .variant-label {
      color: #808080;
      font-size: 11px;
      font-weight: 600;
      margin-right: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Sub-variantes (anidadas) */
    .variant-move-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .subvariants {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 4px;
      flex-wrap: wrap;
    }

    .subvariant-wrapper {
      display: inline-flex;
      align-items: flex-start;
      color: #999;
      font-size: 12px;
      margin: 0 4px;
      gap: 3px;
      flex-wrap: wrap;
      max-width: 100%;
    }
    
    .subvariant-wrapper .paren {
      color: #aaa;
      font-size: 14px;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .subvariant-moves {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
      max-width: calc(100% - 40px);
    }

    /* Sub-variantes tienen estilo más tenue */
    .subvariant-wrapper .variant-move {
      background: rgba(255, 255, 255, 0.03);
      opacity: 0.85;
      font-size: 12px;
    }

    .subvariant-wrapper .variant-move:hover {
      background: rgba(255, 255, 255, 0.1);
      opacity: 1;
    }
    
    .subvariant-wrapper .variant-move .move-number {
      font-size: 9px;
    }
    
    .subvariant-wrapper .variant-move .piece {
      font-size: 14px;
    }
    
    .subvariant-wrapper .variant-move .rest {
      font-size: 11px;
    }
    
    .subvariant-wrapper .variant-move .icon {
      font-size: 10px !important;
    }

    /* Indicador de apertura */
    .opening-indicator {
      padding: 8px 12px;
      margin: 4px 0;
      background: rgba(168, 136, 101, 0.15);
      border-left: 3px solid #a88865;
      font-size: 12px;
      color: #d4b896;
      font-style: italic;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .opening-indicator .opening-name {
      font-weight: 600;
      color: #e8c5a0;
    }

    .opening-indicator .opening-eco {
      opacity: 0.8;
      font-size: 11px;
    }
  `;

  // Separar pieza y resto del SAN - con soporte para blancas/negras
  formatMove(san, isWhite) {
    const blackPieces = {
      K: "♔",
      Q: "♕",
      R: "♖",
      B: "♗",
      N: "♘"
    };

    const whitePieces = {
      K: "♚",
      Q: "♛",
      R: "♜",
      B: "♝",
      N: "♞"
    };

    const pieceMap = isWhite ? whitePieces : blackPieces;
    const firstChar = san.charAt(0);

    if (pieceMap[firstChar]) {
      return {
        piece: pieceMap[firstChar],
        rest: san.slice(1)
      };
    }

    return {
      piece: "",
      rest: san
    };
  }

  formatEvaluation(evalValue) {
    if (typeof evalValue !== "number") return "";
    if (evalValue >= 0) {
      return `+${evalValue.toFixed(2)}`;
    }
    return evalValue.toFixed(2);
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // Auto-scroll al movimiento actual
    if (changedProperties.has('current') && this.current >= 0) {
      const activeMove = this.shadowRoot.querySelector('.active');
      if (activeMove) {
        activeMove.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }
    }
  }

  render() {
    const pairs = this.getMovePairs();

    return html`
      <div>
        ${pairs.map((pair, pairIndex) => {
          const whiteIndex = pairIndex * 2;
          const blackIndex = pairIndex * 2 + 1;

          return html`
            <div class="move-row">
              <!-- Número de movimiento -->
              <div class="move-number">${pair.moveNumber}</div>

              <!-- WHITE -->
              ${this.moves[whiteIndex] !== undefined
                ? (() => {
                    const move = this.moves[whiteIndex];
                    const type = this.classifications?.[whiteIndex];
                    const style = type ? getMoveStyle(type) : null;
                    const evalValue = this.moveEvaluations?.[whiteIndex];
                    const { piece, rest } = this.formatMove(move.san, true);

                    return html`
                      <div
                        class="move white ${!this.inVariant && whiteIndex === this.current ? 'active' : ''}"
                        @click=${() => this.selectMove(whiteIndex)}
                        title=${style?.label ?? ""}
                      >
                        <div class="turn-indicator"></div>
                        <div class="left">
                          <div class="move-text">
                            <span class="piece">${piece}</span>
                            <span class="rest">${rest}</span>
                          </div>
                        </div>

                        <div class="right">
                          <span class="eval">
                            ${this.formatEvaluation(evalValue)}
                          </span>
                          ${style
                            ? html`<span class="icon" style="color:${style.color}">
                                ${style.icon}
                              </span>`
                            : ""}
                        </div>
                      </div>
                    `;
                  })()
                : html`<div class="move" style="cursor: default;"></div>`}

              <!-- BLACK -->
              ${this.moves[blackIndex] !== undefined
                ? (() => {
                    const move = this.moves[blackIndex];
                    const type = this.classifications?.[blackIndex];
                    const style = type ? getMoveStyle(type) : null;
                    const evalValue = this.moveEvaluations?.[blackIndex];
                    const { piece, rest } = this.formatMove(move.san, false);

                    return html`
                      <div
                        class="move ${!this.inVariant && blackIndex === this.current ? 'active' : ''}"
                        @click=${() => this.selectMove(blackIndex)}
                        title=${style?.label ?? ""}
                      >
                        <div class="turn-indicator"></div>
                        <div class="left">
                          <div class="move-text">
                            <span class="piece">${piece}</span>
                            <span class="rest">${rest}</span>
                          </div>
                        </div>

                        <div class="right">
                          <span class="eval">
                            ${this.formatEvaluation(evalValue)}
                          </span>
                          ${style
                            ? html`<span class="icon" style="color:${style.color}">
                                ${style.icon}
                              </span>`
                            : ""}
                        </div>
                      </div>
                    `;
                  })()
                : html`<div class="move" style="cursor: default;"></div>`}

            </div>

            <!-- Indicador de apertura -->
            ${(() => {
              // Mostrar apertura cuando se completa (después del último movimiento de libro)
              const blackIndex = pairIndex * 2 + 1;
              const openingInfo = this.openingsByMove?.[blackIndex];
              const prevOpeningInfo = blackIndex > 0 ? this.openingsByMove?.[blackIndex - 1] : null;
              
              // Detectar si acabamos de completar una apertura (última jugada de libro)
              if (openingInfo?.opening && !openingInfo.isBook && prevOpeningInfo?.isBook) {
                const opening = openingInfo.opening;
                const openingName = opening.variation 
                  ? `${opening.name} - ${opening.variation}` 
                  : opening.name;
                
                return html`
                  <div class="opening-indicator">
                    <span>📖</span>
                    <span class="opening-name">${openingName}</span>
                    ${opening.eco ? html`<span class="opening-eco">[${opening.eco}]</span>` : ''}
                  </div>
                `;
              }
              return '';
            })()}

            <!-- Variantes de usuario -->
            ${this.renderUserVariants(whiteIndex)}
            ${blackIndex < this.moves.length ? this.renderUserVariants(blackIndex) : ''}
          `;
        })}
      </div>
    `;
  }

  renderUserVariants(moveIndex) {
    const variants = this.userVariants?.[moveIndex];
    if (!variants || variants.length === 0) {
      return '';
    }

    return html`
      <div class="variant-container">
        <span class="variant-label">Variantes:</span>
        ${variants.map((variant, variantIndex) => this.renderVariant(variant, moveIndex, variantIndex))}
      </div>
    `;
  }

  renderVariant(variant, mainMoveIndex, variantIndex, parentPath = [], globalMoveContext = null) {
    const currentPath = [...parentPath, { mainMoveIndex, variantIndex }];
    const isTopLevel = parentPath.length === 0;
    const movesToShow = variant.moves;
    
    // Para sub-variantes, usar el globalMoveContext; para top-level, usar mainMoveIndex
    const moveContext = globalMoveContext !== null ? globalMoveContext : mainMoveIndex;

    // Renderizar movimientos individuales con sus sub-variantes
    const moveElements = movesToShow.map((move, idx) => {
      const isActive = this.inVariant && 
                       this.variantPath?.path &&
                       this.pathsMatch(this.variantPath.path, currentPath) &&
                       this.variantPath?.moveIndexInVariant === idx;
      
      const isWhiteMove = (moveContext + idx + 1) % 2 === 0;
      const { piece, rest } = this.formatMove(move.san, isWhiteMove);
      
      // Calcular número de movimiento usando moveContext
      const moveNumber = Math.floor((moveContext + idx) / 2) + 1;
      const movePrefix = isWhiteMove ? `${moveNumber}.` : `${moveNumber}...`;
      
      // Clasificar el movimiento si tenemos la información necesaria
      let style = null;
      if (variant.bestMoves && variant.bestEvaluations && variant.evaluations) {
        const playedEval = variant.bestEvaluations[idx + 1];  // Usar bestEvaluations que ya considera la respuesta óptima del oponente
        const bestEval = variant.bestEvaluations[idx];
        const bestMove = variant.bestMoves[idx];
        
        console.log(`🔍 Variante mov ${idx}/${variant.moves.length}: bestEval=${bestEval}, playedEval=${playedEval}`);
        console.log(`   📊 Array lengths: bestEvals=${variant.bestEvaluations.length}, evals=${variant.evaluations.length}, bestMoves=${variant.bestMoves.length}`);
        
        if (typeof playedEval === 'number' && typeof bestEval === 'number') {
          const playerColor = isWhiteMove ? 'white' : 'black';
          const loss = playerColor === "white"
            ? (bestEval - playedEval)
            : (playedEval - bestEval);
          
          console.log(`🏷️ Clasificando mov ${idx} (${isWhiteMove ? 'W' : 'B'}): ${move.san}`);
          console.log(`   bestEval: ${bestEval.toFixed(2)}, playedEval: ${playedEval.toFixed(2)}`);
          console.log(`   loss: ${loss.toFixed(2)}`);
          
          const classification = classifyMove({
            playedMove: move,
            bestMove: bestMove,
            playedEval: playedEval,
            bestEval: bestEval,
            playerColor: playerColor,
            isBook: false
          });
          
          console.log(`   → ${classification}`);
          
          if (classification) {
            style = getMoveStyle(classification);
            console.log(`   → style:`, style);
          }
        }
      } else {
        console.log(`⚠️ Variante mov ${idx}: Faltan datos para clasificar - bestMoves=${!!variant.bestMoves}, bestEvals=${!!variant.bestEvaluations}, evals=${!!variant.evaluations}`);
      }
      
      // Verificar si hay sub-variantes en este movimiento
      const hasSubVariants = variant.subVariants && variant.subVariants[idx] && variant.subVariants[idx].length > 0;
      
      return html`
        ${hasSubVariants ? html`
          ${variant.subVariants[idx].map((subVar, subVarIdx) => html`
            <span class="subvariant-wrapper">
              <span class="paren">(</span>
              ${this.renderVariant(subVar, idx, subVarIdx, currentPath, moveContext + idx)}
              <span class="paren">)</span>
            </span>
          `)}
        ` : ''}
        <span 
          class="variant-move ${isActive ? 'active' : ''}"
          @click=${(e) => {
            e.stopPropagation();
            this.selectVariant(currentPath, idx);
          }}
          title=${style?.label ?? ""}
        >
          <span class="move-number">${movePrefix}</span>
          <span class="piece">${piece}</span>
          <span class="rest">${rest}</span>
          ${style ? html`<span class="icon" style="color:${style.color}; font-size:11px;">${style.icon}</span>` : ''}
        </span>
      `;
    });
    
    // Para sub-variantes, retornar los movimientos sin contenedor adicional
    if (!isTopLevel) {
      return moveElements;
    }
    
    // Para variantes top-level, usar el div container
    return html`
      <div class="variant-container-inline">
        ${moveElements}
      </div>
    `;
  }
  
  renderVariantMoves(variant, mainMoveIndex, variantIndex, currentPath) {
    // Método deprecado - ahora todo está en renderVariant
    return this.renderVariant(variant, mainMoveIndex, variantIndex, currentPath || [], null);
  }
  
  pathsMatch(path1, path2) {
    if (!path1 || !path2 || path1.length !== path2.length) return false;
    return path1.every((p, i) => 
      p.mainMoveIndex === path2[i].mainMoveIndex && 
      p.variantIndex === path2[i].variantIndex
    );
  }

  selectVariant(variantPath, moveIndexInVariant) {
    this.dispatchEvent(
      new CustomEvent("variant-selected", {
        detail: { variantPath: { path: variantPath }, moveIndexInVariant },
        bubbles: true,
        composed: true
      })
    );
  }

  renderVariantsAfterPair(pairIndex) {
    const whiteIndex = pairIndex * 2;
    const blackIndex = pairIndex * 2 + 1;
    
    const whiteMove = this.moves[whiteIndex];
    const blackMove = this.moves[blackIndex];
    
    const variantsHtml = [];
    
    // Variantes del movimiento blanco
    if (whiteMove && whiteMove.variants && whiteMove.variants.length > 0) {
      variantsHtml.push(this.renderVariants(whiteMove.variants, whiteIndex, true));
    }
    
    // Variantes del movimiento negro
    if (blackMove && blackMove.variants && blackMove.variants.length > 0) {
      variantsHtml.push(this.renderVariants(blackMove.variants, blackIndex, false));
    }
    
    return variantsHtml.length > 0 ? html`${variantsHtml}` : '';
  }

  renderVariants(variants, moveIndex, isWhite) {
    if (!variants || variants.length === 0) return '';
    
    return html`
      <div class="variant-container">
        <span class="variant-label">Alternativa:</span>
        ${variants.map((variant, vIndex) => {
          return html`
            ${variant.map((moveSan, mIndex) => {
              const isVariantWhite = isWhite ? (mIndex % 2 === 0) : (mIndex % 2 === 1);
              const { piece, rest } = this.formatMove(moveSan, isVariantWhite);
              
              return html`
                <span 
                  class="variant ${this.inVariant && this.variantPath?.mainMoveIndex === moveIndex && this.variantPath?.variantIndex === vIndex && this.variantPath?.moveIndexInVariant === mIndex ? 'active' : ''}"
                  @click=${() => this.selectVariantMove(moveIndex, vIndex, mIndex)}
                  title="Alternat: ${moveSan}"
                >
                  <span class="piece">${piece}</span>
                  <span class="rest">${rest}</span>
                </span>
              `;
            })}
          `;
        })}
      </div>
    `;
  }

  selectVariantMove(mainMoveIndex, variantIndex, moveIndexInVariant) {
    this.dispatchEvent(
      new CustomEvent("variant-selected", {
        detail: {
          mainMoveIndex,
          variantIndex,
          moveIndexInVariant
        }
      })
    );
  }

  selectMove(i) {
    this.dispatchEvent(
      new CustomEvent("move-selected", {
        detail: i
      })
    );
  }

  getMovePairs() {
    const pairs = [];

    for (let i = 0; i < this.moves.length; i += 2) {
      pairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: this.moves[i],
        black: this.moves[i + 1] || null
      });
    }

    return pairs;
  }
}

customElements.define("cs-move-list", CSMoveList);