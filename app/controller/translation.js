const {Controller} = require('egg')

class TranslationController extends Controller {
  async create() {
    const {ctx} = this
    const {locale, translations, email} = ctx.request.body
    ctx.assert(ctx.helper.isEmail(email), 400)
    await ctx.service.translation.createTranslation(locale, translations, email)
    ctx.body = {status: 0}
  }
}

module.exports = TranslationController
