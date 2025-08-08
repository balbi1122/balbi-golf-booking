const crypto = require('crypto');
const SECRET = process.env.GMAIL_TOKEN_SECRET || 'change-this-to-a-long-random-string';
const ALGO = 'aes-256-gcm';

function k() { return crypto.createHash('sha256').update(SECRET).digest(); }

exports.encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const key = k();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
};

exports.decrypt = (b64) => {
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.slice(0, 12);
  const tag = raw.slice(12, 28);
  const data = raw.slice(28);
  const key = k();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
};
