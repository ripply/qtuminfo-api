const {Service} = require('egg')

class BulletinService extends Service {
  async listBulletins(count, {locale} = {}) {
    const {Bulletin, BulletinTranslation} = this.ctx.model
    const {gt: $gt} = this.app.Sequelize.Op
    const list = await Bulletin.findAll({
      where: {priority: {[$gt]: 0}},
      attributes: ['_id', 'locale', 'title', 'url'],
      order: [['priority', 'DESC'], ['_id', 'DESC']],
      limit: count
    })
    const result = {default: []}
    const locales = new Set(['default'])
    for (const bulletin of list) {
      if (!locales.has(bulletin.locale)) {
        locales.add(bulletin.locale)
        result[bulletin.locale] = result.default.map(({title, url}) => ({title, url}))
      }
      for (const locale of locales) {
        result[locale].push({title: bulletin.title, url: bulletin.url})
      }
      for (const translation of await BulletinTranslation.findAll({
        where: {bulletinId: bulletin._id},
        attributes: ['locale', 'title', 'url']
      })) {
        if (!locales.has(translation.locale)) {
          locales.add(translation.locale)
          result[translation.locale] = result.default.map(({title, url}) => ({title, url}))
        }
        Object.assign(result[translation.locale][result[translation.locale].length - 1], {
          title: translation.title,
          url: translation.url || bulletin.url
        })
      }
    }
    if (locale == null) {
      return result
    } else {
      return {[locale]: result[locale] ?? result.default}
    }
  }
}

module.exports = BulletinService
