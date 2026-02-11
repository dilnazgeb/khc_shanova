import { useEffect, useState } from 'react';
import { BaseCrudService } from '@/integrations';
import { ConstructionProjects } from '@/entities';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface DashboardStats {
  totalProjects: number;
  criticalProjects: number;
  warningProjects: number;
  normalProjects: number;
  averageRiskScore: number;
}

export default function MasterDashboardPage() {
  const [projects, setProjects] = useState<ConstructionProjects[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'критичный' | 'тревожный' | 'нормальный'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'risk' | 'updated' | 'smr'>('name');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const result = await BaseCrudService.getAll<ConstructionProjects>('constructionprojects', [], { limit: 1000 });
      const projectsList = result.items || [];
      setProjects(projectsList);

      // Рассчитываем статистику
      const critical = projectsList.filter(p => p.riskLevel === 'критичный').length;
      const warning = projectsList.filter(p => p.riskLevel === 'тревожный').length;
      const normal = projectsList.filter(p => p.riskLevel === 'нормальный').length;
      const avgRisk = projectsList.length > 0
        ? projectsList.reduce((sum, p) => sum + (p.mlRiskProbability || 0), 0) / projectsList.length
        : 0;

      setStats({
        totalProjects: projectsList.length,
        criticalProjects: critical,
        warningProjects: warning,
        normalProjects: normal,
        averageRiskScore: avgRisk,
      });
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = filterStatus === 'all'
    ? projects
    : projects.filter(p => p.riskLevel === filterStatus);

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.projectName || '').localeCompare(b.projectName || '');
      case 'risk':
        return (b.mlRiskProbability || 0) - (a.mlRiskProbability || 0);
      case 'updated':
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      case 'smr':
        return (a.smrCompletion || 0) - (b.smrCompletion || 0);
      default:
        return 0;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'критичный':
        return '🔴 критичный';
      case 'тревожный':
        return '🟡 тревожный';
      case 'нормальный':
        return '🟢 нормальный';
      default:
        return '⚪ неизвестен';
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk > 0.6) return 'text-red-600 bg-red-50';
    if (risk > 0.35) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <LoadingSpinner />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Заголовок */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="font-heading text-4xl text-deep-black mb-2">📊 Главный Дашборд</h1>
          <p className="font-paragraph text-lg text-medium-grey">
            Обзор всех проектов и их статусов
          </p>
        </motion.div>

        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 bg-blue-50 rounded-lg border border-blue-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-medium-grey">Всего проектов</p>
                  <p className="text-3xl font-bold text-deep-black">{stats.totalProjects}</p>
                </div>
                <Activity className="w-8 h-8 text-primary opacity-30" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-red-50 rounded-lg border border-red-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-medium-grey">Критичные</p>
                  <p className="text-3xl font-bold text-red-600">{stats.criticalProjects}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500 opacity-30" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-yellow-50 rounded-lg border border-yellow-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-medium-grey">Тревожные</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.warningProjects}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-yellow-500 opacity-30" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-green-50 rounded-lg border border-green-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-medium-grey">Нормальные</p>
                  <p className="text-3xl font-bold text-green-600">{stats.normalProjects}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500 opacity-30" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="p-6 bg-purple-50 rounded-lg border border-purple-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-medium-grey">Средний риск</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {(stats.averageRiskScore * 100).toFixed(0)}%
                  </p>
                </div>
                <Activity className="w-8 h-8 text-purple-500 opacity-30" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Фильтры и сортировка */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div>
            <label className="text-sm text-medium-grey mr-2">Фильтр:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-primary"
            >
              <option value="all">Все проекты</option>
              <option value="критичный">🔴 Критичные</option>
              <option value="тревожный">🟡 Тревожные</option>
              <option value="нормальный">🟢 Нормальные</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-medium-grey mr-2">Сортировка:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-primary"
            >
              <option value="name">По названию</option>
              <option value="risk">По риску (выше)</option>
              <option value="updated">По дате обновления</option>
              <option value="smr">По СМР (меньше)</option>
            </select>
          </div>
        </div>

        {/* Таблица проектов */}
        {sortedProjects.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="overflow-x-auto"
          >
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left p-4 font-bold text-deep-black">Проект</th>
                  <th className="text-left p-4 font-bold text-deep-black">Статус</th>
                  <th className="text-center p-4 font-bold text-deep-black">Риск</th>
                  <th className="text-center p-4 font-bold text-deep-black">СМР</th>
                  <th className="text-center p-4 font-bold text-deep-black">ГПР</th>
                  <th className="text-center p-4 font-bold text-deep-black">ДДУ</th>
                  <th className="text-center p-4 font-bold text-deep-black">Действие</th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((project, idx) => (
                  <motion.tr
                    key={project._id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-deep-black">
                          {project.projectName || 'Unknown'}
                        </p>
                        <p className="text-xs text-medium-grey">
                          {project.location || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-sm font-semibold">
                        {getStatusBadge(project.riskLevel || 'unknown')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskColor(project.mlRiskProbability || 0)}`}>
                        {((project.mlRiskProbability || 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-sm font-semibold">
                        {(project.smrCompletion || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-sm font-semibold">
                        {(project.gprDelayPercent || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-sm font-semibold">
                        {(project.dduPayments || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Link
                        to={`/projects/${project._id}`}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block text-sm font-semibold"
                      >
                        Подробнее →
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-medium-grey">
              {filterStatus === 'all'
                ? 'Проектов не найдено. Загрузите первый отчёт.'
                : 'Нет проектов с выбранным статусом.'}
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
