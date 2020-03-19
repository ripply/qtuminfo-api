const {Service} = require('egg')

class BulletinService extends Service {
  async listAllBulletins() {
    const {Bulletin, BulletinTranslation} = this.ctx.model
    const list = await Bulletin.findAll({
      include: [{
        model: BulletinTranslation,
        as: 'translations'
      }],
      order: [['priority', 'DESC'], ['_id', 'DESC']]
    })
    return list.map(bulletin => ({
      id: bulletin._id,
      locale: bulletin.locale,
      title: bulletin.title,
      url: bulletin.url,
      priority: bulletin.priority,
      translations: bulletin.translations.map(translation => ({
        locale: translation.locale,
        title: translation.title,
        url: translation.url
      }))
    }))
  }

  async createBulletin({locale, title, url, priority, translations}) {
    const db = this.ctx.model
    const {Bulletin, BulletinTranslation} = db
    const transaction = await db.transaction()
    try {
      const bulletin = await Bulletin.create({locale, title, url, priority}, {transaction})
      const bulletinTranslations = await BulletinTranslation.bulkCreate(
        translations.map(translation => ({
          bulletinId: bulletin._id,
          locale: translation.locale,
          title: translation.title,
          url: translation.url
        })),
        {transaction}
      )
      await transaction.commit()
      return {
        id: bulletin._id,
        locale: bulletin.locale,
        title: bulletin.title,
        url: bulletin.url,
        priority: bulletin.priority,
        translations: bulletinTranslations.map(translation => ({
          locale: translation.locale,
          title: translation.title,
          url: translation.url
        }))
      }
    } catch (err) {
      await transaction.rollback()
    }
  }

  async updateBulletin({id, locale, title, url, priority, translations}) {
    const db = this.ctx.model
    const {Bulletin, BulletinTranslation} = db
    const transaction = await db.transaction()
    try {
      await Bulletin.update(
        {locale, title, url, priority},
        {where: {_id: id}, transaction}
      )
      await BulletinTranslation.destroy({where: {bulletinId: id}, transaction})
      const bulletinTranslations = await BulletinTranslation.bulkCreate(
        translations.map(translation => ({
          bulletinId: id,
          locale: translation.locale,
          title: translation.title,
          url: translation.url
        })),
        {transaction}
      )
      await transaction.commit()
      return {
        id,
        locale,
        title,
        url,
        priority,
        translations: bulletinTranslations.map(translation => ({
          locale: translation.locale,
          title: translation.title,
          url: translation.url
        }))
      }
    } catch (err) {
      await transaction.rollback()
    }
  }

  async removeBulletin(id) {
    const db = this.ctx.model
    const {Bulletin, BulletinTranslation} = db
    const transaction = await db.transaction()
    try {
      await Bulletin.destroy({where: {_id: id}, transaction})
      await BulletinTranslation.destroy({where: {bulletinId: id}, transaction})
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
    }
  }

  async setPriority(mapping) {
    const db = this.ctx.model
    const {Bulletin} = db
    const transaction = await db.transaction()
    try {
      for (const [id, priority] of Object.entries(mapping)) {
        await Bulletin.update({priority}, {where: {_id: Number(id)}, transaction})
      }
      await transaction.commit()
      return mapping
    } catch (err) {
      await transaction.rollback()
    }
  }
}

module.exports = BulletinService
