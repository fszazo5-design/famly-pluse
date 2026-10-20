# بناء نسخة Android لتطبيق نبض العائلة

## المتطلبات

- Node.js 20 أو أحدث
- Android Studio أو Android SDK Platform 35
- JDK 21
- ضبط `ANDROID_HOME` أو إنشاء `android/local.properties` بمسار SDK

### أسرار GitHub Actions المطلوبة للبناء

أضف هذه القيم إلى **Settings → Secrets and variables → Actions** في مستودع GitHub:

- `VITE_API_URL=https://famly-pluse-api.fszazo5.workers.dev` — عنوان API الخاص بـ Cloudflare Worker (يمكن تركه فارغًا لاستخدام العنوان الافتراضي المضمّن بالتطبيق).
- `VITE_TURNSTILE_SITE_KEY` — Site Key عام من Cloudflare، يُضمّن في الويب والهاتف؛ ليس سرًا.
- `VITE_HELP_VIDEO_URL` — اختياري.
- أسرار توقيع APK/AAB الموجودة في workflow.

يستضيف Worker صفحة `/turnstile-widget.html` ويضمّنها التطبيق داخل الويب أو WebView. أضف اسم المضيف `famly-pluse-api.fszazo5.workers.dev` إلى Hostname Management في Widget Turnstile. استخدم action باسم `request_otp`.

أضف **Secret Key** المقابل إلى Cloudflare Worker باسم `TURNSTILE_SECRET_KEY` عبر `wrangler secret put` أو إعدادات Worker. لا تضع هذا المفتاح داخل GitHub أو تطبيق Android أو أي متغير يبدأ بـ `VITE_`.

## حماية الويب والهاتف

- نسختا الويب والهاتف تستخدمان Cloudflare Turnstile مع تحقق server-side في Worker.
- عند نقل OTP إلى Worker، لم يعد فحص Vercel BotID مستخدمًا لهذا المسار.

## إعداد Auth0 وCloudflare Worker

يستخدم المشروع **Auth0 Passwordless SMS** فقط لإرسال والتحقق من OTP. أضف القيم التالية كـ Worker secrets/variables في Cloudflare:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_REDIRECT_URI=https://famlypulse.vercel.app/`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_SECRET_KEY` (سرّ تحقق Turnstile)

لا تُستخدم قاعدة Neon في Worker الحالي. البيانات التشغيلية تُكتب إلى KV. لا تستخدم إعدادات Twilio القديمة؛ لم تعد جزءًا من مسار OTP. راجع مستودع الباك إند لحدود KV المهمة قبل الاستخدام الإنتاجي في حالات الطوارئ.

## بناء APK تجريبي

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

الملف الناتج يكون في:

`android/app/build/outputs/apk/debug/app-debug.apk`

## بناء نسخة Release

يشغّل GitHub Actions الـworkflow عند بدء `workflow_dispatch` أو دفع tag مثل `v1.0.0`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

ينتج الـworkflow ملفي APK وAAB موقّعين ويحفظهما كـArtifacts.

## التصاريح المضافة

تمت إضافة التصاريح اللازمة للوظائف الحالية فقط:

- الإنترنت وحالة الشبكة لاتصالات API وخادم Neon.
- الموقع الدقيق/التقريبي والموقع في الخلفية للتتبع وSOS.
- خدمة foreground للموقع والميكروفون.
- الميكروفون لخزنة الصوت عند تفعيل التسجيل.
- الإشعارات والاهتزاز وتنبيهات الطوارئ.
- Wake lock وBoot completed لاستمرارية مراقبة الأمان.

لا توجد صلاحيات الكاميرا أو الاتصال الهاتفي حاليًا لأن التطبيق لا ينفذ هاتين الوظيفتين في الواجهة الحالية. أضفها فقط عند تنفيذ الوظيفة فعليًا.

## فيديو الشرح

ضع رابط فيديو MP4 في متغير البيئة قبل البناء:

```bash
VITE_HELP_VIDEO_URL=https://example.com/guardian-help.mp4 npm run build
npx cap sync android
```

تظهر الصفحة من لوحة التحكم تحت **دليل الاستخدام**. ملف PDF العربي موجود داخل التطبيق في `/guide.pdf`.
