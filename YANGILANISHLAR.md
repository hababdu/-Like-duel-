# Server xavfsizligi – nima o'zgardi (2-qadam)

## server.js
- **Socket autentifikatsiyasi:** `io.use()` har bir ulanishda Telegram `initData` imzosini tekshiradi. `tgId` endi mijozdan emas, serverda tasdiqlangan ma'lumotdan olinadi (`socket.data.tgId`). Boshqa odam nomidan o'ynash yopildi.
- **CORS:** `cors(corsOptions)` endi hamma so'rovga qo'llanadi (avval `cors()` hammaga ochiq edi).
- **REST himoyasi:** `GET /api/user/:tgId`, `/wallet`, `/referrals`, `/stats` endi `requireTelegramAuth` + `requireSelf` talab qiladi – faqat o'z ma'lumotingizni ko'rasiz.
- **Tezlik cheklovi (paketsiz):** HTTP 120/min, `/user/auth` 20/min (IP bo'yicha); socket: `find_match` 6/10s, `make_choice` 20/10s, `chat_message` 8/10s, `user_connect` 10/10s.
- **Webhook:** production'da `TELEGRAM_WEBHOOK_SECRET` majburiy (bo'lmasa server ishga tushmaydi).
- `trust proxy` yoqildi (Render orqasida to'g'ri IP).

## Frontend
- `src/api.js` – `authHeaders()` (X-Telegram-Init-Data). Profile, Wallet, Referrals, Shop, BotGame so'rovlariga qo'shildi.
- `src/socket.js` – ulanishda `auth: { initData }` yuboriladi.

## Siz qilishingiz kerak
1. Render'da `TELEGRAM_WEBHOOK_SECRET` o'rnating va webhook'ni shu secret bilan qayta o'rnating: `setWebhook?url=...&secret_token=<SECRET>`.
2. Eski bot tokenini BotFather'da `/revoke` qiling (`bot.js` da ochiq yozilgan edi, endi `.env` dan o'qiladi; token git tarixida qolgan).
3. Frontend ham, backend ham birga deploy qilinsin (eski frontend socketga ulana olmaydi).
4. Telegram tashqarisida (oddiy brauzerda) socket endi ulanmaydi – bu kutilgan holat.
5. initData 24 soatdan keyin eskiradi: ilova 24 soatdan ortiq ochiq tursa, qayta ochish kerak bo'ladi.

---
# 3-qadam: Bot o'yini serverga ko'chirildi
- `POST /api/bot/play` va `/api/bot/timeout` (imzo talab qiladi). Natija, bot tanlovi, mukofot, combo va tanga o'zgarishi **faqat serverda** hisoblanadi. Mijoz faqat `choice` va `difficulty` yuboradi.
- Mukofotlar avvalgidek: g'alaba 40/70/110 (+combo), durang +10, mag'lubiyat −20, vaqt tugashi −10.
- **Yangi limit:** kuniga bot orqali ko'pi bilan 300 tanga yutiladi (`BOT_DAILY_COIN_CAP` env bilan o'zgartiriladi). Avval cheksiz tanga yasash mumkin edi (o'rtacha kutilgan natija musbat edi).
- Har so'rov orasida 700 ms kutish. Tanga o'zgarishlari hamyon tarixiga "Bot bilan o'yin" sifatida yoziladi.
- Bot sun'iy intellekti tuzatildi: avval "oson" bot o'yinchining joriy tanlovini ko'rib mag'lub qilishi mumkin edi. Endi: oson – tasodifiy; o'rta – eng ko'p tanlangan shaklga qarshi 35%; qiyin – 55%.
- Mavjud `/api/user/update-coins` (mijoz chaqirgan, serverda yo'q edi) endi ishlatilmaydi.

# 4-qadam: Xato holatlari va tuzatishlar
- `ErrorBoundary`: kutilmagan xatoda oq ekran o'rniga "Qayta yuklash" ekrani.
- Viewport: kattalashtirish (zoom) taqiqi olib tashlandi (qulaylik).
- `package.json` dagi ishlamaydigan `"dev": "vite"` skripti o'chirildi.
