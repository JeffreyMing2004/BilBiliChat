/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BILIBILI_CLIENT_ID?: string
  readonly VITE_BILIBILI_CLIENT_SECRET?: string
  readonly VITE_BILIBILI_REDIRECT_URI?: string
  readonly VITE_BILIBILI_OAUTH_AUTHORIZE_URL?: string
  readonly VITE_BILIBILI_OAUTH_TOKEN_URL?: string
  readonly VITE_BILIBILI_OAUTH_USERINFO_URL?: string
  readonly VITE_BILIBILI_OAUTH_SCOPE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
