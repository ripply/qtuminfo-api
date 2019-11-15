const {Controller} = require('egg')

class CaptchaController extends Controller {
  async create() {
    const {ctx} = this
    let captcha = await ctx.service.captcha.createCaptcha()
    ctx.session.captcha = captcha.text
    ctx.response.type = 'image/svg+xml'
    ctx.body = captcha.data
  }
}

module.exports = CaptchaController
