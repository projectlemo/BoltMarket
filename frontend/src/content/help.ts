/** Help Center articles (EN/AR). Searchable client-side; categories drive the filters. */
export type HelpCategory = 'account' | 'funding' | 'trading' | 'funded' | 'security' | 'partners';

type LS = { en: string; ar: string };

export const helpCategories: { id: HelpCategory; label: LS }[] = [
  { id: 'account', label: { en: 'Account & verification', ar: 'الحساب والتحقق' } },
  { id: 'funding', label: { en: 'Deposits & withdrawals', ar: 'الإيداع والسحب' } },
  { id: 'trading', label: { en: 'Trading & platforms', ar: 'التداول والمنصات' } },
  { id: 'funded', label: { en: 'Bolt Funded', ar: 'برنامج التمويل' } },
  { id: 'security', label: { en: 'Security', ar: 'الأمان' } },
  { id: 'partners', label: { en: 'Partners', ar: 'الشركاء' } },
];

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  q: LS;
  a: LS;
}

export const helpArticles: HelpArticle[] = [
  {
    id: 'open-account',
    category: 'account',
    q: { en: 'How do I open an account?', ar: 'كيف أفتح حسابًا؟' },
    a: {
      en: 'Select Create account, enter your full name, email, country of residence and a password, and accept the terms. Confirm your email with the link we send you, then log in to the client portal to verify your identity and open a live or demo MetaTrader 5 account.',
      ar: 'اختر «إنشاء حساب» وأدخل اسمك الكامل وبريدك الإلكتروني ودولة إقامتك وكلمة مرور، ثم وافق على الشروط. أكّد بريدك عبر الرابط الذي نرسله إليك، ثم سجّل الدخول إلى بوابة العملاء للتحقق من هويتك وفتح حساب ميتاتريدر 5 حقيقي أو تجريبي.',
    },
  },
  {
    id: 'kyc-documents',
    category: 'account',
    q: { en: 'Which documents do I need to verify my identity?', ar: 'ما المستندات المطلوبة للتحقق من هويتي؟' },
    a: {
      en: 'A clear photo or scan of a valid government-issued photo ID (passport, national ID card or driving licence, front and back where applicable) and a proof of address issued within the last three months, such as a utility bill or bank statement showing your name and address. We may also ask for a selfie holding your ID.',
      ar: 'صورة واضحة أو نسخة ممسوحة من هوية حكومية سارية تحمل صورتك (جواز سفر أو بطاقة هوية وطنية أو رخصة قيادة، الوجهان عند الحاجة)، وإثبات عنوان صادر خلال آخر ثلاثة أشهر مثل فاتورة خدمات أو كشف حساب بنكي يظهر اسمك وعنوانك. وقد نطلب أيضًا صورة شخصية وأنت تحمل هويتك.',
    },
  },
  {
    id: 'kyc-time',
    category: 'account',
    q: { en: 'How long does verification take?', ar: 'كم يستغرق التحقق من الهوية؟' },
    a: {
      en: 'Our compliance team reviews submissions in the order they arrive. You receive an email as soon as your status changes, and you can follow it on the Verification page of the portal. Clear, uncropped photos where all four corners are visible are the fastest way through.',
      ar: 'يراجع فريق الامتثال الطلبات حسب ترتيب وصولها، وتصلك رسالة بالبريد فور تغيّر حالتك، ويمكنك متابعتها من صفحة «التحقق» في البوابة. الصور الواضحة غير المقصوصة التي تظهر فيها الزوايا الأربع هي أسرع طريق لإتمام التحقق.',
    },
  },
  {
    id: 'change-details',
    category: 'account',
    q: { en: 'Can I change my name, email or country?', ar: 'هل يمكنني تغيير اسمي أو بريدي أو دولتي؟' },
    a: {
      en: 'Open a support ticket from the portal. Changes to verified details require supporting documents and are reviewed by compliance before they take effect.',
      ar: 'افتح تذكرة دعم من البوابة. تتطلب التغييرات على البيانات الموثّقة مستندات داعمة، ويراجعها فريق الامتثال قبل اعتمادها.',
    },
  },
  {
    id: 'deposit-methods',
    category: 'funding',
    q: { en: 'Which deposit methods can I use?', ar: 'ما وسائل الإيداع المتاحة؟' },
    a: {
      en: 'Debit and credit cards and cryptocurrency, as listed on the Deposit page of your portal. Card payments are processed on a secure page hosted by our payment provider; crypto deposits use an invoice with a unique address. Availability can depend on your country.',
      ar: 'البطاقات المدينة والائتمانية والعملات الرقمية، كما تظهر في صفحة «الإيداع» في بوابتك. تُعالَج مدفوعات البطاقات عبر صفحة آمنة يستضيفها مزوّد الدفع، وتستخدم إيداعات العملات الرقمية فاتورة بعنوان فريد. قد يختلف التوفر بحسب دولتك.',
    },
  },
  {
    id: 'deposit-time',
    category: 'funding',
    q: { en: 'When will my deposit appear in MetaTrader 5?', ar: 'متى يظهر إيداعي في ميتاتريدر 5؟' },
    a: {
      en: 'Card deposits are credited as soon as the payment provider confirms the payment. Crypto deposits are credited after the required number of network confirmations. You can follow every deposit on the Transactions page.',
      ar: 'تُضاف إيداعات البطاقات فور تأكيد مزوّد الدفع للعملية، وتُضاف إيداعات العملات الرقمية بعد عدد التأكيدات المطلوب على الشبكة. يمكنك متابعة كل إيداع من صفحة «المعاملات».',
    },
  },
  {
    id: 'withdraw',
    category: 'funding',
    q: { en: 'How do I withdraw funds?', ar: 'كيف أسحب أموالي؟' },
    a: {
      en: 'Go to Withdraw in the portal, choose the trading account, amount and method and submit. Your identity must be verified first. The finance team reviews each request; the amount is deducted from your MT5 balance when the request is approved, and you are notified when the payment is sent.',
      ar: 'انتقل إلى «السحب» في البوابة، واختر حساب التداول والمبلغ والوسيلة ثم أرسل الطلب. يجب التحقق من هويتك أولًا. تراجع إدارة المالية كل طلب، ويُخصم المبلغ من رصيد ميتاتريدر 5 عند الموافقة، وتصلك رسالة عند إرسال الدفعة.',
    },
  },
  {
    id: 'same-method',
    category: 'funding',
    q: { en: 'Why are withdrawals returned to my original payment method?', ar: 'لماذا تُعاد السحوبات إلى وسيلة الدفع الأصلية؟' },
    a: {
      en: 'Anti-money-laundering rules require funds to go back to the source they came from wherever possible. Profits above the deposited amount can be paid to another verified method in your name.',
      ar: 'تتطلب قواعد مكافحة غسل الأموال إعادة الأموال إلى مصدرها متى أمكن ذلك. ويمكن دفع الأرباح التي تتجاوز المبلغ المودَع إلى وسيلة أخرى موثّقة باسمك.',
    },
  },
  {
    id: 'mt5-login',
    category: 'trading',
    q: { en: 'How do I log in to MetaTrader 5?', ar: 'كيف أسجّل الدخول إلى ميتاتريدر 5؟' },
    a: {
      en: 'Open MetaTrader 5 and choose File → Login to Trade Account (on mobile: Settings → New Account). Enter the login number and password of your MT5 account and select the server name shown next to the account in the portal.',
      ar: 'افتح ميتاتريدر 5 واختر «ملف» ← «تسجيل الدخول إلى حساب تداول» (على الجوال: «الإعدادات» ← «حساب جديد»). أدخل رقم الدخول وكلمة مرور حساب ميتاتريدر 5، واختر اسم الخادم الظاهر بجانب الحساب في البوابة.',
    },
  },
  {
    id: 'mt5-password',
    category: 'trading',
    q: { en: 'I forgot my MT5 password', ar: 'نسيت كلمة مرور ميتاتريدر 5' },
    a: {
      en: 'Go to Accounts in the portal, open the account menu and choose Reset trading password. The new password is shown once on screen; store it somewhere safe.',
      ar: 'انتقل إلى «الحسابات» في البوابة، وافتح قائمة الحساب واختر «إعادة تعيين كلمة مرور التداول». تظهر كلمة المرور الجديدة مرة واحدة على الشاشة، فاحفظها في مكان آمن.',
    },
  },
  {
    id: 'leverage',
    category: 'trading',
    q: { en: 'What leverage can I choose?', ar: 'ما الرافعة المالية التي يمكنني اختيارها؟' },
    a: {
      en: 'You choose leverage up to 1:500 when you open each MT5 account. Margin requirements for individual symbols are set on the trading server and shown in MetaTrader 5. Higher leverage increases both potential profits and potential losses.',
      ar: 'تختار الرافعة حتى 1:500 عند فتح كل حساب على ميتاتريدر 5. تُحدَّد متطلبات الهامش لكل رمز على خادم التداول وتظهر في ميتاتريدر 5. الرافعة الأعلى تزيد الأرباح المحتملة والخسائر المحتملة معًا.',
    },
  },
  {
    id: 'stop-out',
    category: 'trading',
    q: { en: 'Why were my positions closed automatically?', ar: 'لماذا أُغلقت صفقاتي تلقائيًا؟' },
    a: {
      en: 'When your margin level (equity divided by used margin) falls to the stop-out level of your account, the platform closes positions, starting with the largest loss, to protect your balance from going further negative. Keep enough free margin and use stop-losses to avoid it.',
      ar: 'عندما ينخفض مستوى الهامش (حقوق الملكية مقسومة على الهامش المستخدم) إلى مستوى الإغلاق الإجباري لحسابك، تغلق المنصة الصفقات بدءًا بالأكثر خسارة لحماية رصيدك من مزيد من الانخفاض. احتفظ بهامش حر كافٍ واستخدم أوامر وقف الخسارة لتجنب ذلك.',
    },
  },
  {
    id: 'swaps',
    category: 'trading',
    q: { en: 'What are swaps?', ar: 'ما رسوم التبييت (السواب)؟' },
    a: {
      en: 'A swap is an overnight financing adjustment applied to positions held past the daily rollover. It can be a charge or a credit depending on the instrument and direction. Current rates for every symbol are listed in MetaTrader 5 under Specification.',
      ar: 'السواب تسوية تمويل ليلية تُطبَّق على الصفقات المفتوحة بعد موعد التبييت اليومي، وقد تكون خصمًا أو إضافة بحسب الأداة واتجاه الصفقة. تجد القيم الحالية لكل رمز في ميتاتريدر 5 ضمن «المواصفات».',
    },
  },
  {
    id: 'funded-start',
    category: 'funded',
    q: { en: 'How do I start a Bolt Funded evaluation?', ar: 'كيف أبدأ تقييم برنامج التمويل؟' },
    a: {
      en: 'Choose a plan on the Bolt Funded page or in the Funded section of your portal and pay the one-time fee. Your evaluation account appears in the portal once it is activated, with its login and server.',
      ar: 'اختر خطة من صفحة برنامج التمويل أو من قسم «التمويل» في بوابتك، وادفع الرسوم لمرة واحدة. يظهر حساب التقييم في البوابة بعد تفعيله، مع بيانات الدخول والخادم.',
    },
  },
  {
    id: 'funded-breach',
    category: 'funded',
    q: { en: 'What happens if I break a rule?', ar: 'ماذا يحدث إذا خالفت إحدى القواعد؟' },
    a: {
      en: 'The evaluation ends and the account is disabled. Your results stay visible in the portal and you can start a new evaluation at any time.',
      ar: 'ينتهي التقييم ويُعطَّل الحساب، وتبقى نتائجك ظاهرة في البوابة، ويمكنك بدء تقييم جديد في أي وقت.',
    },
  },
  {
    id: 'funded-payout',
    category: 'funded',
    q: { en: 'How are funded rewards paid?', ar: 'كيف تُدفع مكافآت الحساب الممول؟' },
    a: {
      en: 'Request a payout from the portal once you are eligible. After review, your share of the profits is paid to a verified method in your name.',
      ar: 'اطلب الدفعة من البوابة عندما تصبح مؤهلًا، وبعد المراجعة تُدفع حصتك من الأرباح إلى وسيلة موثّقة باسمك.',
    },
  },
  {
    id: '2fa',
    category: 'security',
    q: { en: 'How do I turn on two-factor authentication?', ar: 'كيف أفعّل المصادقة الثنائية؟' },
    a: {
      en: 'In the portal go to Settings → Security, scan the QR code with an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password, and enter the six-digit code. Save the recovery codes shown; each works once if you lose your phone.',
      ar: 'من البوابة انتقل إلى «الإعدادات» ← «الأمان»، وامسح رمز QR بتطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator أو 1Password، ثم أدخل الرمز المكوّن من ستة أرقام. احفظ رموز الاسترداد المعروضة، فكل منها يعمل مرة واحدة إذا فقدت هاتفك.',
    },
  },
  {
    id: 'lost-2fa',
    category: 'security',
    q: { en: 'I lost access to my authenticator app', ar: 'فقدت الوصول إلى تطبيق المصادقة' },
    a: {
      en: 'Log in with one of your recovery codes instead of the six-digit code, then set up two-factor authentication again. If you have no recovery codes, contact support from the email address on your profile; we will verify your identity before resetting it.',
      ar: 'سجّل الدخول باستخدام أحد رموز الاسترداد بدلًا من الرمز المكوّن من ستة أرقام، ثم أعد إعداد المصادقة الثنائية. إذا لم تكن لديك رموز استرداد، فتواصل مع الدعم من البريد المسجّل في ملفك، وسنتحقق من هويتك قبل إعادة التعيين.',
    },
  },
  {
    id: 'phishing',
    category: 'security',
    q: { en: 'How do I recognise genuine Bolt Markets messages?', ar: 'كيف أميّز رسائل Bolt Markets الحقيقية؟' },
    a: {
      en: 'We never ask for your password, two-factor code or full card details by email, chat, social media or phone, and we never ask you to send money to a personal account. Log in by typing our website address yourself rather than following links in unexpected messages.',
      ar: 'لا نطلب أبدًا كلمة مرورك أو رمز المصادقة الثنائية أو بيانات بطاقتك الكاملة عبر البريد أو الدردشة أو وسائل التواصل أو الهاتف، ولا نطلب منك تحويل أموال إلى حساب شخصي. سجّل الدخول بكتابة عنوان موقعنا بنفسك بدلًا من الضغط على روابط في رسائل غير متوقعة.',
    },
  },
  {
    id: 'ib-program',
    category: 'partners',
    q: { en: 'How does the referral programme work?', ar: 'كيف يعمل برنامج الإحالة؟' },
    a: {
      en: 'Copy your personal link from the Partners page of the portal and share it. Clients who register through it are linked to your profile and you can follow their onboarding progress. Commission terms for introducing brokers are agreed individually with our partnerships team.',
      ar: 'انسخ رابطك الخاص من صفحة «الشركاء» في البوابة وشاركه. يرتبط العملاء الذين يسجلون عبره بملفك، ويمكنك متابعة تقدّم تسجيلهم. تُتفق شروط عمولات الوسطاء المعرِّفين بشكل فردي مع فريق الشراكات لدينا.',
    },
  },
  {
    id: 'ib-payout',
    category: 'partners',
    q: { en: 'Where do I see my partner commissions?', ar: 'أين أرى عمولاتي كشريك؟' },
    a: {
      en: 'Credited commissions appear on the Partners page and in your transaction history. You can withdraw them like any other balance once your profile is verified.',
      ar: 'تظهر العمولات المضافة في صفحة «الشركاء» وفي سجل معاملاتك، ويمكنك سحبها مثل أي رصيد آخر بعد التحقق من ملفك.',
    },
  },
];

/** Normalise text for search: case, Arabic diacritics, alef/ya/ta-marbuta variants and tatweel. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchHelp(query: string, lang: 'en' | 'ar', category?: HelpCategory | 'all'): HelpArticle[] {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  return helpArticles.filter((a) => {
    if (category && category !== 'all' && a.category !== category) return false;
    if (!terms.length) return true;
    const hay = normalizeSearch(`${a.q[lang]} ${a.a[lang]} ${a.q.en} ${a.a.en}`);
    return terms.every((t) => hay.includes(t));
  });
}
