const {Controller} = require('egg')

class DefaultController extends Controller {
  async subscribe() {
    const {ctx} = this
    const rooms = ctx.args
    if (rooms.length) {
      ctx.socket.join(...rooms)
    }
  }

  async unsubscribe() {
    const {ctx} = this
    const rooms = ctx.args
    if (rooms.length) {
      ctx.socket.leave(...rooms)
    }
  }
}

module.exports = DefaultController
