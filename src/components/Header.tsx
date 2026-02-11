import { Link, useLocation } from 'react-router-dom';
import { Image } from '@/components/ui/image';

export default function Header() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="w-full bg-white border-b border-light-grey sticky top-0 z-50">
      <div className="max-w-[100rem] mx-auto px-8 lg:px-16 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-300">
            <Image
              src="/лого.png"
              alt="Логотип"
              className="h-10 w-auto"
              width={40}
            />
            <span className="font-heading text-2xl text-deep-black">
              Мониторинг Проектов
            </span>
          </Link>

          <nav className="flex items-center gap-8">
            <Link
              to="/"
              className={`font-paragraph text-base transition-colors duration-300 ${
                isActive('/')
                  ? 'text-accent-gold'
                  : 'text-medium-grey hover:text-foreground'
              }`}
            >
              Главная
            </Link>
            <Link
              to="/dashboard"
              className={`font-paragraph text-base transition-colors duration-300 ${
                isActive('/dashboard')
                  ? 'text-accent-gold'
                  : 'text-medium-grey hover:text-foreground'
              }`}
            >
              📊 Дашборд
            </Link>
            <Link
              to="/projects"
              className={`font-paragraph text-base transition-colors duration-300 ${
                isActive('/projects') || location.pathname.startsWith('/projects/')
                  ? 'text-accent-gold'
                  : 'text-medium-grey hover:text-foreground'
              }`}
            >
              Проекты
            </Link>
            <Link
              to="/upload"
              className={`font-paragraph text-base transition-colors duration-300 ${
                isActive('/upload')
                  ? 'text-accent-gold'
                  : 'text-medium-grey hover:text-foreground'
              }`}
            >
              Загрузить Отчеты
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
