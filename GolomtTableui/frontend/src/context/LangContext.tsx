'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'mn' | 'en';

const dict = {
  // Sidebar
  'nav.home': { mn: 'Нүүр', en: 'Home' },
  'nav.search': { mn: 'Хайлтын систем', en: 'Search Engine' },
  'nav.alerts': { mn: 'Сэрэмжлүүлэг', en: 'Alerts' },
  'nav.redflag': { mn: 'Улаан туг', en: 'Red Flag' },
  'nav.users': { mn: 'Хэрэглэгчид', en: 'Users' },
  'nav.dashboards': { mn: 'Dashboard тохиргоо', en: 'Dashboard Config' },
  'nav.chains': { mn: 'Chain тохиргоо', en: 'Chain Config' },
  'nav.settings': { mn: 'Тохиргоо', en: 'Settings' },
  'nav.notifications': { mn: 'Мэдэгдэл', en: 'Notifications' },
  'nav.menu': { mn: 'Цэс', en: 'Menu' },
  'nav.admin': { mn: 'Админ', en: 'Admin' },
  'nav.logout': { mn: 'Гарах', en: 'Logout' },

  // Home page
  'home.greeting.morning': { mn: 'Өглөөний мэнд', en: 'Good morning' },
  'home.greeting.afternoon': { mn: 'Өдрийн мэнд', en: 'Good afternoon' },
  'home.greeting.evening': { mn: 'Оройн мэнд', en: 'Good evening' },
  'home.title': { mn: 'Аудитын хяналтын самбар', en: 'Audit Control Panel' },
  'home.search.title': { mn: 'Хайлтын систем', en: 'Search Engine' },
  'home.search.subtitle': { mn: 'CIF хайлт', en: 'CIF Search' },
  'home.search.desc': { mn: '12 dashboard дээр ажилтны CIF ID-аар хайлт хийж, аль dashboard-д илэрч буйг шалгана.', en: 'Search employee CIF ID across 12 dashboards to check which ones they appear in.' },
  'home.alerts.title': { mn: 'Сэрэмжлүүлэг', en: 'Alerts' },
  'home.alerts.subtitle': { mn: 'Олон давхцал', en: 'Multi-overlap' },
  'home.alerts.desc': { mn: '2 ба түүнээс дээш dashboard-д илэрсэн CIF ID-нуудын жагсаалт.', en: 'List of CIF IDs found in 2 or more dashboards.' },
  'home.redflag.title': { mn: 'Улаан туг', en: 'Red Flag' },
  'home.redflag.subtitle': { mn: 'Event Chain', en: 'Event Chain' },
  'home.redflag.desc': { mn: 'Event Chain дүрмийн илэрцүүд. Сэжигтэй хэрэглэгчид.', en: 'Event chain rule matches. Suspicious users.' },
  'home.details': { mn: 'Дэлгэрэнгүй', en: 'Details' },

  // Settings page
  'settings.title': { mn: 'Тохиргоо', en: 'Settings' },
  'settings.subtitle': { mn: 'Системийн тохиргоо', en: 'System preferences' },
  'settings.appearance': { mn: 'Харагдах байдал', en: 'Appearance' },
  'settings.theme': { mn: 'Загвар', en: 'Theme' },
  'settings.dark': { mn: 'Харанхуй', en: 'Dark' },
  'settings.light': { mn: 'Гэрэлтэй', en: 'Light' },
  'settings.language': { mn: 'Хэл', en: 'Language' },
  'settings.mongolian': { mn: 'Монгол', en: 'Mongolian' },
  'settings.english': { mn: 'Англи', en: 'English' },
  'settings.account': { mn: 'Хаяг', en: 'Account' },
  'settings.changePassword': { mn: 'Нууц үг солих', en: 'Change Password' },
  'settings.currentPw': { mn: 'Одоогийн нууц үг', en: 'Current password' },
  'settings.newPw': { mn: 'Шинэ нууц үг', en: 'New password' },
  'settings.confirmPw': { mn: 'Шинэ нууц үг давтах', en: 'Confirm new password' },
  'settings.save': { mn: 'Хадгалах', en: 'Save' },
  'settings.pwChanged': { mn: 'Нууц үг амжилттай солигдлоо', en: 'Password changed successfully' },
  'settings.pwMismatch': { mn: 'Шинэ нууц үг таарахгүй байна', en: 'New passwords do not match' },
  'settings.pwShort': { mn: 'Нууц үг хамгийн багадаа 8 тэмдэгт', en: 'Password must be at least 8 characters' },

  // Dashboard config
  'dashConfig.title': { mn: 'Dashboard тохиргоо', en: 'Dashboard Configuration' },
  'dashConfig.subtitle': { mn: 'Oracle dashboard нэмэх, устгах, идэвхжүүлэх', en: 'Add, remove, or toggle Oracle dashboards' },
  'dashConfig.add': { mn: 'Нэмэх', en: 'Add' },
  'dashConfig.new': { mn: 'Шинэ Dashboard', en: 'New Dashboard' },
  'dashConfig.name': { mn: 'Нэр', en: 'Name' },
  'dashConfig.table': { mn: 'Table нэр', en: 'Table name' },
  'dashConfig.cifCol': { mn: 'CIF багана', en: 'CIF column' },
  'dashConfig.dateCol': { mn: 'Огноо багана', en: 'Date column' },
  'dashConfig.amountCol': { mn: 'Дүн багана', en: 'Amount column' },
  'dashConfig.cancel': { mn: 'Болих', en: 'Cancel' },
  'dashConfig.fillAll': { mn: 'Бүх талбарыг бөглөнө үү', en: 'Please fill in all fields' },
  'dashConfig.empty': { mn: 'Dashboard тохиргоо байхгүй', en: 'No dashboard configurations' },
  'dashConfig.confirmDelete': { mn: 'Устгах уу?', en: 'Delete this item?' },

  // Chain config
  'chainConfig.title': { mn: 'Event Chain тохиргоо', en: 'Event Chain Configuration' },
  'chainConfig.subtitle': { mn: 'Red Flag дүрэм нэмэх, устгах, идэвхжүүлэх', en: 'Add, remove, or toggle Red Flag rules' },
  'chainConfig.add': { mn: 'Нэмэх', en: 'Add' },
  'chainConfig.new': { mn: 'Шинэ Chain', en: 'New Chain' },
  'chainConfig.name': { mn: 'Нэр', en: 'Name' },
  'chainConfig.desc': { mn: 'Тайлбар', en: 'Description' },
  'chainConfig.sourceIds': { mn: 'Source Dashboard IDs', en: 'Source Dashboard IDs' },
  'chainConfig.targetIds': { mn: 'Target Dashboard IDs', en: 'Target Dashboard IDs' },
  'chainConfig.sourceLabel': { mn: 'Source Label', en: 'Source Label' },
  'chainConfig.targetLabel': { mn: 'Target Label', en: 'Target Label' },
  'chainConfig.cancel': { mn: 'Болих', en: 'Cancel' },
  'chainConfig.dashIds': { mn: 'Боломжит Dashboard ID-нууд', en: 'Available Dashboard IDs' },
  'chainConfig.empty': { mn: 'Event Chain тохиргоо байхгүй', en: 'No event chain configurations' },
  'chainConfig.required': { mn: 'Нэр, source IDs, target IDs шаардлагатай', en: 'Name, source IDs, and target IDs are required' },
  'chainConfig.confirmDelete': { mn: 'Устгах уу?', en: 'Delete this item?' },

  // Common
  'common.admin': { mn: 'Админ', en: 'Admin' },
  'common.viewer': { mn: 'Харагч', en: 'Viewer' },
  'common.noNotif': { mn: 'Мэдэгдэл байхгүй', en: 'No notifications' },
  'common.highRisk': { mn: 'маш өндөр эрсдэл', en: 'critical risk' },
  'common.critical': { mn: 'Маш өндөр', en: 'Critical' },
  'common.high': { mn: 'Өндөр', en: 'High' },
} as const;

type DictKey = keyof typeof dict;

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('mn');

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang;
    if (saved === 'mn' || saved === 'en') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
    document.documentElement.lang = l;
  };

  const t = (key: DictKey): string => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang] || entry['mn'];
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be inside LangProvider');
  return ctx;
}
