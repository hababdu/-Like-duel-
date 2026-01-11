import { Request, Response } from 'express';
import crypto from 'crypto';

export const verifyTelegramData = (req: Request, res: Response) => {
  try {
    const initData = req.body.initData; // Frontend'dan kelgan ma'lumot
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;

    // initData'ni URLSearchParams formatida tekshirish uchun tayyorlash
    const urlParams = new URLSearchParams(initData);
    
    // `hash` ni ajratib olamiz (Telegram tomonidan imzolangan)
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Qolgan parametrlarni alfavit tartibida saralab, "hash_check_string" yasaymiz
    const dataCheckArr: string[] = [];
    urlParams.sort();
    urlParams.forEach((val, key) => {
      dataCheckArr.push(`${key}=${val}`);
    });
    const dataCheckString = dataCheckArr.join('\n');
    
    // Secret key'ni hisoblash (Telegram talabi)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    
    // Olingan hash'ni hisoblash
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    // Hash'larni taqqoslash (xavfsizlik tekshiruvi)
    if (calculatedHash === hash) {
      // Muvaffaqiyatli! Foydalanuvchi ma'lumotlarini olamiz
      const userData = JSON.parse(urlParams.get('user')!);
      
      // Bu yerda: Database'da foydalanuvchini topish/yangi yaratish logikasi
      // const user = await findOrCreateUser(userData);
      
      res.json({ 
        success: true, 
        user: userData,
        // createdUser: user 
      });
    } else {
      res.status(403).json({ success: false, error: 'Invalid Telegram data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};