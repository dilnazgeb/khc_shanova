#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Server для анализа PDF отчётов
Оптимизированная версия с быстрым анализатором
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import hashlib
import re
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Конфигурация
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_project_id(code: str, customer: str = None) -> str:
    if not code:
        return None
    key = f"{code}:{customer or 'unknown'}"
    hash_suffix = hashlib.md5(key.encode()).hexdigest()[:8]
    clean_code = ''.join(c for c in code if c.isalnum() or c == '-').lower()
    return f"{clean_code}-{hash_suffix}"


def extract_text_from_pdf(filepath: str) -> dict:
    """Быстрое извлечение текста из PDF. Возвращает full и first page text."""
    try:
        import pdfplumber
        with pdfplumber.open(filepath) as pdf:
            text = ""
            first = ""
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    if i == 0:
                        first = page_text
                    text += page_text + "\n"
            return {'full': text, 'first': first}
    except:
        # Fallback если pdfplumber не работает
        return {'full': '', 'first': ''}


def extract_metrics(text: str) -> dict:
    """Извлекает метрики из текста PDF"""
    metrics = {
        'SMR_completion': 0,
        'GPR_delay_percent': 0,
        'GPR_delay_days': 0,
        'DDU_payments_percent': [0],
        'guarantee_extension': False,
        'builder_delay_days': 0,
        'builder_rating_drop': 0,
        'complaints_count': 0,
        'debt_to_equity': 0
    }
    
    # СМР - Строительно-монтажные работы
    smr_patterns = [
        r'СМР.*?(\d+[.,]\d+)\s*%',
        r'выполнение\s+СМР.*?(\d+[.,]\d+)',
        r'строительно\D+монтажные.*?(\d+[.,]\d+)',
    ]
    for pattern in smr_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['SMR_completion'] = float(match.group(1).replace(',', '.'))
            break
    
    # ГПР - График-Процент-Резерв (отставание)
    gpr_patterns = [
        r'отставани[еюя].*?(\d+[.,]\d+)\s*%',
        r'ГПР.*?(\d+[.,]\d+)',
        r'от графика.*?(\d+[.,]\d+)',
    ]
    for pattern in gpr_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['GPR_delay_percent'] = float(match.group(1).replace(',', '.'))
            break
    
    # ГПР дни
    gpr_days_patterns = [
        r'отставани[еюя]\s+(\d+)\s+д[нн]',
        r'(\d+)\s+д[нн].*?отставани',
        r'дней.*?отставани|отставани.*?(\d+)\s+дней',
    ]
    for pattern in gpr_days_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['GPR_delay_days'] = int(match.group(1))
            break
    
    # ДДУ - Договор Долевого Участия (платежи)
    # Ищем несколько значений (за последние месяцы)
    ddu_values = []
    ddu_patterns = [
        r'ДДУ.*?(\d+[.,]\d+)\s*%',
        r'платежи.*?(\d+[.,]\d+)',
        r'поступлени[еяю].*?денежных.*?(\d+[.,]\d+)',
    ]
    
    # Берём все совпадения для ДДУ
    for pattern in ddu_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            value = float(match.group(1).replace(',', '.'))
            if value not in ddu_values:
                ddu_values.append(value)
        if ddu_values:
            break
    
    # Если нашли несколько значений - используем их как история
    if ddu_values:
        metrics['DDU_payments_percent'] = ddu_values[:3]  # максимум 3 месяца
    
    # Гарантийный случай (d1)
    if re.search(r'гарантийн\w+\s+случа\w*', text, re.IGNORECASE):
        metrics['guarantee_extension'] = True
    
    # Просрочка по займам (b2, d4)
    delay_patterns = [
        r'просрочк[аи].*?(\d+)\s+д[нн]',
        r'(\d+)\s+д[нн].*?просрочк',
    ]
    for pattern in delay_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['builder_delay_days'] = int(match.group(1))
            break
    
    # Жалобы дольщиков (b3, d2)
    complaint_patterns = [
        r'обращени[еям].*?(\d+)',
        r'жалоб.*?(\d+)',
    ]
    for pattern in complaint_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['complaints_count'] = int(match.group(1))
            break
    
    # Снижение рейтинга (b4, d3)
    rating_patterns = [
        r'рейтинг.*?(?:на|снижение).*?(\d+)',
        r'снижение.*?рейтинг.*?(\d+)',
    ]
    for pattern in rating_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['builder_rating_drop'] = int(match.group(1))
            break
    
    # Соотношение долга к капиталу (b5)
    debt_patterns = [
        r'(?:долг|заемн\w+).*?(?:капитал|собственн\w+).*?(\d+[.,]\d+)',
        r'соотношени[еям].*?(?:долг|заемн\w+).*?(\d+[.,]\d+)',
    ]
    for pattern in debt_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metrics['debt_to_equity'] = float(match.group(1).replace(',', '.'))
            break
    
    return metrics


