#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПРОДВИНУТЫЙ АНАЛИЗАТОР v3.0
С извлечением контекста, номеров страниц и подробным обоснованием
"""

import re
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import pdfplumber


class AdvancedReportAnalyzer:
    """Продвинутый анализатор с контекстом и обоснованием"""
    
    def __init__(self, pdf_path: str = None, text: str = None):
        self.pdf_path = pdf_path
        self.text = text
        self.pages = []  # Список страниц с текстом
        self.project_info = {}
        self.evidence = {}  # Доказательства для каждой метрики
        
        if pdf_path:
            self._extract_from_pdf()
        elif text:
            self.pages = [{"page_num": 1, "text": text}]
    
    def _extract_from_pdf(self):
        """Извлекает текст по страницам из PDF"""
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for i, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text()
                    if page_text:
                        self.pages.append({
                            "page_num": i,
                            "text": page_text
                        })
                        
            # Объединяем весь текст
            self.text = "\n".join([p["text"] for p in self.pages])
        except Exception as e:
            print(f"Ошибка чтения PDF: {e}")
            self.pages = [{"page_num": 1, "text": ""}]
    
    def extract_project_info(self) -> Dict:
        """Извлекает информацию о проекте с первой страницы"""
        if not self.pages:
            return {}

        first_page = self.pages[0]["text"]

        project_name = self._extract_project_name(first_page)
        require_manual_name = False
        # Если не удалось извлечь название, выставляем флаг для ручного ввода
        if not project_name or project_name == "Не удалось извлечь название проекта":
            project_name = None
            require_manual_name = True

        info = {
            "full_name": project_name,
            "code": self._extract_project_code(first_page),
            "report_period": self._extract_report_period(first_page),
            "location": self._extract_location(first_page),
            "customer": self._extract_customer(first_page),
            "page_content": first_page,  # Полный текст первой страницы
            "require_manual_name": require_manual_name
        }

        self.project_info = info
        return info
    
    def _extract_project_name(self, text: str) -> Optional[str]:
        """Извлекает полное название ЖК из результатов анализа или описания"""
        
        # Вариант 1: Ищем полный текст в кавычках после "жилого здания)" - это основной паттерн
        # Паттерн ищет текст вида: жилого здания) "Многоквартирный жилой комплекс..."
        pattern1 = r'жилого\s+здания\)\s*["\"]([^"\"]+?)["\"]\.?\s*(?:Первая|вторая|первая)'
        match1 = re.search(pattern1, text, re.IGNORECASE | re.DOTALL)
        if match1:
            name = re.sub(r'\s+', ' ', match1.group(1)).strip()
            # Убираем "без наружных инженерных сетей" в конце если есть
            name = re.sub(r'\s*\([^)]*наружных[^)]*\)\s*["\"]?', '', name)
            if name and len(name) > 10:
                return name
        
        # Вариант 2: Ищем просто текст в кавычках с "Многоквартирный"
        pattern2 = r'"(Многоквартирный[^"]+?)"(?:\s*\.|\s*Первая|\s*вторая|$)'
        match2 = re.search(pattern2, text, re.DOTALL)
        if match2:
            name = re.sub(r'\s+', ' ', match2.group(1)).strip()
            # Убираем "без наружных инженерных сетей" в конце если есть  
            name = re.sub(r'\s*\([^)]*наружных[^)]*\)\s*["\"]?', '', name)
            if name and len(name) > 10:
                return name
        
        # Вариант 3: Ищем Многоквартирный комплекс со встроненными помещениями...
        pattern3 = r'Многоквартирный\s+жилой\s+комплекс\s+со\s+встро[йн]{1,2}енн[ы]?м[и]?\s+помещениями[^.]*?(?:парким|паркингом)[^.]*?(?:по адресу|город)'
        match3 = re.search(pattern3, text, re.IGNORECASE | re.DOTALL)
        if match3:
            desc = match3.group(0)
            # Берем только до города чтобы не перетащить слишком много
            idx = desc.rfind('город')
            if idx > 0:
                desc = desc[:idx+20]  # Берем до города + 20 символов
            name = re.sub(r'\s+', ' ', desc).strip()
            # Удаляем скобки с инженерными сетями
            name = re.sub(r'\([^)]*наружных[^)]*\)', '', name).strip()
            if name and len(name) > 10:
                return name
        
        # Вариант 4: ЖК в кавычках - сокращенное название
        pattern4 = r'ЖК\s+["\"]?([^"\"()]+?)["\"]?(?:\s*\d|\s*о[ч]|$)'
        match4 = re.search(pattern4, text, re.IGNORECASE)
        if match4:
            name = match4.group(1).strip()
            if name and len(name) > 3 and 'JM' not in name and 'City' not in name:
                return name
        
        # Вариант 5: Просто текст с "Многоквартирный" в начале
        pattern5 = r'(Многоквартирный[^\n]{50,300}?(?:город|адрес))'
        match5 = re.search(pattern5, text, re.IGNORECASE)
        if match5:
            name = re.sub(r'\s+', ' ', match5.group(1)).strip()
            # Удаляем лишние скобки
            name = re.sub(r'\([^)]*наружных[^)]*\)', '', name).strip()
            if name and len(name) > 15:
                return name
        
        # Вариант 6: Ищем текст в скобках после описания объекта
        pattern6 = r'объект[^:]*:\s*\(([^)]{20,}?(?:ЖК|город|район)[^)]*)\)'
        match6 = re.search(pattern6, text, re.IGNORECASE)
        if match6:
            name = match6.group(1).strip()
            if name and len(name) > 15:
                return name
        
        # Вариант 7: Ищем "Объект:" или "Название:" с последующим текстом до точки/перевода строки
        pattern7 = r'(?:Объект|Название|Проект):\s*([А-Яа-яЁё][^.\n]*?(?:жилой|комплекс|ЖК)[^.\n]{0,100}[^.\n])'
        match7 = re.search(pattern7, text)
        if match7:
            name = match7.group(1).strip()
            if name and len(name) > 10:
                return name
        
        # Вариант 8: Берем первый достаточно длинный текст с кириллицей и ключевыми словами
        pattern8 = r'([А-Яа-яЁё]{10,}[^\n]*?(?:жилой|комплекс|ЖК)[^\n]*?(?:город|адрес)[^\n]{0,50})'
        match8 = re.search(pattern8, text)
        if match8:
            name = match8.group(1).strip()
            # Удаляем номер страницы и прочие артефакты в конце
            name = re.sub(r'\s+\d+$', '', name)
            # Убираем лишние скобки
            name = re.sub(r'\([^)]*наружных[^)]*\)', '', name).strip()
            if name and len(name) > 15:
                return name
        
        return "Не удалось извлечь название проекта"
    
    def _extract_customer(self, text: str) -> Optional[str]:
        """Извлекает заказчика проекта"""
        # Ищем "Заказчик:" или "Застройщик:" с последующим именем
        pattern1 = r'(?:Заказчик|Застройщик|Инвестор):\s*([А-Яа-яЁё][^\n]+)'
        match1 = re.search(pattern1, text, re.IGNORECASE)
        if match1:
            customer = match1.group(1).strip()
            # Берём только первые 100 символов (обычно имя на одной строке)
            customer = customer[:100]
            if customer and len(customer) > 3:
                return customer
        
        # Если не нашли, ищем в скобках или после "ООО", "АО" и т.д.
        pattern2 = r'(?:ООО|АО|ИП|БО|ТОО|СПД)\s+["\']?([^\'";\n]+)["\']?'
        match2 = re.search(pattern2, text)
        if match2:
            customer = match2.group(1).strip()
            if customer and len(customer) > 3:
                return customer
        
        return None
    
    def _extract_project_code(self, text: str) -> Optional[str]:
        """Извлекает код проекта"""
        pattern = r'Код:\s*\(номер сертификата\s*(\d+)\)\s*(ДПГ[^\s]+)'
        match = re.search(pattern, text)
        
        if match:
            cert_num = match.group(1)
            dpg_code = match.group(2)
            return f"Сертификат №{cert_num}, {dpg_code}"
        
        return None
    
    def _extract_report_period(self, text: str) -> Optional[str]:
        """Извлекает период отчета и форматирует его"""
        pattern = r'Отчетный период:\s*(\d{4})(\d{2})'
        match = re.search(pattern, text)
        
        if match:
            year = match.group(1)
            month = match.group(2)
            
            # Конвертируем месяц в название
            months = {
                "01": "января", "02": "февраля", "03": "марта",
                "04": "апреля", "05": "мая", "06": "июня",
                "07": "июля", "08": "августа", "09": "сентября",
                "10": "октября", "11": "ноября", "12": "декабря"
            }
            
            month_name = months.get(month, month)
            return f"{year}г {month_name}"
        
        return None
    
    def _extract_location(self, text: str) -> Optional[str]:
        """Извлекает местоположение проекта"""
        patterns = [
            r'по адресу[:\s-]+([^\.]+(?:город|проспект|улица|район)[^\.]+)',
            r'Адрес.*?:\s*([^\n]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def find_in_pages(self, pattern: str, metric_name: str) -> Optional[Dict]:
        """Находит паттерн по всем страницам и возвращает контекст"""
        for page in self.pages:
            match = re.search(pattern, page["text"], re.IGNORECASE | re.DOTALL)
            if match:
                # Извлекаем контекст (предложение целиком)
                context = self._extract_sentence_context(page["text"], match)
                
                return {
                    "value": match.group(1) if match.groups() else match.group(0),
                    "page": page["page_num"],
                    "context": context,
                    "metric": metric_name,
                    "pattern_used": pattern
                }
        
        return None
    
    def _extract_sentence_context(self, text: str, match) -> str:
        """Извлекает полное предложение с найденным текстом"""
        start = match.start()
        end = match.end()
        
        # Ищем начало предложения (идем назад до точки или начала)
        sentence_start = start
        for i in range(start - 1, max(0, start - 200), -1):
            if text[i] in '.!?\n' and i > 0:
                sentence_start = i + 1
                break
            elif i == 0:
                sentence_start = 0
                break
        
        # Ищем конец предложения (идем вперед до точки)
        sentence_end = end
        for i in range(end, min(len(text), end + 200)):
            if text[i] in '.!?\n':
                sentence_end = i + 1
                break
            elif i == len(text) - 1:
                sentence_end = len(text)
                break
        
        sentence = text[sentence_start:sentence_end].strip()
        # Убираем лишние пробелы
        sentence = re.sub(r'\s+', ' ', sentence)
        
        return sentence
    
    def extract_smr_with_evidence(self) -> Tuple[Optional[float], Optional[Dict]]:
        """Извлекает СМР с доказательствами"""
        patterns = [
            r'Фактическое выполнение СМР.*?составляет\s*[–-]?\s*(\d+[.,]\d+)\s*%',
            r'СМР\s*выполнен[оа]?\s*:?\s*(\d+[.,]?\d*)\s*%',
            r'СМР\s*освоен[оа]?\s*(?:на)?\s*(\d+[.,]?\d*)\s*(?:процент|%)',
            r'[Вв]ыполнение\s*(?:строительно[- ]?монтажных\s*работ|СМР)\s*:?\s*(\d+[.,]?\d*)\s*%',
        ]
        
        for pattern in patterns:
            evidence = self.find_in_pages(pattern, "СМР")
            if evidence:
                try:
                    value = float(evidence["value"].replace(',', '.'))
                    evidence["extracted_value"] = value
                    return value, evidence
                except:
                    continue
        
        return None, None
    
    def extract_gpr_with_evidence(self) -> Tuple[Optional[float], Optional[int], Optional[Dict]]:
        """Извлекает отставание от ГПР с доказательствами"""
        patterns = [
            r'[Оо]тставание.*?(\d+)\s*дн',
            r'[Оо]тставани[яе]\s+от\s+[Гг][Пп][Рр]\s*[–-]?\s*(\d+)\s*дн',
            r'[Оо]тставание\s+от\s+графика.*?(\d+)\s*дн',
            r'[Зз]адержка\s*(?:работ)?\s*[–-]?\s*(\d+)\s*дн',
        ]
        
        delay_evidence = None
        delay_days = None
        
        for pattern in patterns:
            evidence = self.find_in_pages(pattern, "Отставание")
            if evidence:
                try:
                    delay_days = int(evidence["value"])
                    delay_evidence = evidence
                    delay_evidence["extracted_value"] = delay_days
                    break
                except:
                    continue
        
        if delay_days is None:
            return None, None, None
        
        # Ищем нормативный срок
        norm_patterns = [
            r'[Нн]ормативный\s*срок.*?(\d+)\s*месяц',
            r'[Сс]рок\s*строительства\s*:?\s*(\d+)\s*(?:мес|месяц)',
        ]
        
        norm_months = None
        for pattern in norm_patterns:
            norm_evidence = self.find_in_pages(pattern, "Нормативный срок")
            if norm_evidence:
                try:
                    norm_months = int(norm_evidence["value"])
                    delay_evidence["norm_period"] = norm_evidence
                    break
                except:
                    continue
        
        if norm_months:
            norm_days = norm_months * 30
            delay_percent = (delay_days / norm_days) * 100
        else:
            delay_percent = (delay_days / 570) * 100  # 19 месяцев по умолчанию
        
        delay_evidence["delay_percent"] = delay_percent
        
        return delay_percent, delay_days, delay_evidence
    
    def extract_ddu_monthly_from_table(self) -> Tuple[List[float], Optional[Dict]]:
        """Извлекает месячные поступления из таблицы 'Приложение 2 к Таблице 7'"""
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text().lower()
                    # Ищем текст "Приложение 2 к Таблице 7" или похожий
                    if ("приложение" in page_text and "таблица 7" in page_text) or \
                       ("приложение 2" in page_text) or \
                       ("таблица" in page_text and "дду" in page_text):
                        
                        page_tables = page.extract_tables()
                        if page_tables:
                            # Ищем таблицу с подходящим размером (6x7 или близко к этому)
                            for table_idx, table in enumerate(page_tables):
                                if not table or len(table) < 5:
                                    continue
                                    
                                rows = len(table)
                                cols = len(table[0]) if table[0] else 0
                                
                                # Таблица должна быть примерно 6 на 7 (или близко)
                                if 5 <= rows <= 10 and 5 <= cols <= 8:
                                    monthly_values = []
                                    
                                    # Стратегия 1: Ищем числовые значения в последней колонке (обычно 6-я или 7-я)
                                    # Берем последние 3 числовых значения из этого столбца
                                    numeric_values = []
                                    
                                    # Проходим по всем ячейкам таблицы и ищем числовые значения
                                    for row_idx, row in enumerate(table):
                                        for col_idx, cell in enumerate(row):
                                            if cell is None:
                                                continue
                                            cell_str = str(cell).strip()
                                            # Нормализуем число (удаляем пробелы, запятые, тыс разделители)
                                            normalized = cell_str.replace(' ', '').replace(',', '.')
                                            try:
                                                # Пробуем преобразовать в число
                                                # Ищем числа > 100000 (поступления в тысячах или миллионах)
                                                value = float(normalized)
                                                if value > 100000:  # Фильтруем маленькие числа
                                                    numeric_values.append({
                                                        'value': value,
                                                        'row': row_idx,
                                                        'col': col_idx,
                                                        'original': cell_str
                                                    })
                                            except:
                                                pass
                                    
                                    # Берем последние 3 значения (предполагаем, что это последние 3 месяца)
                                    if numeric_values:
                                        numeric_values.sort(key=lambda x: (x['row'], x['col']), reverse=True)
                                        monthly_values = [v['value'] for v in numeric_values[:3]]
                                        monthly_values.reverse()  # Восстанавливаем порядок
                                        
                                        if len(monthly_values) >= 3:
                                            return monthly_values[:3], {
                                                "page": page_num,
                                                "table_index": table_idx,
                                                "source": "Приложение 2 к Таблице 7",
                                                "values": monthly_values[:3],
                                                "note": "Месячные поступления по ДДУ из таблицы (в тыс.тг или млн.тг)"
                                            }
        except Exception as e:
            print(f"Ошибка извлечения таблицы ДДУ: {e}")
        
        return [], None

    def extract_ddu_with_evidence(self) -> Tuple[List[float], Optional[Dict], Optional[List[float]]]:
        """Извлекает ДДУ с доказательствами. Возвращает (проценты, доказательства, месячные_значения)"""
        
        # Вариант 1: Пробуем извлечь месячные значения из таблицы
        monthly_values, table_evidence = self.extract_ddu_monthly_from_table()
        if monthly_values and len(monthly_values) >= 3:
            # Возвращаем месячные значения И пустой список процентов
            # (так как месячные значения будут пересчитаны в статус-калькуляторе)
            return [], table_evidence, monthly_values
        
        # Вариант 2: Ищем процент поступлений ДДУ в тексте
        patterns = [
            r'([0-9]+[.,][0-9]+)\s*%\s*от\s*общего\s*поступления.*?средства\s*дольщиков',
            r'[Сс]редства\s*дольщиков.*?(\d+[.,]?\d*)\s*%',
            r'[Пп]оступления\s*(?:от|по)?\s*дольщиков.*?(\d+[.,]?\d*)\s*%',
            r'ДДУ\s*поступления\s*:?\s*(\d+[.,]?\d*)\s*%',
        ]
        
        for pattern in patterns:
            evidence = self.find_in_pages(pattern, "ДДУ")
            if evidence:
                try:
                    percent = float(evidence["value"].replace(',', '.'))
                    evidence["extracted_value"] = percent
                    # Возвращаем процент для всех трех месяцев (если проценты одинаковые)
                    return [percent, percent, percent], evidence, None
                except:
                    continue
        
        return [], None, None
    
    def check_guarantee_with_evidence(self) -> Tuple[bool, Optional[Dict]]:
        """Проверяет гарантийный случай с доказательствами"""
        patterns = [
            r'гарантийного\s*случа[яй]',
            r'[Гг]арантийный\s*случай',
            r'наступлени[еи]\s*гарантийного\s*случая',
        ]
        
        for pattern in patterns:
            evidence = self.find_in_pages(pattern, "Гарантийный случай")
            if evidence:
                evidence["extracted_value"] = True
                return True, evidence
        
        return False, None
    
    def analyze(self) -> Dict:
        """Полный анализ с доказательствами"""
        # Извлекаем информацию о проекте
        project_info = self.extract_project_info()
        
        # Извлекаем метрики с доказательствами
        smr, smr_evidence = self.extract_smr_with_evidence()
        gpr_percent, gpr_days, gpr_evidence = self.extract_gpr_with_evidence()
        ddu_percent, ddu_evidence, ddu_monthly = self.extract_ddu_with_evidence()
        guarantee, guarantee_evidence = self.check_guarantee_with_evidence()
        
        # Собираем все доказательства
        self.evidence = {
            "smr": smr_evidence,
            "gpr_delay": gpr_evidence,
            "ddu": ddu_evidence,
            "guarantee": guarantee_evidence
        }
        
        metrics = {
            'SMR_completion': smr,
            'GPR_delay_percent': gpr_percent,
            'GPR_delay_days': gpr_days,
            'DDU_payments_percent': ddu_percent,
            'guarantee_extension': guarantee,
            'dolshik_obrascheniya': 0,
            'loan_overdue_days': None,
            'rating_drop': None,
            'loan_to_equity_ratio': None
        }
        
        # Добавляем месячные значения ДДУ если они были найдены из таблицы
        if ddu_monthly and len(ddu_monthly) >= 3:
            metrics['DDU_monthly_values'] = ddu_monthly
        
        # Классифицируем
        status, conditions, reasoning = self.classify_with_reasoning(metrics)
        
        return {
            'project_info': project_info,
            'project_status': status,
            'metrics': metrics,
            'evidence': self.evidence,
            'triggered_conditions': conditions,
            'reasoning': reasoning
        }
    
    def classify_with_reasoning(self, metrics: Dict) -> Tuple[str, List[str], List[str]]:
        """Классифицирует с подробным обоснованием"""
        triggered = []
        reasoning = []
        
        # a: СМР < 80%
        a = metrics['SMR_completion'] is not None and metrics['SMR_completion'] < 80
        if a:
            triggered.append('a')
            reasoning.append(
                f"✓ Условие 'a' ВЫПОЛНЕНО: СМР {metrics['SMR_completion']:.2f}% < 80% (критический порог)"
            )
        else:
            if metrics['SMR_completion'] is not None:
                reasoning.append(
                    f"✗ Условие 'a' НЕ ВЫПОЛНЕНО: СМР {metrics['SMR_completion']:.2f}% >= 80% (в норме)"
                )
        
        # b1: отставание > 30%
        b1 = metrics['GPR_delay_percent'] is not None and metrics['GPR_delay_percent'] > 30
        if b1:
            triggered.append('b1')
            reasoning.append(
                f"✓ Условие 'b1' ВЫПОЛНЕНО: Отставание {metrics['GPR_delay_percent']:.2f}% > 30% "
                f"({metrics['GPR_delay_days']} дней)"
            )
        else:
            if metrics['GPR_delay_percent'] is not None:
                reasoning.append(
                    f"✗ Условие 'b1' НЕ ВЫПОЛНЕНО: Отставание {metrics['GPR_delay_percent']:.2f}% <= 30% "
                    f"({metrics['GPR_delay_days']} дней - в допустимых пределах)"
                )
        
        # b6: ДДУ < 70%
        b6 = any(p < 70 for p in metrics['DDU_payments_percent']) if metrics['DDU_payments_percent'] else False
        if b6:
            triggered.append('b6')
            ddu_val = metrics['DDU_payments_percent'][0]
            reasoning.append(
                f"✓ Условие 'b6' ВЫПОЛНЕНО: Поступления по ДДУ {ddu_val:.2f}% < 70% (критический порог)"
            )
        else:
            if metrics['DDU_payments_percent']:
                ddu_val = metrics['DDU_payments_percent'][0]
                reasoning.append(
                    f"✗ Условие 'b6' НЕ ВЫПОЛНЕНО: Поступления по ДДУ {ddu_val:.2f}% >= 70% (в норме)"
                )
        
        # d1: гарантия
        d1 = metrics['guarantee_extension']
        if d1:
            triggered.append('d1')
            reasoning.append(
                f"✓ Условие 'd1' ВЫПОЛНЕНО: Объявлен гарантийный случай (критическое событие)"
            )
        else:
            reasoning.append(
                f"✗ Условие 'd1' НЕ ВЫПОЛНЕНО: Гарантийный случай не объявлялся"
            )
        
        # Логика классификации
        b = b1 or b6
        c = b1
        d = d1
        ddu_critical = b6
        
        # Определяем статус
        if a and ddu_critical and c and d:
            status = "критичный"
            reasoning.insert(0, "🔴 СТАТУС: КРИТИЧНЫЙ - Все критические условия выполнены (a И b И c И d)")
        elif a and b:
            status = "тревожный"
            reasoning.insert(0, "🟡 СТАТУС: ТРЕВОЖНЫЙ - Выполнены условия для тревожного статуса (a И b)")
        else:
            status = "нормальный"
            reasoning.insert(0, "🟢 СТАТУС: НОРМАЛЬНЫЙ - Критические условия не выполнены")
        
        return status, triggered, reasoning
    
    def generate_detailed_report(self) -> str:
        """Генерирует подробный отчет"""
        result = self.analyze()
        
        lines = []
        lines.append("=" * 120)
        lines.append("ПОДРОБНЫЙ АНАЛИЗ СТРОИТЕЛЬНОГО ОТЧЕТА С ОБОСНОВАНИЕМ")
        lines.append("=" * 120)
        lines.append("")
        
        # Информация о проекте
        lines.append("📋 ИНФОРМАЦИЯ О ПРОЕКТЕ")
        lines.append("─" * 120)
        
        proj = result['project_info']
        lines.append(f"Название: {proj.get('full_name', 'Не указано')}")
        lines.append(f"Код проекта: {proj.get('code', 'Не указано')}")
        lines.append(f"Период отчета: {proj.get('report_period', 'Не указано')}")
        if proj.get('location'):
            lines.append(f"Местоположение: {proj.get('location')}")
        lines.append("")
        
        # Статус
        status_icons = {
            'нормальный': '🟢',
            'тревожный': '🟡',
            'критичный': '🔴'
        }
        icon = status_icons.get(result['project_status'], '❓')
        lines.append(f"СТАТУС ПРОЕКТА: {icon} {result['project_status'].upper()}")
        lines.append("")
        
        # Извлеченные метрики с доказательствами
        lines.append("=" * 120)
        lines.append("ИЗВЛЕЧЕННЫЕ МЕТРИКИ (С ДОКАЗАТЕЛЬСТВАМИ)")
        lines.append("=" * 120)
        lines.append("")
        
        # СМР
        if result['evidence']['smr']:
            ev = result['evidence']['smr']
            lines.append(f"1. 📊 Объем СМР: {result['metrics']['SMR_completion']}%")
            lines.append(f"   Страница: {ev['page']}")
            lines.append(f"   Контекст: \"{ev['context']}\"")
            status_smr = "🔴 КРИТИЧНО" if result['metrics']['SMR_completion'] < 80 else "🟢 НОРМА"
            lines.append(f"   Оценка: {status_smr}")
        else:
            lines.append(f"1. 📊 Объем СМР: ❌ Не извлечено")
        lines.append("")
        
        # Отставание
        if result['evidence']['gpr_delay']:
            ev = result['evidence']['gpr_delay']
            lines.append(f"2. ⏱️ Отставание от ГПР: {result['metrics']['GPR_delay_days']} дней ({result['metrics']['GPR_delay_percent']:.2f}%)")
            lines.append(f"   Страница: {ev['page']}")
            lines.append(f"   Контекст: \"{ev['context']}\"")
            if 'norm_period' in ev:
                lines.append(f"   Нормативный срок (стр. {ev['norm_period']['page']}): \"{ev['norm_period']['context']}\"")
            status_gpr = "🔴 КРИТИЧНО" if result['metrics']['GPR_delay_percent'] > 30 else "🟢 НОРМА"
            lines.append(f"   Оценка: {status_gpr}")
        else:
            lines.append(f"2. ⏱️ Отставание от ГПР: ❌ Не извлечено")
        lines.append("")
        
        # ДДУ
        if result['evidence']['ddu']:
            ev = result['evidence']['ddu']
            ddu_val = result['metrics']['DDU_payments_percent'][0]
            lines.append(f"3. 💰 Поступления по ДДУ: {ddu_val}%")
            lines.append(f"   Страница: {ev['page']}")
            lines.append(f"   Контекст: \"{ev['context']}\"")
            status_ddu = "🔴 КРИТИЧНО" if ddu_val < 70 else "🟢 НОРМА"
            lines.append(f"   Оценка: {status_ddu}")
        else:
            lines.append(f"3. 💰 Поступления по ДДУ: ❌ Не извлечено")
        lines.append("")
        
        # Гарантия
        if result['evidence']['guarantee']:
            ev = result['evidence']['guarantee']
            lines.append(f"4. 🛡️ Гарантийный случай: ДА")
            lines.append(f"   Страница: {ev['page']}")
            lines.append(f"   Контекст: \"{ev['context']}\"")
            lines.append(f"   Оценка: 🔴 КРИТИЧНО")
        else:
            lines.append(f"4. 🛡️ Гарантийный случай: НЕТ")
            lines.append(f"   Оценка: 🟢 НОРМА")
        lines.append("")
        
        # Обоснование классификации
        lines.append("=" * 120)
        lines.append("ОБОСНОВАНИЕ КЛАССИФИКАЦИИ")
        lines.append("=" * 120)
        lines.append("")
        
        for reason in result['reasoning']:
            lines.append(reason)
        
        lines.append("")
        lines.append("=" * 120)
        lines.append("ИТОГОВОЕ ЗАКЛЮЧЕНИЕ")
        lines.append("=" * 120)
        lines.append("")
        
        if result['project_status'] == 'критичный':
            lines.append("🚨 СРОЧНЫЕ МЕРЫ ТРЕБУЮТСЯ:")
            lines.append("   1. Немедленное вмешательство руководства")
            lines.append("   2. Пересмотр финансирования проекта")
            lines.append("   3. Аудит подрядчиков и поставщиков")
            lines.append("   4. План экстренного восстановления графика")
        elif result['project_status'] == 'тревожный':
            lines.append("⚠️ НЕОБХОДИМЫ КОРРЕКТИРУЮЩИЕ ДЕЙСТВИЯ:")
            lines.append("   1. Усилить контроль за выполнением работ")
            lines.append("   2. Проанализировать причины отставания")
            lines.append("   3. Разработать план по устранению проблем")
            lines.append("   4. Увеличить частоту мониторинга")
        else:
            lines.append("✅ Проект в пределах нормы, продолжать текущий мониторинг")
        
        lines.append("")
        
    def extract_tables(self) -> List[Dict]:
        """Извлекает таблицы из PDF"""
        tables = []
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_tables = page.extract_tables()
                    if page_tables:
                        for table_idx, table in enumerate(page_tables):
                            tables.append({
                                'page': page_num,
                                'table_index': table_idx,
                                'headers': table[0] if table else [],
                                'rows': table[1:] if len(table) > 1 else [],
                                'content': table
                            })
        except Exception as e:
            print(f"Ошибка извлечения таблиц: {e}")
        
        return tables
    
    def extract_images_metadata(self) -> List[Dict]:
        """Извлекает метаданные о изображениях (страницы, размеры)"""
        images = []
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    if hasattr(page, 'chars'):
                        # Получаем информацию об объектах на странице
                        page_images = page.objects.get('image', [])
                        if page_images:
                            for img_idx, img in enumerate(page_images):
                                images.append({
                                    'page': page_num,
                                    'x0': img.get('x0'),
                                    'top': img.get('top'),
                                    'width': img.get('width'),
                                    'height': img.get('height'),
                                    'description': f'Изображение на странице {page_num}'
                                })
        except Exception as e:
            print(f"Ошибка извлечения изображений: {e}")
        
        return images


def test_advanced_analyzer():
    """Тестирование продвинутого анализатора на тексте"""
    
    test_text = """
