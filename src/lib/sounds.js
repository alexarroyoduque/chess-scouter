/**
 * Servicio de sonidos para el tablero de ajedrez
 */

class SoundManager {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    try {
      // Inicializar AudioContext solo cuando sea necesario (después de interacción del usuario)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API no disponible:', e);
    }
  }

  /**
   * Reproduce el sonido de movimiento (similar a chess.com)
   */
  playMove() {
    if (!this.audioContext) {
      this.init();
    }
    
    if (!this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      
      // Crear oscilador para el tono principal
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Configurar el sonido (un "clic" suave)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.02);
      
      // Envelope: ataque rápido, decay suave
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      
      oscillator.start(now);
      oscillator.stop(now + 0.08);
      
    } catch (e) {
      console.warn('Error reproduciendo sonido:', e);
    }
  }

  /**
   * Reproduce sonido de captura (un poco más enfático)
   */
  playCapture() {
    if (!this.audioContext) {
      this.init();
    }
    
    if (!this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      
      // Crear dos osciladores para un sonido más rico
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Configurar frecuencias
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(900, now);
      osc1.frequency.exponentialRampToValueAtTime(350, now + 0.03);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(600, now);
      osc2.frequency.exponentialRampToValueAtTime(250, now + 0.03);
      
      // Envelope más pronunciado
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      osc1.start(now);
      osc1.stop(now + 0.1);
      osc2.start(now);
      osc2.stop(now + 0.1);
      
    } catch (e) {
      console.warn('Error reproduciendo sonido de captura:', e);
    }
  }

  /**
   * Reproduce sonido de jaque (agudo y distintivo como chess.com)
   */
  playCheck() {
    if (!this.audioContext) {
      this.init();
    }
    
    if (!this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      
      // Sonido más agudo y corto para jaque
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Frecuencia más alta para jaque (distintivo)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, now);
      oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.015);
      
      // Envelope corto y punzante
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.003);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
      
      oscillator.start(now);
      oscillator.stop(now + 0.06);
      
    } catch (e) {
      console.warn('Error reproduciendo sonido de jaque:', e);
    }
  }
}

// Instancia singleton
export const soundManager = new SoundManager();
