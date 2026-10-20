# Phone OTP + Family Code عبر Cloudflare Worker

## مسار المصادقة

يستخدم التطبيق عنوان API التالي:

```text
https://famly-pluse-api.fszazo5.workers.dev
```

يستخدم Worker خدمة Auth0 Passwordless SMS للتحقق من رقم الهاتف، وCloudflare Turnstile للحماية من الطلبات الآلية، وCloudflare KV لتخزين المستخدمين والعائلات والجلسات.

التطبيق يرسل طلبات OTP إلى:

- `POST /api/auth/request-otp` مع `{ phone, captchaToken }`
- `POST /api/auth/verify-otp` مع `{ phone, code, display_name }`
- `POST /api/family/complete` مع `Authorization: Bearer <token>` لإنشاء عائلة أو الانضمام إليها

## إعداد Worker

أضف أسرار Auth0 وTurnstile إلى مستودع الباك أو Cloudflare Worker فقط:

```sh
npx wrangler secret put AUTH0_DOMAIN
npx wrangler secret put AUTH0_CLIENT_ID
npx wrangler secret put AUTH0_CLIENT_SECRET
npx wrangler secret put AUTH0_REDIRECT_URI
npx wrangler secret put TURNSTILE_SECRET_KEY
```

لا تضع أيًا من هذه القيم داخل متغير يبدأ بـ `VITE_` أو داخل APK.

## إعداد Turnstile

أنشئ Widget من Cloudflare Turnstile بنمط Managed، ثم اسمح باسم المضيف الخاص بالـ Worker:

```text
famly-pluse-api.fszazo5.workers.dev
```

ضع Site Key العام في Secret باسم:

```text
VITE_TURNSTILE_SITE_KEY
```

يستخدم التطبيق صفحة `/turnstile-widget.html` التي يقدمها Worker نفسه. لا يعتمد التطبيق على Vercel أو BotID.

## إعداد التطبيق

استخدم رابط Worker في بيئة البناء:

```text
VITE_API_URL=https://famly-pluse-api.fszazo5.workers.dev
```

وهو أيضًا الرابط الافتراضي المضمّن في الواجهة وWorkflow Android وWorkflow OTA.

## قاعدة البيانات والتخزين

يستخدم Worker KV binding باسم `DATA`. شغّل إعدادات KV الموجودة في مستودع الباك قبل استقبال المستخدمين. KV مناسب للاختبار والأحمال المنخفضة، لكن بيانات SOS والتتبع الحرجة تحتاج لاحقًا إلى تخزين معاملاتي مثل D1 أو Durable Objects.

## ملاحظات أمان

- لا ترسل OTP قبل نجاح Turnstile server-side.
- لا تسجل رموز OTP أو Tokens أو مفاتيح Auth0 أو مفتاح Turnstile السري.
- استخدم HTTPS فقط.
- أبقِ CORS في Worker محدودًا للنطاقات المطلوبة و`capacitor://localhost`.
- لا تستخدم رابط مستودع GitHub كعنوان API؛ الرابط الوحيد للاتصال هو عنوان Worker المنشور.
