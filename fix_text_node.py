#!/usr/bin/env python3
# Script to remove reminder section from Text Node form

file_path = r"c:\Users\Stevan\Desktop\inmovya-main\src\components\journey-map\LeadJourneyMap.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 1694-1769 (0-indexed: 1693-1768)
# Keep everything before line 1694 and after line 1769
new_lines = lines[:1693] + lines[1769:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Removed reminder section from Text Node form (lines 1694-1769)")
print(f"Original lines: {len(lines)}")
print(f"New lines: {len(new_lines)}")
print(f"Removed: {len(lines) - len(new_lines)} lines")
