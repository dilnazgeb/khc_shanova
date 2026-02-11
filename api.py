#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Server для анализа PDF отчётов
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import hashlib
import signal
from werkzeug.utils import secure_filename
from advanced_analyzer import AdvancedReportAnalyzer

app = Flask(__name__)
CORS(app)

# Конфигурация
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE


class TimeoutException(Exception):
    pass


def timeout_handler(signum, frame):
    raise TimeoutException("PDF analysis timeout")


def allowed_file(filename):
    """Проверяет, имеет ли файл допустимое расширение"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_project_id(code: str, customer: str = None) -> str:
    """Генерирует уникальный ID проекта на основе кода и заказчика"""
    if not code:
        return None
    
    # Нормализуем код - убираем спецсимволы И кириллицу, оставляем только ASCII alphanumeric
    # Это необходимо для совместимости с Wix (_id может быть только ASCII)
    normalized_code = ''.join(c.lower() for c in code if c.isascii() and c.isalnum())
    if not normalized_code:
        return None
    
    # Используем только код для дедублирования (код уникален для проекта)
    # customer опциональный, но включаем для дополнительной уникальности
    key = f"{normalized_code}:{customer.lower() if customer else 'novendor'}"
    hash_suffix = hashlib.md5(key.encode()).hexdigest()[:8]
    return f"{normalized_code}-{hash_suffix}"


def generate_fallback_code(name: str, period: str) -> str:
    """Генерирует fallback код когда extraction не удалась"""
    if not name:
        name = "unknown"
    
    # Нормализуем только name (период не включаем, чтобы разные отчеты одного проекта имели одинаковый код)
    # Оставляем только ASCII alphanumeric для совместимости с Wix
    name_clean = ''.join(c.lower() for c in name if c.isascii() and c.isalnum())[:30]
    
    if not name_clean:
        name_clean = "unknown"
    
    # Используем хеш для компактности
    name_hash = hashlib.md5(name_clean.encode()).hexdigest()[:8]
    fallback_code = f"fallback{name_hash}"
    return fallback_code


def create_fallback_response(filename: str):
    """Создаёт fallback ответ когда анализ PDF не сработал"""
    return {
        'projectId': generate_project_id(filename),
        'project_info': {
            'full_name': f'Проект {filename.replace(".pdf", "")}',
            'code': filename.replace(".pdf", ""),
            'customer': 'Неизвестен',
            'report_period': 'Текущий период',
            'location': ''
        },
        'project_status': 'тревожный',
        'metrics': {
            'SMR_completion': 45.0,
            'GPR_delay_percent': 15.0,
            'GPR_delay_days': 30,
            'DDU_payments_percent': [50.0],
            'guarantee_extension': False
        },
        'reasoning': [
            'Файл не удалось проанализировать автоматически',
            'Используются приблизительные значения для быстрой загрузки',
            'Пожалуйста, проверьте данные в интерфейсе'
        ],
        'triggered_conditions': ['timeout', 'fallback_mode']
    }



@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    """
    Анализирует загруженный PDF файл отчёта
    
    Returns:
        JSON с результатами анализа
    """
    try:
        # Проверяем, есть ли файл в запросе
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Проверяем имя файла
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Проверяем расширение файла
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Сохраняем файл во временную папку
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Пытаемся анализировать PDF
            analyzer = AdvancedReportAnalyzer(pdf_path=filepath)
            result = analyzer.analyze()
            
            # Преобразуем результат в JSON-совместимый формат
            project_code = result['project_info'].get('code', '')
            project_name = result['project_info'].get('full_name', '')
            report_period = result['project_info'].get('report_period', '')
            project_customer = result['project_info'].get('customer', '')
            
            # Если код не извлечен, используем fallback
            if not project_code:
                fallback_code = generate_fallback_code(project_name, report_period)
                print(f"Code extraction failed, using fallback: '{fallback_code}'")
                project_code = fallback_code
            
            project_id = generate_project_id(project_code, project_customer)
            
            response = {
                'projectId': project_id,  # Уникальный ID для дедублирования
                'project_info': {
                    'full_name': result['project_info'].get('full_name', 'Unknown'),
                    'code': result['project_info'].get('code', '') or project_code,  # Используем fallback код если original пустой
                    'customer': result['project_info'].get('customer', ''),
                    'report_period': result['project_info'].get('report_period', 'Unknown'),
                    'location': result['project_info'].get('location', ''),
                },
                'project_status': result['project_status'],
                'metrics': {
                    'SMR_completion': result['metrics'].get('SMR_completion'),
                    'GPR_delay_percent': result['metrics'].get('GPR_delay_percent'),
                    'GPR_delay_days': result['metrics'].get('GPR_delay_days'),
                    'DDU_payments_percent': result['metrics'].get('DDU_payments_percent', []),
                    'DDU_monthly_values': result['metrics'].get('DDU_monthly_values'),
                    'guarantee_extension': result['metrics'].get('guarantee_extension', False)
                },
                'reasoning': result['reasoning'],
                'triggered_conditions': result['triggered_conditions']
            }
            # Если требуется ручной ввод названия, добавляем флаг во внешний объект
            if result['project_info'].get('require_manual_name'):
                response['require_manual_name'] = True
            
            return jsonify(response), 200
            
        except Exception as e:
            # При ошибке анализа используем fallback
            print(f"PDF analysis error (using fallback): {str(e)}")
            fallback = create_fallback_response(filename)
            return jsonify(fallback), 200
        
        finally:
            # Удаляем временный файл
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except:
                    pass
    
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Проверка здоровья сервера"""
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    # Для разработки
    port = int(os.environ.get('PORT', 5002))
    app.run(debug=True, host='0.0.0.0', port=port)
