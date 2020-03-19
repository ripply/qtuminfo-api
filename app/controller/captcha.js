const {Controller} = require('egg')

class CaptchaController extends Controller {
  async create() {
    const captcha = await this.ctx.service.captcha.createCaptcha()
    this.ctx.session.captcha = captcha.text
    this.ctx.response.type = 'image/svg+xml'
    this.ctx.body = captcha.data
  }
}

module.exports = CaptchaController
