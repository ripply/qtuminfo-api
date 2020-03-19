const {Controller} = require('egg')

class CaptchaController extends Controller {
  async create() {
    const {name, email, content, captcha} = this.ctx.request.body
    if (!this.ctx.session.captcha || captcha !== this.ctx.session.captcha) {
      this.ctx.body = {success: false, code: 1, message: 'Invalid captcha'}
    }
    this.ctx.session.captcha = null
    if (!name || name.length > 60) {
      this.ctx.body = {success: false, code: 2, message: 'Invalid name'}
    } else if (!this.ctx.helper.isEmail(email)) {
      this.ctx.body = {success: false, code: 3, message: 'Invalid email'}
    } else if (!content) {
      this.ctx.body = {success: false, code: 4, message: 'Please fill in the content'}
    } else if (content.length > 10000) {
      this.ctx.body = {success: false, code: 4, message: 'Content too long'}
    }
    await this.ctx.service.feedback.createFeedback(name, email, content)
    this.ctx.body = {success: true}
  }
}

module.exports = CaptchaController
