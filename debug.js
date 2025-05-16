const fs = require('fs');
const path = require('path');

console.log('=== DEBUG OUTPUT ===');

// PostCSSの設定を確認
try {
  console.log('\n=== POSTCSS CONFIG ===');
  const postcssPath = path.resolve('./postcss.config.js');
  console.log(`PostCSS config exists: ${fs.existsSync(postcssPath)}`);
  
  if (fs.existsSync(postcssPath)) {
    const postcssContent = fs.readFileSync(postcssPath, 'utf8');
    console.log('PostCSS Content:');
    console.log(postcssContent);
    
    // モジュールとして読み込んでみる
    try {
      const postcssConfig = require('./postcss.config.js');
      console.log('PostCSS Config as module:');
      console.log(JSON.stringify(postcssConfig, null, 2));
    } catch (e) {
      console.log('Error loading postcss config as module:', e.message);
    }
  }
} catch (e) {
  console.log('Error checking postcss config:', e.message);
}

// パス関連の問題を確認
console.log('\n=== DIRECTORY STRUCTURE ===');
try {
  console.log('Components dir exists:', fs.existsSync('./components'));
  console.log('Lib dir exists:', fs.existsSync('./lib'));
  console.log('Contexts dir exists:', fs.existsSync('./contexts'));
  
  if (fs.existsSync('./components')) {
    console.log('UI dir exists:', fs.existsSync('./components/ui'));
    
    if (fs.existsSync('./components/ui')) {
      console.log('Components/UI contents:', fs.readdirSync('./components/ui'));
    }
  }
  
  if (fs.existsSync('./lib')) {
    console.log('Lib contents:', fs.readdirSync('./lib'));
    
    if (fs.existsSync('./lib/supabase')) {
      console.log('Lib/Supabase contents:', fs.readdirSync('./lib/supabase'));
    }
  }
  
  if (fs.existsSync('./contexts')) {
    console.log('Contexts contents:', fs.readdirSync('./contexts'));
  }
} catch (e) {
  console.log('Error checking directory structure:', e.message);
}

// 最終的に新しいPostCSS設定を書き込む
try {
  console.log('\n=== WRITING NEW POSTCSS CONFIG ===');
  const newConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}`;
  fs.writeFileSync('./postcss.config.js', newConfig);
  console.log('New PostCSS config written successfully');
} catch (e) {
  console.log('Error writing new postcss config:', e.message);
}

console.log('\n=== DEBUG COMPLETE ===');
