const {Service} = require('egg')

class CacheService extends Service {
  async getCache(key) {
    let result = await this.app.redis.hget(this.app.name, key)
    if (result == null) {
      return result
    } else {
      return JSON.parse(result)
    }
  }

  async setCache(key, value) {
    await this.app.redis.hset(this.app.name, key, JSON.stringify(value))
  }

  async deleteCache(key) {
    await this.app.redis.hdel(this.app.name, key)
  }

  async existsCache(key) {
    return await this.app.redis.hexists(this.app.name, key)
  }
}

module.exports = CacheService
