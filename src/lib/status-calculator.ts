/**
 * Статус-калькулятор для проектов
 * Определяет статус проекта и причины его присвоения
 * 
 * ТРЕВОЖНЫЕ = a AND b, где:
 *   a = СМР < 80% от ГПР
 *   b = ИЛИ(b1; b2; b3; b4; b5; b6)
 *
 * КРИТИЧЕСКИЕ = a AND b AND c AND d, где:
 *   a = СМР < 80%
 *   b = ДДУ последовательно <70%, <60%, <50% за 3 месяца
 *   c = Отставание > 30% от общего срока
 *   d = И/ИЛИ(d1; d2; d3; d4)
 */

export interface Metrics {
  SMR_completion?: number;           // % выполнения СМР от ГПР
  GPR_delay_percent?: number;        // % отставания от ГПР
  GPR_delay_days?: number;           // дни отставания
  DDU_payments_percent?: number[];   // массив % поступлений ДДУ за последние месяцы
  DDU_monthly_values?: number[];     // абсолютные значения поступлений (млн тг) за последние месяцы
  GPR_value?: number;                // значение ГПР (млн тг) для пересчета процентов
  guarantee_extension?: boolean;     // наличие продления гарантии
  builder_delay_days?: number;       // просрочка по займам (дни)
  builder_rating_drop?: number;      // снижение рейтинга (баллы)
  complaints_count?: number;         // количество официальных жалоб
  debt_to_equity?: number;           // соотношение долга к собственному капиталу
}

export interface HistoryEntry {
  month: string;
  smrCompletion: number;
  gprDelayPercent: number;
  dduPayments: number | number[];
  builderDelayDays?: number;
  builderRatingDrop?: number;
  complaintsCount?: number;
  debtToEquity?: number;
}

export interface StatusReason {
  reason: string;
  metric?: string;
  value?: string | number;
  threshold?: string | number;
  change?: number;
  condition?: string; // для отслеживания выполненных условий
}

interface ConditionCheckResult {
  isMet: boolean;
  reasons: StatusReason[];
}

/**
 * Проверяет условие a: СМР < 80% от ГПР
 */
function checkConditionA(metrics: Metrics): ConditionCheckResult {
  const smr = metrics.SMR_completion ?? 0;
  const isMet = smr < 80;
  
  return {
    isMet,
    reasons: isMet ? [{
      reason: `Условие A: СМР < 80% (текущее значение: ${smr.toFixed(1)}%)`,
      metric: 'SMR_completion',
      value: `${smr.toFixed(1)}%`,
      threshold: '80%',
      condition: 'A'
    }] : []
  };
}

/**
 * Проверяет условие b для ТРЕВОЖНОГО статуса (ИЛИ из 6 условий)
 */
