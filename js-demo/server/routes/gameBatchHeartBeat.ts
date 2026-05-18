import api from "../interceptor"

/**
 * 批量心跳接口
 * @param ctx
 */
export default async function GameBatchHeartBeat(ctx) {
    const params = ctx.request.body
    await api
        .post("/v2/app/batchHeartbeat", params)
        .then(({ data }) => {
            ctx.body = data
        })
        .catch(err => {
            ctx.body = err
        })
}
