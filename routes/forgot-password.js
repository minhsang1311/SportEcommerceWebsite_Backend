const resetToken = crypto.randomBytes(20).toString('hex');
const sqlToken = 'UPDATE users SET reset_token = ? WHERE email = ?';
db.query(sqlToken, [resetToken, req.body.email], (error, results) => {
    if (error) {
        return res.json({ Message: "Error" });
    }

    if (results.length === 0) {
      // No user found with the specified email
      return res.json({ Message: "Email does not exist" });
    }
    // Password reset token saved successfully
    return res.json({ Message: "Token Update Success" });
});
const transporter = nodemailer.createTransport({
    service: 'sangnnm.sec@gmail.com',
    auth: {
      user: 'sangnnm.sec',
      pass: 'Minh1sang1',
    },
  });

  const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
  const mailOptions = {
    from: 'sangnnm.sec',
    to: email,
    subject: 'Password Reset',
    text: `Click the following link to reset your password: ${resetLink}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    console.log('Password reset email sent:', info.response);
    res.json({ message: 'Password reset email sent' });
  });