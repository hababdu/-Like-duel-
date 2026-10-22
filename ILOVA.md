# Like-Duel ilovasi (Android / iOS)

Bot o'yini Capacitor orqali haqiqiy ilovaga aylantirildi. Bitta kod: Telegram Mini App ham, Android/iOS ilova ham.

## Qanday ishlaydi
- Telegram ichida: avvalgidek `initData` bilan kirish.
- Ilovada: email/parol bilan kirish (`/api/auth/register`, `/api/auth/login`), JWT token telefonda saqlanadi.
- Telegram Stars do'koni va taklif havolalari faqat Telegram ichida ko'rinadi.

## Backend (Render) da kerak
- `JWT_SECRET` — uzun tasodifiy satr (bo'lmasa email-kirish o'chiq turadi).
- CORS: Capacitor originlari (`https://localhost`, `capacitor://localhost`) kodda avtomatik ruxsat etilgan.

## Build
```bash
cd frontend
cp .env.example .env        # REACT_APP_API_URL ni tekshiring
npm install
npm run android             # build + sync + Android Studio'ni ochadi (JDK 17+, Android Studio kerak)
npm run ios                 # faqat macOS + Xcode + CocoaPods (sudo gem install cocoapods; cd ios/App && pod install)
```
Android Studio'da: Build > Generate Signed Bundle/APK. Paket nomi: `uz.likeduel.app` (`capacitor.config.json`).

## Do'konga chiqarishdan oldin
1. Ikonka va splash: `npx @capacitor/assets generate` (`resources/icon.png` 1024x1024 va `splash.png` 2732x2732 qo'ying).
2. App Store/Google Play talablari: maxfiylik siyosati URL, akkauntni o'chirish (`DELETE /api/auth/account` tayyor, ilovaga tugma qo'shish kerak).
3. Ilova ichida haqiqiy pul/Stars sotuvi uchun Apple/Google ichki xarid qoidalariga amal qiling (hozir ilovada do'kon yashirin).
