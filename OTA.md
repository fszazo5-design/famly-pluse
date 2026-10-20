# تحديث واجهة التطبيق عبر OTA

يستخدم التطبيق `@capgo/capacitor-updater` لتحديث ملفات الواجهة فقط من GitHub Releases. عند كل push إلى `main` في ملفات الواجهة، ينفذ Workflow باسم **Frontend OTA Release**، ويبني `dist.zip` وينشره كإصدار يبدأ بـ `ota-`. عند التنزيل، يمر ملف ZIP عبر `/api/ota/download` في Cloudflare Worker حتى لا يتأثر Android بإعادة توجيه GitHub إلى `release-assets.githubusercontent.com`.

عند تشغيل التطبيق على Android، يفحص آخر Release في المستودع `fszazo5-design/famly-pluse`. إذا وُجد `dist.zip` بإصدار جديد، يظهر تنبيه داخل التطبيق. بعد التنزيل يتم تجهيز الحزمة لتعمل عند إعادة فتح التطبيق. إذا فشلت الحزمة في الإقلاع، يعيد native updater تلقائيًا إلى آخر حزمة سليمة.

## ما الذي يدعم OTA؟

تحديثات React وTypeScript وJavaScript وCSS وHTML والصور والملفات الثابتة مناسبة لـ OTA، بشرط ألا تعتمد على قدرة native غير موجودة في نسخة APK المثبتة.

إضافة أو إزالة Capacitor plugin، تعديل Kotlin/Java، تغيير `AndroidManifest.xml` أو الصلاحيات، أو تحديث إعدادات Android يحتاج إصدار APK/AAB جديدًا عبر Workflow **Android Release**. لا تنشر هذه التغييرات كـ OTA.

## التشغيل اليدوي

يمكن تشغيل **Frontend OTA Release** من تبويب Actions عبر `workflow_dispatch`. لا تحتاج إلى إضافة secret جديد؛ يستخدم الـ Workflow `GITHUB_TOKEN` بصلاحية `contents: write` لإنشاء Release.

إذا نُقل المشروع إلى مستودع آخر، غيّر `VITE_OTA_REPOSITORY` في أسرار GitHub أو عدّل القيمة الافتراضية في `.env.example`.
