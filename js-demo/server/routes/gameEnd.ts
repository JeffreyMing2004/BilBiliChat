import api from "../interceptor"

/**
 * 互动玩法游戏结束接口
 * @param ctx
 */
export default async function GameEnd(ctx) {
    const params = ctx.request.body
    await api
        .post("/v2/app/end", params)
        .then(({ data }) => {
            ctx.body = data
        })
        .catch(err => {
            ctx.body = err
        })
}
