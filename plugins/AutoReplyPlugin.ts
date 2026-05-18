import { defineBilBiliChatPlugin } from '../src/sdk'

const KEYWORDS = ['你好', '晚上好', '主播好']

export default defineBilBiliChatPlugin({
  id: 'auto-reply-plugin',
  name: 'Auto Reply Plugin',
  version: '1.0.0',
  enabled: false,
  hooks: {
    onMessage({ message }) {
      if (message.type !== 'danmu') {
        return
      }

      const matched = KEYWORDS.some((keyword) => message.content.includes(keyword))
      if (matched) {
        console.info(`[AutoReplyPlugin] 命中关键词，建议回复 ${message.username}`)
      }
    },
  },
})
