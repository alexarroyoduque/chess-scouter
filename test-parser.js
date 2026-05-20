// Test rápido del parser de evaluaciones y variantes
import { parseEvaluationsFromPgn, parseVariantsFromPgn, loadGame } from './src/lib/chess-logic.js';
import fs from 'fs';

const pgnPath = process.argv[2] || './test-game.pgn';

try {
  const pgnContent = fs.readFileSync(pgnPath, 'utf-8');
  
  console.log('📄 Analizando PGN...\n');
  
  const evaluations = parseEvaluationsFromPgn(pgnContent);
  
  console.log(`✅ Se encontraron ${evaluations.length} evaluaciones\n`);
  
  if (evaluations.length > 0) {
    console.log('🔍 Primeras 10 evaluaciones:');
    evaluations.slice(0, 10).forEach((evalValue, i) => {
      const moveNum = Math.floor(i / 2) + 1;
      const color = i % 2 === 0 ? 'Blancas' : 'Negras';
      console.log(`  ${moveNum}. ${color}: ${evalValue > 0 ? '+' : ''}${evalValue.toFixed(2)}`);
    });
    
    console.log('\n📊 Estadísticas:');
    console.log(`  - Evaluación inicial: ${evaluations[0].toFixed(2)}`);
    console.log(`  - Evaluación final: ${evaluations[evaluations.length - 1].toFixed(2)}`);
    console.log(`  - Máxima ventaja blancas: +${Math.max(...evaluations).toFixed(2)}`);
    console.log(`  - Máxima ventaja negras: ${Math.min(...evaluations).toFixed(2)}`);
  } else {
    console.log('❌ No se encontraron evaluaciones en el PGN');
    console.log('   Asegúrate de que el PGN incluye análisis de Lichess');
  }

  // Test de variantes
  console.log('\n\n🌲 Analizando variantes...\n');
  const variants = parseVariantsFromPgn(pgnContent);
  const variantCount = Object.keys(variants).length;
  
  console.log(`✅ Se encontraron variantes en ${variantCount} movimientos\n`);
  
  if (variantCount > 0) {
    console.log('📋 Variantes encontradas:');
    Object.entries(variants).forEach(([moveIndex, variantsList]) => {
      const moveNum = Math.floor(parseInt(moveIndex) / 2) + 1;
      const color = parseInt(moveIndex) % 2 === 0 ? 'Blancas' : 'Negras';
      console.log(`\n  ${moveNum}. ${color} (índice ${moveIndex}):`);
      variantsList.forEach((variant, vIdx) => {
        console.log(`    Variante ${vIdx + 1}: ${variant.slice(0, 5).join(' ')}${variant.length > 5 ? '...' : ''}`);
      });
    });
  } else {
    console.log('❌ No se encontraron variantes en el PGN');
  }

  // Test de loadGame con variantes
  console.log('\n\n🎯 Probando loadGame()...\n');
  const moves = loadGame(pgnContent);
  const movesWithVariants = moves.filter(m => m.variants && m.variants.length > 0);
  
  console.log(`✅ Total de movimientos: ${moves.length}`);
  console.log(`✅ Movimientos con variantes: ${movesWithVariants.length}\n`);
  
  if (movesWithVariants.length > 0) {
    console.log('📌 Primeros movimientos con variantes:');
    movesWithVariants.slice(0, 3).forEach((move, idx) => {
      const moveIdx = moves.indexOf(move);
      const moveNum = Math.floor(moveIdx / 2) + 1;
      const color = moveIdx % 2 === 0 ? 'Blancas' : 'Negras';
      console.log(`\n  ${moveNum}. ${color} - ${move.san}:`);
      move.variants.forEach((variant, vIdx) => {
        console.log(`    Alt ${vIdx + 1}: ${variant.join(' ')}`);
      });
    });
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  console.log('\nUso: node test-parser.js <ruta-al-pgn>');
}