function checkConditionBWarning(metrics: Metrics): ConditionCheckResult {
  const reasons: StatusReason[] = [];
  const gpr = metrics.GPR_delay_percent ?? 0;
  const ddu = Array.isArray(metrics.DDU_payments_percent)
    ? metrics.DDU_payments_percent[0] ?? 0
    : metrics.DDU_payments_percent ?? 0;

  // b1: отставание от ГПР более 30%
  if (gpr > 30) {
    reasons.push({
      reason: `Условие b1: Отставание от ГПР > 30% (текущее: ${gpr.toFixed(1)}%)`,
      metric: 'GPR_delay_percent',
      value: `${gpr.toFixed(1)}%`,
      threshold: '30%',
      condition: 'b1'
    });
    return { isMet: true, reasons };
  }

  // b2: просрочка по займам более 30 дней
  const builderDelay = metrics.builder_delay_days ?? 0;
  if (builderDelay > 30) {
    reasons.push({
      reason: `Условие b2: Просрочка по займам > 30 дней (текущая: ${builderDelay} дней)`,
      metric: 'builder_delay_days',
      condition: 'b2'
    });
    return { isMet: true, reasons };
  }

  // b3: более 1 официального обращения дольщиков
  const complaints = metrics.complaints_count ?? 0;
  if (complaints > 1) {
    reasons.push({
      reason: `Условие b3: Более 1 жалобы дольщиков (текущее: ${complaints})`,
      metric: 'complaints_count',
      condition: 'b3'
    });
    return { isMet: true, reasons };
  }

  // b4: снижение рейтинга на 20+ баллов
  const ratingDrop = metrics.builder_rating_drop ?? 0;
  if (ratingDrop >= 20) {
    reasons.push({
      reason: `Условие b4: Снижение рейтинга на ${ratingDrop} баллов (≥20)`,
      metric: 'builder_rating_drop',
      condition: 'b4'
    });
    return { isMet: true, reasons };
  }

  // b5: соотношение долга > 6
  const debtToEquity = metrics.debt_to_equity ?? 0;
  if (debtToEquity > 6) {
    reasons.push({
      reason: `Условие b5: Соотношение долга > 6 (текущее: ${debtToEquity.toFixed(2)})`,
      metric: 'debt_to_equity',
      condition: 'b5'
    });
    return { isMet: true, reasons };
  }

  // b6: ДДУ последовательно <70%, <60%, <50% (может быть перевычислено через ГПР)
  // Вариант 1: Если есть абсолютные значения и ГПР
  if (Array.isArray(metrics.DDU_monthly_values) && metrics.DDU_monthly_values.length >= 3 && metrics.GPR_value && metrics.GPR_value > 0) {
    const [m1, m2, m3] = metrics.DDU_monthly_values;
    const gpr = metrics.GPR_value;
    
    // Конвертируем значения из тг в млн тг (разделяем на 1,000,000)
    const m1_mln = m1 / 1_000_000;
    const m2_mln = m2 / 1_000_000;
    const m3_mln = m3 / 1_000_000;
    
    // Рассчитываем НАКОПЛЕННЫЕ поступления в млн тг
    const cumulative1 = m1_mln;
    const cumulative2 = m1_mln + m2_mln;
    const cumulative3 = m1_mln + m2_mln + m3_mln;
    
    // Рассчитываем накопленные доли (%)
    const cumulativeShare1 = (cumulative1 / gpr) * 100;
    const cumulativeShare2 = (cumulative2 / gpr) * 100;
    const cumulativeShare3 = (cumulative3 / gpr) * 100;
    
    if (cumulativeShare1 < 70 && cumulativeShare2 < 60 && cumulativeShare3 < 50) {
      reasons.push({
        reason: `Условие b6: Накопленные поступления по ДДУ < 70%, < 60%, < 50% (М1 накопл=${cumulativeShare1.toFixed(1)}%, М1+М2 накопл=${cumulativeShare2.toFixed(1)}%, М1+М2+М3 накопл=${cumulativeShare3.toFixed(1)}%)`,
        metric: 'DDU_monthly_values',
        condition: 'b6'
      });
      return { isMet: true, reasons };
    }
  }
  
  // Вариант 2: Если готовые проценты из PDF
  if (Array.isArray(metrics.DDU_payments_percent) && metrics.DDU_payments_percent.length >= 3) {
    const [m1, m2, m3] = metrics.DDU_payments_percent;
    if (m1 < 70 && m2 < 60 && m3 < 50) {
      reasons.push({
        reason: `Условие b6: ДДУ последовательно < 70%, < 60%, < 50% (текущие: ${m1.toFixed(1)}%, ${m2.toFixed(1)}%, ${m3.toFixed(1)}%)`,
        metric: 'DDU_payments_percent',
        condition: 'b6'
      });
      return { isMet: true, reasons };
    }
  }

  return { isMet: false, reasons: [] };
}

/**
 * Проверяет условие b для КРИТИЧЕСКОГО статуса (b6 - ДДУ)
 */
