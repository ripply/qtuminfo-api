const nodemailer = require('nodemailer')
const {Service} = require('egg')

class MailService extends Service {
  async sendMail(params) {
    const config = this.app.config.nodemailer
    let transporter = nodemailer.createTransport(config)
    return await transporter.sendMail({
      from: `"Qtum.info Feedback" <${config.auth.user}>`,
      ...params
    })
  }
}

module.exports = MailService
