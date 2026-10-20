# Firebase Phone OTP + Family Code عبر Cloudflare Worker

## مسار المصادقة

يستخدم التطبيق عنوان API التالي:

```text
https://famly-pluse-api.fszazo5.workers.dev
```

تستخدم الواجهة Firebase Phone Auth لإرسال SMS والتحقق من reCAPTCHA، ثم ترسل Firebase ID token إلى Worker. يتحقق Worker من الرمز عبر Firebase Identity Toolkit ويصدر جلسة Bearer محلية، بينما يستمر Cloudflare KV في تخزين المستخدمين والعائلات والجلسات.

التطبيق يرسل طلبات OTP إلى:

- `POST /api/auth/firebase-exchange` مع `{ id_token, display_name }`
- `POST /api/family/complete` مع `Authorization: Bearer <token>` لإنشاء عائلة أو الانضمام إليها

## إعداد Firebase وWorker

فعّل Phone provider في Firebase Authentication، وأضف نطاق الواجهة إلى Authorized domains، ثم أضف Web API key إلى Worker فقط:

```sh
npx wrangler secret put FIREBASE_WEB_API_KEY
```

لا تضع أيًا من هذه القيم داخل متغير يبدأ بـ `VITE_` أو داخل APK.

## إعداد الواجهة

ضع قيم Web app الظاهرة في Firebase Console داخل `.env`:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

القيم السابقة public configuration وليست service-account secrets. لا تضع service account JSON داخل الواجهة أو APK.

## إعداد التطبيق

عنوان Worker مثبت داخل الواجهة وWorkflow Android وWorkflow OTA، ولا يعتمد على متغير رابط قابل للتغيير:

```text
https://famly-pluse-api.fszazo5.workers.dev
```

## قاعدة البيانات والتخزين

يستخدم Worker KV binding باسم `DATA`. شغّل إعدادات KV الموجودة في مستودع الباك قبل استقبال المستخدمين. KV مناسب للاختبار والأحمال المنخفضة، لكن بيانات SOS والتتبع الحرجة تحتاج لاحقًا إلى تخزين معاملاتي مثل D1 أو Durable Objects.

## ملاحظات أمان

- لا ترسل OTP قبل نجاح Turnstile server-side.
- لا تسجل رموز OTP أو Tokens أو مفاتيح Auth0 أو مفتاح Turnstile السري.
- استخدم HTTPS فقط.
- أبقِ CORS في Worker محدودًا للنطاقات المطلوبة و`capacitor://localhost`.
- لا تستخدم رابط مستودع GitHub كعنوان API؛ الرابط الوحيد للاتصال هو عنوان Worker المنشور.
