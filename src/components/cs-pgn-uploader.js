import { LitElement, html, css } from "lit";
import "./cs-game-fetcher.js";

export class CSPgnUploader extends LitElement {
  static properties = {
    activeTab: { type: String }
  };

  constructor() {
    super();
    this.activeTab = 'online'; // Por defecto mostrar búsqueda online
  }

  createRenderRoot() {
    return this; // Usar Light DOM para heredar estilos
  }

  render() {
    return html`
      <style>
        .tabs-container {
          margin-bottom: 20px;
        }

        .tabs {
          display: flex;
          gap: 4px;
          justify-content: center;
          border-bottom: 2px solid #555;
          padding-bottom: 0;
        }

        .tab {
          padding: 10px 24px;
          background: transparent;
          color: #999;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          position: relative;
          top: 2px;
        }

        .tab:hover {
          color: #fff;
          background: rgba(129, 182, 76, 0.1);
        }

        .tab.active {
          color: #81b64c;
          border-bottom-color: #81b64c;
        }

        .uploader-container {
          text-align: center;
          padding: 20px;
        }

        .uploader-container h3 {
          margin-bottom: 8px;
          color: #fff;
          font-size: 18px;
        }

        .uploader-container p {
          color: #999;
          font-size: 14px;
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .uploader-container small {
          color: #666;
          font-size: 12px;
        }

        .uploader-container input[type="file"] {
          display: block;
          margin: 12px auto 0;
          padding: 10px 20px;
          background: #3d3d3d;
          color: #fff;
          border: 2px dashed #666;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          max-width: 400px;
        }

        .uploader-container input[type="file"]:hover {
          border-color: #81b64c;
          background: #454545;
        }

        .uploader-container input[type="file"]::file-selector-button {
          padding: 8px 16px;
          margin-right: 12px;
          background: #81b64c;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .uploader-container input[type="file"]::file-selector-button:hover {
          background: #96c861;
        }

        .instructions {
          margin-top: 16px;
          padding: 12px;
          background: rgba(129, 182, 76, 0.1);
          border-left: 3px solid #81b64c;
          border-radius: 4px;
          text-align: left;
          font-size: 13px;
          color: #ccc;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .instructions ol {
          margin: 8px 0 0 20px;
          padding: 0;
        }

        .instructions li {
          margin: 4px 0;
        }

        .tab-content {
          animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      </style>

      <div class="tabs-container">
        <div class="tabs">
          <button 
            class="tab ${this.activeTab === 'online' ? 'active' : ''}"
            @click=${() => this.activeTab = 'online'}
          >
            🌐 Desde plataforma
          </button>
          <button 
            class="tab ${this.activeTab === 'file' ? 'active' : ''}"
            @click=${() => this.activeTab = 'file'}
          >
            📁 Subir archivo
          </button>
        </div>
      </div>

      <div class="tab-content">
        ${this.activeTab === 'online' ? html`
          <cs-game-fetcher @pgn-loaded=${this.handlePgnLoaded}></cs-game-fetcher>
        ` : html`
          <div class="uploader-container">
            <h3>♟️ Analizar Partida con Stockfish 17</h3>
            <p>
              Carga cualquier archivo PGN para analizarlo
              <br>
              <small>(Análisis automático con Stockfish 17.1 + NNUE)</small>
            </p>
            <input type="file" @change=${this.handleFile} accept=".pgn" />
            
            <div class="instructions">
              <strong>📋 Cómo usar:</strong>
              <ol>
                <li>Exporta tu partida desde Lichess, Chess.com, etc.</li>
                <li>Descarga el archivo PGN (no necesita análisis previo)</li>
                <li>Cárgalo aquí y el motor analizará cada posición</li>
                <li>Verás evaluaciones, clasificaciones y mejores jugadas</li>
              </ol>
            </div>
          </div>
        `}
      </div>
    `;
  }

  handlePgnLoaded(e) {
    // Evitar procesar el mismo evento dos veces
    if (e.detail._alreadyForwarded) {
      return;
    }
    
    // Reenviar el evento al componente padre (app.js)
    console.log('📨 cs-pgn-uploader recibió pgn-loaded, reenviando al app.js');
    console.log('📄 PGN (primeros 300 chars):', e.detail.substring(0, 300));
    console.log('📏 Longitud total:', e.detail.length);
    
    this.dispatchEvent(
      new CustomEvent("pgn-loaded", {
        detail: e.detail,
        bubbles: true,
        composed: true
      })
    );
    
    // Detener la propagación del evento original
    e.stopPropagation();
  }

  handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      const pgnContent = event.target.result;
      
      // Verificar que el contenido parece ser un PGN válido
      if (!pgnContent.includes('[Event') && !pgnContent.includes('1.')) {
        alert('⚠️ El archivo no parece ser un PGN válido.\nAsegúrate de cargar un archivo .pgn de una partida de ajedrez.');
        return;
      }
      
      this.dispatchEvent(
        new CustomEvent("pgn-loaded", {
          detail: pgnContent
        })
      );
    };

    reader.onerror = () => {
      alert('❌ Error al leer el archivo. Por favor, inténtalo de nuevo.');
    };

    reader.readAsText(file, "utf-8");
  }
}

customElements.define("cs-pgn-uploader", CSPgnUploader);