def extract_project_info(full_text: str, first_page_text: str = None) -> dict:
    """Извлекает информацию о проекте"""
    info = {
        'full_name': 'Unknown Project',
        'code': 'Unknown',
        'customer': '',
        'report_period': 'Unknown',
        'location': '',
        'name_from_first_page': False
    }
    
    # Код проекта
    code_patterns = [
        r'ДПГ[\s-]?\d+[\s-]?\d+[\s-]?\d+',
        r'Код[:\s]+([А-Яа-я\d\s-]+)',
    ]
    # Сначала ищем код на первой странице
    search_targets = [first_page_text or '', full_text]
    for idx, target in enumerate(search_targets):
        for pattern in code_patterns:
            match = re.search(pattern, target)
        if match:
                info['code'] = match.group(0) if 'ДПГ' in match.group(0) else (match.group(1) if match.lastindex else match.group(0))
                break
        if info['code'] != 'Unknown':
            break
    
    # Название проекта - ищем после "Отчет инжиниринговой компании..."
    # Это название идёт после длинной строки с описанием отчёта
    name_patterns = [
        # Попытка найти название в кавычках после "Отчет инжиниринговой..."
        r'Отчет\s+инжиниринговой.*?\n\s*([^\n]+)',
        # Или название в кавычках как ЖК "..."
        r'ЖК\s+"([^"]+)"',
        # Или после слова "объект"
        r'объект[:\s]+([^\n]+)',
        # Или в строке "Наименование"
        r'Наименовани[еюя][:\s]+([^\n]+)',
    ]
    # Название — сначала проверяем первую страницу на явное указание ЖК
    found_name = False
    for idx, target in enumerate([first_page_text or '', full_text]):
        for pattern in name_patterns:
            match = re.search(pattern, target, re.IGNORECASE | re.DOTALL)
            if match:
                full_text_name = match.group(1).strip() if match.lastindex >= 1 else match.group(0).strip()
                name = ' '.join(full_text_name.split())[:200]
                if name and len(name) > 3:
                    info['full_name'] = name
                    found_name = True
                    # если нашли на первой странице — отмечаем
                    if idx == 0:
                        info['name_from_first_page'] = True
                    break
        if found_name:
            break
    
    # Период отчета
    period_patterns = [
        r'(\d{4})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)',
        r'период[:\s]+([^\n]+)',
    ]
    for pattern in period_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            info['report_period'] = match.group(0)
            break
    
    # Местоположение
    location_patterns = [
        r'город\s+([^\n,]+)',
        r'расположен[иия][:\s]+([^\n]+)',
    ]
    for pattern in location_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            info['location'] = match.group(1).strip()
            break
    
    # Заказчик
    customer_patterns = [
        r'Заказчик[:\s]+([^\n]+)',
        r'(ООО|АО|ИП)[^:\n]*',
    ]
    for pattern in customer_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            info['customer'] = match.group(1).strip()
            break
    
    return info


