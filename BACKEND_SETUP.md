# Backend Setup для Build View Hub

## Установка зависимостей

### Python зависимости

```bash
pip install flask flask-cors pdfplumber
```

### Для полной установки (с данными)
```bash
pip install flask flask-cors pdfplumber pandas numpy scikit-learn
```

## Запуск API сервера

### Способ 1: Прямой запуск Flask

```bash
python3 api.py
```

Сервер запустится на `http://localhost:5000`

### Способ 2: Через Gunicorn (для production)

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 api:app
```

### Способ 3: Через Docker (опционально)

```bash
docker build -t build-view-hub-api .
docker run -p 5000:5000 build-view-hub-api
```

## API Endpoints

### POST /api/analyze-report
Анализирует загруженный PDF отчёт

**Request:**
```
Content-Type: multipart/form-data
Body:
  - file: [PDF file]
```

**Response (200):**
```json
{
  "project_info": {
    "full_name": "Project Name",
    "code": "Certificate №123",
    "report_period": "2025г декабря",
    "location": "City location"
  },
  "project_status": "тревожный",
  "metrics": {
    "SMR_completion": 46.69,
    "GPR_delay_percent": 13.33,
    "GPR_delay_days": 76,
    "DDU_payments_percent": [47.07],
    "guarantee_extension": true
  },
  "reasoning": [
    "🟡 СТАТУС: ТРЕВОЖНЫЙ - ...",
    "✓ Условие 'a' ВЫПОЛНЕНО: ..."
  ],
  "triggered_conditions": ["a", "b6", "d1"]
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message"
}
```

### GET /api/health
Проверка здоровья сервера

**Response (200):**
```json
{
  "status": "ok"
}
```

## Конфигурация

В файле `api.py` можно настроить:
- `UPLOAD_FOLDER` - папка для временного хранения файлов
- `MAX_FILE_SIZE` - максимальный размер файла (по умолчанию 50 MB)
- Хост и порт в `app.run()`

## Frontend интеграция

Frontend отправляет запрос на `/api/analyze-report` при загрузке PDF файла в компоненте `UploadPage.tsx`.

## Требования к PDF файлам

PDF отчёты должны содержать:
- Название проекта
- Код проекта/сертификата
- Период отчета (YYYYMM формат)
- Объем СМР (%)
- Отставание от ГПР (дни)
- Поступления по ДДУ (%)
- Информацию о гарантийных случаях

## Развёртывание

### На локальной машине:
1. Установить Python 3.8+
2. Установить зависимости: `pip install -r requirements.txt`
3. Запустить: `python3 api.py`

### На сервере (Linux/macOS):
1. Клонировать репозиторий
2. Создать virtual environment: `python3 -m venv venv`
3. Активировать: `source venv/bin/activate`
4. Установить: `pip install -r requirements.txt`
5. Запустить через Gunicorn или другой WSGI сервер

## Troubleshooting

### Ошибка "ModuleNotFoundError: No module named 'pdfplumber'"
```bash
pip install pdfplumber
```

### Ошибка CORS при запросе с frontend
Убедитесь, что Flask запущен с CORS включен (уже включен в api.py)

### Файл не загружается
- Проверьте размер файла (максимум 50 MB)
- Убедитесь, что это PDF файл
- Проверьте права доступа на папку /tmp

## Логирование

Добавить логирование в api.py:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# В функциях:
logger.debug(f"Анализирую файл: {filename}")
logger.error(f"Ошибка: {str(e)}")
```
