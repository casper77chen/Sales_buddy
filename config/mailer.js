async function sendMail({ to, subject, html }) {
  if (!process.env.ZSEND_API_KEY) {
    console.warn('Email 未設定 ZSEND_API_KEY，跳過寄信');
    return null;
  }

  const fromAddress = process.env.ZSEND_FROM || 'noreply@casper77chen.com';

  const res = await fetch('https://api.zeabur.com/api/v1/zsend/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ZSEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ZSend 寄信失敗: ${res.status} ${err}`);
  }

  const data = await res.json();
  console.log('Email 已寄出 (ZSend):', data);
  return data;
}

module.exports = { sendMail };
