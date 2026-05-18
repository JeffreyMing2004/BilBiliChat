import api from "../interceptor"

/**
 * 心跳接口
 * @param ctx
 */
export default async function GameHeartBeat(ctx) {
    const params = ctx.request.body
    await api
        .post("/v2/app/heartbeat", params)
        .then(({ data }) => {
            ctx.body = data
        })
        .catch(err => {
            ctx.body = err
        })
}