Отчет инжиниринговой компании в сфере долевого участия в жилищном 
строительстве о результатах мониторинга за ходом строительства жилого 
дома (жилого здания)
"Многоквартирный жилой комплекс со встроенными помещениями и паркингом по адресу - город Нурсултан,
район Есиль, район пересечения проспектов Туран и Кабанбай батыра". Первая очередь (блоки Б, Б1, Б2, Б3, В, В1, Г, Д) (ЖК "JM City Dom-Park" 1 очередь/Туран)
Код: (номер сертификата 134) ДПГ-21-01-039/098 СОКЛ от 30.04.2025 CLA-2025-05
Отчетный период: 202512

21 октября 2024г. АО "Казахстанская Жилищная Компания" объявлено о наступлении гарантийного случая.

Фактическое выполнение СМР на конец отчётного периода составляет –46,69%.
Отставание от гпр 76 дн.
Нормативный срок строительства: 19 месяцев

Вывод: 47,07 % от общего поступления денежных средств, средства дольщиков.
"""
    
    analyzer = AdvancedReportAnalyzer(text=test_text)
    report = analyzer.generate_detailed_report()
    print(report)
    
    # Сохраняем в файл
    with open('/home/claude/advanced_report.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    
    print("\n" + "=" * 120)
    print("Отчет сохранен в: /home/claude/advanced_report.txt")


if __name__ == "__main__":
    test_advanced_analyzer()
