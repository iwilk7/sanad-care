# خادم فهد (HUMAIN Voice)

وسيط صغير يحمل مفتاح HUMAIN بدل ما ينحط في موقع سند (الموقع عام). مجاني على Cloudflare Workers.

## التشغيل (١٠ دقايق)
1. ادخل **dash.cloudflare.com** ← Workers & Pages ← Create ← **Hello World** worker، وسمّه `sanad-fahad`.
2. **Edit code**: امسح الموجود والصق محتوى `worker.js` كامل ← **Deploy**.
3. Settings ← **Variables and Secrets** ← Add:
   - `HUMAIN_API_KEY` نوعه **Secret** = مفتاحك من console.voice.humain.com (فعّل له صلاحية **agent** عشان المكالمة الحيّة).
   - `VOICE_ID` (اختياري) = رقم صوت فهد. فاضي = صوت HUMAIN الافتراضي. لمعرفة رقم صوت عبدالعزيز `mul_abdulaziz` شغّل `list-voices.mjs`.
4. انسخ رابط الـ Worker (مثل `https://sanad-fahad.xxxx.workers.dev`) وافتح `/health` — لازم يطلع `"key":true`.
5. في سند: **الإعدادات ← صوت فهد** الصق الرابط ← حفظ ← «جرّب صوت فهد».
   أو شارك الفريق رابط: `https://iwilk7.github.io/sanad-care/?fahad=رابط-الـWorker`

## وش يسوي
- `POST /session` يبدأ مكالمة فهد الحيّة (HUMAIN Voice Agent، لهجة خليجية) مع ٨ أدوات تقرأ وتكتب في بيانات سند داخل المتصفح.
- `POST /tts` يحوّل نص قصير (٦٠٠ حرف) لصوت mp3 — يستخدمه الموقع لكل القراءة الصوتية.
- يقبل الطلبات من `iwilk7.github.io` فقط (غيّرها بـ `ALLOWED_ORIGINS`).

## تنبيهات
- لا تحط المفتاح في GitHub أو في رابط.
- الباقة المجانية في HUMAIN فيها ٥٠٠٠ رصيد ≈ ٦٫٥ دقيقة مكالمة حيّة. وفّرها للعرض.
- بيانات العرض تجريبية فقط.
