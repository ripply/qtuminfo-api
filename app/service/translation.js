const {Service} = require('egg')

class TranslationService extends Service {
  async createTranslation(locale, translations) {
    const {QtuminfoTranslation} = this.ctx.model
    await QtuminfoTranslation.create({locale, translations}, {transaction: this.ctx.state.transaction})
  }
}

module.exports = TranslationService
