import fs from 'fs';
import path from 'path';

// 1. Verify CSS classes in global.css
const cssPath = path.resolve('src/styles/global.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const requiredCssClasses = [
    '.svg-infection-beam-ruby',
    '.svg-capture-ruby-crystal',
    '.svg-gem-spark-ruby',
    '.piece-converting-ruby',
    '.svg-infection-beam-pearl',
    '.svg-capture-pearl-ripple',
    '.svg-capture-pearl-ripple-inner',
    '.svg-gem-spark-pearl',
    '.piece-converting-pearl',
    '.hex-cell-3d-base',
    '.hex-cell-rim',
    '.hex-cell-bed',
    '.svg-landing-shockwave'
];

console.log('--- CSS VALIDATION ---');
let allCssFound = true;
for (const cls of requiredCssClasses) {
    const found = cssContent.includes(cls);
    console.log(`CSS Class ${cls}: ${found ? '✓ FOUND' : '✗ MISSING'}`);
    if (!found) allCssFound = false;
}

// 2. Verify Game Engine bindings
const enginePath = path.resolve('src/scripts/game-engine.js');
const engineContent = fs.readFileSync(enginePath, 'utf8');

console.log('\n--- GAME ENGINE VALIDATION ---');
const engineChecks = [
    { name: 'grad-hex-plate gradient', check: engineContent.includes('id="grad-hex-plate"') },
    { name: 'grad-hex-stroke gradient', check: engineContent.includes('id="grad-hex-stroke"') },
    { name: 'grad-hex-bed gradient', check: engineContent.includes('id="grad-hex-bed"') },
    { name: 'grad-hex-base gradient', check: engineContent.includes('id="grad-hex-base"') },
    { name: 'triggerCaptureVFX player param', check: engineContent.includes('triggerCaptureVFX(fromX, fromY, toX, toY, color, player') },
    { name: 'ruby crystal shockwave creation', check: engineContent.includes('svg-capture-ruby-crystal') },
    { name: 'pearl ripple creation', check: engineContent.includes('svg-capture-pearl-ripple') },
    { name: 'ruby beam creation', check: engineContent.includes('svg-infection-beam-ruby') },
    { name: 'pearl beam creation', check: engineContent.includes('svg-infection-beam-pearl') },
    { name: 'piece converting class injection', check: engineContent.includes("player === 'ruby' ? 'piece-converting-ruby' : 'piece-converting-pearl'") }
];

let allEngineFound = true;
for (const check of engineChecks) {
    console.log(`Engine Check [${check.name}]: ${check.check ? '✓ PASS' : '✗ FAIL'}`);
    if (!check.check) allEngineFound = false;
}

// 3. Verify Particle Engine bindings
const particlePath = path.resolve('src/scripts/particles.js');
const particleContent = fs.readFileSync(particlePath, 'utf8');

console.log('\n--- PARTICLE ENGINE VALIDATION ---');
const particleChecks = [
    { name: 'createCaptureBurst ruby branch', check: particleContent.includes("if (player === 'ruby')") },
    { name: 'Ruby crimson shockwave color', check: particleContent.includes("color: '#ff2d60'") },
    { name: 'Ruby gold ember color', check: particleContent.includes("color: isGold ? '#fbbf24' : '#ff2d60'") },
    { name: 'Pearl electric cyan shockwave', check: particleContent.includes("color: '#00e5ff'") },
    { name: 'Pearl dual ripple shockwave', check: particleContent.includes("color: '#ffffff'") },
    { name: 'Full buffer clearCanvas', check: particleContent.includes("this.ctx.setTransform(1, 0, 0, 1, 0, 0)") }
];

let allParticleFound = true;
for (const check of particleChecks) {
    console.log(`Particle Check [${check.name}]: ${check.check ? '✓ PASS' : '✗ FAIL'}`);
    if (!check.check) allParticleFound = false;
}

if (allCssFound && allEngineFound && allParticleFound) {
    console.log('\n🎉 ALL VALIDATION CHECKS PASSED PERFECTLY!');
    process.exit(0);
} else {
    console.error('\n⚠️ SOME CHECKS FAILED');
    process.exit(1);
}
