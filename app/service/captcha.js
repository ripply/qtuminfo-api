const {Service} = require('egg')
const svgCaptcha = require('svg-captcha')

class CaptchaService extends Service {
  async createCaptcha() {
    return svgCaptcha.create()
  }
}

module.exports = CaptchaService