function checkConditionBCritical(metrics: Metrics): ConditionCheckResult {
  const reasons: StatusReason[] = [];
  
  // Вариант 1: Если переданы абсолютные значения М1, М2, М3 и ГПР — рассчитываем по накопленным поступлениям
  if (Array.isArray(metrics.DDU_monthly_values) && metrics.DDU_monthly_values.length >= 3 && metrics.GPR_value && metrics.GPR_value > 0) {
    const [m1, m2, m3] = metrics.DDU_monthly_values;
    const gpr = metrics.GPR_value;
    
    // Конвертируем значения из тг в млн тг (разделяем на 1,000,000)
    // Значения из PDF часто в тенге, а ГПР обычно указывают в млн тг
    const m1_mln = m1 / 1_000_000;
    const m2_mln = m2 / 1_000_000;
    const m3_mln = m3 / 1_000_000;
    
    // Рассчитываем НАКОПЛЕННЫЕ поступления в млн тг
    const cumulative1 = m1_mln;
    const cumulative2 = m1_mln + m2_mln;
    const cumulative3 = m1_mln + m2_mln + m3_mln;
    
    // Рассчитываем накопленные доли (%)
    const cumulativeShare1 = (cumulative1 / gpr) * 100;
    const cumulativeShare2 = (cumulative2 / gpr) * 100;
    const cumulativeShare3 = (cumulative3 / gpr) * 100;
    
    // Проверяем условие B (критичное): необходимо выполнение ВСЕх трёх порогов
    const isMet = cumulativeShare1 < 70 && cumulativeShare2 < 60 && cumulativeShare3 < 50;
    
    if (isMet) {
      reasons.push({
        reason: `Условие B (критичное): Накопленные поступления по ДДУ соответствуют паттерну < 70%, < 60%, < 50%`,
        metric: 'DDU_monthly_values',
        condition: 'B',
        value: `М1 накопл: ${cumulativeShare1.toFixed(1)}% ✓ | М1+М2 накопл: ${cumulativeShare2.toFixed(1)}% ✓ | М1+М2+М3 накопл: ${cumulativeShare3.toFixed(1)}% ✓`
      });
    } else {
      // Объяснение почему не выполнено
      const failed = [];
      if (cumulativeShare1 >= 70) failed.push(`M1 накопл: ${cumulativeShare1.toFixed(1)}% >= 70%`);
      if (cumulativeShare2 >= 60) failed.push(`M1+M2 накопл: ${cumulativeShare2.toFixed(1)}% >= 60%`);
      if (cumulativeShare3 >= 50) failed.push(`M1+M2+M3 накопл: ${cumulativeShare3.toFixed(1)}% >= 50%`);
      
      reasons.push({
        reason: `Условие B (критичное) НЕ выполнено. Причины: ${failed.join(' | ')}`,
        metric: 'DDU_monthly_values',
        condition: 'B_not_met'
      });
    }
    
    return { isMet, reasons };
  }
  
  // Вариант 2: Если переданы уже готовые проценты (из PDF) — проверяем их
  if (Array.isArray(metrics.DDU_payments_percent) && metrics.DDU_payments_percent.length >= 3) {
    const [m1, m2, m3] = metrics.DDU_payments_percent;
    if (m1 < 70 && m2 < 60 && m3 < 50) {
      return {
        isMet: true,
        reasons: [{
          reason: `Условие B (критичное): ДДУ < 70%, < 60%, < 50% последовательно (${m1.toFixed(1)}%, ${m2.toFixed(1)}%, ${m3.toFixed(1)}%)`,
          metric: 'DDU_payments_percent',
          condition: 'B'
        }]
      };
    } else {
      const failed = [];
      if (m1 >= 70) failed.push(`М1: ${m1.toFixed(1)}% >= 70%`);
      if (m2 >= 60) failed.push(`М2: ${m2.toFixed(1)}% >= 60%`);
      if (m3 >= 50) failed.push(`М3: ${m3.toFixed(1)}% >= 50%`);
      
      return {
        isMet: false,
        reasons: [{
          reason: `Условие B (критичное) НЕ выполнено: ${failed.join(', ')}`,
          condition: 'B_not_met'
        }]
      };
    }
  }
  
  return { isMet: false, reasons: [] };
}

/**
 * Проверяет условие c: отставание > 30% от общего срока
 */
function checkConditionC(metrics: Metrics): ConditionCheckResult {
  const gpr = metrics.GPR_delay_percent ?? 0;
  const isMet = gpr > 30;
  
  return {
    isMet,
    reasons: isMet ? [{
      reason: `Условие C: Отставание > 30% (текущее: ${gpr.toFixed(1)}%)`,
      metric: 'GPR_delay_percent',
      condition: 'C'
    }] : []
  };
}

/**
 * Проверяет условие d для КРИТИЧЕСКОГО статуса (И/ИЛИ из 4 условий)
 */
