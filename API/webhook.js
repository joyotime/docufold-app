const crypto = require('crypto');

// 辅助函数：读取原始请求体 (Raw Body) 用于签名校验
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 1. 获取在 Lemon Squeezy 后台设置的 Signing Secret
    const secret = process.env.LEMON_SQUEEZY_SIGNING_SECRET;
    
    // 2. 获取原始 Body 并校验签名
    const rawBody = await getRawBody(req);
    const hmac = crypto.createHmac('sha256', secret || '');
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(req.headers['x-signature'] || '', 'utf8');

    // 如果签名不匹配，说明是伪造请求，拒绝处理
    if (!secret || !crypto.timingSafeEqual(digest, signature)) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // 3. 解析 Lemon Squeezy 发来的数据
    const payload = JSON.parse(rawBody.toString('utf8'));
    const eventName = payload.meta.event_name;
    const customData = payload.meta.custom_data;

    console.log(`收到 Lemon Squeezy 事件: ${eventName}`);

    // 4. 处理订单创建/支付成功事件
    if (eventName === 'order_created') {
      const orderData = payload.data.attributes;
      const customerEmail = orderData.user_email;
      const orderId = payload.data.id;

      console.log(`【付款成功】 订单号: ${orderId}, 用户邮箱: ${customerEmail}`);

      // TODO: 在这里编写你的业务逻辑
      // 例如：调用数据库将该用户标记为 Pro 会员、发送激活邮件等
    }

    // 5. 成功返回 200 给 Lemon Squeezy
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ message: 'Webhook handler failed' });
  }
};
