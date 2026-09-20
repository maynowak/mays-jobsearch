import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputDir = path.join(__dirname, 'src/assets/images');
const outputDir = path.join(__dirname, 'src/assets/images');

const images = [
  'job-matcher-next-step.png',
  'job-matcher-next-step-searchpage.png'
];

async function optimize() {
  console.log('Starting image optimization...\n');
  
  for (const image of images) {
    const inputPath = path.join(inputDir, image);
    const baseName = path.parse(image).name;
    
    // Get original size
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;
    console.log(`\n--- ${image} ---`);
    console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB (${originalSize} bytes)`);
    
    // 1. Compress PNG losslessly
    const compressedPngPath = path.join(outputDir, `${baseName}-compressed.png`);
    await sharp(inputPath)
      .png({ 
        compressionLevel: 9,
        adaptiveFiltering: true,
        force: true
      })
      .toFile(compressedPngPath);
    
    const compressedStats = fs.statSync(compressedPngPath);
    const compressedSize = compressedStats.size;
    const pngSavings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    console.log(`Compressed PNG: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${compressedSize} bytes) - ${pngSavings}% savings`);
    
    // 2. Generate WebP at 85% quality
    const webpPath = path.join(outputDir, `${baseName}.webp`);
    await sharp(inputPath)
      .webp({ 
        quality: 85,
        effort: 6
      })
      .toFile(webpPath);
    
    const webpStats = fs.statSync(webpPath);
    const webpSize = webpStats.size;
    const webpSavings = ((originalSize - webpSize) / originalSize * 100).toFixed(1);
    console.log(`WebP (85%): ${(webpSize / 1024 / 1024).toFixed(2)} MB (${webpSize} bytes) - ${webpSavings}% savings`);
    
    // Replace original with compressed PNG
    fs.copyFileSync(compressedPngPath, inputPath);
    fs.unlinkSync(compressedPngPath);
    console.log(`✓ Replaced original with compressed PNG`);
    console.log(`✓ Generated WebP: ${baseName}.webp`);
  }
  
  console.log('\n✅ Image optimization complete!');
}

optimize().catch(console.error);
