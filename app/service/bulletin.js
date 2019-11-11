const {Service} = require('egg')

class BulletinService extends Service {
  async listBulletins(count) {
    const {Bulletin, BulletinTranslation} = this.ctx.model
    const {gt: $gt} = this.app.Sequelize.Op
    let list = await Bulletin.findAll({
      where: {priority: {[$gt]: 0}},
      attributes: ['_id', 'title', 'url'],
      order: [['priority', 'DESC'], ['_id', 'DESC']],
      limit: count,
      transaction: this.ctx.state.transaction
    })
    return await Promise.all(list.map(async bulletin => {
      let translations = await BulletinTranslation.findAll({
        where: {bulletinId: bulletin._id},
        attributes: ['locale', 'title', 'url'],
        transaction: this.ctx.state.transaction
      })
      let result = {
        title: bulletin.title,
        url: bulletin.url,
        translations: {}
      }
      for (let x of translations) {
        result.translations[x.locale] = {
          title: x.title,
          url: x.url || bulletin.url
        }
      }
      return result
    }))
  }
}

module.exports = BulletinService
