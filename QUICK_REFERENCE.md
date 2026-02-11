# 🚀 Quick Reference - PDF Analysis Integration

## 🎯 Команды для быстрого старта

```bash
# 1. Установить зависимости
pip install -r requirements-backend.txt

# 2. Запустить Backend
python3 api.py

# 3. В другом терминале - Frontend
npm run dev

# 4. Тестирование API
curl http://localhost:5000/api/health
```

## 📁 Новые файлы

| Файл | Описание |
|------|---------|
| `api.py` | Flask сервер для анализа PDF |
| `requirements-backend.txt` | Python зависимости |
| `README_PDF_ANALYSIS.md` | Полная документация |
| `INTEGRATION_SUMMARY.md` | Сводка изменений |
| `BACKEND_SETUP.md` | Конфигурация Backend |
| `PDF_ANALYSIS_GUIDE.md` | Руководство пользователя |
| `USAGE_EXAMPLES.md` | Примеры кода |

## 📝 Обновленные файлы

| Файл | Что изменилось |
|------|-----------------|
| `src/components/pages/UploadPage.tsx` | Drag-drop, PDF анализ, отображение результатов |

## 🔌 API Endpoints

```
GET  /api/health                    # Проверка здоровья
POST /api/analyze-report            # Анализ PDF
```

## 📊 JSON Response Structure

```json
{
  "project_info": {
    "full_name": "string",
    "code": "string",
    "report_period": "string",
    "location": "string"
  },
  "project_status": "нормальный|тревожный|критичный",
  "metrics": {
    "SMR_completion": number,
    "GPR_delay_percent": number,
    "GPR_delay_days": number,
    "DDU_payments_percent": [number],
    "guarantee_extension": boolean
  },
  "reasoning": [string],
  "triggered_conditions": [string]
}
```

## 🎨 Status Icons

- 🟢 Нормальный (normal)
- 🟡 Тревожный (warning)
- 🔴 Критичный (critical)

## 📦 Зависимости

```
flask==2.3.3
flask-cors==4.0.0
pdfplumber==0.10.3
werkzeug==2.3.7
```

## 🧪 Тестирование

```bash
# Тестировать API
curl -X POST http://localhost:5000/api/analyze-report \
  -F "file=@2.pdf"

# Проверить здоровье
curl http://localhost:5000/api/health

# С Python
python3 -c "
from advanced_analyzer import AdvancedReportAnalyzer
a = AdvancedReportAnalyzer(pdf_path='2.pdf')
r = a.analyze()
print(r['project_status'])
"
```

## ⚙️ Ключевые пороги

| Метрика | Критичный порог |
|---------|-----------------|
| СМР | < 80% |
| Отставание ГПР | > 30% |
| ДДУ | < 70% |
| Гарантия | Объявлена = критично |

## 🔄 Процесс анализа

1. PDF загружается на frontend
2. Frontend отправляет POST на `/api/analyze-report`
3. Backend сохраняет файл временно
4. `AdvancedReportAnalyzer` извлекает метрики
5. Классифицирует статус проекта
6. Возвращает JSON результат
7. Frontend отображает результаты
8. Сохраняет в БД (projectreports)

## 🚨 Статусы ошибок

```
200 OK              # Успешно проанализировано
400 Bad Request     # Неправильный формат файла
500 Server Error    # Ошибка обработки
```

## 📚 Где найти документацию

- **Полная документация:** [README_PDF_ANALYSIS.md](README_PDF_ANALYSIS.md)
- **Backend конфигурация:** [BACKEND_SETUP.md](BACKEND_SETUP.md)
- **Примеры кода:** [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)
- **Сводка изменений:** [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)

## 🆘 Быстрые решения

| Проблема | Решение |
|----------|---------|
| ImportError: pdfplumber | `pip install pdfplumber` |
| Port 5000 in use | `lsof -i :5000` → `kill -9 <PID>` |
| No module: flask | `pip install flask flask-cors` |
| CORS error | Убедитесь что flask-cors установлен |

## 💾 Сохранение результатов

Результаты автоматически сохраняются в:
- **Коллекция:** `projectreports`
- **Поля:** `reportFileName`, `uploadDate`, `processingStatus`, `ingestionLog`

## 🎯 Функции компонента

```typescript
// UploadPage.tsx
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>();
const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

// Обработчики
handleDrag()        // Drag-drop визуализация
handleDrop()        // Обработка dropped файла
handleFileChange()  // Обработка выбранного файла
handleSubmit()      // Отправка на анализ
getStatusIcon()     // Иконка статуса
```

## 🔐 CORS конфигурация

```python
from flask_cors import CORS
app = Flask(__name__)
CORS(app)  # Включено для localhost
```

## 📊 Пример результата

```json
{
  "project_status": "тревожный",
  "metrics": {
    "SMR_completion": 46.69,
    "GPR_delay_percent": 13.33,
    "GPR_delay_days": 76,
    "DDU_payments_percent": [47.07],
    "guarantee_extension": true
  }
}
```

Означает:
- ⚠️ СМР слишком низко (46.69%)
- ✅ Отставание в допусках (13.33%)
- ⚠️ ДДУ слишком низко (47.07%)
- 🛡️ Объявлен гарантийный случай

## 🌍 URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Upload page: `http://localhost:5173/upload`
- API Health: `http://localhost:5000/api/health`

## 📞 Support

При проблемах смотрите документацию:
1. [README_PDF_ANALYSIS.md](README_PDF_ANALYSIS.md) - общее описание
2. [BACKEND_SETUP.md](BACKEND_SETUP.md) - backend проблемы
3. [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) - примеры кода

---

**Версия:** 1.0  
**Дата:** 2 февраля 2026  
**Статус:** ✅ Ready
