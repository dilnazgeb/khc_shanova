/**
 * Сервис для управления проектами и историей отчётов
 */

import { BaseCrudService } from '@/integrations';
import { ConstructionProjects } from '@/entities';
import { calculateStatus, extractMonthKey } from './status-calculator';

interface AnalysisResult {
  projectId?: string;
  project_info: {
    full_name: string;
    code: string;
    customer?: string;
    report_period: string;
    location: string;
  };
  metrics: {
    SMR_completion?: number;
    GPR_delay_percent?: number;
    GPR_delay_days?: number;
    DDU_payments_percent?: number[];
    DDU_monthly_values?: number[];
    guarantee_extension?: boolean;
  };
  reasoning: string[];
  triggered_conditions: string[];
}

/**
 * Сохраняет или обновляет проект на основе результата анализа
 * Если проект уже существует (по коду), добавляет в историю
 */
export async function saveOrUpdateProject(
  analysisResult: AnalysisResult,
  fileInfo?: { fileName: string; uploadedAt: string; url?: string; projectName?: string }
): Promise<{ projectId: string; isNew: boolean }> {
  const projectId = analysisResult.projectId;
  const monthKey = extractMonthKey(analysisResult.project_info.report_period);
  const rawCode = (analysisResult.project_info.code || '').trim();
  const normalizedCode = rawCode.replace(/[^a-z0-9]/gi, '').toLowerCase();
  
  // Используем projectName из fileInfo если последнее передано
  const projectName = fileInfo?.projectName || analysisResult.project_info.full_name;

  console.log('=== saveOrUpdateProject called ===');
  console.log('projId from analysis:', projectId);
  console.log('rawCode:', rawCode);
  console.log('normalizedCode:', normalizedCode);

  try {
    // Ищем существующий проект: сначала по projectId, затем по коду или названию
    let existingProject: ConstructionProjects | null = null;

    if (projectId) {
      try {
        existingProject = await BaseCrudService.getById<ConstructionProjects>(
          'constructionprojects',
          projectId
        );
        console.log('Found by projectId:', projectId);
      } catch (err) {
        console.log('Not found by projectId, searching by code...');
        existingProject = null;
      }
    }

    if (!existingProject) {
      // Попытка найти по коду (основной критерий дедублирования)
      try {
        const all = await BaseCrudService.getAll<ConstructionProjects>('constructionprojects', [], { limit: 1000 });
        console.log(`Searching among ${all.items.length} existing projects`);
        
        const nameLower = (analysisResult.project_info.full_name || '').toLowerCase();

        existingProject = all.items.find((p) => {
          if (!p) return false;
          // Поиск по коду (нормализованному)
          if (p.code && typeof p.code === 'string') {
            const pCodeNorm = p.code.replace(/[^a-z0-9]/gi, '').toLowerCase();
            console.log(`  Checking existing project code: "${p.code}" → "${pCodeNorm}" vs incoming "${normalizedCode}"`);
            if (pCodeNorm === normalizedCode && normalizedCode) {
              console.log('  ✓ MATCH by code!');
              return true;
            }
          }
          // Поиск по названию (если имя явно задано)
          if (p.projectName && typeof p.projectName === 'string' && p.projectName.toLowerCase() === nameLower && nameLower) {
            console.log('  ✓ MATCH by name!');
            return true;
          }
          return false;
        }) || null;
        console.log('Result of code search:', existingProject ? `Found: ${existingProject._id}` : 'Not found');
      } catch (err) {
        console.warn('Could not search existing projects, will create new', err);
      }
    }

    // Подготовим историю и агрегированные DDU для проверки условий (последние 3 отчёта)
    const existingHistory = (existingProject?.reportHistory || []).map((h: any) => ({
      month: h.month,
      reportPeriod: h.reportPeriod || '',
      smrCompletion: h.smrCompletion ?? 0,
      gprDelayPercent: h.gprDelayPercent ?? 0,
      gprDelayDays: h.gprDelayDays ?? 0,
      dduPayments: h.dduPayments ?? 0,
      dduMonthlyValues: h.dduMonthlyValues || [],
      riskLevel: h.riskLevel || 'unknown',
      timestamp: h.timestamp || new Date().toISOString(),
      analysisResult: h.analysisResult,
    }));
    // newHistoryEntry собираем ниже — сначала подготовим временные данные для расчёта

    // Извлекаем месячные значения DDU (должны быть либо из DDU_monthly_values, либо из legacy DDU_payments_percent)
    const dduMonthlyValues = Array.isArray(analysisResult.metrics.DDU_monthly_values)
      ? analysisResult.metrics.DDU_monthly_values
      : Array.isArray(analysisResult.metrics.DDU_payments_percent)
      ? analysisResult.metrics.DDU_payments_percent
      : [];

    const newHistoryEntry: any = {
      month: monthKey,
      reportPeriod: analysisResult.project_info.report_period,
      smrCompletion: analysisResult.metrics.SMR_completion || 0,
      gprDelayPercent: analysisResult.metrics.GPR_delay_percent || 0,
      gprDelayDays: analysisResult.metrics.GPR_delay_days || 0,
      dduPayments:
        Array.isArray(analysisResult.metrics.DDU_payments_percent)
          ? analysisResult.metrics.DDU_payments_percent[0]
          : analysisResult.metrics.DDU_payments_percent || 0,
      dduMonthlyValues: dduMonthlyValues,
      riskLevel: 'нормальный',
      timestamp: new Date().toISOString(),
      analysisResult,
    };
    // Собираем объединённую историю (новый отчёт + существующая история)
    const combinedHistory = [
      {
        month: monthKey,
        ddu: Array.isArray(analysisResult.metrics.DDU_payments_percent)
          ? analysisResult.metrics.DDU_payments_percent[0]
          : analysisResult.metrics.DDU_payments_percent || 0,
      },
      ...existingHistory.map((h: any) => ({ month: h.month, ddu: h.dduPayments || (h.dduPayments === 0 ? 0 : undefined) }))
    ];

    // Берём последние 3 значения DDU (если есть) в порядке от старого к новому
    const last3 = combinedHistory.slice(0, 3).map((h) => h.ddu).filter((v) => v !== undefined);
    const dduArray = last3.length > 0 ? last3.reverse() : [];

    // Подготовим метрики для расчёта статуса, передав DDU-массив (старое->новое)
    const metricsForCalc = {
      ...analysisResult.metrics,
      DDU_payments_percent: dduArray,
    };

    // Вычислим статус с учётом истории
    const { status, reasons, mlRiskProbability, needs3Reports } = calculateStatus(metricsForCalc, undefined);

    // Обновим запись newHistoryEntry.riskLevel после расчёта
    newHistoryEntry.riskLevel = status;

    if (existingProject) {
      // Обновляем существующий проект
      // Дедупликация по месяцу: если этот месяц уже в истории, заменяем его
      const filteredHistory = (existingProject.reportHistory || []).filter(
        (h: any) => h.month !== monthKey
      ) as any[];
      
      const updatedHistory = [
        newHistoryEntry,
        ...filteredHistory,
      ] as any[];

      // Оставляем только последние 12 месяцев
      const trimmedHistory = updatedHistory.slice(0, 12) as any[];

      // Обновляем список PDF отчетов
      let updatedPdfReports = (existingProject.pdfReports || []) as any[];
      if (fileInfo) {
        // Проверяем, нет ли уже такого месяца в PDF отчетах
        updatedPdfReports = updatedPdfReports.filter(
          (r: any) => r.month !== monthKey
        );
        updatedPdfReports.unshift({
          month: monthKey,
          reportPeriod: analysisResult.project_info.report_period,
          fileName: fileInfo.fileName,
          uploadedAt: fileInfo.uploadedAt,
          url: fileInfo.url,
        });
        // Ограничиваем до 12 последних
        updatedPdfReports = updatedPdfReports.slice(0, 12);
      }

      const updatedProject: ConstructionProjects = {
        ...existingProject,
        projectName: projectName,
        code: analysisResult.project_info.code,
        customer: analysisResult.project_info.customer || existingProject.customer,
        location: analysisResult.project_info.location || existingProject.location,
        smrCompletion: newHistoryEntry.smrCompletion,
        gprDelayPercent: newHistoryEntry.gprDelayPercent,
        gprDelayDays: newHistoryEntry.gprDelayDays,
        dduPayments: newHistoryEntry.dduPayments,
        riskLevel: status,
        mlRiskProbability,
        reportPeriod: analysisResult.project_info.report_period,
        currentStatus:
          newHistoryEntry.smrCompletion >= 80 ? 'На графике' : 'Отставание',
        scheduleAdherence:
          100 - (analysisResult.metrics.GPR_delay_percent || 0),
        reportHistory: trimmedHistory,
        pdfReports: updatedPdfReports,
        statusReasons: reasons,
        needs3Reports: needs3Reports || false,
        analysisResult,
        updatedAt: new Date().toISOString(),
      };

      await BaseCrudService.update('constructionprojects', updatedProject);
      console.log(`✓ Project UPDATED (existing): ${existingProject._id}`);

      return { projectId: existingProject._id, isNew: false };
    } else {
      // Создаём новый проект
      // Обрезаем _id до 128 символов для Wix compatibility
      const finalId = (projectId || `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).substring(0, 128);
      
      const newProject: ConstructionProjects = {
        _id: finalId,
        projectName: projectName,
        code: analysisResult.project_info.code,
        customer: analysisResult.project_info.customer || '',
        location: analysisResult.project_info.location,
        reportPeriod: analysisResult.project_info.report_period,
        projectId: finalId,
        smrCompletion: newHistoryEntry.smrCompletion,
        gprDelayPercent: newHistoryEntry.gprDelayPercent,
        gprDelayDays: newHistoryEntry.gprDelayDays,
        dduPayments: newHistoryEntry.dduPayments,
        riskLevel: status,
        mlRiskProbability,
        currentStatus:
          newHistoryEntry.smrCompletion >= 80 ? 'На графике' : 'Отставание',
        scheduleAdherence:
          100 - (analysisResult.metrics.GPR_delay_percent || 0),
        reportHistory: [newHistoryEntry],
        pdfReports: fileInfo ? [{
          month: monthKey,
          reportPeriod: analysisResult.project_info.report_period,
          fileName: fileInfo.fileName,
          uploadedAt: fileInfo.uploadedAt,
          url: fileInfo.url,
        }] : [],
        statusReasons: reasons,
        needs3Reports: needs3Reports || false,
        analysisResult,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await BaseCrudService.create('constructionprojects', newProject);
      console.log(`✗ Project CREATED (NEW with code="${analysisResult.project_info.code}"): ${newProject._id}`);

      return { projectId: newProject._id, isNew: true };
    }
  } catch (error) {
    console.error('Error saving/updating project:', error);
    throw error;
  }
}

/**
 * Удаляет проект по _id и опционально удаляет связанные репорты
 */
export async function deleteProject(projectId: string, removeReports: boolean = false): Promise<void> {
  try {
    if (!projectId) throw new Error('projectId required');
    await BaseCrudService.delete('constructionprojects', projectId);
    console.log(`Project deleted: ${projectId}`);

    if (removeReports) {
      // Попробуем удалить связанные projectreports в mock-режиме (если сервис поддерживает)
      try {
        const reports = await BaseCrudService.getAll<any>('projectreports', [], { limit: 1000 });
        const related = reports.items.filter(r => r.projectId === projectId || r.project_id === projectId || r.projectId === undefined && r.code === undefined);
        for (const rep of related) {
          await BaseCrudService.delete('projectreports', rep._id);
        }
      } catch (err) {
        console.warn('Could not delete related reports automatically', err);
      }
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}