def calculate_project_status(metrics: dict) -> str:
    """
    Определяет статус проекта на основе официальных критериев
    
    ТРЕВОЖНЫЙ = a AND b:
      a: СМР < 80%
      b: ИЛИ(отставание >30%, просрочка >30 дней, жалобы >1, снижение рейтинга >=20, долг >6, ДДУ <70%/<60%/<50%)
    
    КРИТИЧНЫЙ = a AND b AND c AND d:
      a: СМР < 80%
      b: ДДУ последовательно <70%, <60%, <50%
      c: Отставание > 30%
      d: ИЛИ(гарантия, жалобы >1, снижение рейтинга >=20, просрочка)
    """
    
    smr = metrics['SMR_completion']
    gpr = metrics['GPR_delay_percent']
    ddu_list = metrics['DDU_payments_percent']
    
    # Условие a для обоих статусов: СМР < 80%
    condition_a = smr < 80
    
    if not condition_a:
        return 'нормальный'
    
    # Попытка определить КРИТИЧНЫЙ статус
    ddu_sequential_low = False
    if isinstance(ddu_list, list) and len(ddu_list) >= 3:
        # Берём последние 3 месяца в порядке от старого к новому
        m1, m2, m3 = ddu_list[0], ddu_list[1], ddu_list[2]
        ddu_sequential_low = m1 < 70 and m2 < 60 and m3 < 50
    
    condition_b_critical = ddu_sequential_low
    condition_c = gpr > 30
    
    # Условие d: ИЛИ из 4 условий
    condition_d = (
        metrics.get('guarantee_extension', False) or
        (metrics.get('complaints_count', 0) > 1) or
        (metrics.get('builder_rating_drop', 0) >= 20) or
        (metrics.get('builder_delay_days', 0) > 0)
    )
    
    if condition_a and condition_b_critical and condition_c and condition_d:
        return 'критичный'
    
    # Попытка определить ТРЕВОЖНЫЙ статус: a AND b
    # Условие b для тревожного (ИЛИ из 6 условий)
    condition_b_warning = (
        gpr > 30 or  # b1: отставание >30%
        (metrics.get('builder_delay_days', 0) > 30) or  # b2: просрочка >30 дней
        (metrics.get('complaints_count', 0) > 1) or  # b3: жалобы >1
        (metrics.get('builder_rating_drop', 0) >= 20) or  # b4: рейтинг -20+
        (metrics.get('debt_to_equity', 0) > 6) or  # b5: долг >6
        ddu_sequential_low  # b6: ДДУ <70%, <60%, <50%
    )
    
    if condition_a and condition_b_warning:
        return 'тревожный'
    
    return 'нормальный'


