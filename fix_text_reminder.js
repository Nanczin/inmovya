const fs = require('fs');

const filePath = 'c:\\Users\\Stevan\\Desktop\\inmovya-main\\src\\components\\journey-map\\LeadJourneyMap.tsx';

// Read file
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\r\n');

console.log(`Original file has ${lines.length} lines`);

// Remove lines 1694-1769 (0-indexed: 1693-1768)
const before = lines.slice(0, 1693);
const after = lines.slice(1769);
const newLines = [...before, ...after];

console.log(`New file will have ${newLines.length} lines`);
console.log(`Removed ${lines.length - newLines.length} lines`);

// Write back
fs.writeFileSync(filePath, newLines.join('\r\n'), 'utf8');

console.log('✅ Successfully removed reminder section from Text Node form!');