function checkConditionD(metrics: Metrics): ConditionCheckResult {
  const reasons: StatusReason[] = [];

  // d1: продление гарантии (хотя бы 1 факт)
  if (metrics.guarantee_extension) {
    reasons.push({
      reason: 'Условие d1: Наличие продления гарантии',
      metric: 'guarantee_extension',
      condition: 'd1'
    });
    return { isMet: true, reasons };
  }

  // d2: более 1 официального обращения дольщиков
  const complaints = metrics.complaints_count ?? 0;
  if (complaints > 1) {
    reasons.push({
      reason: `Условие d2: Более 1 обращения дольщиков (текущее: ${complaints})`,
      metric: 'complaints_count',
      condition: 'd2'
    });
    return { isMet: true, reasons };
  }

  // d3: снижение рейтинга на 20+ баллов
  const ratingDrop = metrics.builder_rating_drop ?? 0;
  if (ratingDrop >= 20) {
    reasons.push({
      reason: `Условие d3: Снижение рейтинга на ${ratingDrop} баллов (≥20)`,
      metric: 'builder_rating_drop',
      condition: 'd3'
    });
    return { isMet: true, reasons };
  }

  // d4: просрочка по займам
  const builderDelay = metrics.builder_delay_days ?? 0;
  if (builderDelay > 0) {
    reasons.push({
      reason: `Условие d4: Просрочка по займам на ${builderDelay} дней`,
      metric: 'builder_delay_days',
      condition: 'd4'
    });
    return { isMet: true, reasons };
  }

  return { isMet: false, reasons: [] };
}

/**
 * Рассчитывает статус проекта на основе официальных критериев
 */
export function calculateStatus(
  metrics: Metrics,
  history?: HistoryEntry[],
  manualD?: { d1?: boolean; d2?: boolean; d3?: boolean; d4?: boolean }
): {
  status: 'критичный' | 'тревожный' | 'нормальный';
  reasons: StatusReason[];
  mlRiskProbability: number;
  needs3Reports?: boolean;
} {
  const reasons: StatusReason[] = [];

  // Проверяем условие A (СМР < 80%)
  const conditionA = checkConditionA(metrics);

  // Проверяем b6 (ДДУ последовательно) только если есть данные за 3 месяца
  const has3DDU = Array.isArray(metrics.DDU_payments_percent) && metrics.DDU_payments_percent.length >= 3;

  // Если A не выполнено - нормальный
  if (!conditionA.isMet) {
    reasons.push({ reason: 'СМР >= 80% — базовое условие A не выполнено', metric: 'SMR_completion' });
    return { status: 'нормальный', reasons, mlRiskProbability: 0.05 };
  }

  // Если A выполнено, но нет 3 отчётов для оценки b6 и нет других b-подусловий — нужно подождать 3 отчёта
  const warningB = checkConditionBWarning(metrics);
  if (!has3DDU && !warningB.isMet) {
    reasons.push(...conditionA.reasons);
    reasons.push({ reason: 'Недостаточно данных для проверки условия b6 — требуется загрузить отчёты за 3 месяца', condition: 'needs_3_reports' });
    return { status: 'нормальный', reasons, mlRiskProbability: 0.1, needs3Reports: true };
  }

  // КРИТИЧНЫЙ: a AND b6 AND c AND d
  const conditionB_Critical = checkConditionBCritical(metrics);
  const conditionC = checkConditionC(metrics);
  // d может быть заполнено вручную (manualD) — если передали, используем его как OR с автоматикой
  const conditionDAuto = checkConditionD(metrics);
  const manualDProvided = manualD && (manualD.d1 || manualD.d2 || manualD.d3 || manualD.d4);
  const conditionDCombined = {
    isMet: conditionDAuto.isMet || !!manualDProvided,
    reasons: [...conditionDAuto.reasons]
  };
  if (manualDProvided) {
    // добавим ручные причины
    if (manualD.d1) conditionDCombined.reasons.push({ reason: 'Пользователь указал d1 (продление гарантии)', condition: 'd1' });
    if (manualD.d2) conditionDCombined.reasons.push({ reason: 'Пользователь указал d2 (жалобы дольщиков)', condition: 'd2' });
    if (manualD.d3) conditionDCombined.reasons.push({ reason: 'Пользователь указал d3 (снижение рейтинга)', condition: 'd3' });
    if (manualD.d4) conditionDCombined.reasons.push({ reason: 'Пользователь указал d4 (просрочка по займам)', condition: 'd4' });
  }

  if (conditionB_Critical.isMet && conditionC.isMet && conditionDCombined.isMet) {
    reasons.push(...conditionA.reasons);
    reasons.push(...conditionB_Critical.reasons);
    reasons.push(...conditionC.reasons);
    reasons.push(...conditionDCombined.reasons);
    
    // Добавляем объяснение логики критичного статуса
    reasons.push({ 
      reason: '🔴 КРИТИЧНЫЙ СТАТУС — все 4 условия выполнены:',
      condition: 'critical_explanation'
    });
    reasons.push({ 
      reason: '✓ Условие A (СМР < 80%)', 
      condition: 'a_met'
    });
    reasons.push({ 
      reason: '✓ Условие B (ДДУ: <70%, <60%, <50% за 3 месяца подряд)', 
      condition: 'b_critical_met'
    });
    reasons.push({ 
      reason: '✓ Условие C (Отставание > 30%)', 
      condition: 'c_met'
    });
    reasons.push({ 
      reason: '✓ Условие D (d1, d2, d3 или d4)', 
      condition: 'd_met'
    });
    
    return { status: 'критичный', reasons, mlRiskProbability: 1.0 };
  }

  // ТРЕВОЖНЫЙ: a AND any b (b1..b5 or b6)
  if (warningB.isMet) {
    reasons.push(...conditionA.reasons);
    reasons.push(...warningB.reasons);
    
    // Добавляем объяснение почему не критичный
    reasons.push({ 
      reason: '⚠️ Статус ТРЕВОЖНЫЙ (не критичный) потому что:',
      condition: 'explanation'
    });
    
    if (!conditionB_Critical.isMet) {
      reasons.push({ 
        reason: '• Условие b (для критичного): ДДУ не соответствует паттерну <70%, <60%, <50% за 3 месяца подряд',
        condition: 'b_critical_not_met'
      });
    }
    if (!conditionC.isMet) {
      reasons.push({ 
        reason: '• Условие c: Отставание от ГПР не превышает 30%',
        condition: 'c_not_met'
      });
    }
    if (!conditionDCombined.isMet) {
      reasons.push({ 
        reason: '• Условие d: Не указаны дополнительные критерии d1-d4',
        condition: 'd_not_met'
      });
    }
    
    return { status: 'тревожный', reasons, mlRiskProbability: 0.6 };
  }

  // Если дошли сюда — A выполнено, но b не подтверждён (и не было 3 месяцев) -> нормальный + просьба загрузить ещё месяцы
  reasons.push(...conditionA.reasons);
  reasons.push({ reason: 'Требуется дополнительная информация по пункту B: загрузите отчёты за последние 3 месяца для оценки b6', condition: 'needs_3_reports' });
  return { status: 'нормальный', reasons, mlRiskProbability: 0.1, needs3Reports: !has3DDU };
}

