import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BaseCrudService } from '@/integrations';
import { ConstructionProjects, ProjectHistory } from '@/entities';
import { AlertTriangle, Clock, CheckCircle, ArrowLeft, TrendingUp, Calendar, Download, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { deleteProject } from '@/lib/project-service';
import { compareReports, ReportDiff } from '@/lib/report-diff';
import { generateFlags, Flag, prioritizeFlags } from '@/lib/flags';
import { calculateStatus } from '@/lib/status-calculator';
import { downloadAsText, downloadAsCSV, printProject } from '@/lib/export-service';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ConstructionProjects | null>(null);
  const [history, setHistory] = useState<ProjectHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [diff, setDiff] = useState<ReportDiff | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [manualD, setManualD] = useState<{ d1: boolean; d2: boolean; d3: boolean; d4: boolean }>({ d1: false, d2: false, d3: false, d4: false });
  const [isApplyingManualD, setIsApplyingManualD] = useState(false);
  const [manualStatus, setManualStatus] = useState<string | null>(null);
  const [manualReasons, setManualReasons] = useState<any[]>([]);
  const [additionalCriteria, setAdditionalCriteria] = useState<{
    b2?: boolean;
    b3?: boolean;
    b4?: boolean;
    c?: boolean;
  }>({});
  const [manualGPR, setManualGPR] = useState<number | null>(null);
  const [manualDDUMonthly, setManualDDUMonthly] = useState<{
    m1?: number;
    m2?: number;
    m3?: number;
  }>({});

  useEffect(() => {
    loadProjectData();
  }, [id]);

  // Загружаем ручные критерии d из проекта, если есть
  useEffect(() => {
    if (project && project.manualD) {
      setManualD(project.manualD);
    }
  }, [project]);

  const loadProjectData = async () => {
    if (!id) return;

    try {
      // Сначала проверяем sessionStorage для недавно загруженных проектов
      const analysisDataStr = sessionStorage.getItem(`project-${id}`);
      if (analysisDataStr) {
        try {
          const analysisData = JSON.parse(analysisDataStr);
          // Преобразуем analysisResult в ConstructionProjects объект
          const projectFromAnalysis: ConstructionProjects = {
            _id: id,
            projectName: analysisData.project_info.full_name || 'Unknown Project',
            location: analysisData.project_info.location || '',
            code: analysisData.project_info.code || '',
            reportPeriod: analysisData.project_info.report_period || '',
            smrCompletion: analysisData.metrics.SMR_completion || 0,
            gprDelayPercent: analysisData.metrics.GPR_delay_percent || 0,
            gprDelayDays: analysisData.metrics.GPR_delay_days || 0,
            dduPayments: analysisData.metrics.DDU_payments_percent?.[0] || 0,
            guaranteeExtension: analysisData.metrics.guarantee_extension || false,
            riskLevel: analysisData.project_status === 'критичный' ? 'критичный' 
                     : analysisData.project_status === 'тревожный' ? 'тревожный' 
                     : 'нормальный',
            mlRiskProbability: 0,
            currentStatus: analysisData.metrics.SMR_completion >= 80 ? 'На графике' : 'Отставание',
            scheduleAdherence: 100 - (analysisData.metrics.GPR_delay_percent || 0),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            analysisResult: analysisData,
          };
          setProject(projectFromAnalysis);
          sessionStorage.removeItem(`project-${id}`); // Очищаем после использования
        } catch (parseErr) {
          console.warn('Failed to parse analysis data from sessionStorage:', parseErr);
        }
      }

      // Если не нашли в sessionStorage, грузим из БД
      if (!project) {
        const projectData = await BaseCrudService.getById<ConstructionProjects>('constructionprojects', id);
        setProject(projectData);

        // Рассчитываем diff и флаги если есть история
        if (projectData?.reportHistory && projectData.reportHistory.length > 1) {
          const currentMonth = projectData.reportHistory[0];
          const previousMonth = projectData.reportHistory[1];
          const reportDiff = compareReports(currentMonth, previousMonth);
          setDiff(reportDiff);

          const generatedFlags = generateFlags(projectData, currentMonth, previousMonth);
          setFlags(prioritizeFlags(generatedFlags));
        } else if (projectData?.reportHistory && projectData.reportHistory.length === 1) {
          const currentMonth = projectData.reportHistory[0];
          const generatedFlags = generateFlags(projectData, currentMonth);
          setFlags(prioritizeFlags(generatedFlags));
        }
      }

      const historyResult = await BaseCrudService.getAll<ProjectHistory>('projecthistory');
      const projectHistory = historyResult.items.filter(h => h.projectId === id);
      projectHistory.sort((a, b) => {
        const dateA = a.updateTimestamp ? new Date(a.updateTimestamp).getTime() : 0;
        const dateB = b.updateTimestamp ? new Date(b.updateTimestamp).getTime() : 0;
        return dateB - dateA;
      });
      setHistory(projectHistory);
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Если имя проекта отсутствует или совпадает с кодом — сразу предлагаем ввести вручную
  useEffect(() => {
    if (project && (!project.projectName || project.projectName === project.projectCode)) {
      setIsEditingName(true);
      setEditedName('');
    }
  }, [project]);

  const handleDelete = async () => {
    if (!project?._id) return;
    const ok = window.confirm('Вы уверены, что хотите удалить проект? Это действие необратимо.');
    if (!ok) return;
    try {
      setIsDeleting(true);
      await deleteProject(project._id, true);
      window.location.href = '/projects';
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Не удалось удалить проект. Проверьте консоль.');
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditName = () => {
    setEditedName(project?.projectName || project?.projectName || '');
    setIsEditingName(true);
  };

  const saveEditedName = async () => {
    if (!project) return;
    const updated = { ...project, projectName: editedName, updatedAt: new Date().toISOString() } as any;
    try {
      await BaseCrudService.update('constructionprojects', updated);
      setProject(updated);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to save project name:', err);
      alert('Не удалось сохранить название проекта.');
    }
  };

  // Сохраняем ручные критерии d в проект
  const saveManualD = async (newManualD: typeof manualD) => {
    if (!project) return;
    const updated = { ...project, manualD: newManualD, updatedAt: new Date().toISOString() } as any;
    try {
      await BaseCrudService.update('constructionprojects', updated);
      setProject(updated);
    } catch (err) {
      console.error('Failed to save manualD:', err);
      alert('Не удалось сохранить критерии d.');
    }
  };

  // Пересчёт статуса с учётом ручных критериев d
  const recalculateStatusWithManualD = () => {
    if (!project) return;
    const metrics = project.analysisResult?.metrics || {};
    const result = calculateStatus(metrics, undefined, manualD);
    setManualStatus(result.status);
    setManualReasons(result.reasons);
  };

  // Пересчёт статуса с учётом дополнительных критериев (b2, b3, b4, c) и ГПР
  const recalculateWithAdditional = () => {
    if (!project) return;
    
    // Определяем месячные значения - либо из PDF, либо из ручного ввода
    const dduMonthly = Object.values(manualDDUMonthly).some(v => v !== undefined)
      ? [manualDDUMonthly.m1 ?? 0, manualDDUMonthly.m2 ?? 0, manualDDUMonthly.m3 ?? 0]
      : project.analysisResult?.metrics?.DDU_monthly_values;
    
    const metrics = {
      ...project.analysisResult?.metrics,
      // Добавляем опциональные критерии
      ...(additionalCriteria.b2 ? { builder_delay_days: 31 } : {}),
      ...(additionalCriteria.b3 ? { complaints_count: 2 } : {}),
      ...(additionalCriteria.b4 ? { builder_rating_drop: 20 } : {}),
      ...(additionalCriteria.c ? { GPR_delay_percent: 31 } : {}),
      // Добавляем ГПР и месячные значения для пересчета b6
      ...(manualGPR && dduMonthly && {
        GPR_value: manualGPR,
        DDU_monthly_values: dduMonthly
      })
    };
    const result = calculateStatus(metrics, undefined, manualD);
    setManualStatus(result.status);
    setManualReasons(result.reasons);
  };

  const getRiskIcon = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'критичный':
        return <AlertTriangle className="w-6 h-6 text-warning-red" />;
      case 'тревожный':
        return <Clock className="w-6 h-6 text-primary" />;
      case 'нормальный':
        return <CheckCircle className="w-6 h-6 text-success-green" />;
      default:
        return null;
    }
  };

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'критичный':
        return 'text-warning-red';
      case 'тревожный':
        return 'text-primary';
      case 'нормальный':
        return 'text-success-green';
      default:
        return 'text-medium-grey';
    }
  };

  const getRiskBgColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'критичный':
        return 'bg-warning-red';
      case 'тревожный':
        return 'bg-primary';
      case 'нормальный':
        return 'bg-success-green';
      default:
        return 'bg-light-grey';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="w-full">
        <section className="w-full max-w-[100rem] mx-auto px-8 lg:px-16 pt-12 pb-8">
          <div className="flex items-center justify-between mb-8">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 font-paragraph text-base text-medium-grey hover:text-foreground transition-colors duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться к Проектам
            </Link>
            
            {project && (
              <div className="flex gap-3 items-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => downloadAsText(project)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Download className="w-4 h-4" />
                  TXT
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => downloadAsCSV(project)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => printProject(project)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gold text-white rounded-lg hover:opacity-80 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Печать
                </motion.button>

                {/* Edit name */}
                {!isEditingName ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={startEditName}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-light-grey text-foreground rounded-lg hover:border-primary transition-colors"
                  >
                    Редактировать название
                  </motion.button>
                ) : (
                  <div className="inline-flex items-center gap-2">
                    <input value={editedName} onChange={e => setEditedName(e.target.value)} className="px-3 py-2 border rounded" />
                    <button onClick={saveEditedName} className="px-3 py-2 bg-primary text-white rounded">Сохранить</button>
                    <button onClick={() => setIsEditingName(false)} className="px-3 py-2 border rounded">Отмена</button>
                  </div>
                )}

                {/* Delete */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  {isDeleting ? 'Удаление...' : 'Удалить проект'}
                </motion.button>
              </div>
            )}
          </div>

          <div className="min-h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner />
              </div>
            ) : !project ? (
              <div className="text-center py-20">
                <h2 className="font-heading text-3xl text-deep-black mb-4">
                  Проект не найден
                </h2>
                <p className="font-paragraph text-base text-medium-grey mb-8">
                  Проект, который вы ищете, не существует или был удалён.
                </p>
                <Link
                  to="/projects"
                  className="inline-block px-8 py-4 border border-primary text-primary font-paragraph text-base rounded-md hover:text-accent-gold hover:border-accent-gold transition-colors duration-300"
                >
                  Просмотреть все проекты
                </Link>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {/* Project Header */}
                <div className="bg-white p-10 rounded-lg border border-light-grey mb-8">
                  { (project.needs3Reports || project.analysisResult?.needs3Reports) && (
                    <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <strong>Требуется 3 отчёта:</strong> Для корректной оценки условия B6 необходимо загрузить отчёты за последние 3 месяца. Пока оценка b6 не завершена.
                    </div>
                  )}

                  {/* Ручной ввод критериев d для критического статуса */}
                  {project && project.analysisResult && (
                    <div className="mb-6">
                      <h3 className="font-heading text-lg text-deep-black mb-2">Ручной ввод критериев D (для критического статуса)</h3>
                      <div className="flex flex-col gap-2 mb-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={manualD.d1} onChange={e => {
                            const newD = { ...manualD, d1: e.target.checked };
                            setManualD(newD);
                            saveManualD(newD);
                          }} /> d1: Продление гарантии
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={manualD.d2} onChange={e => {
                            const newD = { ...manualD, d2: e.target.checked };
                            setManualD(newD);
                            saveManualD(newD);
                          }} /> d2: Более 1 обращения дольщиков
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={manualD.d3} onChange={e => {
                            const newD = { ...manualD, d3: e.target.checked };
                            setManualD(newD);
                            saveManualD(newD);
                          }} /> d3: Снижение рейтинга на 20+ баллов
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={manualD.d4} onChange={e => {
                            const newD = { ...manualD, d4: e.target.checked };
                            setManualD(newD);
                            saveManualD(newD);
                          }} /> d4: Просрочка по займам
                        </label>
                      </div>
                      <button onClick={recalculateStatusWithManualD} className="px-4 py-2 bg-primary text-white rounded">Пересчитать статус с учётом D</button>
                      {manualStatus && (
                        <div className="mt-3 p-3 bg-light-grey rounded">
                          <strong>Статус с учётом D:</strong> {manualStatus}
                          <ul className="mt-2 list-disc pl-5">
                            {manualReasons.map((r, i) => (
                              <li key={i}>{r.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ввод ГПР и месячных поступлений для проверки критерия b6 */}
                  {project && (
                    <div className="bg-background p-6 rounded-lg border border-light-grey mb-8">
                      <h3 className="font-heading text-xl text-deep-black mb-4">
                        💰 Проверка критерия B6 (ДДУ)
                      </h3>
                      <p className="text-sm text-medium-grey mb-4">
                        Для проверки критерия B6 введите ГПР (млн тг){project.analysisResult?.metrics?.DDU_monthly_values ? ' — месячные поступления автоматически извлечены из PDF' : ' и месячные поступления по ДДУ'}:
                      </p>
                      
                      <div className="space-y-4 mb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold mb-1">ГПР, млн тг:</label>
                            <input 
                              type="number" 
                              value={manualGPR ?? ''}
                              onChange={e => setManualGPR(e.target.value ? Number(e.target.value) : null)}
                              placeholder="Например: 1200"
                              className="w-full px-3 py-2 border border-light-grey rounded"
                            />
                          </div>
                        </div>
                        
                        {project.analysisResult?.metrics?.DDU_monthly_values && (
                          <div className="p-3 bg-amber-50 rounded border border-amber-200 mb-4">
                            <p className="text-xs font-semibold text-amber-900">⚠️ Важно:</p>
                            <p className="text-xs text-amber-800">Значения М1, М2, М3 из PDF в тенге. Для расчета они автоматически конвертируются в млн тг (разделяются на 1,000,000).</p>
                            <p className="text-xs text-amber-800">ГПР вводите в <span className="font-semibold">миллионах тенге</span>. Например: если ГПР = 3 млрд тг, вводите <span className="font-semibold">3000</span></p>
                          </div>
                        )}
                        
                        {!project.analysisResult?.metrics?.DDU_monthly_values && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white rounded border border-light-grey">
                            <div>
                              <label className="block text-sm font-semibold mb-1">М1 (млн тг):</label>
                              <input 
                                type="number" 
                                value={manualDDUMonthly.m1 ?? ''}
                                onChange={e => setManualDDUMonthly({...manualDDUMonthly, m1: e.target.value ? Number(e.target.value) : undefined})}
                                placeholder="Месяц 1"
                                className="w-full px-3 py-2 border border-light-grey rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold mb-1">М2 (млн тг):</label>
                              <input 
                                type="number" 
                                value={manualDDUMonthly.m2 ?? ''}
                                onChange={e => setManualDDUMonthly({...manualDDUMonthly, m2: e.target.value ? Number(e.target.value) : undefined})}
                                placeholder="Месяц 2"
                                className="w-full px-3 py-2 border border-light-grey rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold mb-1">М3 (млн тг):</label>
                              <input 
                                type="number" 
                                value={manualDDUMonthly.m3 ?? ''}
                                onChange={e => setManualDDUMonthly({...manualDDUMonthly, m3: e.target.value ? Number(e.target.value) : undefined})}
                                placeholder="Месяц 3"
                                className="w-full px-3 py-2 border border-light-grey rounded text-sm"
                              />
                            </div>
                          </div>
                        )}
                        
                        {(project.analysisResult?.metrics?.DDU_monthly_values || Object.values(manualDDUMonthly).some(v => v !== undefined)) && manualGPR && (
                          <div className="p-4 bg-blue-50 rounded border border-blue-200">
                            <p className="text-sm font-semibold text-blue-900 mb-3">Расчет накопленных доль ДДУ от ГПР:</p>
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-blue-300">
                                  <th className="text-left p-2 font-semibold">Месяц</th>
                                  <th className="text-right p-2 font-semibold">Месячно (млн тг)</th>
                                  <th className="text-right p-2 font-semibold">Накопленно (млн тг)</th>
                                  <th className="text-right p-2 font-semibold">Доля от ГПР (%)</th>
                                  <th className="text-center p-2 font-semibold">Порог</th>
                                  <th className="text-center p-2 font-semibold">Статус</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Конвертируем значения из тг в млн тг (разделяем на 1,000,000)
                                  const m1_mln = (project.analysisResult?.metrics?.DDU_monthly_values?.[0] ?? manualDDUMonthly.m1 ?? 0) / 1_000_000;
                                  const m2_mln = (project.analysisResult?.metrics?.DDU_monthly_values?.[1] ?? manualDDUMonthly.m2 ?? 0) / 1_000_000;
                                  const m3_mln = (project.analysisResult?.metrics?.DDU_monthly_values?.[2] ?? manualDDUMonthly.m3 ?? 0) / 1_000_000;
                                  
                                  const rows = [
                                    { month: 'М1', monthly: m1_mln, cumulative: m1_mln, threshold: 70 },
                                    { month: 'М1+М2', monthly: m2_mln, cumulative: m1_mln + m2_mln, threshold: 60 },
                                    { month: 'М1+М2+М3', monthly: m3_mln, cumulative: m1_mln + m2_mln + m3_mln, threshold: 50 }
                                  ];
                                  
                                  return rows.map((row, idx) => {
                                    const share = (row.cumulative / manualGPR) * 100;
                                    const isMet = share < row.threshold;
                                    return (
                                      <tr key={idx} className="border-b border-blue-200 hover:bg-blue-100">
                                        <td className="p-2">{row.month}</td>
                                        <td className="text-right p-2">{row.monthly.toFixed(2)}</td>
                                        <td className="text-right p-2 font-semibold">{row.cumulative.toFixed(2)}</td>
                                        <td className="text-right p-2 font-semibold">{share.toFixed(1)}%</td>
                                        <td className="text-center p-2">&lt; {row.threshold}%</td>
                                        <td className="text-center p-2">{isMet ? '✓' : '✗'}</td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                            {manualGPR && (
                              <p className="text-xs text-blue-800 mt-2">
                                <span className="font-semibold">ГПР:</span> {manualGPR.toFixed(0)} млн тг | 
                                {(() => {
                                  const m1_mln = (project.analysisResult?.metrics?.DDU_monthly_values?.[0] ?? manualDDUMonthly.m1 ?? 0) / 1_000_000;
                                  const m2_mln = (project.analysisResult?.metrics?.DDU_monthly_values?.[1] ?? manualDDUMonthly.m2 ?? 0) / 1_000_000;
                                  const m3_mln = (project.analysisResult?.metrics?.DDU_monthly_values?.[2] ?? manualDDUMonthly.m3 ?? 0) / 1_000_000;
                                  const sum3 = m1_mln + m2_mln + m3_mln;
                                  const c1 = m1_mln / manualGPR * 100 < 70;
                                  const c2 = (m1_mln + m2_mln) / manualGPR * 100 < 60;
                                  const c3 = sum3 / manualGPR * 100 < 50;
                                  return (
                                    <>
                                      <span className="font-semibold"> Сумма поступлений:</span> {sum3.toFixed(2)} млн тг |
                                      <span className="font-semibold"> Все три условия выполнены:</span> {c1 && c2 && c3 ? '✓ ДА' : '✗ НЕТ'}
                                    </>
                                  );
                                })()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Дополнительные критерии для уточнения статуса */}
                  {project && (
                    <div className="bg-background p-6 rounded-lg border border-light-grey mb-8">
                      <h3 className="font-heading text-xl text-deep-black mb-4">
                        📋 Дополнительные критерии (опционально)
                      </h3>
                      <p className="text-sm text-medium-grey mb-4">
                        Укажите дополнительные условия для уточнения классификации статуса:
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <label className="flex items-center gap-2 p-3 border border-light-grey rounded-lg hover:bg-white transition">
                          <input 
                            type="checkbox" 
                            checked={additionalCriteria.b2 || false}
                            onChange={e => setAdditionalCriteria({...additionalCriteria, b2: e.target.checked})}
                          /> 
                          <span className="text-sm">b2: Просрочка по займам &gt; 30 дней</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 border border-light-grey rounded-lg hover:bg-white transition">
                          <input 
                            type="checkbox" 
                            checked={additionalCriteria.b3 || false}
                            onChange={e => setAdditionalCriteria({...additionalCriteria, b3: e.target.checked})}
                          /> 
                          <span className="text-sm">b3: Более 1 жалобы дольщиков</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 border border-light-grey rounded-lg hover:bg-white transition">
                          <input 
                            type="checkbox" 
                            checked={additionalCriteria.b4 || false}
                            onChange={e => setAdditionalCriteria({...additionalCriteria, b4: e.target.checked})}
                          /> 
                          <span className="text-sm">b4: Снижение рейтинга на 20+ баллов</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 border border-light-grey rounded-lg hover:bg-white transition">
                          <input 
                            type="checkbox" 
                            checked={additionalCriteria.c || false}
                            onChange={e => setAdditionalCriteria({...additionalCriteria, c: e.target.checked})}
                          /> 
                          <span className="text-sm">c: Отставание от ГПР &gt; 30%</span>
                        </label>
                      </div>

                      <button 
                        onClick={() => recalculateWithAdditional()}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
                      >
                        Пересчитать статус с доп. критериями
                      </button>
                      {manualStatus && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                          <strong>Уточненный статус:</strong> <span className="text-lg font-bold">{manualStatus}</span>
                          <ul className="mt-2 list-disc pl-5 text-sm">
                            {manualReasons.map((r, i) => (
                              <li key={i}>{r.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        {getRiskIcon(project.riskLevel)}
                        <span className={`font-paragraph text-sm uppercase tracking-wider ${getRiskColor(project.riskLevel)}`}>
                          {project.riskLevel === 'критичный' ? 'Высокий' : project.riskLevel === 'тревожный' ? 'Средний' : 'Низкий'} риск
                        </span>
                      </div>
                      <h1 className="font-heading text-5xl text-deep-black mb-4">
                        {isEditingName ? (
                          <div className="flex gap-2 items-center">
                            <input
                              value={editedName}
                              onChange={e => setEditedName(e.target.value)}
                              className="px-3 py-2 border rounded text-2xl"
                              placeholder="Введите название проекта"
                              autoFocus
                            />
                            <button onClick={saveEditedName} className="px-3 py-2 bg-primary text-white rounded">Сохранить</button>
                            <button onClick={() => setIsEditingName(false)} className="px-3 py-2 border rounded">Отмена</button>
                          </div>
                        ) : (
                          <span>{project.projectName}</span>
                        )}
                      </h1>
                      <p className="font-paragraph text-lg text-medium-grey mb-6">
                        {project.location}
                      </p>
                      {project.description && (
                        <p className="font-paragraph text-base text-foreground leading-relaxed">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-8 border-t border-light-grey">
                    <div>
                      <p className="font-paragraph text-sm text-medium-grey mb-2">
                        Текущий статус
                      </p>
                      <p className="font-paragraph text-lg text-foreground">
                        {project.currentStatus}
                      </p>
                    </div>
                    <div>
                      <p className="font-paragraph text-sm text-medium-grey mb-2">
                        ML Risk Probability
                      </p>
                      <p className="font-paragraph text-lg text-foreground">
                        {((project.mlRiskProbability || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="font-paragraph text-sm text-medium-grey mb-2">
                        Budget Adherence
                      </p>
                      <p className="font-paragraph text-lg text-foreground">
                        {(project.budgetAdherence || 0).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="font-paragraph text-sm text-medium-grey mb-2">
                        Schedule Adherence
                      </p>
                      <p className="font-paragraph text-lg text-foreground">
                        {(project.scheduleAdherence || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* ML Prediction Explanation */}
                <div className="bg-white p-10 rounded-lg border border-light-grey mb-8">
                  <h2 className="font-heading text-3xl text-deep-black mb-6">
                    📊 Анализ оценки рисков
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-paragraph text-base text-medium-grey">
                          Вероятность риска
                        </span>
                        <span className="font-paragraph text-base text-foreground">
                          {((project.mlRiskProbability || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-3 bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${getRiskBgColor(project.riskLevel)}`}
                          style={{ width: `${(project.mlRiskProbability || 0) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-medium-grey mt-2">
                        Система оценивает риск на основе условий A–D: рассматриваются % завершения СМР, задержка по графику, темп поступлений по ДДУ и другие факторы.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                      <div>
                        <h3 className="font-paragraph text-lg text-deep-black mb-4">
                          ✅ Ключевые факторы
                        </h3>
                        <ul className="space-y-3">
                          <li className="flex items-start gap-3">
                            <TrendingUp className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                              <p className="font-paragraph text-base text-foreground">
                                Соответствие бюджету (ГПР)
                              </p>
                              <p className="font-paragraph text-sm text-medium-grey">
                                Формула: 100% − % задержки = {(100 - (project.gprDelayPercent || 0)).toFixed(1)}%
                              </p>
                              <p className="font-paragraph text-xs text-medium-grey mt-1">
                                {(project.gprDelayPercent || 0) >= 10
                                  ? '⚠️ Плановые работы идут с отставанием'
                                  : '✓ Плановые работы выполняются в срок'}
                              </p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                              <p className="font-paragraph text-base text-foreground">
                                Соответствие графику (СМР)
                              </p>
                              <p className="font-paragraph text-sm text-medium-grey">
                                Формула: Процент готовности строительно-монтажных работ = {(project.smrCompletion || 0).toFixed(1)}%
                              </p>
                              <p className="font-paragraph text-xs text-medium-grey mt-1">
                                {(project.smrCompletion || 0) >= 80
                                  ? '✓ Строительство логично идёт по плану'
                                  : '⚠️ Требуется ускорение строительства'}
                              </p>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-paragraph text-lg text-deep-black mb-4">
                          💼 Рекомендация
                        </h3>
                        <div className="bg-background p-6 rounded-lg">
                          <p className="font-paragraph text-base text-foreground leading-relaxed">
                            {project.riskLevel === 'критичный'
                              ? '🔴 КРИТИЧНЫЙ СТАТУС — требуется немедленное вмешательство. Рекомендуется перераспределение ресурсов, встречи со стейкхолдерами и плановое ускорение работ.'
                              : project.riskLevel === 'тревожный'
                              ? '🟡 ТРЕВОЖНЫЙ СТАТУС — требуется внимание. Реализуйте профилактические меры: ускорьте СМР, увеличьте поступления по ДДУ, свяжитесь с подрядчиком.'
                              : '🟢 НОРМАЛЬНЫЙ СТАТУС — проект в порядке. Продолжайте текущее управление.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Manual D flags (user input) */}
                  <div className="bg-white p-6 rounded-lg border border-light-grey mb-6">
                    <h3 className="font-heading text-lg text-deep-black mb-3">Ручные флаги (d1–d4)</h3>
                    <p className="font-paragraph text-sm text-medium-grey mb-4">Если автоматические данные неполные или вы хотите указать критические события вручную — отметьте соответствующие пункты и нажмите «Применить».</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={manualD.d1} onChange={e => setManualD(s => ({ ...s, d1: e.target.checked }))} />
                        <span>d1 — продление гарантии / гарантийный случай</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={manualD.d2} onChange={e => setManualD(s => ({ ...s, d2: e.target.checked }))} />
                        <span>d2 — жалобы дольщиков &gt;1</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={manualD.d3} onChange={e => setManualD(s => ({ ...s, d3: e.target.checked }))} />
                        <span>d3 — снижение рейтинга ≥20</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={manualD.d4} onChange={e => setManualD(s => ({ ...s, d4: e.target.checked }))} />
                        <span>d4 — просрочка по займам (есть)</span>
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          if (!project) return;
                          try {
                            setIsApplyingManualD(true);
                            // Собираем метрики из analysisResult / project
                            const metrics = project.analysisResult?.metrics || {
                              SMR_completion: project.smrCompletion || 0,
                              GPR_delay_percent: project.gprDelayPercent || 0,
                              GPR_delay_days: project.gprDelayDays || 0,
                              DDU_payments_percent: project.analysisResult?.metrics?.DDU_payments_percent || (project.dduPayments ? [project.dduPayments] : []),
                              guarantee_extension: project.guaranteeExtension || false,
                              builder_delay_days: project.gprDelayDays || 0,
                              builder_rating_drop: 0,
                              complaints_count: 0,
                              debt_to_equity: 0,
                            };

                            const res = calculateStatus(metrics as any, project.reportHistory as any, manualD as any);

                            // Обновляем проект локально и в mock DB
                            const updated = {
                              ...project,
                              riskLevel: res.status,
                              statusReasons: res.reasons || project.statusReasons,
                              mlRiskProbability: res.mlRiskProbability || project.mlRiskProbability,
                              updatedAt: new Date().toISOString(),
                              manualDFlags: manualD,
                            } as any;

                            await BaseCrudService.update('constructionprojects', updated);
                            setProject(updated);
                            alert('Ручные флаги применены и статус пересчитан');
                          } catch (err) {
                            console.error('Failed to apply manual D flags:', err);
                            alert('Не удалось применить ручные флаги. Смотрите консоль.');
                          } finally {
                            setIsApplyingManualD(false);
                          }
                        }}
                        disabled={isApplyingManualD}
                        className="px-4 py-2 bg-primary text-white rounded-lg"
                      >
                        {isApplyingManualD ? 'Применение...' : 'Применить и пересчитать'}
                      </button>
                      <button onClick={() => setManualD({ d1: false, d2: false, d3: false, d4: false })} className="px-4 py-2 border rounded">Сбросить</button>
                    </div>
                  </div>

                  {/* Status Reasons */}
                {project.statusReasons && project.statusReasons.length > 0 && (
                  <div className="bg-white p-10 rounded-lg border border-light-grey mb-8">
                    <h2 className="font-heading text-3xl text-deep-black mb-6">
                      📋 Логика определения статуса
                    </h2>
                    
                    {/* Reference Table for Condition Formulas */}
                    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6">
                      <h3 className="font-paragraph font-semibold text-sm text-deep-black mb-3">📐 Формулы расчёта условий:</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white p-3 rounded border-l-2 border-blue-500">
                          <p><span className="font-semibold">A:</span> СМР от ГПР</p>
                          <p className="text-medium-grey">Если СМР &lt; 80% → КРИТИЧНЫЕ</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-2 border-blue-500">
                          <p><span className="font-semibold">b1:</span> Отставание ГПР</p>
                          <p className="text-medium-grey font-mono text-xs">Отставание(%) = (Дни отставания / Нормативный срок) × 100</p>
                          <p className="text-medium-grey mt-1">Если результат &gt; 30% → ТРЕВОЖНО</p>
                          <p className="text-amber-700 mt-1">Пример: 450 дней / 570 дней = 78.9%</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-2 border-blue-500">
                          <p><span className="font-semibold">b6:</span> Накопленные ДДУ</p>
                          <p className="text-medium-grey">Если (М1+М2+М3)/ГПР &lt; 50% → КРИТИЧНЫЕ</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-2 border-blue-500">
                          <p><span className="font-semibold">C:</span> ГПР отточенй</p>
                          <p className="text-medium-grey">Если отставание &gt; 30% → КРИТИЧНЫЕ</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {project.statusReasons.map((reason, idx) => {
                        const isExplanation = reason.condition === 'explanation' || reason.condition === 'critical_explanation';
                        const isMet = reason.condition?.includes('_met') || reason.condition === 'A' || reason.condition?.startsWith('b') || reason.condition === 'c';
                        const isNotMet = reason.condition?.includes('_not_met');
                        
                        let bgColor = 'bg-blue-50 border-l-blue-500';
                        if (isExplanation || isNotMet) {
                          bgColor = 'bg-amber-50 border-l-amber-500';
                        }
                        if (isMet && !isExplanation) {
                          bgColor = 'bg-green-50 border-l-green-500';
                        }
                        
                        let conditionExplanation = '';
                        if (reason.condition === 'b1') {
                          conditionExplanation = `Дни отставания от ГПР конвертируются в проценты относительно нормативного срока строительства. Формула: (дни отставания / нормативный срок в днях) × 100. Если результат > 30%, это ТРЕВОЖНОЕ состояние.`;
                        } else if (reason.condition === 'b6') {
                          conditionExplanation = 'Сумма поступлений по ДДУ за 3 месяца (М1+М2+М3) делится на ГПР: если результат < 50%, это критично';
                        } else if (reason.condition === 'A') {
                          conditionExplanation = 'Процент завершения строительно-монтажных работ извлекается из PDF таблицы';
                        }
                        
                        return (
                          <div key={idx} className={`p-3 ${bgColor} rounded border-l-4`}>
                            <p className="font-paragraph text-sm text-foreground">
                              {reason.reason}
                            </p>
                            {conditionExplanation && (
                              <p className="text-xs text-medium-grey mt-1 italic">
                                💡 {conditionExplanation}
                              </p>
                            )}
                            {reason.metric && (
                              <div className="text-xs text-medium-grey space-y-0.5 mt-2">
                                {reason.value !== undefined && (
                                  <p>
                                    <span className="font-semibold">Значение:</span> {reason.value}
                                  </p>
                                )}
                                {reason.threshold !== undefined && (
                                  <p>
                                    <span className="font-semibold">Порог:</span> {reason.threshold}
                                  </p>
                                )}
                                {reason.change !== undefined && (
                                  <p>
                                    <span className="font-semibold">Изменение:</span>{' '}
                                    {reason.change > 0 ? '+' : ''}
                                    {reason.change.toFixed(1)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Analysis Details */}
                {project.analysisResult && (
                  <div className="bg-white p-10 rounded-lg border border-light-grey mb-8">
                    <h2 className="font-heading text-3xl text-deep-black mb-6">
                      Результаты Анализа
                    </h2>
                    <div className="space-y-6">
                      {/* Metrics Details */}
                      <div>
                        <h3 className="font-heading text-lg text-deep-black mb-4">Ключевые Метрики</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="p-4 bg-background rounded-lg">
                            <p className="font-paragraph text-sm text-medium-grey mb-2">Завершение СМР</p>
                            <p className="font-heading text-2xl text-deep-black">
                              {typeof project.analysisResult.metrics?.SMR_completion === 'number' 
                                ? project.analysisResult.metrics.SMR_completion.toFixed(1) 
                                : 'N/A'}%
                            </p>
                          </div>
                          <div className="p-4 bg-background rounded-lg">
                            <p className="font-paragraph text-sm text-medium-grey mb-2">Отставание ГПР</p>
                            <p className="font-heading text-2xl text-deep-black">
                              {typeof project.analysisResult.metrics?.GPR_delay_percent === 'number' 
                                ? project.analysisResult.metrics.GPR_delay_percent.toFixed(1) 
                                : 'N/A'}%
                            </p>
                          </div>
                          <div className="p-4 bg-background rounded-lg">
                            <p className="font-paragraph text-sm text-medium-grey mb-2">Платежи по ДДУ</p>
                            <p className="font-heading text-2xl text-deep-black">
                              {typeof project.analysisResult.metrics?.DDU_payments_percent?.[0] === 'number' 
                                ? project.analysisResult.metrics.DDU_payments_percent[0].toFixed(1) 
                                : 'N/A'}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Analysis Details */}
                      {project.analysisResult.reasoning && project.analysisResult.reasoning.length > 0 && (
                        <div>
                          <h3 className="font-heading text-lg text-deep-black mb-4">Детали Анализа</h3>
                          <div className="space-y-3">
                            {project.analysisResult.reasoning.map((reason, idx) => (
                              <p key={idx} className="font-paragraph text-sm text-foreground">
                                {reason}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Report History Timeline */}
                {project.reportHistory && project.reportHistory.length > 0 && (
                  <div className="bg-white p-10 rounded-lg border border-light-grey mb-8">
                    <h2 className="font-heading text-3xl text-deep-black mb-8">
                      История Отчётов (последние 3 месяца)
                    </h2>
                    <div className="space-y-6">
                      {project.reportHistory.slice(0, 3).map((entry, idx) => (
                        <motion.div
                          key={`${entry.month}-${idx}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: idx * 0.1 }}
                          className="border-l-4 border-primary pl-6 pb-6 relative"
                        >
                          <div className="absolute left-0 top-0 w-4 h-4 bg-primary rounded-full -translate-x-2.5" />

                          <div className="mb-4">
                            <p className="font-paragraph text-sm text-medium-grey mb-1">
                              Период: {entry.reportPeriod}
                            </p>
                            <h3 className="font-heading text-xl text-deep-black flex items-center gap-3 mb-3">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  entry.riskLevel === 'критичный'
                                    ? 'bg-warning-red text-white'
                                    : entry.riskLevel === 'тревожный'
                                    ? 'bg-primary text-white'
                                    : 'bg-success-green text-white'
                                }`}
                              >
                                {entry.riskLevel === 'критичный'
                                  ? '🔴 Критичный'
                                  : entry.riskLevel === 'тревожный'
                                  ? '🟡 Тревожный'
                                  : '🟢 Нормальный'}
                              </span>
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-background p-4 rounded-lg">
                            <div>
                              <p className="text-xs text-medium-grey font-semibold uppercase mb-2">СМР</p>
                              <p className="font-heading text-lg text-deep-black">
                                {(entry.smrCompletion ?? 0).toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-medium-grey font-semibold uppercase mb-2">ГПР</p>
                              <p className="font-heading text-lg text-deep-black">
                                {(entry.gprDelayPercent ?? 0).toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-medium-grey font-semibold uppercase mb-2">ДДУ</p>
                              {entry.dduMonthlyValues && entry.dduMonthlyValues.length > 0 ? (
                                <div className="space-y-1">
                                  {entry.dduMonthlyValues.slice(0, 3).map((val, i) => (
                                    <p key={i} className="font-heading text-sm text-deep-black">
                                      М{i+1}: {(val / 1_000_000).toFixed(2)} млн тг
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="font-heading text-lg text-deep-black">
                                  {(entry.dduPayments ?? 0).toFixed(1)}%
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-medium-grey font-semibold uppercase mb-2">
                                ГПР дней
                              </p>
                              <p className="font-heading text-lg text-deep-black">{entry.gprDelayDays ?? 0}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PDF Reports */}
                {project.pdfReports && project.pdfReports.length > 0 && (
                  <div className="bg-white p-10 rounded-lg border border-light-grey mb-8">
                    <h2 className="font-heading text-3xl text-deep-black mb-8">
                      📄 Загруженные PDF Отчёты (по месяцам)
                    </h2>
                    <div className="space-y-4">
                      {project.reportHistory && project.reportHistory.length > 0 ? (
                        project.reportHistory.slice(0, 3).map((historyEntry, idx) => {
                          // Ищем соответствующий PDF по месяцу
                          const pdfReport = project.pdfReports?.find(p => p.month === historyEntry.month);
                          return (
                            <motion.div
                              key={`${historyEntry.month}-${idx}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.4, delay: idx * 0.1 }}
                              className="border border-light-grey rounded-lg p-6 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm text-medium-grey mb-1">
                                    Период: {historyEntry.reportPeriod}
                                  </p>
                                  {pdfReport ? (
                                    <>
                                      <h3 className="font-heading text-lg text-deep-black mb-2">
                                        {pdfReport.fileName}
                                      </h3>
                                      <p className="text-xs text-medium-grey">
                                        Загружен: {format(new Date(pdfReport.uploadedAt), 'dd.MM.yyyy HH:mm')}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-medium-grey italic">
                                      📄 PDF отчёт для этого месяца не загружен
                                    </p>
                                  )}
                                </div>
                                {pdfReport && (
                                  <a
                                    href={pdfReport.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                                  >
                                    📥 Загрузить
                                  </a>
                                )}
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        project.pdfReports.map((report, idx) => (
                          <motion.div
                            key={`${report.month}-${idx}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: idx * 0.1 }}
                            className="border border-light-grey rounded-lg p-6 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm text-medium-grey mb-1">
                                  Период: {report.reportPeriod}
                                </p>
                                <h3 className="font-heading text-lg text-deep-black mb-2">
                                  {report.fileName}
                                </h3>
                                <p className="text-xs text-medium-grey">
                                  Загружен: {format(new Date(report.uploadedAt), 'dd.MM.yyyy HH:mm')}
                                </p>
                              </div>
                              <a
                                href={report.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                              >
                                📥 Загрузить
                              </a>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-white p-10 rounded-lg border border-light-grey">
                  <h2 className="font-heading text-3xl text-deep-black mb-8">
                    📜 История изменения статуса
                  </h2>
                  {history.length === 0 ? (
                    <p className="font-paragraph text-base text-medium-grey text-center py-8">
                      Нет записей об изменении статуса.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {history.map((record, index) => (
                        <motion.div
                          key={record._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          className="border-l-2 border-light-grey pl-8 pb-6 relative"
                        >
                          <div className="absolute left-0 top-0 w-3 h-3 bg-accent-gold rounded-full -translate-x-[7px]" />
                          
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              {record.updateTimestamp && (
                                <p className="font-paragraph text-sm text-medium-grey mb-2">
                                  {format(new Date(record.updateTimestamp), 'dd.MM.yyyy • HH:mm')}
                                </p>
                              )}
                              <h3 className="font-paragraph text-lg text-deep-black">
                                {record.statusChangeDescription || 'Обновление статуса'}
                              </h3>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            {record.previousProjectStatus && record.currentProjectStatus && (
                              <div>
                                <p className="font-paragraph text-sm text-medium-grey mb-1">
                                  Изменение статуса проекта
                                </p>
                                <p className="font-paragraph text-base text-foreground">
                                  {record.previousProjectStatus} → {record.currentProjectStatus}
                                </p>
                              </div>
                            )}
                            {record.previousRiskLevel && record.currentRiskLevel && (
                              <div>
                                <p className="font-paragraph text-sm text-medium-grey mb-1">
                                  Изменение уровня риска
                                </p>
                                <p className="font-paragraph text-base text-foreground">
                                  {record.previousRiskLevel} → {record.currentRiskLevel}
                                </p>
                              </div>
                            )}
                            {record.mlPrediction && (
                              <div>
                                <p className="font-paragraph text-sm text-medium-grey mb-1">
                                  Предсказание
                                </p>
                                <p className="font-paragraph text-base text-foreground">
                                  {record.mlPrediction}
                                </p>
                              </div>
                            )}
                            {record.mlPredictionConfidence != null && (
                              <div>
                                <p className="font-paragraph text-sm text-medium-grey mb-1">
                                  Уверенность предсказания
                                </p>
                                <p className="font-paragraph text-base text-foreground">
                                  {(record.mlPredictionConfidence * 100).toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* НОВАЯ СЕКЦИЯ: Флаги и Предупреждения */}
                {flags.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12"
                  >
                    <h2 className="font-heading text-2xl text-deep-black mb-6">🚩 Флаги и Предупреждения</h2>
                    <div className="space-y-3">
                      {flags.map((flag, idx) => (
                        <motion.div
                          key={flag.id}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className={`p-4 rounded-lg border-l-4 ${
                            flag.type === 'critical'
                              ? 'bg-red-50 border-red-500'
                              : flag.type === 'warning'
                              ? 'bg-yellow-50 border-yellow-500'
                              : 'bg-green-50 border-green-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{flag.icon}</span>
                            <div>
                              <h3 className="font-bold text-sm">{flag.title}</h3>
                              <p className="text-sm text-medium-grey mt-1">{flag.description}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* НОВАЯ СЕКЦИЯ: Сравнение Отчётов (Diff) */}
                {diff && diff.changes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12"
                  >
                    <h2 className="font-heading text-2xl text-deep-black mb-6">📊 Изменение метрик месяц-к-месяцу</h2>
                    
                    {diff.monthPrevious && (
                      <p className="text-sm text-medium-grey mb-6">
                        Сравнение: {diff.monthCurrent} vs {diff.monthPrevious}
                        {diff.overallTrend === 'improving' && ' ✅ (улучшение)'}
                        {diff.overallTrend === 'degrading' && ' ⚠️ (ухудшение)'}
                      </p>
                    )}

                    {diff.warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        {diff.warnings.map((warning, idx) => (
                          <p key={idx} className="text-sm text-amber-900 mb-1">
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {diff.changes.map((change, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-paragraph font-semibold text-sm">{change.metric}</h3>
                            <span className="text-xl">{change.icon}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-medium-grey">Было</p>
                              <p className="text-base font-bold">
                                {change.previous !== null && change.previous !== undefined ? (change.previous).toFixed(1) + '%' : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-medium-grey">Стало</p>
                              <p className="text-base font-bold">{(change.current ?? 0).toFixed(1)}%</p>
                            </div>
                            <div className={`p-2 rounded text-sm font-semibold ${
                              change.trend === 'improved' 
                                ? 'bg-green-100 text-green-800'
                                : change.trend === 'degraded'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {change.change > 0 ? '+' : ''}{change.change.toFixed(1)}% ({change.changePercent.toFixed(1)}%)
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

