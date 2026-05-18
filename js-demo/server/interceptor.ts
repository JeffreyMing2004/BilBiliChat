import axios from "axios"
import { getEncodeHeader } from "./tool/index"

// axios 拦截器
const api = axios.create({
    baseURL: "https://live-open.biliapi.com"
    // baseURL: "http://test-live-open.biliapi.net" //test
})

// 鉴权加密处理headers，下次请求自动带上
api.interceptors.request.use(config => {
    const headers = getEncodeHeader(
        config.data,
        global.appKey,
        global.appSecret
    )
    config.headers = headers
    return config
})

export default api
