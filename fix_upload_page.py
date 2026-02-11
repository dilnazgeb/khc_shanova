#!/usr/bin/env python3
import re

with open('src/components/pages/UploadPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the button - be more flexible with whitespace
pattern = r'<button\s+onClick=\{?\(\) => \{[^}]*alert\([\'"]✓ Название проекта[^}]*\}\}[^>]*className="[^"]*"'
replacement = '<button\n                                onClick={handleSaveProject}\n                                disabled={savingProject}\n                                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"'

# This approach won't work well, let's just do string replacement with exact whitespace
old_button = '''                              <button
                                onClick={() => {
                                  // Сохранение названия проекта - оно уже обновлено в analysisResult
                                  alert('✓ Название проекта сохранено. При сохранении отчёта оно будет применено к проекту.');
                                }}
                                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-semibold"
                              >
                                Сохранить
                              </button>'''

new_button = '''                              <button
                                onClick={handleSaveProject}
                                disabled={savingProject}
                                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingProject ? '⏳ Сохранение...' : '✓ Сохранить'}
                              </button>'''

if old_button in content:
    content = content.replace(old_button, new_button)
    print('✓ Button replaced')
else:
    print('✗ Button not found, trying alternative pattern...')
    # Try without exact whitespace matching
    content = re.sub(
        r'<button\s+onClick=\{\(\) => \{\s*// Сохранение названия проекта[^}]*alert[^}]*\}\}\s*className="[^"]*"\s*>\s*Сохранить\s*</button>',
        new_button,
        content,
        flags=re.DOTALL
    )
    print('✓ Button replaced with regex')

with open('src/components/pages/UploadPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Updated UploadPage.tsx')
