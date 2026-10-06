// Post-build script: prepares dist output and docs/ for GitHub Pages.
// Script/css tags are injected by HtmlWebpackPlugin - async chunks (languages,
// ...) must NOT be added as <script> tags, otherwise code splitting is defeated.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const docsDir = path.join(__dirname, '..', 'docs');
const srcImagesDir = path.join(__dirname, '..', 'images');
const distImagesDir = path.join(distDir, 'images');
const docsImagesDir = path.join(docsDir, 'images');
// gif.js loads its worker from './src/js/libs/gifjs/gif.worker.js' at runtime
const gifWorkerSrc = path.join(__dirname, '..', 'src', 'js', 'libs', 'gifjs', 'gif.worker.js');

function copyGifWorker(targetDir) {
  if (!fs.existsSync(gifWorkerSrc)) {
    return;
  }
  const target = path.join(targetDir, 'src', 'js', 'libs', 'gifjs');
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(gifWorkerSrc, path.join(target, 'gif.worker.js'));
  console.log(`Copied gif.worker.js to ${path.relative(path.join(__dirname, '..'), target)}`);
}

// .well-known/security.txt (source: public/.well-known) must be in every build, dist and docs
const wellKnownSrc = path.join(__dirname, '..', 'public', '.well-known');
function copyWellKnown(targetDir) {
  if (!fs.existsSync(wellKnownSrc)) {
    return;
  }
  fs.cpSync(wellKnownSrc, path.join(targetDir, '.well-known'), { recursive: true });
  console.log(`Copied .well-known to ${path.relative(path.join(__dirname, '..'), targetDir)}`);
}

// CNAME (custom domain of GitHub Pages) must be in docs after every build
const cnameSrc = path.join(__dirname, '..', 'public', 'CNAME');
function copyCname(targetDir) {
  if (fs.existsSync(cnameSrc)) {
    fs.copyFileSync(cnameSrc, path.join(targetDir, 'CNAME'));
    console.log(`Copied CNAME to ${path.relative(path.join(__dirname, '..'), targetDir)}`);
  }
}

function postBuild() {
  const htmlPath = path.join(distDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  console.log('index.html length:', html.length);
  console.log('Has </body>:', html.includes('</body>'));

  // Copy images folder to dist
  if (fs.existsSync(srcImagesDir)) {
    if (fs.existsSync(distImagesDir)) {
      fs.rmSync(distImagesDir, { recursive: true, force: true });
    }
    fs.cpSync(srcImagesDir, distImagesDir, { recursive: true });
    console.log('Copied images to dist/images');
  }
  copyGifWorker(distDir);
  copyWellKnown(distDir);

  // Ensure docs directory exists
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Copy images folder to docs
  if (fs.existsSync(srcImagesDir)) {
    if (fs.existsSync(docsImagesDir)) {
      fs.rmSync(docsImagesDir, { recursive: true, force: true });
    }
    fs.cpSync(srcImagesDir, docsImagesDir, { recursive: true });
    console.log('Copied images to docs/images');
  }
  copyGifWorker(docsDir);
  copyWellKnown(docsDir);
  copyCname(docsDir);

  // Write index.html to docs (scripts/styles already injected by webpack)
  fs.writeFileSync(path.join(docsDir, 'index.html'), html);

  console.log('Prepared docs/index.html');
}

postBuild();
