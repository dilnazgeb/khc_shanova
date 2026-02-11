/**
 * Флаги и предупреждения для автоматического оповещения
 */

export interface Flag {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  severity: 1 | 2 | 3 | 4 | 5; // 5 - максимальный приоритет
  createdAt: Date;
  resolvedAt?: Date;
  icon: string;
}

export function generateFlags(
  project: any,
  currentMonth: any,
  previousMonth?: any
): Flag[] {
  const flags: Flag[] = [];
  const now = new Date();

  // ФЛАГ 1: Первый переход в критичное состояние
  if (
    currentMonth.riskLevel === 'критичный' &&
    (!previousMonth || previousMonth.riskLevel !== 'критичный')
  ) {
    flags.push({
      id: `first-critical-${currentMonth.month}`,
      type: 'critical',
      title: 'Первый переход в КРИТИЧНОЕ состояние',
      description: `Проект ${project.projectName} впервые вошёл в критичное состояние. Требуется срочное рассмотрение.`,
      severity: 5,
      createdAt: now,
      icon: '🚨',
    });
  }

  // ФЛАГ 2: Долгое пребывание в критичном состоянии
  if (currentMonth.riskLevel === 'критичный') {
    let criticalMonths = 1;
    if (previousMonth) {
      // Подсчитаем подряд
      for (let i = 0; i < Math.min(project.reportHistory?.length || 0, 12); i++) {
        if (project.reportHistory?.[i]?.riskLevel === 'критичный') {
          criticalMonths++;
        } else {
          break;
        }
      }
    }

    if (criticalMonths >= 3) {
      flags.push({
        id: `long-critical-${currentMonth.month}`,
        type: 'critical',
        title: `Проект в критичном состоянии ${criticalMonths} месяца подряд`,
        description: `Требуется немедленное вмешательство управления`,
        severity: 5,
        createdAt: now,
        icon: '🔴',
      });
    }
  }

  // ФЛАГ 3: СМР деградация
  if (previousMonth && currentMonth.smrCompletion < previousMonth.smrCompletion - 5) {
    flags.push({
      id: `smr-degradation-${currentMonth.month}`,
      type: 'warning',
      title: 'Деградация СМР',
      description: `СМР упала на ${(previousMonth.smrCompletion - currentMonth.smrCompletion).toFixed(1)}%. Возможны задержки на стройплощадке.`,
      severity: 4,
      createdAt: now,
      icon: '📉',
    });
  }

  // ФЛАГ 4: Близко к критичному (тревожное состояние)
  if (currentMonth.riskLevel === 'тревожный') {
    const criticalThreshold = 60;
    const riskScore = Math.round(currentMonth.mlRiskProbability * 100);

    if (riskScore > 45) {
      flags.push({
        id: `near-critical-${currentMonth.month}`,
        type: 'warning',
        title: 'Проект близко к критичному состоянию',
        description: `Риск ${riskScore}% - осталось ${criticalThreshold - riskScore} очков до критичного. Требуется контроль.`,
        severity: 3,
        createdAt: now,
        icon: '🟡',
      });
    }
  }

  // ФЛАГ 5: ГПР сильное отставание
  if (currentMonth.gprDelayPercent > 40) {
    flags.push({
      id: `high-gpr-delay-${currentMonth.month}`,
      type: 'warning',
      title: 'Критичное отставание по графику',
      description: `Отставание ${currentMonth.gprDelayPercent.toFixed(1)}% (${currentMonth.gprDelayDays} дней). Риск срыва дедлайна.`,
      severity: 4,
      createdAt: now,
      icon: '⏰',
    });
  }

  // ФЛАГ 6: ДДУ низкие платежи
  if (currentMonth.dduPayments < 30) {
    flags.push({
      id: `low-ddu-${currentMonth.month}`,
      type: 'warning',
      title: 'Критично низкие платежи по ДДУ',
      description: `Только ${currentMonth.dduPayments.toFixed(1)}% платежей получено. Финансирование под угрозой.`,
      severity: 4,
      createdAt: now,
      icon: '💰',
    });
  }

  // ФЛАГ 7: Хорошее состояние - нормальный с улучшением
  if (
    currentMonth.riskLevel === 'нормальный' &&
    previousMonth &&
    previousMonth.riskLevel !== 'нормальный'
  ) {
    flags.push({
      id: `returned-to-normal-${currentMonth.month}`,
      type: 'info',
      title: 'Проект вернулся в нормальное состояние ✅',
      description: `Все ключевые метрики улучшились, проект стабилизировался`,
      severity: 1,
      createdAt: now,
      icon: '✅',
    });
  }

  // ФЛАГ 8: Стабильный прогресс
  if (
    currentMonth.riskLevel === 'нормальный' &&
    currentMonth.smrCompletion >= 80 &&
    currentMonth.gprDelayPercent < 10
  ) {
    flags.push({
      id: `stable-progress-${currentMonth.month}`,
      type: 'info',
      title: 'Стабильный прогресс по проекту',
      description: `СМР > 80%, отставание < 10%. Проект идёт по плану.`,
      severity: 1,
      createdAt: now,
      icon: '📊',
    });
  }

  return flags;
}

export function prioritizeFlags(flags: Flag[]): Flag[] {
  return flags.sort((a, b) => {
    if (a.severity !== b.severity) {
      return b.severity - a.severity;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
