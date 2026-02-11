import { Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-light-grey mt-20">
      <div className="max-w-[100rem] mx-auto px-8 lg:px-16 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="font-heading text-xl text-deep-black mb-6">
              Мониторинг Проектов
            </h3>
            <p className="font-paragraph text-base text-medium-grey leading-relaxed">
              Система мониторинга государственного жилищного строительства с интеллектуальной оценкой рисков и прогностической аналитикой.
            </p>
          </div>

          <div>
            <h3 className="font-heading text-xl text-deep-black mb-6">
              Контактная Информация
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-1" />
                <div>
                  <p className="font-paragraph text-base text-foreground">
                    shanovadilnaz@gmail.com
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-1" />
                <div>
                  <p className="font-paragraph text-base text-foreground">
                    Астана, Казахстан
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-heading text-xl text-deep-black mb-6">
              Рабочее Время
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-paragraph text-base text-medium-grey">
                  Пн-Пт
                </span>
                <span className="font-paragraph text-base text-foreground">
                  9:00 - 18:00
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-paragraph text-base text-medium-grey">
                  Суббота
                </span>
                <span className="font-paragraph text-base text-foreground">
                  10:00 - 14:00
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-paragraph text-base text-medium-grey">
                  Воскресенье
                </span>
                <span className="font-paragraph text-base text-foreground">
                  Выходной
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-light-grey">
          <p className="font-paragraph text-sm text-medium-grey text-center">
            © {new Date().getFullYear()} Мониторинг Проектов. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
