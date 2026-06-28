const nodemailer = require("nodemailer");
const axios = require("axios");
const fs = require("fs"); // Added native file system module
const { htmlToText } = require("html-to-text");
require("dotenv").config();

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.url = url;
    this.from = {
      name: "Inventory System",
      email: process.env.EMAIL_FROM,
    };
  }

  newTransport() {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

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
    // 1) Read the raw HTML file
    const filePath = `${__dirname}/../views/email/${template}.html`;
    let html = fs.readFileSync(filePath, "utf-8");

    // 2) Dynamically replace custom placeholders with actual data
    html = html
      .replace(/{{firstName}}/g, this.firstName)
      .replace(/{{url}}/g, this.url)
      .replace(/{{subject}}/g, subject);

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
        from: `Inventory systen <${process.env.EMAIL_FROM}>`,
        to: this.to,
        subject,
        html,
        text: htmlToText(html),
        category: "Integration Test",
        sandbox: true,
      };

      try {
        await this.newTransport().sendMail(mailOptions);
        console.log("✅ Email sent successfully via Mailtrap!");
      } catch (error) {
        console.error("❌ Error sending email via Mailtrap:", error);
      }
    }
  }

  async sendWelcome() {
    await this.send("welcome", "Welcome to Inventory System.");
  }

  async sendPasswordReset() {
    await this.send(
      "PasswordReset",
      "Your password reset token (valid for only 10 minutes)",
    );
  }

  async notifyStockStatus() {
    await this.send("stockStatus", "Your stock status.");
  }

  async purchaseUpdate() {
    await this.send("purchaseUpdate", "Purchase updated");
  }
};
