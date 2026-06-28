import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const files = globSync('src/**/*.{tsx,ts,jsx,js}', { ignore: ['src/components/icons.tsx', 'src/types/database.ts'] });

const replacements = [
  // 1. Responsive gaps (gap-5 -> gap-4 md:gap-6)
  { regex: /\bgap-5\b/g, replacement: 'gap-4 md:gap-6' },
  
  // 2. Modals/Drawer backdrops (bg-black/40 or bg-slate-900/60 -> bg-slate-900/40 backdrop-blur-sm)
  // Wait, user banned backdrop-blur! So just solid tint: bg-slate-900/60
  { regex: /\bbg-black\/40\b/g, replacement: 'bg-slate-900/60' },
  { regex: /\bbg-black\/50\b/g, replacement: 'bg-slate-900/60' },

  // 3. Typography hierarchy on headings
  // Add text-balance to block-level headings
  { regex: /<h1([^>]*)className="([^"]*)"/g, replacement: '<h1$1className="$2 text-balance tracking-tight"' },
  { regex: /<h2([^>]*)className="([^"]*)"/g, replacement: '<h2$1className="$2 text-balance tracking-tight"' },
  { regex: /<h3([^>]*)className="([^"]*)"/g, replacement: '<h3$1className="$2 tracking-tight"' },

  // 4. Subtle hover motion
  { regex: /\bhover:scale-105\b/g, replacement: 'hover:scale-[1.01] transition-transform duration-300 ease-out' },
  { regex: /\bhover:scale-102\b/g, replacement: 'hover:scale-[1.01] transition-transform duration-300 ease-out' },

  // 5. Clean up duplicate classes created by multiple runs
  { regex: /\btext-balance text-balance\b/g, replacement: 'text-balance' },
  { regex: /\btracking-tight tracking-tight\b/g, replacement: 'tracking-tight' },
];

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  for (const rule of replacements) {
    content = content.replace(rule.regex, rule.replacement);
  }

  // Deduplicate classes
  content = content.replace(/className="([^"]*)"/g, (match, classes) => {
    const uniqueClasses = [...new Set(classes.split(/\s+/))].join(' ');
    return `className="${uniqueClasses}"`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    modifiedCount++;
    console.log(`Modified: ${file}`);
  }
}

console.log(`\nImpeccable rules applied to ${modifiedCount} files.`);
