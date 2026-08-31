import json

with open('backend/html_forensic_breakdown.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== TOP 30 LARGEST HTML FILES ===")
for i, item in enumerate(data['top_30'], 1):
    tracked = "[TRACKED]" if item['is_tracked'] else "[UNTRACKED]"
    print(f"{i:2}. {item['bytes']:7,} B | {item['lines']:5} L | {item['category']:12} | {tracked:11} | {item['path']}")
