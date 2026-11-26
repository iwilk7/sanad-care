/* خادم فهد — وسيط صغير بين موقع سند وHUMAIN Voice
   ليش موجود؟ مفتاح HUMAIN لازم يبقى على خادم، ما ينحط في كود الموقع (الموقع عام على GitHub).
   المسارات:
     GET  /health    فحص سريع
     POST /session   يبدأ مكالمة «فهد» الحيّة (HUMAIN Voice Agent) ويرجّع {server_url, participant_token}
     POST /tts       يحوّل نص قصير إلى صوت سعودي mp3 (HUMAIN Nebula)
   الأسرار (Cloudflare → Settings → Variables and Secrets):
     HUMAIN_API_KEY  (Secret)   مفتاحك من console — لازم يكون فيه صلاحية agent
     VOICE_ID        (اختياري)  رقم صوت فهد (UUID) — فاضي = الصوت الافتراضي
     ALLOWED_ORIGINS (اختياري)  مواقع مسموحة مفصولة بفواصل */

const API_URL = 'https://api.voice.humain.com';
const DEFAULT_ORIGINS = ['https://iwilk7.github.io', 'http://localhost:8765', 'http://127.0.0.1:8765'];

const PROMPT = `أنت «فهد»، المساعد الصوتي في تطبيق «سند» لرعاية كبار السن في السعودية.
تكلم {{name}} ({{role}}) بلهجة سعودية بيضاء، دافية ومحترمة، بجمل قصيرة وواضحة وبطيئة شوي. نادِه باسمه أحيانًا. لا تطوّل: جملتين أو ثلاث بالكثير ثم اسأل سؤال واحد.

اللي تقدر تسويه (استخدم الأدوات، لا تخمّن من عندك):
- تقول له وش عنده اليوم: get_today.
- تذكّره بأدويته وأوقاتها المربوطة بيومه (بعد الفطور، بعد الغدا، قبل النوم): get_medications.
- إذا قال إنه أخذ دواء: كرّر له اسم الدواء وتأكد منه بسؤال «يعني أخذت كذا الحين؟»، وإذا قال نعم بوضوح سجّله بـ confirm_dose. إذا مو متأكد لا تسجّل.
- مواعيده: get_appointment. وإذا عنده سؤال للدكتور سجّله بـ add_doctor_question.
- مين الأقرب من أهله: who_is_nearest.
- إذا طلب أحد يكلمه أو قال إنه طفشان: notify_family بدرجة normal.
- طمّن أهله إذا قال إنه بخير: report_wellbeing.

حدود ثابتة ما تتجاوزها أبدًا:
- لا تشخّص ولا تفسّر أعراض، ولا تقترح دواء، ولا تغيّر جرعة، ولا تقول له ياخذ جرعة زيادة أو يعوّض جرعة فايتة. قل له يسأل الصيدلي أو الطبيب.
- إذا ذكر طيحة، ألم في الصدر، ضيق تنفس، نزيف، دوخة شديدة أو أي خطر: قل له يتصل بالهلال الأحمر 997 فورًا، واستدعِ notify_family بدرجة urgent بنفس اللحظة.
- لا تخترع معلومات عن أدويته أو مواعيده. إذا الأداة ما رجعت شي قل ما عندي.
- لا تتكلم بمواضيع بعيدة عن رعايته ويومه إلا سوالف خفيفة تونّسه.
اليوم: {{today}}.`;

const INTRO = 'هلا والله يا {{name}}، معك فهد. بشّرني عنك، كيف حالك اليوم؟';

