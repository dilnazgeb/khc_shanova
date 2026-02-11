import { ConstructionProjects } from '@/entities';

/**
 * Преобразует результаты анализа PDF в данные проекта ConstructionProjects
 */
export function analysisResultToProject(
  analysisResult: any,
  reportId?: string
): ConstructionProjects {
  if (!analysisResult) {
    throw new Error('analysisResult is empty or undefined');
  }

  const { project_info, project_status, metrics } = analysisResult;

  if (!project_info) {
    throw new Error('project_info is missing from analysisResult');
  }

  // Определяем уровень риска на основе статуса
  const riskLevelMap: Record<string, 'критичный' | 'тревожный' | 'нормальный'> = {
    'критичный': 'критичный',
    'тревожный': 'тревожный',
    'нормальный': 'нормальный',
  };

  const riskLevel = riskLevelMap[project_status] || 'нормальный';

  // Извлекаем значения метрик, обеспечивая типобезопасность
  const smrCompletion = typeof metrics?.SMR_completion === 'number' ? metrics.SMR_completion : 0;
  const gprDelayPercent = typeof metrics?.GPR_delay_percent === 'number' ? metrics.GPR_delay_percent : 0;
  const dduPayments = Array.isArray(metrics?.DDU_payments_percent)
    ? (metrics.DDU_payments_percent[0] || 0)
    : 0;

  // Вычисляем вероятность риска на основе метрик
  const mlRiskProbability = calculateRiskProbability(smrCompletion, gprDelayPercent, dduPayments);

  // Определяем статус проекта (на/оффплан)
  const currentStatus = smrCompletion >= 80 ? 'На графике' : 'Отставание';

  // Вычисляем соблюдение расписания и бюджета
  const scheduleAdherence = Math.max(0, 100 - gprDelayPercent);
  const budgetAdherence = dduPayments;

  // Валидируем имя проекта — если автоматический парсер не смог извлечь название,
  // используем код проекта как fallback и помечаем для ручного ввода в UI.
  let projectName = String(project_info?.full_name || '').trim();
  if (!projectName || projectName === 'Не удалось извлечь название проекта') {
    projectName = String(project_info?.code || `Проект-${Date.now()}`).trim();
  }

  const project: ConstructionProjects = {
    _id: reportId || `proj-${Date.now()}-${Math.random()}`,
    projectName,
    location: String(project_info?.location || '').trim(),
    riskLevel,
    currentStatus,
    mlRiskProbability,
    smrCompletion,
    gprDelayPercent,
    dduPayments,
    budgetAdherence,
    scheduleAdherence,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportPeriod: String(project_info?.report_period || '').trim(),
    projectCode: String(project_info?.code || '').trim(),
  };

  return project;
}

/**
 * Вычисляет вероятность риска на основе метрик
 */
function calculateRiskProbability(
  smrCompletion: number,
  gprDelayPercent: number,
  dduPayments: number
): number {
  // Формула для расчета риска:
  // - СМР < 80% добавляет 40% риска
  // - Отставание > 30% добавляет 30% риска
  // - ДДУ < 70% добавляет 30% риска

  let risk = 0;

  if (smrCompletion < 80) {
    risk += 40 * (1 - smrCompletion / 80);
  }

  if (gprDelayPercent > 30) {
    risk += 30 * (gprDelayPercent / 100);
  }

  if (dduPayments < 70) {
    risk += 30 * (1 - dduPayments / 70);
  }

  return Math.min(100, Math.max(0, risk));
}
