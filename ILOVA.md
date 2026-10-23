# Like-Duel ilovasi (Android / iOS)

Bitta kod: Telegram Mini App ham, Android/iOS ilova ham.

## Kirish
- Telegram ichida: avvalgidek `initData`.
- Ilovada: **Google** (Android, iOS) va **Apple** (iOS). Parol yo'q. Server provayder tokenini tekshiradi (`POST /api/auth/google`, `/api/auth/apple`) va o'z sessiya tokenini beradi.

## To'lov
- Tangalar **Click** orqali bank kartasi bilan sotib olinadi (Telegram Stars olib tashlangan).
- Narxlar so'mda: `like-duel-backend/server.js` dagi `COIN_PACKAGES`.
- Do'konlar (Google Play / App Store) tanga sotuvini faqat ichki xarid orqali ruxsat beradi. Shuning uchun do'kon build'ida `REACT_APP_STORE_BUILD=true` qilinadi va "Tanga Do'koni" yashiriladi. Ichki xarid (IAP) hali yozilmagan.

## APK ni GitHub'dan yuklab olish
GitHub'da repo > **Actions** > **Android APK** > oxirgi muvaffaqiyatli (yashil) yig'ish > pastdagi **Artifacts** > `like-duel-apk` (zip ichida `app-debug.apk`). Telefonga o'tkazib, "noma'lum manbalardan o'rnatish"ga ruxsat bering. Har `main` ga push'da avtomatik yig'iladi, qo'lda ham ishga tushirish mumkin (Run workflow).
Qiymatlar: repo > Settings > Secrets and variables > Actions > **Variables**: `REACT_APP_GOOGLE_WEB_CLIENT_ID`, `REACT_APP_GOOGLE_IOS_CLIENT_ID`, `REACT_APP_API_URL`, `REACT_APP_STORE_BUILD`.
Test APK doim bir xil kalit bilan imzolanadi. Google Android OAuth client uchun SHA-1: `B2:59:91:68:D8:40:EC:70:FF:AA:3F:15:46:18:60:00:9C:6A:0D:C4`.

## Mac va iPhone uchun (GitHub Actions)
Actions bo'limida uchta workflow bor, hammasi `main` ga push'da avtomatik ishlaydi:
- **Mac desktop** → artefakt `like-duel-mac` (Intel `x64` va Apple Silicon `arm64` uchun alohida .zip; ochib, Like-Duel.app ni Applications ga ko'chiring). Imzolanmagan: birinchi ochishda Finder'da ilovaga o'ng tugma > Open, yoki `xattr -cr /Applications/Like-Duel.app`. Ilova `http://localhost:38123` da ochiladi: Google Cloud'dagi **Web** OAuth client'ga shu manzilni "Authorized JavaScript origins" ga qo'shing.
- **iOS (unsigned IPA)** → artefakt `like-duel-ios-unsigned-ipa`. Imzosiz IPA to'g'ridan-to'g'ri o'rnatilmaydi: Sideloadly yoki AltStore bilan o'z Apple ID'ngiz orqali iPhone'ga o'rnatiladi (bepul hisobda 7 kun amal qiladi). Bunday o'rnatishda "Apple bilan kirish" ishlamaydi, Google ishlaydi. Google uchun repo Variables'ga `IOS_REVERSED_CLIENT_ID` (`com.googleusercontent.apps.XXXX`) qo'shing.
- **App Store/TestFlight** uchun pullik Apple Developer hisobi (99$/yil), sertifikat va provisioning profile kerak; keyin workflow imzolashga o'tkaziladi.

## 1) Backend sozlash (Render > Environment)
`like-duel-backend/.env.example` dagi hamma qiymatlarni kiriting. Eng muhimlari: `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_ID`, `CLICK_*`.

**Click:** merchant.click.uz kabinetida xizmat oching, Prepare URL = `https://<server>/api/click/prepare`, Complete URL = `https://<server>/api/click/complete`. `service_id`, `merchant_id`, `secret_key` ni env ga yozing.

## 2) Google kirishni sozlash
Google Cloud Console > APIs & Services > Credentials:
1. **Web** OAuth client yarating → `GOOGLE_CLIENT_IDS` (backend) va `REACT_APP_GOOGLE_WEB_CLIENT_ID` (frontend).
2. **Android** OAuth client: paket `uz.likeduel.app` + imzo SHA-1 (debug va release uchun alohida).
3. **iOS** OAuth client: bundle ID `uz.likeduel.app` → `REACT_APP_GOOGLE_IOS_CLIENT_ID`. Xcode'da `Info.plist` ga URL Type qo'shing: URL scheme = iOS client'ning "reversed client ID" (`com.googleusercontent.apps.XXXX`).

## 3) Apple kirishni sozlash (faqat iOS)
Apple Developer'da App ID `uz.likeduel.app` uchun **Sign in with Apple** yoqing; Xcode > Signing & Capabilities > + Capability > Sign in with Apple.

## 4) Build
```bash
cd frontend
cp .env.example .env     # qiymatlarni to'ldiring
npm install
npm run android          # build + sync + Android Studio (JDK 17+)
npm run ios              # macOS + Xcode + CocoaPods
```
- To'g'ridan-to'g'ri APK (karta to'lovi bilan): `REACT_APP_STORE_BUILD=false`.
- Do'kon uchun: `REACT_APP_STORE_BUILD=true`.

## 5) Do'konga chiqarishdan oldin
- Ikonka/splash: `npx @capacitor/assets generate` (`resources/icon.png` 1024x1024, `splash.png` 2732x2732).
- Maxfiylik siyosati URL, ilova skrinshotlari.
- Akkauntni o'chirish tugmasi menyuda bor (Apple talabi).
