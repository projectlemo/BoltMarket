/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_COMPANY_LEGAL_NAME?: string;
  readonly VITE_COMPANY_REG_NUMBER?: string;
  readonly VITE_COMPANY_ADDRESS?: string;
  readonly VITE_REGULATORY_STATUS?: string;
  readonly VITE_REGULATOR_NAME?: string;
  readonly VITE_LICENSE_NUMBER?: string;
  readonly VITE_JURISDICTION?: string;
  readonly VITE_GOVERNING_LAW?: string;
  readonly VITE_RESTRICTED_COUNTRIES?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_SUPPORT_PHONE?: string;
  readonly VITE_SUPPORT_WHATSAPP?: string;
  readonly VITE_LIVE_CHAT_PROVIDER?: string;
  readonly VITE_LIVE_CHAT_ID?: string;
  readonly VITE_SOCIAL_X?: string;
  readonly VITE_SOCIAL_INSTAGRAM?: string;
  readonly VITE_SOCIAL_YOUTUBE?: string;
  readonly VITE_SOCIAL_DISCORD?: string;
  readonly VITE_MT5_SERVER_LIVE?: string;
  readonly VITE_MT5_SERVER_DEMO?: string;
  readonly VITE_MT5_DOWNLOAD_WINDOWS?: string;
  readonly VITE_MT5_DOWNLOAD_MAC?: string;
  readonly VITE_MT5_DOWNLOAD_IOS?: string;
  readonly VITE_MT5_DOWNLOAD_ANDROID?: string;
  readonly VITE_MT5_WEB_TERMINAL?: string;
  readonly VITE_MT5_WEB_TERMINAL_EMBED?: string;
  readonly VITE_DEMO_PRICES?: string;
  readonly VITE_ECONOMIC_CALENDAR?: string;
  readonly VITE_TRADINGVIEW_WIDGETS?: string;
  readonly VITE_LEGAL_REVIEWED?: string;
  readonly VITE_LEGAL_EFFECTIVE_DATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
