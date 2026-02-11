import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BaseCrudService } from '@/integrations';
import { ConstructionProjects } from '@/entities';
import { AlertTriangle, Clock, CheckCircle, ArrowUpDown, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { analysisResultToProject } from '@/lib/analysis-to-project';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type SortField = 'projectName' | 'riskLevel' | 'mlRiskProbability' | 'budgetAdherence' | 'scheduleAdherence';
type SortOrder = 'asc' | 'desc';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ConstructionProjects[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ConstructionProjects[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('mlRiskProbability');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [projects, searchQuery, riskFilter, statusFilter, sortField, sortOrder]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      
      console.log('Loading projects from backend...');
      
      // Загружаем загруженные отчеты (результаты анализа)
      let projectsFromReports: ConstructionProjects[] = [];
      try {
        const reportsResult = await BaseCrudService.getAll<any>('projectreports');
        console.log('Reports loaded:', reportsResult.items.length);
        
        // Преобразуем результаты анализа в проекты
        projectsFromReports = reportsResult.items
          .filter(report => report.analysisResult)  // Только отчеты с результатами анализа
          .map(report => {
            try {
              const project = analysisResultToProject(report.analysisResult, report._id);
              console.log('Converted report to project:', project.projectName);
              return project;
            } catch (err) {
              console.error('Failed to convert report:', err);
              return null;
            }
          })
          .filter(p => p !== null) as ConstructionProjects[];
          
        console.log('Projects from reports:', projectsFromReports.length);
      } catch (reportsErr) {
        console.error('Error loading reports:', reportsErr);
      }
      
      // Загружаем существующие проекты из БД
      let existingProjects: ConstructionProjects[] = [];
      try {
        const existingResult = await BaseCrudService.getAll<ConstructionProjects>('constructionprojects');
        existingProjects = existingResult.items || [];
        console.log('Existing projects:', existingProjects.length);
      } catch (existingErr) {
        console.error('Error loading existing projects:', existingErr);
      }
      
      // Объединяем проекты, избегая дубликатов по названию
      const projectMap = new Map<string, ConstructionProjects>();
      
      // Сначала добавляем существующие проекты
      existingProjects.forEach(p => {
        projectMap.set(p.projectName || '', p);
      });
      
      // Затем добавляем/обновляем проекты из отчетов
      projectsFromReports.forEach(p => {
        // If analyzer indicates needs3Reports, append marker to name or set flag in object
        if ((p as any).needs3Reports) {
          (p as any).projectName = `${p.projectName} (Требуется 3 отчёта)`;
        }
        projectMap.set(p.projectName, p);
      });
      
      const allProjects = Array.from(projectMap.values());
      console.log('Total projects after merge:', allProjects.length);
      
      setProjects(allProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        p =>
          p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(p => p.riskLevel === riskFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.currentStatus === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'riskLevel') {
        const riskOrder = { 'критичный': 3, 'тревожный': 2, 'нормальный': 1 };
        aValue = riskOrder[aValue as keyof typeof riskOrder] || 0;
        bValue = riskOrder[bValue as keyof typeof riskOrder] || 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }

      if (aValue == null) aValue = 0;
      if (bValue == null) bValue = 0;

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredProjects(filtered);
  };

  const getRiskIcon = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'критичный':
        return <AlertTriangle className="w-5 h-5 text-warning-red" />;
      case 'тревожный':
        return <Clock className="w-5 h-5 text-primary" />;
      case 'нормальный':
        return <CheckCircle className="w-5 h-5 text-success-green" />;
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

  const uniqueStatuses = Array.from(new Set(projects.map(p => p.currentStatus).filter(Boolean)));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="w-full">
        <section className="w-full max-w-[100rem] mx-auto px-8 lg:px-16 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-heading text-5xl text-deep-black mb-4">
              Строительные Проекты
            </h1>
            <p className="font-paragraph text-lg text-medium-grey">
              Мониторинг и анализ всех активных строительных проектов
            </p>
          </motion.div>
        </section>

        {/* Filters */}
        <section className="w-full bg-white border-y border-light-grey py-8">
          <div className="max-w-[100rem] mx-auto px-8 lg:px-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="font-paragraph text-sm text-medium-grey mb-2 block">
                  Поиск Проектов
                </label>
                <Input
                  type="text"
                  placeholder="Наименование проекта или расположение..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-paragraph text-sm text-medium-grey mb-2 block">
                  Уровень Риска
                </label>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все уровни" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все уровни риска</SelectItem>
                    <SelectItem value="критичный">Критичный</SelectItem>
                    <SelectItem value="тревожный">Тревожный</SelectItem>
                    <SelectItem value="нормальный">Нормальный</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-paragraph text-sm text-medium-grey mb-2 block">
                  Статус
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {uniqueStatuses.map(status => (
                      <SelectItem key={status} value={status!}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-paragraph text-sm text-medium-grey mb-2 block">
                  Sort By
                </label>
                <Select
                  value={`${sortField}-${sortOrder}`}
                  onValueChange={value => {
                    const [field, order] = value.split('-');
                    setSortField(field as SortField);
                    setSortOrder(order as SortOrder);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlRiskProbability-desc">Risk (High to Low)</SelectItem>
                    <SelectItem value="mlRiskProbability-asc">Risk (Low to High)</SelectItem>
                    <SelectItem value="projectName-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="projectName-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="budgetAdherence-asc">Budget (Low to High)</SelectItem>
                    <SelectItem value="budgetAdherence-desc">Budget (High to Low)</SelectItem>
                    <SelectItem value="scheduleAdherence-asc">Schedule (Low to High)</SelectItem>
                    <SelectItem value="scheduleAdherence-desc">Schedule (High to Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Projects Table */}
        <section className="w-full max-w-[100rem] mx-auto px-8 lg:px-16 py-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoading ? 0 : 1 }}
            transition={{ duration: 0.8 }}
            className="min-h-[600px]"
          >
            {isLoading ? null : filteredProjects.length === 0 ? (
              <div className="text-center py-20">
                <Filter className="w-16 h-16 text-light-grey mx-auto mb-6" />
                <h3 className="font-heading text-2xl text-deep-black mb-3">
                  No Projects Found
                </h3>
                <p className="font-paragraph text-base text-medium-grey">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-light-grey overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background border-b border-light-grey">
                      <tr>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          Риск
                        </th>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          Название проекта
                        </th>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          Расположение
                        </th>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          Статус
                        </th>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          Уверенность ИИ
                        </th>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          Бюджет
                        </th>
                        <th className="px-8 py-5 text-left font-paragraph text-sm text-medium-grey font-normal">
                          График
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map((project, index) => (
                        <motion.tr
                          key={project._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="border-b border-light-grey hover:bg-background transition-colors duration-200"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              {getRiskIcon(project.riskLevel)}
                              <span className={`font-paragraph text-sm ${getRiskColor(project.riskLevel)}`}>
                                {project.riskLevel}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <Link
                              to={`/projects/${project._id}`}
                              className="font-paragraph text-base text-deep-black hover:text-accent-gold transition-colors duration-300"
                            >
                              {project.projectName}
                            </Link>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-paragraph text-base text-medium-grey">
                              {project.location}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-paragraph text-sm text-foreground">
                              {project.currentStatus}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-paragraph text-base text-foreground">
                              {((project.mlRiskProbability || 0) * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-paragraph text-base text-foreground">
                              {(project.budgetAdherence || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-paragraph text-base text-foreground">
                              {(project.scheduleAdherence || 0).toFixed(1)}%
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
