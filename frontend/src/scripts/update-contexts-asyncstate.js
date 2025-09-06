#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contextsDir = path.join(__dirname, '../contexts');
const files = fs.readdirSync(contextsDir).filter(f => f.endsWith('.tsx'));

const asyncStateImport = `import { AsyncState, AsyncStateHelpers } from "../types/asyncState";`;

files.forEach(file => {
  const filePath = path.join(contextsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already updated
  if (content.includes('from "../types/asyncState"')) {
    console.log(`✅ Already updated: ${file}`);
    return;
  }
  
  // Check if has local AsyncState definition
  const hasLocalAsyncState = content.includes('interface AsyncState') || content.includes('export interface AsyncState');
  
  if (hasLocalAsyncState) {
    console.log(`📝 Updating: ${file}`);
    
    // Remove local AsyncState interface definition
    content = content.replace(/(?:export )?interface AsyncState<T> \{[\s\S]*?\n\}/gm, '');
    
    // Add import after the last import from React
    const reactImportMatch = content.match(/import [\s\S]*? from "react";/);
    if (reactImportMatch) {
      const insertPos = reactImportMatch.index + reactImportMatch[0].length;
      content = content.slice(0, insertPos) + '\n' + asyncStateImport + content.slice(insertPos);
    }
    
    // Update helper function calls
    content = content.replace(/createEmptyAsyncState/g, 'AsyncStateHelpers.createEmpty');
    content = content.replace(/createLoadingState/g, 'AsyncStateHelpers.createLoading');
    content = content.replace(/createSuccessState/g, 'AsyncStateHelpers.createSuccess');
    content = content.replace(/createErrorState/g, 'AsyncStateHelpers.createError');
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${file}`);
  } else {
    console.log(`⏭️  No AsyncState in: ${file} (needs manual review)`);
  }
});

console.log('\n✅ Script completed!');
console.log('Note: Some contexts without AsyncState may need manual implementation.');