/**
 * Генерирует месячный ключ из периода отчёта
 */
export function extractMonthKey(reportPeriod: string): string {
  // Ожидаем формат: "2025 декабря" или "2025г декабря"
  const match = reportPeriod.match(/(\d{4}).*?(\d{1,2})/);
  if (match) {
    const year = match[1];
    // Найдём номер месяца
    const months: { [key: string]: string } = {
      января: '01',
      февраля: '02',
      марта: '03',
      апреля: '04',
      мая: '05',
      июня: '06',
      июля: '07',
      августа: '08',
      сентября: '09',
      октября: '10',
      ноября: '11',
      декабря: '12',
    };

    for (const [monthName, monthNum] of Object.entries(months)) {
      if (reportPeriod.toLowerCase().includes(monthName)) {
        return `${year}${monthNum}`;
      }
    }
  }

  // Fallback - берём первые 6 символов (YYYYMM)
  const numMatch = reportPeriod.match(/(\d{6})/);
  if (numMatch) {
    return numMatch[1];
  }

  return new Date().toISOString().slice(0, 7).replace('-', '');
}

/**
 * Преобразует массив истории в формат для проверки условий
 */
export function normalizeHistoryForStatus(
  history?: Array<{
    month: string;
    metrics?: Metrics;
    [key: string]: any;
  }>
): HistoryEntry[] {
  if (!history || history.length === 0) {
    return [];
  }

  return history.map((entry) => ({
    month: entry.month || '',
    smrCompletion:
      entry.metrics?.SMR_completion ?? entry.smrCompletion ?? 0,
    gprDelayPercent:
      entry.metrics?.GPR_delay_percent ?? entry.gprDelayPercent ?? 0,
    dduPayments: Array.isArray(
      entry.metrics?.DDU_payments_percent
    )
      ? (entry.metrics.DDU_payments_percent[0] ?? 0)
      : (entry.metrics?.DDU_payments_percent ?? entry.dduPayments ?? 0),
    builderDelayDays: entry.metrics?.builder_delay_days ?? entry.builderDelayDays ?? 0,
    builderRatingDrop: entry.metrics?.builder_rating_drop ?? entry.builderRatingDrop ?? 0,
    complaintsCount: entry.metrics?.complaints_count ?? entry.complaintsCount ?? 0,
    debtToEquity: entry.metrics?.debt_to_equity ?? entry.debtToEquity ?? 0,
  }));
}
