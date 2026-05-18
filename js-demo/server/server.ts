import Koa from "koa"
import logger from "koa-logger"
import cors from "koa2-cors"
import bodyParser from "koa-bodyparser"

import router from "./routes/index"

// axios 拦截
import "./interceptor"

// init
const app = new Koa()

// 开启logger
app.use(logger())

// 开启bodyParser
app.use(bodyParser())

// 开启跨域
app.use(cors())

// 开启router
app.use(router.routes())
app.use(router.allowedMethods())

app.use(async ctx => {
    ctx.body = "bilibili创作者服务中心"
})

const protocol = "http"
const host = "127.0.0.1"
const port = 3000

app.listen(port, () => {
    console.log(`Listening on ${protocol}://${host}:${port}`)
})
