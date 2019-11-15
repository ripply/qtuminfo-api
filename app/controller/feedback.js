const {Controller} = require('egg')

const emailRegex = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/

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
    } else if (!emailRegex.test(email)) {
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
