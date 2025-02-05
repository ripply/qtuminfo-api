const {Controller} = require('egg')

class BulletinController extends Controller {
  async query() {
    const {ctx} = this
    ctx.body = await ctx.service.admin.bulletin.listAllBulletins()
  }

  async create() {
    const {ctx} = this
    const {locale, title, url, priority, translations} = ctx.request.body
    ctx.body = await ctx.service.admin.bulletin.createBulletin({locale, title, url, priority, translations})
  }

  async edit() {
    const {ctx} = this
    const {id} = ctx.params
    const {locale, title, url, priority, translations} = ctx.request.body
    ctx.body = await ctx.service.admin.bulletin.updateBulletin({id, locale, title, url, priority, translations})
  }

  async delete() {
    const {ctx} = this
    const {id} = ctx.params
    await ctx.service.admin.bulletin.removeBulletin(id)
    ctx.body = null
  }

  async setPriority() {
    const {ctx} = this
    const mapping = ctx.request.body
    ctx.body = await ctx.service.admin.bulletin.setPriority(mapping)
  }
}

module.exports = BulletinController
