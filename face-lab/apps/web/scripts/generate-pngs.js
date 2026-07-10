#!/usr/bin/env node
/**
 * Script para gerar PNGs dos logos SVG
 * Requer: npm install -D sharp
 *
 * Uso: node scripts/generate-pngs.js
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const images = [
  { input: 'favicon.svg', output: 'favicon-192.png', size: 192 },
  { input: 'favicon.svg', output: 'favicon-512.png', size: 512 },
  { input: 'logo-192.svg', output: 'logo-192.png', size: 192 },
  { input: 'logo-512.svg', output: 'logo-512.png', size: 512 },
];

async function generatePNGs() {
  for (const { input, output, size } of images) {
    const inputPath = path.join(publicDir, input);
    const outputPath = path.join(publicDir, output);

    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  ${input} not found, skipping...`);
      continue;
    }

    try {
      await sharp(inputPath)
        .png()
        .resize(size, size)
        .toFile(outputPath);
      console.log(`✓ Generated ${output}`);
    } catch (error) {
      console.error(`✗ Error generating ${output}:`, error.message);
    }
  }
  console.log('\n✓ PNG generation complete!');
}

generatePNGs().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
