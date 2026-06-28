import fs from 'fs/promises';
import path from 'path';

async function walk(dir) {
  let results = [];
  const list = await fs.readdir(dir);
  for (let file of list) {
    file = path.resolve(dir, file);
    const stat = await fs.stat(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(await walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  }
  return results;
}

async function run() {
  const files = await walk('./src');
  for (const file of files) {
    if (file.includes('StandardCard') || file.includes('GlassCard.tsx')) continue;

    let content = await fs.readFile(file, 'utf8');
    let changed = false;

    if (content.includes('GlassCard')) {
      // 1. Remove inline GlassCard function
      content = content.replace(/function GlassCard\(\{[^}]+\}\s*:\s*\{[^}]+\}\)\s*\{\s*return\s*\(\s*<div[^>]+>\s*\{children\}\s*<\/div>\s*\);\s*\}/g, '');
      content = content.replace(/function GlassCard\(\{\s*className,\s*children\s*\}\s*:\s*\{\s*className\?:\s*string;\s*children:\s*React\.ReactNode\s*\}\)\s*\{\s*return\s*\(\s*<div[^>]*>\s*\{children\}\s*<\/div>\s*\);\s*\}/g, '');
      
      // Some formatting variations
      content = content.replace(/function GlassCard[^}]+\{[^}]+return\s*\([^)]+\)\s*;\s*\}/g, '');

      // 2. Replace components usage
      content = content.replaceAll('<GlassCard', '<StandardCard');
      content = content.replaceAll('</GlassCard>', '</StandardCard>');

      // 3. Update imports
      if (content.includes('import GlassCard from "@/components/GlassCard"')) {
        content = content.replace('import GlassCard from "@/components/GlassCard"', 'import StandardCard from "@/components/ui/StandardCard"');
      } else if (content.includes('<StandardCard') && !content.includes('import StandardCard')) {
        // Need to add import at the top
        content = 'import StandardCard from "@/components/ui/StandardCard";\n' + content;
      }
      
      changed = true;
    }

    if (changed) {
      await fs.writeFile(file, content, 'utf8');
      console.log('Updated', file);
    }
  }
}

run().catch(console.error);
