const {Service} = require('egg')

class TranslationService extends Service {
  async createTranslation(locale, translations, email) {
    const {QtuminfoTranslation} = this.ctx.model
    await QtuminfoTranslation.create({locale, translations, email}, {transaction: this.ctx.state.transaction})
  }
}

module.exports = TranslationService
