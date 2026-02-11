// HPI 1.7-G
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BaseCrudService } from '@/integrations';
import { ConstructionProjects } from '@/entities';
import { AlertTriangle, TrendingUp, CheckCircle, Clock, ArrowRight, Activity, BarChart3, ShieldCheck } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Image } from '@/components/ui/image';

// --- Types ---
interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  delay?: number;
}

interface ProjectCardProps {
  project: ConstructionProjects;
  index: number;
}

// --- Components ---

const StatCard = ({ icon, value, label, delay = 0 }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-start p-8 border-l border-light-grey/30 hover:bg-white/50 transition-colors duration-500"
    >
      <div className="mb-6 text-accent-gold">{icon}</div>
      <span className="font-heading text-5xl lg:text-6xl text-deep-black mb-2 tracking-tight">
        {value}
      </span>
      <span className="font-paragraph text-sm text-medium-grey uppercase tracking-widest">
        {label}
      </span>
    </motion.div>
  );
};

const ProjectCard = ({ project, index }: ProjectCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full bg-white border border-light-grey/50 overflow-hidden hover:border-accent-gold/30 transition-all duration-500"
    >
      <div className="aspect-[4/3] w-full overflow-hidden relative">
        <div className="absolute inset-0 bg-deep-black/10 group-hover:bg-deep-black/0 transition-colors duration-500 z-10" />
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full h-full"
        >
          <Image
            src="https://static.wixstatic.com/media/243b45_67c1a59833cd4eb3b130fade5e21a0b8~mv2.png?originWidth=768&originHeight=576"
            alt={project.projectName || "Project Image"}
            className="w-full h-full object-cover"
            width={800}
          />
        </motion.div>
        <div className="absolute top-4 right-4 z-20">
          <span className={`px-3 py-1 text-xs font-paragraph uppercase tracking-wider bg-white/90 backdrop-blur-sm border ${
            project.riskLevel === 'критичный' ? 'text-warning-red border-warning-red' : 
            project.riskLevel === 'тревожный' ? 'text-primary border-primary' : 
            'text-success-green border-success-green'
          }`}>
            {project.riskLevel}
          </span>
        </div>
      </div>
      
      <div className="p-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-heading text-2xl text-deep-black mb-1 group-hover:text-primary transition-colors duration-300">
              {project.projectName}
            </h3>
            <p className="font-paragraph text-sm text-medium-grey">
              {project.location}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-light-grey/30">
          <div>
            <p className="font-paragraph text-xs text-medium-grey mb-1 uppercase tracking-wider">Статус</p>
            <p className="font-paragraph text-sm text-deep-black">{project.currentStatus}</p>
          </div>
          <div>
            <p className="font-paragraph text-xs text-medium-grey mb-1 uppercase tracking-wider">Risk Level</p>
            <p className="font-paragraph text-sm text-deep-black">
              {((project.mlRiskProbability || 0) * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Link 
            to={`/projects/${project._id}`}
            className="inline-flex items-center gap-2 font-paragraph text-sm text-deep-black hover:text-accent-gold transition-colors duration-300"
          >
            Подробнее <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default function HomePage() {
  const [projects, setProjects] = useState<ConstructionProjects[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const result = await BaseCrudService.getAll<ConstructionProjects>('constructionprojects');
      setProjects(result.items);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Derived Data
  const highRiskProjects = projects.filter(p => p.riskLevel === 'критичный');
  const mediumRiskProjects = projects.filter(p => p.riskLevel === 'тревожный');
  const lowRiskProjects = projects.filter(p => p.riskLevel === 'нормальный');
  const onScheduleProjects = projects.filter(p => (p.scheduleAdherence || 0) >= 90);
  const onBudgetProjects = projects.filter(p => (p.budgetAdherence || 0) >= 90);

  const avgBudgetAdherence = projects.length > 0
    ? projects.reduce((sum, p) => sum + (p.budgetAdherence || 0), 0) / projects.length
    : 0;

  const avgScheduleAdherence = projects.length > 0
    ? projects.reduce((sum, p) => sum + (p.scheduleAdherence || 0), 0) / projects.length
    : 0;

  return (
    <div ref={containerRef} className="min-h-screen bg-background font-paragraph text-foreground selection:bg-accent-gold selection:text-white overflow-clip">
      <Header />
      
      <main className="w-full">
        {/* --- Hero Section --- */}
        <section className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden">
          {/* Parallax Background */}
          <motion.div 
            style={{ y }}
            className="absolute inset-0 w-full h-[120%] z-0"
          >
            <Image
              src="https://static.wixstatic.com/media/243b45_4da9ad9f58004138b7531956d26d8df5~mv2.png?originWidth=1152&originHeight=640"
              alt="Construction Site Aerial"
              className="w-full h-full object-cover opacity-20 grayscale contrast-125"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/50 to-background" />
          </motion.div>

          {/* Hero Content */}
          <div className="relative z-10 w-full max-w-[120rem] mx-auto px-8 lg:px-16 pt-20">
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="inline-block py-2 px-4 mb-8 border border-deep-black/20 rounded-full font-paragraph text-xs uppercase tracking-[0.2em] text-deep-black/70 backdrop-blur-sm">
                  Развитие жилищного строительства
                </span>
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="font-heading text-6xl md:text-8xl lg:text-9xl text-deep-black mb-8 leading-[0.9] tracking-tighter"
              >
                Точность <br/> контроля
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-2xl font-paragraph text-lg md:text-xl text-secondary/80 leading-relaxed mb-12"
              >
                Интеллектуальный мониторинг сложной инфраструктуры. 
                Полная прозрачность состояния проектов. Анализ финансовых данных и автоматическая классификация рисков.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col sm:flex-row gap-6"
              >
                <Link
                  to="/projects"
                  className="group relative px-8 py-4 bg-deep-black text-white overflow-hidden rounded-sm transition-all hover:bg-accent-gold duration-300"
                >
                  <span className="relative z-10 font-paragraph text-sm uppercase tracking-widest">Перейти на панель</span>
                </Link>
                <Link
                  to="/upload"
                  className="px-8 py-4 border border-deep-black/20 text-deep-black hover:border-deep-black transition-colors duration-300 rounded-sm"
                >
                  <span className="font-paragraph text-sm uppercase tracking-widest">Загрузить отчеты</span>
                </Link>
              </motion.div>
            </div>
          </div>
          
          {/* Scroll Indicator */}
          <motion.div 
            style={{ opacity }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="font-paragraph text-[10px] uppercase tracking-widest text-medium-grey">Прокрутить</span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-deep-black/0 via-deep-black/30 to-deep-black/0" />
          </motion.div>
        </section>

        {/* --- Statistics Ticker --- */}
        <section className="w-full border-y border-light-grey/50 bg-white/50 backdrop-blur-sm">
          <div className="max-w-[120rem] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-light-grey/50">
              <StatCard 
                icon={<Activity className="w-6 h-6" />}
                value={projects.length}
                label="Активные проекты"
                delay={0.1}
              />
              <StatCard 
                icon={<AlertTriangle className="w-6 h-6 text-warning-red" />}
                value={highRiskProjects.length}
                label="Критические риски"
                delay={0.2}
              />
              <StatCard 
                icon={<ShieldCheck className="w-6 h-6 text-success-green" />}
                value={lowRiskProjects.length}
                label="Стабильное состояние"
                delay={0.3}
              />
              <StatCard 
                icon={<BarChart3 className="w-6 h-6 text-primary" />}
                value={`${avgBudgetAdherence.toFixed(0)}%`}
                label="Соблюдение бюджета"
                delay={0.4}
              />
            </div>
          </div>
        </section>

        {/* --- Methodology Section (New Narrative) --- */}
        <section className="w-full py-32 px-8 lg:px-16 bg-background">
          <div className="max-w-[100rem] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
              <div className="lg:col-span-4 sticky top-32">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                >
                  <h2 className="font-heading text-5xl text-deep-black mb-6">Анализ в реальном <br/> времени</h2>
                  <div className="w-12 h-1 bg-accent-gold mb-8" />
                  <p className="font-paragraph text-lg text-medium-grey leading-relaxed">
                    Комплексная система мониторинга проектов на основе анализа финансовых отчетов 
и автоматической классификации рисков.
                  </p>
                </motion.div>
              </div>
              
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { title: "Ввод данных", desc: "Загрузите PDF отчеты о ходе строительства и финансовых показателях проектов." },
                  { title: "Распознавание паттернов", desc: "Система автоматически парсит таблицы и извлекает ключевые метрики: СМР%, ГПР%, ДДУ." },
                  { title: "Классификация рисков", desc: "Классификация проектов по 4 уровням риска (Критичный/Тревожный/Нормальный/Информационный)" },
                  { title: "Управление и отслеживание", desc: "История всех отчётов и автоматическое оповещение о критических изменениях статуса." }
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                    className="p-8 bg-white border border-light-grey/40 hover:border-accent-gold/50 transition-colors duration-300"
                  >
                    <span className="block font-heading text-2xl text-accent-gold mb-4">0{idx + 1}</span>
                    <h3 className="font-heading text-2xl text-deep-black mb-3">{item.title}</h3>
                    <p className="font-paragraph text-sm text-medium-grey leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- Performance Metrics (Sticky Layout) --- */}
        <section className="w-full py-32 bg-white border-t border-light-grey/30">
          <div className="max-w-[100rem] mx-auto px-8 lg:px-16">
            <div className="flex flex-col lg:flex-row gap-20">
              {/* Sticky Header */}
              <div className="lg:w-1/3">
                <div className="sticky top-32">
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                  >
                    <h2 className="font-heading text-5xl text-deep-black mb-6">
                      Метрики <br/> производительности
                    </h2>
                    <p className="font-paragraph text-lg text-medium-grey mb-12">
                      Анализ бюджетного распределения и соблюдения расписания по всему государственному портфелю в реальном времени.
                    </p>
                    
                    <div className="space-y-8">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="font-paragraph text-sm uppercase tracking-wider text-deep-black">Эффективность бюджета</span>
                          <span className="font-paragraph text-sm text-deep-black">{avgBudgetAdherence.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1 bg-light-grey/30">
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: `${avgBudgetAdherence}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="h-full bg-deep-black" 
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="font-paragraph text-sm uppercase tracking-wider text-deep-black">Соблюдение расписания</span>
                          <span className="font-paragraph text-sm text-deep-black">{avgScheduleAdherence.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1 bg-light-grey/30">
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: `${avgScheduleAdherence}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "circOut", delay: 0.2 }}
                            className="h-full bg-accent-gold" 
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="lg:w-2/3">
                <div className="grid grid-cols-1 gap-8">
                  {/* Featured High Performance Projects */}
                  {onScheduleProjects.slice(0, 3).map((project, idx) => (
                    <motion.div
                      key={project._id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className="flex flex-col md:flex-row gap-8 p-8 bg-background border border-light-grey/30"
                    >
                      <div className="w-full md:w-48 h-32 shrink-0">
                        <Image
                          src="https://static.wixstatic.com/media/243b45_d0362d1db338467294e9fe548c2c2ae2~mv2.png?originWidth=384&originHeight=256"
                          alt="Project Thumbnail"
                          className="w-full h-full object-cover grayscale"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-heading text-2xl text-deep-black">{project.projectName}</h3>
                          <span className="px-2 py-1 bg-success-green/10 text-success-green text-xs uppercase tracking-wider">По плану</span>
                        </div>
                        <p className="font-paragraph text-sm text-medium-grey mb-4">{project.location}</p>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <span className="block text-xs text-medium-grey uppercase tracking-wider mb-1">Budget</span>
                            <span className="block font-paragraph text-lg text-deep-black">{project.budgetAdherence}%</span>
                          </div>
                          <div>
                            <span className="block text-xs text-medium-grey uppercase tracking-wider mb-1">Schedule</span>
                            <span className="block font-paragraph text-lg text-deep-black">{project.scheduleAdherence}%</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Project Gallery (Grid) --- */}
        <section className="w-full py-32 bg-background">
          <div className="max-w-[120rem] mx-auto px-8 lg:px-16">
            <div className="flex justify-between items-end mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="font-heading text-5xl text-deep-black mb-4">Активные <br/> Проекты</h2>
                <div className="w-24 h-[1px] bg-deep-black" />
              </motion.div>
              
              <Link to="/projects" className="hidden md:flex items-center gap-2 text-deep-black hover:text-accent-gold transition-colors duration-300">
                <span className="font-paragraph text-sm uppercase tracking-widest">View All Projects</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {isLoading ? (
                // Loading Skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-full h-[500px] bg-light-grey/20 animate-pulse" />
                ))
              ) : (
                projects.slice(0, 6).map((project, index) => (
                  <ProjectCard key={project._id} project={project} index={index} />
                ))
              )}
            </div>
            
            <div className="mt-16 flex justify-center md:hidden">
              <Link to="/projects" className="px-8 py-4 border border-deep-black text-deep-black font-paragraph text-sm uppercase tracking-widest">
                View All Projects
              </Link>
            </div>
          </div>
        </section>

        {/* --- Critical Alerts Section --- */}
        {highRiskProjects.length > 0 && (
          <section className="w-full py-32 bg-deep-black text-white">
            <div className="max-w-[100rem] mx-auto px-8 lg:px-16">
              <div className="flex flex-col lg:flex-row gap-16">
                <div className="lg:w-1/3">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 rounded-full bg-warning-red/20 text-warning-red">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <span className="font-paragraph text-sm text-warning-red uppercase tracking-widest">Требуется действие</span>
                    </div>
                    <h2 className="font-heading text-5xl text-white mb-6">
                      Обнаружены <br/> критические риски
                    </h2>
                    <p className="font-paragraph text-lg text-white/60 mb-8">
                      Эти проекты требуют немедленного внимания из-за критических статус-индикаторов. Пересмотрите детальный анализ и примите необходимые меры для управления рисками.
                    </p>
                    <Link 
                      to="/projects?filter=high-risk"
                      className="inline-block px-8 py-4 bg-white text-deep-black hover:bg-accent-gold hover:text-white transition-colors duration-300 font-paragraph text-sm uppercase tracking-widest"
                    >
                      Просмотреть все риски
                    </Link>
                  </motion.div>
                </div>

                <div className="lg:w-2/3">
                  <div className="space-y-4">
                    {highRiskProjects.slice(0, 4).map((project, idx) => (
                      <motion.div
                        key={project._id}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                      >
                        <Link 
                          to={`/projects/${project._id}`}
                          className="block group p-6 border border-white/10 hover:border-warning-red/50 hover:bg-white/5 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <h3 className="font-heading text-2xl text-white mb-1 group-hover:text-warning-red transition-colors">{project.projectName}</h3>
                              <p className="font-paragraph text-sm text-white/50">{project.location}</p>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-right">
                                <span className="block text-xs text-white/40 uppercase tracking-wider mb-1">Risk Probability</span>
                                <span className="block font-paragraph text-xl text-warning-red">
                                  {((project.mlRiskProbability || 0) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-2 transition-all" />
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}