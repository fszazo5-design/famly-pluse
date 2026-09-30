# بناء نسخة Android لتطبيق نبض العائلة

## المتطلبات

- Node.js 20 أو أحدث
- Android Studio أو Android SDK Platform 35
- JDK 21
- ضبط `ANDROID_HOME` أو إنشاء `android/local.properties` بمسار SDK

### أسرار GitHub Actions المطلوبة للبناء

أضف هذه القيم إلى **Settings → Secrets and variables → Actions** في مستودع GitHub:

- `VITE_API_URL=https://famlypulse.vercel.app` — رابط API المنشور على Vercel.
- `VITE_TURNSTILE_SITE_KEY` — Site Key عام من Cloudflare، يُضمّن في تطبيق الهاتف؛ ليس سرًا.
- `VITE_HELP_VIDEO_URL` — اختياري.
- أسرار توقيع APK/AAB الموجودة في workflow.

ينشئ التطبيق صفحة Turnstile صغيرة مستضافة على نطاق Vercel نفسه، ثم يضمّنها داخل WebView. لذلك أضف `famlypulse.vercel.app` إلى Hostname Management في Widget Turnstile. لا تضف `localhost`؛ صفحة الاختبار نفسها مستضافة على Vercel.

أضف **Secret Key** المقابل في Vercel Project → **Settings → Environment Variables** باسم `TURNSTILE_SECRET_KEY` (Production، وPreview عند الحاجة). لا تضع هذا المفتاح داخل GitHub أو تطبيق Android أو أي متغير يبدأ بـ `VITE_`.

## حماية الويب والهاتف

- نسخة الويب تستخدم **Vercel BotID Basic** بشكل غير مرئي، بلا مفاتيح Cloudflare.
- تطبيق Capacitor للهاتف يستخدم Cloudflare Turnstile، لأن طلباته من WebView محلي إلى Vercel عابرة للنطاق.
- فعّل OIDC في Vercel Project → **Settings → Security → Secure backend access with OIDC federation** ليتمكن BotID من التحقق من طلبات الويب.

## إعداد Auth0 وNeon

يستخدم المشروع **Auth0 Passwordless SMS** فقط لإرسال والتحقق من OTP. في Vercel، تأكد من وجود المتغيرات التالية على الخادم:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_REDIRECT_URI=https://famlypulse.vercel.app/`
- `TURNSTILE_SECRET_KEY`
- `DATABASE_URL` من تكامل Neon، أو `NEON_DATABASE_URL`

لا تستخدم إعدادات Twilio القديمة؛ لم تعد جزءًا من مسار OTP.

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
