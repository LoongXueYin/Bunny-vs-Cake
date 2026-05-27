const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// PPTX is a ZIP file - extract and read slide XMLs
const src = 'C:/Users/tx/Desktop/5分钟简短汇报.pptx';
const tmp = 'C:/Users/tx/Desktop/_pptx_tmp';

try {
  // Clean temp dir
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true });
  fs.mkdirSync(tmp);

  // Unzip
  const AdmZip = (() => {
    // Simple ZIP reader for PPTX
    const data = fs.readFileSync(src);
    // PPTX is ZIP - use built-in approach
    return null;
  })();

  // Use PowerShell to unzip
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${src}' -DestinationPath '${tmp}' -Force"`, { encoding: 'utf8' });

  // Read slides
  const slidesDir = path.join(tmp, 'ppt', 'slides');
  if (!fs.existsSync(slidesDir)) {
    console.log('No slides dir found');
    process.exit(1);
  }

  const slideFiles = fs.readdirSync(slidesDir)
    .filter(f => /^slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0]);
      const nb = parseInt(b.match(/\d+/)[0]);
      return na - nb;
    });

  slideFiles.forEach(file => {
    const xml = fs.readFileSync(path.join(slidesDir, file), 'utf8');
    const matches = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)];
    const texts = matches.map(m => m[1].trim()).filter(Boolean);
    if (texts.length > 0) {
      console.log(`\n=== ${file} ===`);
      texts.forEach(t => console.log('  ' + t));
    }
  });

  // Also check slide1.xml in root slides
  const rootSlides = path.join(tmp, 'ppt', 'slides');
  console.log('\nFiles in slides dir:', fs.readdirSync(rootSlides).join(', '));

} catch (e) {
  console.error('Error:', e.message);
} finally {
  // Cleanup
  try { if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true }); } catch(e) {}
}
