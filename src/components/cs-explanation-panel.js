import { LitElement, html, css } from "lit";

export class CSExplanationPanel extends LitElement {
  static properties = {
    explanation: { type: Object },
    loading: { type: Boolean }
  };

  static styles = css`
    :host {
      display: block;
    }

    .panel {
      border-radius: 10px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
    }

    .title {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 700;
      color: #e8e8e8;
      line-height: 1.3;
    }

    .section {
      margin-bottom: 10px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #888;
      margin-bottom: 4px;
    }

    .section-label.quality   { color: #81b64c; }
    .section-label.reasoning { color: #4a93ff; }
    .section-label.opport    { color: #f0a500; }

    .text {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: #ccc;
    }

    .takeaway {
      font-size: 13px;
      color: #bbb;
      padding-top: 10px;
      margin-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.08);
      line-height: 1.4;
    }

    .takeaway strong {
      color: #e8e8e8;
    }

    .empty {
      color: #777;
      font-size: 13px;
      line-height: 1.5;
    }

    .loading-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(57,131,255,0.3);
      border-top-color: #3983ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      color: #888;
      font-size: 13px;
    }

    /* Piezas dentro del texto explicativo */
    .move-token {
      font-family:
        "Noto Sans Symbols2",
        "Noto Sans Symbols",
        "Segoe UI Symbol",
        "Apple Symbols",
        "DejaVu Sans",
        sans-serif;
      font-size: 1.2em;
      font-weight: 700;
      color: #e8e8e8;
    }
  `;

  /** Convierte texto plano con notación SAN a nodos Lit con símbolos Unicode */
  _withPieces(text) {
    if (!text) return '';
    const pieceMap = { K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658' };
    // Captura movimientos como Nc6, Bxd5+, Qd4#, R1e5, Nac3
    const regex = /\b([KQRBN])([a-h1-8]?x?[a-h][1-8][+#!?=]*(?:[QRBN])?)/g;
    const parts = [];
    let last = 0, m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(html`<span class="move-token">${pieceMap[m[1]]}${m[2]}</span>`);
      last = regex.lastIndex;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="panel">
          <div class="loading-wrap">
            <div class="spinner"></div>
            <span class="loading-text">Consultando al coach IA…</span>
          </div>
        </div>
      `;
    }

    if (!this.explanation) {
      return html``;
    }

    const explanation = this.explanation;

    // Compatibilidad hacia atrás con campos de versiones anteriores
    const diagnosis    = explanation.diagnosis    ?? explanation.quality ?? explanation.explanation ?? "";
    const consequences = explanation.consequences ?? explanation.opportunities ?? explanation.stockfishReasoning ?? "";

    return html`
      <div class="panel">
        <h3 class="title">${explanation.title ?? "Análisis"}</h3>

        ${diagnosis ? html`
          <div class="section">
            <div class="section-label quality">Diagnóstico</div>
            <p class="text">${this._withPieces(diagnosis)}</p>
          </div>
        ` : ""}

        ${consequences ? html`
          <div class="section">
            <div class="section-label opport">Consecuencias</div>
            <p class="text">${this._withPieces(consequences)}</p>
          </div>
        ` : ""}

        ${explanation.takeaway ? html`
          <div class="takeaway">
            <strong>Idea clave:</strong> ${this._withPieces(explanation.takeaway)}
          </div>
        ` : ""}
      </div>
    `;
  }
}

customElements.define("cs-explanation-panel", CSExplanationPanel);
