const nodemailer = require("nodemailer");
const axios = require("axios");
const pug = require("pug");
const { htmlToText } = require("html-to-text");
const { MailtrapTransport } = require("mailtrap");
require("dotenv").config();

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.url = url;
    this.from = {
      name: "Crime Watch",
      email: process.env.EMAIL_FROM,
    };
  }

  newTransport() {
    if (process.env.NODE_ENV === "production") {
      // ✅ Use Brevo API in production (Axios)
      return null; // No need for nodemailer transport in this case
    }

    // ✅ Use Mailtrap SMTP in development
    return nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // 1) Render HTML from a Pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    if (process.env.NODE_ENV === "production") {
      // ✅ Send via Brevo API
      const emailData = {
        sender: this.from,
        to: [{ email: this.to }],
        subject: subject,
        htmlContent: html,
      };

      try {
        const response = await axios.post(
          "https://api.brevo.com/v3/smtp/email",
          emailData,
          {
            headers: {
              "Content-Type": "application/json",
              "api-key": process.env.BREVO_API_KEY,
            },
          },
        );
        console.log("✅ Email sent successfully via Brevo!", response.data);
      } catch (error) {
        console.error(
          "❌ Error sending email via Brevo:",
          error.response?.data || error,
        );
      }
    } else {
      // ✅ Send via Mailtrap SMTP
      const mailOptions = {
        from: `Crime Watch <${process.env.EMAIL_FROM}>`,
        to: this.to,
        subject,
        html,
        text: htmlToText(html),
        category: "Integration Test",
        sandbox: true,
      };

      try {
        // const transporter = this.newTransport();
        await this.newTransport().sendMail(mailOptions);
        console.log("✅ Email sent successfully via Mailtrap!");
      } catch (error) {
        console.error("❌ Error sending email via Mailtrap:", error);
        console.log(error);
      }
    }
  }

  async sendWelcome() {
    await this.send("welcome", "Welcome to the Crime watch Family!");
  }

  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      "Your password reset token (valid for only 10 minutes)",
    );
  }
  async reportNotification() {
    await this.send("reportConfirmation", "Update on your reported crime");
  }
};
