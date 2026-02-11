/**
 * Сравнение отчётов между месяцами (Diff)
 */

export interface MetricChange {
  metric: string;
  previous: number | null;
  current: number;
  change: number;
  changePercent: number;
  trend: 'improved' | 'degraded' | 'stable';
  icon: string;
}

export interface ReportDiff {
  monthCurrent: string;
  monthPrevious: string | null;
  changes: MetricChange[];
  overallTrend: 'improving' | 'degrading' | 'stable';
  warnings: string[];
}

export function compareReports(
  currentMonth: any,
  previousMonth: any | null
): ReportDiff {
  const changes: MetricChange[] = [];
  const warnings: string[] = [];

  if (!previousMonth) {
    return {
      monthCurrent: currentMonth.month,
      monthPrevious: null,
      changes: [],
      overallTrend: 'stable',
      warnings: ['Это первый отчёт по проекту'],
    };
  }

  // Проверяем, что это разные месяцы (санитарная проверка на дубликаты)
  if (currentMonth.month === previousMonth.month) {
    return {
      monthCurrent: currentMonth.month,
      monthPrevious: null,
      changes: [],
      overallTrend: 'stable',
      warnings: ['Обнаружена дубликация месяца в истории – сравнение невозможно'],
    };
  }

  // Сравнение СМР
  const smrChange = currentMonth.smrCompletion - previousMonth.smrCompletion;
  changes.push({
    metric: 'СМР (Строительно-монтажные работы)',
    previous: previousMonth.smrCompletion,
    current: currentMonth.smrCompletion,
    change: smrChange,
    changePercent: (smrChange / previousMonth.smrCompletion) * 100,
    trend: smrChange > 0 ? 'improved' : smrChange < 0 ? 'degraded' : 'stable',
    icon: smrChange > 0 ? '📈' : smrChange < 0 ? '📉' : '➡️',
  });

  if (smrChange < -5) {
    warnings.push(`⚠️ СМР ухудшилась на ${Math.abs(smrChange).toFixed(1)}% за месяц`);
  }

  // Сравнение ГПР
  const gprChange = currentMonth.gprDelayPercent - previousMonth.gprDelayPercent;
  changes.push({
    metric: 'ГПР (отставание от графика)',
    previous: previousMonth.gprDelayPercent,
    current: currentMonth.gprDelayPercent,
    change: gprChange,
    changePercent: previousMonth.gprDelayPercent > 0 ? (gprChange / previousMonth.gprDelayPercent) * 100 : 0,
    trend: gprChange < 0 ? 'improved' : gprChange > 0 ? 'degraded' : 'stable',
    icon: gprChange < 0 ? '📈' : gprChange > 0 ? '📉' : '➡️',
  });

  if (gprChange > 5) {
    warnings.push(`⚠️ Отставание по графику увеличилось на ${gprChange.toFixed(1)}%`);
  }

  // Сравнение ДДУ
  const dduChange = currentMonth.dduPayments - previousMonth.dduPayments;
  changes.push({
    metric: 'ДДУ (платежи)',
    previous: previousMonth.dduPayments,
    current: currentMonth.dduPayments,
    change: dduChange,
    changePercent: (dduChange / previousMonth.dduPayments) * 100,
    trend: dduChange > 0 ? 'improved' : dduChange < 0 ? 'degraded' : 'stable',
    icon: dduChange > 0 ? '📈' : dduChange < 0 ? '📉' : '➡️',
  });

  if (dduChange < -5) {
    warnings.push(`⚠️ Платежи по ДДУ снизились на ${Math.abs(dduChange).toFixed(1)}%`);
  }

  // Определяем общий тренд
  const improvedCount = changes.filter(c => c.trend === 'improved').length;
  const degradedCount = changes.filter(c => c.trend === 'degraded').length;

  let overallTrend: 'improving' | 'degrading' | 'stable' = 'stable';
  if (degradedCount > improvedCount) {
    overallTrend = 'degrading';
  } else if (improvedCount > degradedCount) {
    overallTrend = 'improving';
  }

  // Проверяем статус-переходы
  if (previousMonth.riskLevel !== currentMonth.riskLevel) {
    if (currentMonth.riskLevel === 'критичный') {
      warnings.push('🚨 ПРОЕКТ ПЕРЕШЁЛ В КРИТИЧНОЕ СОСТОЯНИЕ!');
    } else if (previousMonth.riskLevel === 'критичный') {
      warnings.push('✅ Проект улучшился и вышел из критичного состояния');
    }
  }

  // Проверяем деградацию подряд
  if (
    previousMonth.riskLevel !== 'нормальный' &&
    currentMonth.riskLevel === previousMonth.riskLevel
  ) {
    warnings.push('⚠️ Статус не улучшается уже второй месяц подряд');
  }

  return {
    monthCurrent: currentMonth.month,
    monthPrevious: previousMonth.month,
    changes,
    overallTrend,
    warnings,
  };
}
