# Примеры использования PDF Analysis API

## 1. Тестирование API с curl

### Загрузить и проанализировать PDF
```bash
curl -X POST http://localhost:5000/api/analyze-report \
  -F "file=@2.pdf" \
  | jq '.'
```

### Проверить здоровье сервера
```bash
curl http://localhost:5000/api/health
```

## 2. Тестирование с Python

```python
import requests

# Загрузить файл
with open('2.pdf', 'rb') as f:
    files = {'file': f}
    response = requests.post(
        'http://localhost:5000/api/analyze-report',
        files=files
    )

# Получить результаты
result = response.json()
print(f"Статус проекта: {result['project_status']}")
print(f"СМР: {result['metrics']['SMR_completion']}%")
print(f"ДДУ: {result['metrics']['DDU_payments_percent'][0]}%")
```

## 3. Тестирование с JavaScript/Fetch

```javascript
const form = new FormData();
form.append('file', fileInput.files[0]);

const response = await fetch('/api/analyze-report', {
  method: 'POST',
  body: form
});

const result = await response.json();
console.log(result.project_status); // "тревожный"
console.log(result.metrics.SMR_completion); // 46.69
```

## 4. Использование advanced_analyzer.py напрямую

```python
from advanced_analyzer import AdvancedReportAnalyzer

# Анализировать PDF
analyzer = AdvancedReportAnalyzer(pdf_path='2.pdf')
result = analyzer.analyze()

# Вывести подробный отчет
report = analyzer.generate_detailed_report()
print(report)

# Сохранить результаты
import json
with open('result.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
```

## 5. Интеграция в другие компоненты

### В ProjectList компоненте
```typescript
// Получить статус из результатов анализа
const statusColor = {
  'нормальный': 'success-green',
  'тревожный': 'warning-yellow', // примерно
  'критичный': 'warning-red'
}[analysisResult.project_status];
```

### В Dashboard компоненте
```typescript
// Агрегировать статистику
const stats = {
  total: projects.length,
  normal: projects.filter(p => p.status === 'нормальный').length,
  warning: projects.filter(p => p.status === 'тревожный').length,
  critical: projects.filter(p => p.status === 'критичный').length
};
```

## 6. Развертывание с Docker

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements-backend.txt .
RUN pip install -r requirements-backend.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "api:app"]
```

```bash
# Сборка образа
docker build -t build-view-hub-api .

# Запуск контейнера
docker run -p 5000:5000 build-view-hub-api
```

## 7. Интеграция с CI/CD

### GitHub Actions пример
```yaml
name: Test PDF Analysis

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      - run: pip install -r requirements-backend.txt
      - run: python3 -m pytest tests/
```

## 8. Обработка ошибок на frontend

```typescript
try {
  const result = await fetch('/api/analyze-report', {
    method: 'POST',
    body: formData
  });
  
  if (!result.ok) {
    const error = await result.json();
    throw new Error(error.error);
  }
  
  const data = await result.json();
  setAnalysisResult(data);
} catch (error) {
  setErrorMessage(error.message);
}
```

## 9. Кэширование результатов

```python
# api.py - добавить кэш
from functools import lru_cache
import hashlib

@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    file = request.files['file']
    
    # Создать хеш файла для кэша
    file_hash = hashlib.md5(file.read()).hexdigest()
    file.seek(0)
    
    # Проверить кэш
    cache_key = f"analysis_{file_hash}"
    cached = redis_client.get(cache_key)
    if cached:
        return jsonify(json.loads(cached))
    
    # Анализировать и сохранить в кэш
    result = analyze(file)
    redis_client.setex(cache_key, 86400, json.dumps(result))
    return jsonify(result)
```

## 10. Логирование и мониторинг

```python
# api.py - добавить логирование
import logging
import json_logging

json_logging.init_flask(enable_json_logging=True)

@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    logger = logging.getLogger(__name__)
    
    logger.info("Анализ отчета", extra={
        'file_name': file.filename,
        'file_size': len(file.read())
    })
    
    try:
        result = analyze(file)
        logger.info("Анализ успешен", extra={
            'status': result['project_status']
        })
        return jsonify(result)
    except Exception as e:
        logger.error("Ошибка анализа", extra={
            'error': str(e)
        })
        return jsonify({'error': str(e)}), 500
```

## 11. Параллельная обработка с Celery

```python
from celery import Celery

celery = Celery('build-view-hub')

@celery.task
def analyze_pdf_async(file_path):
    analyzer = AdvancedReportAnalyzer(pdf_path=file_path)
    return analyzer.analyze()

@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    # Сохранить файл
    file.save(file_path)
    
    # Запустить асинхронный анализ
    task = analyze_pdf_async.delay(file_path)
    
    # Вернуть ID задачи
    return jsonify({'task_id': task.id})

@app.route('/api/analyze-report/<task_id>', methods=['GET'])
def get_analysis(task_id):
    task = analyze_pdf_async.AsyncResult(task_id)
    if task.ready():
        return jsonify(task.result)
    return jsonify({'status': 'processing'})
```

## 12. Тестирование компонента UploadPage

```typescript
// __tests__/UploadPage.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import UploadPage from '../UploadPage';

describe('UploadPage', () => {
  it('should upload and display analysis results', async () => {
    render(<UploadPage />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByRole('input', { name: /choose file/i });
    
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    
    // Дождаться результатов
    await screen.findByText(/analysis results/i);
  });
});
```

## 13. Метрики и аналитика

```python
# Отслеживать метрики в API
from prometheus_client import Counter, Histogram

analysis_counter = Counter(
    'pdf_analyses_total',
    'Total PDF analyses',
    ['status']
)

analysis_duration = Histogram(
    'pdf_analysis_duration_seconds',
    'Time spent analyzing PDF'
)

@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    with analysis_duration.time():
        result = analyze(file)
        analysis_counter.labels(status=result['project_status']).inc()
    
    return jsonify(result)
```

## 14. Batch обработка

```python
@app.route('/api/analyze-reports', methods=['POST'])
def analyze_reports():
    """Анализировать несколько PDF одновременно"""
    files = request.files.getlist('files')
    results = []
    
    for file in files:
        analyzer = AdvancedReportAnalyzer(pdf_path=save_file(file))
        results.append(analyzer.analyze())
    
    return jsonify({
        'count': len(results),
        'results': results
    })
```

---

**Совет:** Начните с примера #1-2 для тестирования, затем переходите к более сложным интеграциям по мере необходимости.