const s = (type, description, extra = {}) => ({ type, description, ...extra });
const TOOLS = [
  { name: 'get_today', description: 'ملخص يوم كبير السن: الأدوية المتأكدة والباقية، الموعد الجاي، وأي متابعة مفتوحة.', parameters: { type: 'object', properties: {} } },
  { name: 'get_medications', description: 'قائمة أدوية اليوم مع الوقت والارتباط باليوم (بعد الفطور/الغدا/قبل النوم) وحالة التأكيد.', parameters: { type: 'object', properties: {} } },
  { name: 'confirm_dose', description: 'يسجّل أن كبير السن أخذ دواء معيّن، بعد ما يأكد بوضوح. يرجع خطأ إذا الدواء غير موجود أو متأكد من قبل.', parameters: { type: 'object', properties: { medication: s('string', 'اسم الدواء كما في القائمة أو وقته مثل الظهر') }, required: ['medication'] } },
  { name: 'get_appointment', description: 'الموعد الطبي الجاي: العيادة، الطبيب، التاريخ، الوقت، المكان، المرافق، وعدد أسئلة الدكتور.', parameters: { type: 'object', properties: {} } },
  { name: 'add_doctor_question', description: 'يضيف سؤال لقائمة أسئلة الطبيب في ورقة الزيارة.', parameters: { type: 'object', properties: { question: s('string', 'السؤال بكلام كبير السن') }, required: ['question'] } },
  { name: 'who_is_nearest', description: 'ترتيب أفراد الأسرة من الأقرب للأبعد، والتنبيه يروح للأقرب أولًا.', parameters: { type: 'object', properties: {} } },
  { name: 'notify_family', description: 'يبلّغ أقرب فرد من الأسرة. urgent للخطر (يبدأ دائرة الاستجابة: ٥ دقايق لكل فرد). normal لطلب مكالمة أو اطمئنان.', parameters: { type: 'object', properties: { urgency: s('string', 'درجة التنبيه', { enum: ['urgent', 'normal'] }), reason: s('string', 'السبب باختصار') }, required: ['urgency', 'reason'] } },
  { name: 'report_wellbeing', description: 'يسجّل رد اطمئنان كبير السن عشان أهله يشوفونه في ملخص فهد.', parameters: { type: 'object', properties: { status: s('string', 'حالته', { enum: ['fine', 'tired'] }), note: s('string', 'كلامه باختصار') }, required: ['status'] } }
];

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(x => x.trim()) : DEFAULT_ORIGINS);
  const ok = allowed.includes(origin);
  return { ok, headers: ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' } };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
const clip = (v, n) => String(v ?? '').replace(/[{}<>]/g, '').slice(0, n);

async function readJson(req) { try { return await req.json() } catch { return {} } }

async function humain(env, path, body) {
  return fetch(API_URL + path, { method: 'POST', headers: { 'x-api-key': env.HUMAIN_API_KEY, 'Content-Type': 'application/json', Origin: API_URL }, body: JSON.stringify(body) });
}

async function upstreamError(r, headers) {
  let detail = ''; try { detail = (await r.text()).slice(0, 300) } catch { }
  const code = r.status === 401 ? 'bad_key' : r.status === 403 ? 'no_access' : r.status === 429 ? 'busy' : 'upstream';
  return json({ error: code, status: r.status, detail }, r.status === 429 ? 429 : 502, headers);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), c = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
    if (url.pathname === '/health') return json({ ok: true, key: Boolean(env.HUMAIN_API_KEY), voice: Boolean(env.VOICE_ID) }, 200, c.headers);
    if (!c.ok) return json({ error: 'origin_not_allowed' }, 403, c.headers);
    if (req.method !== 'POST') return json({ error: 'method' }, 405, c.headers);
    if (!env.HUMAIN_API_KEY) return json({ error: 'no_key' }, 500, c.headers);
    const b = await readJson(req);

    if (url.pathname === '/session') {
      const role = b.role === 'family' ? 'من أسرة كبير السن' : 'كبير السن';
      const agent = { prompt: PROMPT, intro: INTRO, client_tools: TOOLS, dialect: 'gulf', tool_acknowledgments: { initial: { enabled: true, after_ms: 900 } } };
      if (env.VOICE_ID) agent.voice_id = env.VOICE_ID;
      const r = await humain(env, '/agent/sessions', {
        participant: { identity: 'sanad-' + crypto.randomUUID().slice(0, 8), name: clip(b.name, 40) || 'كبير السن', gender: b.gender === 'female' ? 'female' : 'male' },
        agent,
        variables: { name: clip(b.name, 40) || 'الغالي', role, today: clip(b.today, 60) || new Date().toISOString().slice(0, 10) }
      });
      if (!r.ok) return upstreamError(r, c.headers);
      const d = await r.json();
      return json({ server_url: d.server_url, participant_token: d.participant_token }, 200, c.headers);
    }

    if (url.pathname === '/tts') {
      const text = clip(b.text, 600).trim();
      if (!text) return json({ error: 'empty' }, 400, c.headers);
      const body = { model: 'nebula', input: text, response_format: 'mp3' };
      if (env.VOICE_ID) body.voice = env.VOICE_ID;
      const r = await humain(env, '/v1/audio/speech', body);
      if (!r.ok) return upstreamError(r, c.headers);
      return new Response(r.body, { status: 200, headers: { ...c.headers, 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg', 'Cache-Control': 'no-store' } });
    }
    return json({ error: 'not_found' }, 404, c.headers);
  }
};
