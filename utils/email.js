/* eslint-disable node/no-unsupported-features/es-syntax */
const nodemailer = require('nodemailer');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Kerolos Farah <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async send(message, subject) {
    // 1) Define the email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      text: message
    };

    // 2) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send(
      `Welcome to FCAI Family!\nVisit your profile: ${this.url}`,
      'Welcome'
    );
  }

  async sendPasswordReset() {
    await this.send(
      `Forgot your password? Submit a PATCH request with your new password and 
    passwordConfirm to: ${this.url}.\nIf you didin't fogret your password, please ignore this email!`,
      'Your password reset token (valid for only 10 minutes)'
    );
  }
};
