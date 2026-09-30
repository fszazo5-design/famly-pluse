import { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ExternalLink, FileText, PlayCircle, Shield } from 'lucide-react';

type HelpTab = 'pdf' | 'video';

const videoUrl = import.meta.env.VITE_HELP_VIDEO_URL?.trim() ?? '';

const steps = [
  { title: 'إطلاق تنبيه SOS', text: 'اضغط مطولًا على زر SOS لمدة ثانية ونصف حتى يكتمل المؤشر. سيصل التنبيه إلى أفراد مجموعتك.' },
  { title: 'تتبع العائلة', text: 'افتح بطاقة التتبع لرؤية أفراد المجموعة ومساراتهم عند تفعيل جلسة التتبع.' },
  { title: 'مؤقت الوصول', text: 'حدد مدة الوصول المتوقعة. عند انتهاء الوقت دون إلغاء المؤقت، يُرسل تنبيه تلقائي.' },
  { title: 'خزنة الصوت', text: 'استخدم الخزنة لحفظ التسجيلات المرتبطة بحالات الطوارئ ومراجعتها بأمان.' },
];

export default function HelpCenter({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<HelpTab>('pdf');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto px-5 py-6 pb-10">
        <header className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-white" aria-label="العودة">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xs text-primary-400 font-medium">مركز المساعدة</p>
              <h1 className="text-xl font-bold text-white">كيف تستخدم نبض العائلة؟</h1>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-400" />
          </div>
        </header>

        <div className="glass-card p-1.5 flex gap-1 mb-5" role="tablist" aria-label="نوع الدليل">
          <button onClick={() => setTab('pdf')} role="tab" aria-selected={tab === 'pdf'} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'pdf' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <FileText className="w-4 h-4 inline ml-1.5 -mt-0.5" /> دليل PDF
          </button>
          <button onClick={() => setTab('video')} role="tab" aria-selected={tab === 'video'} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'video' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <PlayCircle className="w-4 h-4 inline ml-1.5 -mt-0.5" /> فيديو الشرح
          </button>
        </div>

        {tab === 'pdf' ? (
          <section className="space-y-4" aria-label="دليل PDF">
            <div className="glass-card p-5 border-primary-500/20">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary-600/20 flex items-center justify-center"><FileText className="w-6 h-6 text-primary-400" /></div>
                <div>
                  <h2 className="font-bold text-white">دليل استخدام نبض العائلة</h2>
                  <p className="text-xs leading-6 text-slate-400 mt-1">شرح مختصر للتنبيهات، التتبع، مؤقت الوصول، وخزنة الصوت.</p>
                </div>
              </div>
              <a href="/guide.pdf" target="_blank" rel="noreferrer" className="mt-5 w-full btn-primary py-3 flex items-center justify-center gap-2 text-sm">
                فتح دليل PDF <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.title} className="glass-card p-4 flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</div>
                  <div><h3 className="text-sm font-semibold text-white">{step.title}</h3><p className="text-xs leading-6 text-slate-400 mt-0.5">{step.text}</p></div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-4" aria-label="فيديو الشرح">
            <div className="glass-card overflow-hidden border-secondary-500/20">
              {videoUrl ? (
                <video className="w-full aspect-video bg-black" controls playsInline preload="metadata" src={videoUrl} />
              ) : (
                <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 flex flex-col items-center justify-center p-6 text-center">
                  <PlayCircle className="w-14 h-14 text-primary-400 mb-3" />
                  <p className="text-sm font-semibold text-white">فيديو الشرح غير مضاف بعد</p>
                  <p className="text-xs text-slate-400 leading-6 mt-2">أضف رابط الفيديو في المتغير VITE_HELP_VIDEO_URL ثم أعد بناء التطبيق.</p>
                </div>
              )}
              <div className="p-4"><h2 className="font-bold text-white">شرح استخدام التطبيق</h2><p className="text-xs text-slate-400 mt-1">شاهد الخطوات الأساسية لتفعيل SOS والتتبع وإدارة المجموعة.</p></div>
            </div>
            <div className="glass-card p-4 flex gap-3"><CheckCircle2 className="w-5 h-5 text-success-400 shrink-0" /><p className="text-xs leading-6 text-slate-400">لأفضل نتيجة، اسمح للتطبيق بالموقع والإشعارات والميكروفون عند الحاجة إلى ميزات الطوارئ.</p></div>
          </section>
        )}

        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5"><Shield className="w-3.5 h-3.5" /> دليل نبض العائلة — السلامة أولًا</div>
      </div>
    </div>
  );
}
