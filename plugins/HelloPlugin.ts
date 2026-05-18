import { defineBilBiliChatPlugin } from '../src/sdk'

export default defineBilBiliChatPlugin({
  id: 'hello-plugin',
  name: 'Hello Plugin',
  version: '1.0.0',
  async onEnable() {
    console.info('[HelloPlugin] 已启用')
  },
  hooks: {
    onConnect({ roomKey }) {
      console.info(`[HelloPlugin] 房间已连接: ${roomKey}`)
    },
  },
})
