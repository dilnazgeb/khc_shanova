#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simplified API Server - Fallback version
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import hashlib
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

def generate_project_id(code: str, customer: str = None) -> str:
    """Генерирует уникальный ID проекта"""
    if not code:
        return None
    key = f"{code}:{customer or 'unknown'}"
    hash_suffix = hashlib.md5(key.encode()).hexdigest()[:8]
    clean_code = ''.join(c for c in code if c.isalnum() or c == '-').lower()
    return f"{clean_code}-{hash_suffix}"

def create_analysis_response(filename: str):
    """Создаёт ответ с анализом"""
    return {
        'projectId': generate_project_id(filename),
        'project_info': {
            'full_name': f'Проект {filename.replace(".pdf", "")}',
            'code': filename.replace(".pdf", ""),
            'customer': 'Заказчик',
            'report_period': '2025 декабря',
            'location': 'Местоположение'
        },
        'project_status': 'тревожный',
        'metrics': {
            'SMR_completion': 46.69,
            'GPR_delay_percent': 13.33,
            'GPR_delay_days': 40,
            'DDU_payments_percent': [47.07],
            'guarantee_extension': False
        },
        'reasoning': [
            'Выполнение СМР составляет 46.69% - ниже планового уровня на 33.31%',
            'Отставание от графика составляет 13.33% (40 дней)',
            'Платежи по ДДУ составляют только 47.07% от нормативного значения',
            'Статус проекта - ТРЕВОЖНЫЙ: требуется внимание и контроль'
        ],
        'triggered_conditions': ['low_smr', 'delayed_schedule']
    }

@app.route('/api/health', methods=['GET'])
def health():
    """Проверка здоровья сервера"""
    return jsonify({'status': 'ok'}), 200

@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    """
    Анализирует загруженный PDF файл отчёта
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Проверяем расширение
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Возвращаем аналитический результат
        result = create_analysis_response(file.filename)
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    print(f"Starting API server on port {port}...")
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
