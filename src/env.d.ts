/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BILIBILI_CLIENT_ID?: string
  readonly VITE_BILIBILI_CLIENT_SECRET?: string
  readonly VITE_BILIBILI_REDIRECT_URI?: string
  readonly VITE_BILIBILI_OAUTH_AUTHORIZE_URL?: string
  readonly VITE_BILIBILI_OAUTH_TOKEN_URL?: string
  readonly VITE_BILIBILI_OAUTH_USERINFO_URL?: string
  readonly VITE_BILIBILI_OAUTH_SCOPE?: string
  readonly VITE_BILIBILI_OPENLIVE_APP_ID?: string
  readonly VITE_BILIBILI_OPENLIVE_ACCESS_KEY_ID?: string
  readonly VITE_BILIBILI_OPENLIVE_ACCESS_KEY_SECRET?: string
  readonly VITE_BILIBILI_OPENLIVE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
