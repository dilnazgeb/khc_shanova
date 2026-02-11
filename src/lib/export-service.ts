/**
 * Экспорт проектов в PDF и Excel
 */

import { ConstructionProjects } from '@/entities';
import { format } from 'date-fns';

export interface ExportOptions {
  format: 'pdf' | 'xlsx';
  includeHistory: boolean;
  includeFlags: boolean;
  includeReasons: boolean;
}

export function generateTextReport(project: ConstructionProjects, options: ExportOptions): string {
  const lines: string[] = [];

  // Заголовок
  lines.push('='.repeat(100));
  lines.push('ОТЧЁТ О ПРОЕКТЕ');
  lines.push('='.repeat(100));
  lines.push('');

  // Основная информация
  lines.push(`Название проекта: ${project.projectName}`);
  lines.push(`Код: ${project.code || 'N/A'}`);
  lines.push(`Заказчик: ${project.customer || 'N/A'}`);
  lines.push(`Местоположение: ${project.location || 'N/A'}`);
  lines.push(`Статус: ${project.riskLevel || 'unknown'}`);
  lines.push(`Риск: ${((project.mlRiskProbability || 0) * 100).toFixed(1)}%`);
  lines.push('');

  // Текущие метрики
  lines.push('-'.repeat(100));
  lines.push('ТЕКУЩИЕ МЕТРИКИ');
  lines.push('-'.repeat(100));
  lines.push(`СМР (Строительно-монтажные работы): ${(project.smrCompletion || 0).toFixed(1)}%`);
  lines.push(`ГПР (отставание по графику): ${(project.gprDelayPercent || 0).toFixed(1)}% (${project.gprDelayDays || 0} дней)`);
  lines.push(`ДДУ (платежи): ${(project.dduPayments || 0).toFixed(1)}%`);
  lines.push(`Гарантийное продление: ${project.guaranteeExtension ? 'Да' : 'Нет'}`);
  lines.push('');

  // Обоснование статуса
  if (options.includeReasons && project.statusReasons && project.statusReasons.length > 0) {
    lines.push('-'.repeat(100));
    lines.push('ОБОСНОВАНИЕ СТАТУСА');
    lines.push('-'.repeat(100));
    project.statusReasons.forEach((reason, idx) => {
      lines.push(`${idx + 1}. ${reason.reason}`);
      if (reason.metric) lines.push(`   Метрика: ${reason.metric}`);
      if (reason.value !== undefined) lines.push(`   Значение: ${reason.value}`);
      if (reason.threshold !== undefined) lines.push(`   Пороговое значение: ${reason.threshold}`);
      if (reason.change !== undefined) lines.push(`   Изменение: ${reason.change}`);
    });
    lines.push('');
  }

  // История отчётов
  if (options.includeHistory && project.reportHistory && project.reportHistory.length > 0) {
    lines.push('-'.repeat(100));
    lines.push('ИСТОРИЯ ОТЧЁТОВ (последние 12 месяцев)');
    lines.push('-'.repeat(100));
    project.reportHistory.forEach((record, idx) => {
      lines.push(`\nМесяц ${idx + 1}: ${record.reportPeriod} (${record.month})`);
      lines.push(`  Статус: ${record.riskLevel}`);
      lines.push(`  СМР: ${record.smrCompletion?.toFixed(1)}%`);
      lines.push(`  ГПР: ${record.gprDelayPercent?.toFixed(1)}% (${record.gprDelayDays} дней)`);
      lines.push(`  ДДУ: ${record.dduPayments?.toFixed(1)}%`);
      if (record.timestamp) {
        lines.push(`  Дата: ${format(new Date(record.timestamp), 'dd.MM.yyyy HH:mm')}`);
      }
    });
    lines.push('');
  }

  // Подпись и дата
  lines.push('-'.repeat(100));
  lines.push(`Отчёт создан: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`);
  lines.push('='.repeat(100));

  return lines.join('\n');
}

export async function exportToCSV(project: ConstructionProjects): Promise<string> {
  const rows: string[] = [];

  // Заголовок CSV
  rows.push('Название,Код,Заказчик,Статус,Риск,СМР,ГПР,ДДУ');

  // Данные проекта
  rows.push(
    [
      `"${project.projectName || ''}"`,
      `"${project.code || ''}"`,
      `"${project.customer || ''}"`,
      `"${project.riskLevel || ''}"`,
      `${((project.mlRiskProbability || 0) * 100).toFixed(1)}`,
      `${(project.smrCompletion || 0).toFixed(1)}`,
      `${(project.gprDelayPercent || 0).toFixed(1)}`,
      `${(project.dduPayments || 0).toFixed(1)}`,
    ].join(',')
  );

  // История отчётов
  if (project.reportHistory && project.reportHistory.length > 0) {
    rows.push('');
    rows.push('История отчётов');
    rows.push('Месяц,Период,Статус,СМР,ГПР,ДДУ,ГПР_дней');
    project.reportHistory.forEach((record) => {
      rows.push(
        [
          record.month || '',
          `"${record.reportPeriod || ''}"`,
          record.riskLevel || '',
          record.smrCompletion?.toFixed(1) || '',
          record.gprDelayPercent?.toFixed(1) || '',
          record.dduPayments?.toFixed(1) || '',
          record.gprDelayDays || '',
        ].join(',')
      );
    });
  }

  return rows.join('\n');
}

export function downloadAsText(project: ConstructionProjects, includeHistory = true) {
  const options: ExportOptions = {
    format: 'pdf',
    includeHistory,
    includeFlags: true,
    includeReasons: true,
  };

  const content = generateTextReport(project, options);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.projectName || 'project'}_${format(new Date(), 'yyyy-MM-dd')}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadAsCSV(project: ConstructionProjects) {
  const content = await exportToCSV(project);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.projectName || 'project'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printProject(project: ConstructionProjects) {
  const options: ExportOptions = {
    format: 'pdf',
    includeHistory: true,
    includeFlags: false,
    includeReasons: true,
  };

  const content = generateTextReport(project, options);
  const printWindow = window.open('', '', 'height=600,width=800');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>${project.projectName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; white-space: pre-wrap; }
            h1 { text-align: center; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}
