#!/usr/bin/env node

/**
 * Utility script to remove console.log, console.warn, and console.error statements
 * Usage: node remove-logs.js
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const dirsToProcess = ['modules'];
const filesToProcess = ['background.js'];

// Patterns to remove (preserve error handling comments)
const patterns = [
  // Remove standalone console.log statements
  /^\s*console\.log\([^)]*\);\s*$/gm,
  // Remove console.log in if/else/try/catch blocks (with proper indentation)
  /^(\s+)console\.log\([^)]*\);\s*$/gm,
  // Remove console.warn statements
  /^\s*console\.warn\([^)]*\);\s*$/gm,
  /^(\s+)console\.warn\([^)]*\);\s*$/gm,
  // Remove console.error statements
  /^\s*console\.error\([^)]*\);\s*$/gm,
  /^(\s+)console\.error\([^)]*\);\s*$/gm,
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  const originalContent = content;
  
  // Apply all patterns
  patterns.forEach(pattern => {
    content = content.replace(pattern, '');
  });
  
  // Remove multiple consecutive empty lines (max 2)
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    modified = true;
  }
  
  return modified;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalModified = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'Deprecated' && file !== 'Alternative Provider') {
      // Recursively process subdirectories (skip Deprecated and Alternative Provider)
      totalModified += processDirectory(filePath);
    } else if (stat.isFile() && file.endsWith('.js')) {
      if (processFile(filePath)) {
        console.log(`✓ Cleaned: ${filePath}`);
        totalModified++;
      }
    }
  });
  
  return totalModified;
}

function main() {
  console.log('🧹 Removing console.log, console.warn, and console.error statements...\n');
  
  let totalModified = 0;
  
  // Process directories
  dirsToProcess.forEach(dir => {
    if (fs.existsSync(dir)) {
      totalModified += processDirectory(dir);
    }
  });
  
  // Process individual files
  filesToProcess.forEach(file => {
    if (fs.existsSync(file)) {
      if (processFile(file)) {
        console.log(`✓ Cleaned: ${file}`);
        totalModified++;
      }
    }
  });
  
  console.log(`\n✨ Done! Modified ${totalModified} file(s).`);
}

main();
