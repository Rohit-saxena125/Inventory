const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');

exports.generateCode = (digit, option = { specialChars: false }) => {
  return otpGenerator.generate(digit, option);
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_SMTP,
    pass: process.env.PASSWORD_SMTP,
  },

  tls: {
    rejectUnauthorized: false,
  },
});

exports.sendEmail = async (mailAlert) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_SMTP,
      to: process.env.EMAIL_SENDER,
      subject: mailAlert.subject,
      html: mailAlert.message,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

exports.htmlMail = (data) => {
  if (data.type == 'OTP') {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        .logo img {
            max-width: 150px;
        }
        .otp {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin: 20px 0;
        }
        .footer {
            margin-top: 20px;
            font-size: 14px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <img src="YOUR_LOGO_URL" alt="Company Logo">
        </div>
        <h2>OTP Verification</h2>
        <p>${data.name} One-Time Password (OTP) for verification is:</p>
        <div class="otp">${data.otp}</div>
        <p>This OTP is valid for a limited time. Please do not share it with anyone.</p>
        <div class="footer">
            <p>&copy; 2024 Your Company. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
  }
};
