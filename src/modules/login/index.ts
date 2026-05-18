export interface LoginFeatureStatus {
  title: string
  description: string
  oauthReady: boolean
  provider: string
}

export function getLoginFeatureStatus(): LoginFeatureStatus {
  return {
    title: 'Bilibili OAuth 登录预留',
    description: '当前窗口已预留 OAuth 登录入口、回调处理位置和用户态扩展点，后续可直接接入 Bilibili 登录流程。',
    oauthReady: false,
    provider: 'Bilibili OAuth 2.0',
  }
}
