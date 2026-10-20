# ربط Neon + Vercel — دليل الإعداد

> **مسار قديم:** هذا المستند يشرح نشر Vercel/Neon السابق. فرع الترحيل الحالي يستخدم Cloudflare Worker وKV، ومصدره المستقل في [famly-pluse-backend](https://github.com/fszazo5-design/famly-pluse-backend). لا تطبق إعدادات هذا الدليل على Worker؛ اتبع README في مستودع الباك إند.

## نظرة عامة

يحتوي هذا المشروع على طبقتين للباك-إند:

1. **Neon + Vercel** — قاعدة البيانات والخدمات الخلفية الرئيسية.
2. **Neon + Vercel** (الباك-إند البديل) — ملفات API خادمة على Vercel
   تتصل بقاعدة بيانات Neon Postgres. ملفات API موجودة في مجلد `api/`.

## ملفات الباك-إند على Vercel

```
api/
├── lib/
│   ├── neon.ts              # اتصال Neon Postgres
│   └── http.ts              # أدوات CORS و JSON responses
├── sos/
│   ├── trigger.ts           # POST — إنشاء تنبيه SOS + بث للعائلة
│   ├── resolve.ts           # POST — إنهاء تنبيه SOS
│   └── active.ts            # GET — التنبيهات النشطة للعائلة
├── tracking/
│   ├── start.ts             # POST — بدء جلسة تتبع
│   ├── stop.ts              # POST — إنهاء جلسة تتبع
│   ├── breadcrumb.ts        # POST — إضافة نقطة GPS
│   └── sessions.ts          # GET — الجلسات النشطة + المسارات
├── family/
│   ├── members.ts           # GET — أفراد العائلة
│   └── group.ts             # GET/POST — إنشاء/انضمام لعائلة
├── audio-vault/
│   └── log.ts               # GET/POST — سجلات التسجيلات الصوتية
├── check-in/
│   ├── create.ts            # POST — إنشاء مؤقت وصول آمن
│   ├── confirm.ts           # POST — تأكيد الوصول برمز PIN
│   └── active.ts            # GET — المؤقتات النشطة
└── neon-schema.sql          # SQL لإنشاء الجداول في Neon
```

## خطوات الإعداد

### 1. إنشاء قاعدة بيانات Neon

1. اذهب إلى https://neon.tech وأنشئ حسابًا.
2. أنشئ مشروعًا جديدًا (New Project).
3. انسخ **Connection String** (يبدأ بـ `postgresql://...`).
4. افتح SQL Editor في Neon والصق محتوى ملف `api/neon-schema.sql` ثم نفّذه.

### 2. نشر الباك-إند على Vercel

1. اذهب إلى https://vercel.com وأنشئ حسابًا.
2. ارفع هذا المشروع (Import Git Repository أو Vercel CLI).
3. في إعدادات المشروع على Vercel، أضف متغير البيئة:
   - **Name:** `DATABASE_URL`
   - **Value:** (الصق Connection String من Neon)
   - عند استخدام تكامل Neon في Vercel، سيُنشئ التكامل `DATABASE_URL` تلقائيًا؛ استخدمه مباشرة ولا حاجة لإضافة متغير آخر.
   - يبقى `NEON_DATABASE_URL` مدعومًا كاسم قديم احتياطيًا إذا كان موجودًا مسبقًا.
4. انشر المشروع (Deploy).

### 3. ربط التطبيق بالباك-إند

في ملف `.env` الخاص بالمشروع، أضف:

```
VITE_API_URL=https://your-project.vercel.app
```

ثم استخدم `apiClient.ts` في الواجهة الأمامية:

```typescript
import { api } from '@/lib/apiClient';

// إطلاق SOS
const result = await api.triggerSOS({
  family_id: 'xxx',
  triggered_by: 'yyy',
  trigger_type: 'manual',
});

// بدء تتبع
const { session } = await api.startTracking({
  family_id: 'xxx',
  user_id: 'yyy',
});

// إضافة نقطة GPS
await api.pushBreadcrumb({
  session_id: session.id,
  user_id: 'yyy',
  family_id: 'xxx',
  latitude: 24.7136,
  longitude: 46.6753,
});
```

## مسارات API

| Method | Path | الوصف |
|--------|------|-------|
| POST | `/api/sos/trigger` | إنشاء تنبيه SOS + إبلاغ العائلة |
| POST | `/api/sos/resolve` | إنهاء تنبيه SOS |
| GET | `/api/sos/active?family_id=` | التنبيهات النشطة |
| POST | `/api/tracking/start` | بدء جلسة تتبع مباشر |
| POST | `/api/tracking/stop` | إنهاء جلسة تتبع |
| POST | `/api/tracking/breadcrumb` | إضافة نقطة GPS |
| GET | `/api/tracking/sessions?family_id=` | الجلسات النشطة + آخر مواقع |
| GET | `/api/tracking/sessions?session_id=` | مسار كامل لجلسة محددة |
| GET | `/api/family/members?family_id=` | أفراد العائلة |
| GET | `/api/family/group?join_code=` | بحث عن عائلة برمز الانضمام |
| POST | `/api/family/group` | إنشاء/انضمام لعائلة |
| GET | `/api/audio-vault/logs?family_id=` | سجلات التسجيلات الصوتية |
| POST | `/api/audio-vault/log` | إضافة سجل تسجيل صوتي |
| POST | `/api/check-in/create` | إنشاء مؤقت وصول آمن |
| POST | `/api/check-in/confirm` | تأكيد الوصول برمز PIN |
| GET | `/api/check-in/active?family_id=` | المؤقتات النشطة |

## ملاحظات

- جميع مسارات API تعمل على **Vercel Edge Runtime** لأسرع استجابة.
- ملف `neon-schema.sql` ينشئ الجداول المطلوبة لتطبيق نبض العائلة
  بدون RLS (لأن التحكم في الوصول يتم عبر طبقة الـ API).
- جميع مسارات API تستورد عميل Neon مشتركًا من `server/api/lib/neon.ts`.
  يقرأ `process.env.DATABASE_URL` أولًا، ثم يستخدم `NEON_DATABASE_URL` كخيار احتياطي قديم.
  لا تضع رابط الاتصال في متغير يبدأ بـ `VITE_`.
