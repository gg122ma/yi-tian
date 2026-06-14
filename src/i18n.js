/**
 * 一天 · 国际化 (i18n) — 20种语言
 */

export const LANGUAGES = [
  { code:'zh', flag:'🇨🇳', name:'中文' }, { code:'en', flag:'🇬🇧', name:'English' },
  { code:'ja', flag:'🇯🇵', name:'日本語' }, { code:'ko', flag:'🇰🇷', name:'한국어' },
  { code:'fr', flag:'🇫🇷', name:'Français' }, { code:'de', flag:'🇩🇪', name:'Deutsch' },
  { code:'es', flag:'🇪🇸', name:'Español' }, { code:'pt', flag:'🇧🇷', name:'Português' },
  { code:'ru', flag:'🇷🇺', name:'Русский' }, { code:'ar', flag:'🇸🇦', name:'العربية' },
  { code:'th', flag:'🇹🇭', name:'ไทย' }, { code:'vi', flag:'🇻🇳', name:'Tiếng Việt' },
  { code:'id', flag:'🇮🇩', name:'Indonesia' }, { code:'ms', flag:'🇲🇾', name:'Melayu' },
  { code:'tr', flag:'🇹🇷', name:'Türkçe' }, { code:'hi', flag:'🇮🇳', name:'हिन्दी' },
  { code:'pl', flag:'🇵🇱', name:'Polski' }, { code:'nl', flag:'🇳🇱', name:'Nederlands' },
  { code:'it', flag:'🇮🇹', name:'Italiano' }, { code:'sv', flag:'🇸🇪', name:'Svenska' },
];

