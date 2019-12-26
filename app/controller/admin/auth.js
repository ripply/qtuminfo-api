const {Controller} = require('egg')

class AuthController extends Controller {
  async login() {
    const {ctx, app} = this
    let {username, password} = ctx.request.body
    ctx.assert(username && password && username === app.config.admin.username && password === app.config.admin.password, 401)
    ctx.session.admin = true
    ctx.body = null
  }
}

module.exports = AuthController
