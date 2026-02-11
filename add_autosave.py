#!/usr/bin/env python3
import re

with open('src/components/pages/UploadPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the location where we need to insert auto-save logic
# We're looking for the line with setUploadedFileName and will insert after it
pattern = r"(setUploadedFileName\(selectedFile\.name\);)\n\n      (// Сохраняем отчет в базу данных)"

replacement = r"\1\n\n      // Если НЕ требуется ручной ввод названия, сохраняем проект сразу\n      if (!result.require_manual_name) {\n        try {\n          console.log('Auto-saving project (no manual name required)...');\n          await saveOrUpdateProject(result, {\n            fileName: selectedFile.name,\n            uploadedAt: new Date().toISOString(),\n            projectName: result.project_info.full_name,\n          });\n          console.log('✓ Project auto-saved');\n          setProjectSaved(true);\n        } catch (autoSaveErr) {\n          console.error('Failed to auto-save project:', autoSaveErr);\n          // Продолжаем - отчёт всё равно сохранится\n        }\n      }\n\n      \2"

if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
    with open('src/components/pages/UploadPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('✓ Updated UploadPage.tsx - auto-save logic added')
else:
    print('✗ Could not find the target pattern')
