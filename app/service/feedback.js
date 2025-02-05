const {Service} = require('egg')

class FeedbackService extends Service {
  async createFeedback(name, email, content) {
    const {Feedback} = this.ctx.model
    const feedback = await Feedback.create({name, email, content})
    await this.sendMail(feedback)
  }

  generateMail(feedback, {receivers} = {}) {
    const {name, email, content} = feedback
    return {
      to: receivers,
      subject: `Qtum.info feedback from ${name}`,
      html: `<p>Name: ${name}</p><p>Email: <a href="mailto:${email}">${email}</a></p><p></p><p>${this.ctx.helper.escape(content)}</p>`,
      replyTo: email
    }
  }

  async sendMail(feedback) {
    await this.ctx.service.mail.sendMail(this.generateMail(feedback, {receivers: this.app.config.feedbackReceivers}))
    feedback.emailSent = true
    await feedback.save()
  }
}

module.exports = FeedbackService