def generate_reasoning(metrics: dict, status: str) -> list:
    """Генерирует обоснование статуса с ссылкой на критерии"""
    reasoning = []
    
    smr = metrics['SMR_completion']
    gpr = metrics['GPR_delay_percent']
    ddu_list = metrics['DDU_payments_percent']
    ddu = ddu_list[0] if ddu_list else 0
    
    if status == 'критичный':
        reasoning.append('🔴 КРИТИЧНЫЙ СТАТУС - выполнены ВСЕ условия:')
        reasoning.append(f'  ✓ Условие A: СМР < 80% (текущее: {smr:.1f}%)')
        if len(ddu_list) >= 3:
            reasoning.append(f'  ✓ Условие B: ДДУ последовательно <70%, <60%, <50% ({ddu_list[0]:.1f}%, {ddu_list[1]:.1f}%, {ddu_list[2]:.1f}%)')
        reasoning.append(f'  ✓ Условие C: Отставание > 30% (текущее: {gpr:.1f}%)')
        reasoning.append(f'  ✓ Условие D: Срабатывает одно из критических событий')
        reasoning.append('➡️ ТРЕБУЕТСЯ НЕМЕДЛЕННОЕ ВМЕШАТЕЛЬСТВО')
        
    elif status == 'тревожный':
        reasoning.append('🟡 ТРЕВОЖНЫЙ СТАТУС - выполнены условия:')
        reasoning.append(f'  ✓ Условие A: СМР < 80% (текущее: {smr:.1f}%)')
        reasoning.append('  ✓ Условие B: Срабатывает одно из условий:')
        
        if gpr > 30:
            reasoning.append(f'    - Отставание >30% (текущее: {gpr:.1f}%)')
        if metrics.get('builder_delay_days', 0) > 30:
            reasoning.append(f'    - Просрочка по займам >{metrics["builder_delay_days"]} дней')
        if metrics.get('complaints_count', 0) > 1:
            reasoning.append(f'    - Жалобы дольщиков: {metrics["complaints_count"]} обращений')
        if metrics.get('builder_rating_drop', 0) >= 20:
            reasoning.append(f'    - Снижение рейтинга на {metrics["builder_rating_drop"]} баллов')
        if metrics.get('debt_to_equity', 0) > 6:
            reasoning.append(f'    - Соотношение долга: {metrics["debt_to_equity"]:.2f}')
        if len(ddu_list) >= 3 and ddu_list[0] < 70 and ddu_list[1] < 60 and ddu_list[2] < 50:
            reasoning.append(f'    - ДДУ последовательно <70%, <60%, <50%')
        
        reasoning.append('➡️ НЕОБХОДИМО АКТИВНОЕ ВНИМАНИЕ И КОНТРОЛЬ')
        
    else:  # нормальный
        reasoning.append('🟢 НОРМАЛЬНЫЙ СТАТУС')
        if smr >= 80:
            reasoning.append(f'  ✓ СМР в норме: {smr:.1f}%')
        reasoning.append('  ✓ Проект соответствует плановым показателям')
        reasoning.append('➡️ Продолжить наблюдение в плановом режиме')
    
    return reasoning


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


@app.route('/api/analyze-report', methods=['POST'])
def analyze_report():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Сохраняем файл
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Извлекаем текст из PDF (полный текст и первая страница)
            texts = extract_text_from_pdf(filepath)
            text_full = texts.get('full', '')
            first_page = texts.get('first', '')

            if not text_full or len(text_full.strip()) < 50:
                # Если текст не извлечен - используем имя файла
                text_full = filename

            # Извлекаем информацию
            project_info = extract_project_info(text_full, first_page)
            # Если имя ЖК не найдено явно на первой странице — используем код как имя и помечаем для ручного ввода
            requires_name_entry = False
            if not project_info.get('name_from_first_page', False):
                # если на первой странице не было имени, подставим код как отображаемое имя
                project_info['full_name'] = project_info.get('code') or project_info.get('full_name')
                requires_name_entry = True

            metrics = extract_metrics(text_full)

            # Определяем, хватает ли DDU-данных для b6
            has3ddu = isinstance(metrics.get('DDU_payments_percent'), list) and len(metrics.get('DDU_payments_percent')) >= 3

            status = calculate_project_status(metrics)
            reasoning = generate_reasoning(metrics, status)
            
            # Генерируем ID проекта
            project_id = generate_project_id(project_info['code'], project_info['customer'])
            
            response = {
                'projectId': project_id,
                'project_info': project_info,
                'project_status': status,
                'metrics': {
                    'SMR_completion': metrics['SMR_completion'],
                    'GPR_delay_percent': metrics['GPR_delay_percent'],
                    'GPR_delay_days': metrics['GPR_delay_days'],
                    'DDU_payments_percent': metrics['DDU_payments_percent'],
                    'guarantee_extension': metrics['guarantee_extension'],
                    'builder_delay_days': metrics.get('builder_delay_days', 0),
                    'builder_rating_drop': metrics.get('builder_rating_drop', 0),
                    'complaints_count': metrics.get('complaints_count', 0),
                    'debt_to_equity': metrics.get('debt_to_equity', 0)
                },
                'reasoning': reasoning,
                'triggered_conditions': [],
                'requires_name_entry': requires_name_entry,
                'needs3Reports': not has3ddu and (metrics.get('SMR_completion', 0) < 80)
            }
            
            return jsonify(response), 200
            
        finally:
            # Удаляем временный файл
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except:
                    pass
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5003))
    print(f"Starting API server on port {port}...")
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
