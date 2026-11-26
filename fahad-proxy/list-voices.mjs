// يطلع أرقام أصوات HUMAIN (عشان تختار صوت فهد). شغّله على جهازك، المفتاح ما ينحفظ في أي ملف:
//   npm i @humain-voice/sdk@0.19.0
//   HUMAIN_API_KEY=مفتاحك node list-voices.mjs
import { TTSClient } from '@humain-voice/sdk';
const c = new TTSClient({ api_url: 'https://api.voice.humain.com', api_key: process.env.HUMAIN_API_KEY });
const voices = await c.listVoices({ timeoutSeconds: 10 });
console.table(voices.map(v => ({ label: v.label, id: v.id })));
await c.close(); process.exit(0);