const translations = {
  zh: { today:'今天',timeline:'时间轴',insights:'洞察',activities:'活动库',habits:'习惯',diary:'日记',profile:'个人',settings:'设置',search:'搜索活动、页面...',hLogged:'小时已记录',gDone:'目标完成',aMood:'平均心情',dStreak:'天连续',h24:'24小时·时间热力条',tDetail:'时间明细',tGoals:'今日目标',hCheck:'习惯打卡',mCurve:'心情与精力曲线',noRec:'今天还没有记录',noGoals:'还没有设置目标',noHab:'还没有习惯',record:'记录',cancel:'取消',create:'创建',save:'保存',darkMode:'暗黑模式',language:'语言',notif:'通知',pref:'偏好',data:'数据管理',about:'关于',newAct:'新建活动',diaryPh:'今天发生了什么...',autoSave:'自动保存',wCount:'字',nickname:'昵称',birthday:'生日',timezone:'时区',motto:'座右铭',aGoal:'年度目标',job:'职业',city:'城市',yReview:'年度回顾',gm:'早上好',ga:'下午好',ge:'晚上好',exportJSON:'导出JSON',importJSON:'导入JSON',saved:'已保存',noRes:'没有找到匹配结果',tDays:'记录天数',tTime:'总记录时间',gRate:'目标完成率',streak:'连续记录',topAct:'最常做的活动',catB:'分类明细',overview:'总览',name:'名称',category:'分类',icon:'图标',color:'颜色' },
  en: { today:'Today',timeline:'Timeline',insights:'Insights',activities:'Activities',habits:'Habits',diary:'Diary',profile:'Profile',settings:'Settings',search:'Search...',hLogged:'hours logged',gDone:'goals done',aMood:'avg mood',dStreak:'day streak',h24:'24h Heatmap',tDetail:'Timeline',tGoals:"Today's Goals",hCheck:'Habits',mCurve:'Mood & Energy',noRec:'No records yet',noGoals:'No goals',noHab:'No habits',record:'Record',cancel:'Cancel',create:'Create',save:'Save',darkMode:'Dark Mode',language:'Language',notif:'Notifications',pref:'Preferences',data:'Data',about:'About',newAct:'New Activity',diaryPh:'What happened today...',autoSave:'Auto-saved',wCount:'words',nickname:'Nickname',birthday:'Birthday',timezone:'Timezone',motto:'Motto',aGoal:'Annual Goal',job:'Job',city:'City',yReview:'Yearly Review',gm:'Good morning',ga:'Good afternoon',ge:'Good evening',exportJSON:'Export JSON',importJSON:'Import JSON',saved:'Saved',noRes:'No results',tDays:'Days',tTime:'Total Time',gRate:'Goal Rate',streak:'Streak',topAct:'Top Activities',catB:'Categories',overview:'Overview',name:'Name',category:'Category',icon:'Icon',color:'Color' },
  ja: { today:'今日',timeline:'タイムライン',insights:'インサイト',activities:'活動',habits:'習慣',diary:'日記',profile:'プロフィール',settings:'設定',search:'検索...',darkMode:'ダークモード',language:'言語',gm:'おはよう',ga:'こんにちは',ge:'こんばんは',save:'保存',cancel:'キャンセル' },
  ko: { today:'오늘',timeline:'타임라인',insights:'인사이트',activities:'활동',habits:'습관',diary:'일기',profile:'프로필',settings:'설정',darkMode:'다크 모드',language:'언어',gm:'좋은 아침',ga:'좋은 오후',ge:'좋은 저녁',save:'저장' },
  fr: { today:"Aujourd'hui",timeline:'Chronologie',insights:'Aperçus',activities:'Activités',habits:'Habitudes',diary:'Journal',profile:'Profil',settings:'Paramètres',darkMode:'Mode sombre',language:'Langue',gm:'Bonjour',ga:"Bon après-midi",ge:'Bonsoir',save:'Sauvegarder' },
  de: { today:'Heute',timeline:'Zeitachse',insights:'Einblicke',activities:'Aktivitäten',habits:'Gewohnheiten',diary:'Tagebuch',profile:'Profil',settings:'Einstellungen',darkMode:'Dunkelmodus',language:'Sprache',gm:'Guten Morgen',ga:'Guten Tag',ge:'Guten Abend',save:'Speichern' },
  es: { today:'Hoy',timeline:'Cronología',insights:'Análisis',activities:'Actividades',habits:'Hábitos',diary:'Diario',profile:'Perfil',settings:'Ajustes',darkMode:'Modo oscuro',language:'Idioma',gm:'Buenos días',ga:'Buenas tardes',ge:'Buenas noches',save:'Guardar' },
  pt: { today:'Hoje',timeline:'Linha do tempo',insights:'Insights',activities:'Atividades',habits:'Hábitos',diary:'Diário',profile:'Perfil',settings:'Config',darkMode:'Modo escuro',language:'Idioma',gm:'Bom dia',ga:'Boa tarde',ge:'Boa noite',save:'Salvar' },
  ru: { today:'Сегодня',timeline:'Хронология',insights:'Аналитика',activities:'Активности',habits:'Привычки',diary:'Дневник',profile:'Профиль',settings:'Настройки',darkMode:'Тёмная тема',language:'Язык',gm:'Доброе утро',ga:'Добрый день',ge:'Добрый вечер',save:'Сохранить' },
  ar: { today:'اليوم',timeline:'جدول',insights:'تحليلات',activities:'أنشطة',habits:'عادات',diary:'يوميات',profile:'ملف',settings:'إعدادات',darkMode:'داكن',language:'لغة',save:'حفظ' },
  th: { today:'วันนี้',timeline:'ไทม์ไลน์',insights:'วิเคราะห์',activities:'กิจกรรม',habits:'นิสัย',diary:'ไดอารี่',settings:'ตั้งค่า',darkMode:'มืด',language:'ภาษา',save:'บันทึก' },
  vi: { today:'Hôm nay',timeline:'Thời gian',insights:'Thống kê',activities:'Hoạt động',habits:'Thói quen',diary:'Nhật ký',settings:'Cài đặt',darkMode:'Tối',language:'Ngôn ngữ',save:'Lưu' },
  id: { today:'Hari ini',timeline:'Timeline',insights:'Wawasan',activities:'Aktivitas',habits:'Kebiasaan',diary:'Diari',settings:'Pengaturan',darkMode:'Gelap',language:'Bahasa',save:'Simpan' },
  ms: { today:'Hari ini',timeline:'Garis masa',insights:'Wawasan',activities:'Aktiviti',habits:'Tabiat',diary:'Diari',settings:'Tetapan',darkMode:'Gelap',language:'Bahasa',save:'Simpan' },
  tr: { today:'Bugün',timeline:'Zaman',insights:'Analiz',activities:'Aktiviteler',habits:'Alışkanlık',diary:'Günlük',settings:'Ayarlar',darkMode:'Karanlık',language:'Dil',save:'Kaydet' },
  hi: { today:'आज',timeline:'टाइमलाइन',insights:'विश्लेषण',activities:'गतिविधि',habits:'आदतें',diary:'डायरी',settings:'सेटिंग्स',darkMode:'डार्क',language:'भाषा',save:'सहेजें' },
  pl: { today:'Dziś',timeline:'Oś czasu',insights:'Analizy',activities:'Aktywności',habits:'Nawyki',diary:'Dziennik',settings:'Ustawienia',darkMode:'Ciemny',language:'Język',save:'Zapisz' },
  nl: { today:'Vandaag',timeline:'Tijdlijn',insights:'Inzichten',activities:'Activiteiten',habits:'Gewoontes',diary:'Dagboek',settings:'Instellingen',darkMode:'Donker',language:'Taal',save:'Opslaan' },
  it: { today:'Oggi',timeline:'Cronologia',insights:'Analisi',activities:'Attività',habits:'Abitudini',diary:'Diario',settings:'Impostazioni',darkMode:'Scuro',language:'Lingua',save:'Salva' },
  sv: { today:'Idag',timeline:'Tidslinje',insights:'Insikter',activities:'Aktiviteter',habits:'Vanor',diary:'Dagbok',settings:'Inställningar',darkMode:'Mörkt',language:'Språk',save:'Spara' },
};

export function t(lang, key) {
  return (translations[lang] && translations[lang][key]) || translations.en[key] || translations.zh[key] || key;
}

export function getLang() {
  return localStorage.getItem('yi_lang') || 'zh';
}

export function setLang(lang) {
  localStorage.setItem('yi_lang', lang);
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
