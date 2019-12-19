const {Controller} = require('egg')

class CaptchaController extends Controller {
  async create() {
    const {ctx} = this
    let {name, email, content, captcha} = ctx.request.body
    if (!ctx.session.captcha || captcha !== ctx.session.captcha) {
      ctx.body = {success: false, code: 1, message: 'Invalid captcha'}
    }
    ctx.session.captcha = null
    if (!name || name.length > 60) {
      ctx.body = {success: false, code: 2, message: 'Invalid name'}
    } else if (!ctx.helper.isEmail(email)) {
      ctx.body = {success: false, code: 3, message: 'Invalid email'}
    } else if (!content) {
      ctx.body = {success: false, code: 4, message: 'Please fill in the content'}
    } else if (content.length > 10000) {
      ctx.body = {success: false, code: 4, message: 'Content too long'}
    }
    await ctx.service.feedback.createFeedback(name, email, content)
    ctx.body = {success: true}
  }
}

module.exports = CaptchaController
