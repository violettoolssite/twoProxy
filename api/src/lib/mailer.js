const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
  });

  return transporter;
}

/**
 * 发送密码重置邮件
 * @param {string} to 收件人邮箱
 * @param {string} resetLink 重置链接
 */
async function sendResetPasswordMail(to, resetLink) {
  const t = getTransporter();

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro SC', 'PingFang SC', 'Segoe UI', sans-serif; padding: 24px; background: #f3f4f6;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.15);">
        <h1 style="font-size: 20px; margin: 0 0 16px; color: #111827;">Mirror 加速站 - 密码重置</h1>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
          您正在尝试重置 Mirror 加速站账户的登录密码。如果这不是您的操作，可以忽略本邮件。
        </p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; border-radius: 999px; text-decoration: none; font-size: 14px;">
            点击这里重置密码
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
          如果按钮无法点击，请复制下面的链接到浏览器中打开：<br>
          <span style="word-break: break-all; color: #111827;">${resetLink}</span>
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
          该链接 1 小时内有效。<br>
          本邮件由系统自动发送，请勿直接回复。
        </p>
      </div>
    </div>
  `;

  await t.sendMail({
    from: config.mail.from || config.mail.user,
    to,
    subject: 'Mirror 加速站 - 密码重置',
    html,
  });
}

module.exports = {
  sendResetPasswordMail,
};


