const {Controller} = require('egg')

class TranslationController extends Controller {
  async create() {
    const {ctx} = this
    const {locale, translations} = ctx.request.body
    await ctx.service.translation.createTranslation(locale, translations)
    ctx.body = {status: 0}
  }
}

module.exports = TranslationController
