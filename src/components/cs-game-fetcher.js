import { LitElement, html, css } from "lit";
import { loadGame } from "../lib/chess-logic.js";
import { buildOpeningsByMove } from "../lib/openings.js";

export class CSGameFetcher extends LitElement {
  static properties = {
    platform: { type: String },
    username: { type: String },
    games: { type: Array },
    loading: { type: Boolean },
    error: { type: String }
  };

  constructor() {
    super();
    this.platform = localStorage.getItem('chess-scouter-platform') || 'chess.com';
    this.username = localStorage.getItem('chess-scouter-username') || '';
    this.games = [];
    this.loading = false;
    this.error = '';
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <style>
        .fetcher-container {
          padding: 20px;
        }

        .fetcher-container h3 {
          margin-bottom: 12px;
          color: #fff;
          font-size: 18px;
          text-align: center;
        }

        .platform-selector {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 16px;
        }

        .platform-btn {
          padding: 8px 20px;
          background: #3d3d3d;
          color: #999;
          border: 2px solid #555;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .platform-btn:hover {
          background: #454545;
          border-color: #81b64c;
        }

        .platform-btn.active {
          background: #81b64c;
          color: #fff;
          border-color: #81b64c;
        }

        .username-input-group {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .username-input-group input {
          flex: 1;
          padding: 12px;
          background: #3d3d3d;
          color: #fff;
          border: 2px solid #555;
          border-radius: 6px;
          font-size: 14px;
        }

        .username-input-group input:focus {
          outline: none;
          border-color: #81b64c;
        }

        .username-input-group button {
          padding: 12px 24px;
          background: #81b64c;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .username-input-group button:hover:not(:disabled) {
          background: #96c861;
        }

        .username-input-group button:disabled {
          background: #555;
          cursor: not-allowed;
        }

        .games-list {
          max-height: 400px;
          overflow-y: auto;
          margin-top: 16px;
        }

        .game-item {
          padding: 12px;
          background: #3d3d3d;
          border: 1px solid #555;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .game-item:hover {
          background: #454545;
          border-color: #81b64c;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .game-players {
          font-weight: 600;
          color: #fff;
          font-size: 14px;
        }

        .game-result {
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .game-result.win {
          background: rgba(129, 182, 76, 0.2);
          color: #81b64c;
        }

        .game-result.loss {
          background: rgba(229, 57, 53, 0.2);
          color: #e53935;
        }

        .game-result.draw {
          background: rgba(158, 158, 158, 0.2);
          color: #999;
        }

        .game-info {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #999;
        }

        .loading-message, .error-message {
          text-align: center;
          padding: 20px;
          border-radius: 6px;
        }

        .loading-message {
          background: rgba(129, 182, 76, 0.1);
          color: #81b64c;
        }

        .error-message {
          background: rgba(229, 57, 53, 0.1);
          color: #e53935;
        }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 13px;
        }
      </style>

      <div class="fetcher-container">
        <h3>🌐 Cargar desde plataforma</h3>

        <div class="platform-selector">
          <button 
            class="platform-btn ${this.platform === 'chess.com' ? 'active' : ''}"
            @click=${() => {
              this.platform = 'chess.com';
              localStorage.setItem('chess-scouter-platform', 'chess.com');
            }}
          >
            Chess.com
          </button>
          <button 
            class="platform-btn ${this.platform === 'lichess' ? 'active' : ''}"
            @click=${() => {
              this.platform = 'lichess';
              localStorage.setItem('chess-scouter-platform', 'lichess');
            }}
          >
            Lichess
          </button>
        </div>

        <div class="username-input-group">
          <input 
            type="text"
            placeholder="Nombre de usuario"
            .value=${this.username}
            @input=${(e) => {
              this.username = e.target.value;
              localStorage.setItem('chess-scouter-username', this.username);
            }}
            @keypress=${(e) => e.key === 'Enter' && this.fetchGames()}
          />
          <button 
            @click=${this.fetchGames}
            ?disabled=${!this.username || this.loading}
          >
            ${this.loading ? '⏳ Cargando...' : '🔍 Buscar'}
          </button>
        </div>

        ${this.error ? html`
          <div class="error-message">
            ❌ ${this.error}
          </div>
        ` : ''}

        ${this.loading ? html`
          <div class="loading-message">
            Cargando partidas de ${this.username} en ${this.platform}...
          </div>
        ` : ''}

        ${!this.loading && !this.error && this.games.length > 0 ? html`
          <div class="games-list">
            ${this.games.map((game) => html`
              <div class="game-item" @click=${() => this.selectGame(game)}>
                <div class="game-header">
                  <span class="game-players">
                    ${game.white} vs ${game.black}
                  </span>
                  <span class="game-result ${game.resultClass}">
                    ${game.result}
                  </span>
                </div>
                <div class="game-info">
                  <span>🕒 ${game.date}</span>
                  <span>⏱ ${game.timeControl}</span>
                  ${game.moveCount ? html`<span>🔢 ${game.moveCount}</span>` : ''}
                  ${game.opening ? html`<span>📊 ${game.opening}</span>` : ''}
                </div>
              </div>
            `)}
          </div>
        ` : ''}

        ${!this.loading && !this.error && this.games.length === 0 && !this.username ? html`
          <div class="empty-state">
            Ingresa tu nombre de usuario y presiona buscar para ver tus últimas partidas
          </div>
        ` : ''}
      </div>
    `;
  }

  async fetchGames() {
    if (!this.username) return;

    // Guardar username en localStorage
    localStorage.setItem('chess-scouter-username', this.username);

    this.loading = true;
    this.error = '';
    this.games = [];
    this.requestUpdate();

    try {
      if (this.platform === 'lichess') {
        await this.fetchLichessGames();
      } else {
        await this.fetchChesscomGames();
      }
    } catch (error) {
      console.error('Error fetching games:', error);
      this.error = error.message || 'Error al cargar partidas. Verifica el nombre de usuario.';
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  async fetchLichessGames() {
    const response = await fetch(
      `https://lichess.org/api/games/user/${this.username}?max=20&rated=true&perfType=blitz,rapid,classical&evals=false&opening=true`,
      {
        headers: {
          'Accept': 'application/x-ndjson'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Usuario no encontrado en Lichess');
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line);
    const games = lines.map(line => JSON.parse(line));

    this.games = games.map(game => {
      const isWhite = game.players.white.user?.name.toLowerCase() === this.username.toLowerCase();
      const result = game.status === 'draw' ? 'draw' : 
                     (game.winner === 'white' && isWhite) || (game.winner === 'black' && !isWhite) ? 'win' : 'loss';
      
      const gameDate = new Date(game.createdAt);
      const dateStr = gameDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

      // Lichess proporciona el número de movimientos (plies) en el campo moves
      const moveCount = game.moves ? Math.ceil(game.moves.split(' ').length / 2) : 0;

      return {
        id: game.id,
        white: game.players.white.user?.name || 'Anonymous',
        black: game.players.black.user?.name || 'Anonymous',
        result: game.status === 'draw' ? '½-½' : result === 'win' ? '1-0' : '0-1',
        resultClass: result,
        date: dateStr,
        timestamp: game.createdAt,
        timeControl: `${Math.floor(game.clock?.initial / 60)}'+${game.clock?.increment || 0}\"`,
        opening: game.opening?.name || '',
        moveCount: moveCount,
        pgn: null, // Lichess no incluye PGN en la lista, hay que descargarlo
        platform: 'lichess',
        url: `https://lichess.org/${game.id}`
      };
    });

    // Ordenar por fecha descendente (más reciente primero)
    this.games.sort((a, b) => b.timestamp - a.timestamp);
  }

  async fetchChesscomGames() {
    // Primero obtener el mes actual
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const response = await fetch(
      `https://api.chess.com/pub/player/${this.username}/games/${year}/${month}`
    );

    if (!response.ok) {
      throw new Error('Usuario no encontrado en Chess.com');
    }

    const data = await response.json();
    
    if (!data.games || data.games.length === 0) {
      throw new Error('No se encontraron partidas recientes');
    }

    // Ordenar por fecha descendente antes de tomar las primeras 20
    const sortedGames = data.games.sort((a, b) => b.end_time - a.end_time);

    this.games = sortedGames.slice(0, 20).map(game => {
      const isWhite = game.white.username.toLowerCase() === this.username.toLowerCase();
      const result = game.white.result === 'win' ? (isWhite ? 'win' : 'loss') :
                     game.black.result === 'win' ? (isWhite ? 'loss' : 'win') : 'draw';
      
      const gameDate = new Date(game.end_time * 1000);
      const dateStr = gameDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

      // Verificar que el PGN esté disponible
      if (!game.pgn) {
        console.warn(`⚠️ Partida ${game.url} no tiene PGN`);
      }

      // Detectar apertura desde los movimientos para chess.com
      let detectedOpening = '';
      let moveCount = 0;
      if (game.pgn) {
        try {
          const gameData = loadGame(game.pgn);
          if (gameData && gameData.moves && gameData.moves.length > 0) {
            moveCount = gameData.moves.length;
            const openingsByMove = buildOpeningsByMove(gameData.moves);
            // Buscar la apertura más larga detectada
            for (let i = openingsByMove.length - 1; i >= 0; i--) {
              if (openingsByMove[i]?.opening) {
                const opening = openingsByMove[i].opening;
                detectedOpening = opening.variation 
                  ? `${opening.name} - ${opening.variation}` 
                  : opening.name;
                break;
              }
            }
          }
        } catch (e) {
          console.warn('Error detectando apertura:', e);
        }
      }

      return {
        id: game.url,
        white: game.white.username,
        black: game.black.username,
        result: game.white.result === 'win' ? '1-0' : game.black.result === 'win' ? '0-1' : '½-½',
        resultClass: result,
        date: dateStr,
        timestamp: game.end_time,
        timeControl: game.time_class,
        opening: detectedOpening,
        moveCount: moveCount,
        pgn: game.pgn || null,
        platform: 'chess.com',
        url: game.url
      };
    });
  }

  async selectGame(game) {
    console.log('🎯 selectGame - Cargando partida:', game);
    let pgn = game.pgn;

    // Lichess requiere descargar el PGN por separado
    if (game.platform === 'lichess') {
      try {
        console.log(`📥 Descargando PGN de Lichess: ${game.id}`);
        const response = await fetch(`https://lichess.org/game/export/${game.id}?evals=false&clocks=false`);
        if (!response.ok) {
          throw new Error('Error al descargar PGN de Lichess');
        }
        pgn = await response.text();
        console.log(`✅ PGN descargado de Lichess (${pgn.length} chars)`);
        console.log('📄 PGN de Lichess (primeros 500 chars):', pgn.substring(0, 500));
      } catch (error) {
        console.error('❌ Error downloading PGN from Lichess:', error);
        alert('Error al descargar la partida de Lichess. Inténtalo de nuevo.');
        return;
      }
    } else if (game.platform === 'chess.com') {
      console.log('📄 PGN de Chess.com (primeros 500 chars):', pgn?.substring(0, 500));
    }

    // Chess.com ya incluye el PGN
    if (!pgn) {
      console.error('❌ PGN no disponible para esta partida');
      alert('PGN no disponible para esta partida.');
      return;
    }

    // Limpiar el PGN antes de enviarlo
    pgn = pgn.trim();
    
    console.log(`📤 Emitiendo evento pgn-loaded con PGN de ${pgn.length} caracteres`);
    this.dispatchEvent(
      new CustomEvent("pgn-loaded", {
        detail: pgn,
        bubbles: true,
        composed: true
      })
    );
  }
}

customElements.define("cs-game-fetcher", CSGameFetcher);
