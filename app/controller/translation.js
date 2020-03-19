const {Controller} = require('egg')

class TranslationController extends Controller {
  async create() {
    const {locale, translations, email} = this.ctx.request.body
    this.ctx.assert(this.ctx.helper.isEmail(email), 400)
    await this.ctx.service.translation.createTranslation(locale, translations, email)
    this.ctx.body = {status: 0}
  }
}

module.exports = TranslationController
