// On. Track – kleiner Server (Cloudflare Worker)
// Aufgabe: hält den Intervals.icu-API-Key geheim und liefert der App ihre Daten.
// Secrets (per `wrangler secret put`): INTERVALS_API_KEY, APP_TOKEN
// Variablen (wrangler.toml): ATHLETE_ID, ALLOWED_ORIGIN
// KV-Bindung AI (für den Coach): speichert die KI-Keys, die in der App eingegeben werden

const API = 'https://intervals.icu/api/v1';

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    // Nur die eigene App darf rein
    if (req.headers.get('Authorization') !== `Bearer ${env.APP_TOKEN}`) {
      return json({ error: 'Nicht angemeldet' }, 401, cors);
    }

    const url = new URL(req.url);
    const iv = (path, init = {}) => fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: 'Basic ' + btoa(`API_KEY:${env.INTERVALS_API_KEY}`),
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    try {
      // Alle Daten für die App in einem Rutsch
      if (req.method === 'GET' && url.pathname === '/api/snapshot') {
        const today = url.searchParams.get('today') || berlinToday();
        const A = env.ATHLETE_ID;
        const [sport, events, acts, well] = await Promise.all([
          iv(`/athlete/${A}/sport-settings`).then(r => r.json()),
          iv(`/athlete/${A}/events?oldest=${addDays(today, -14)}&newest=${addDays(today, 28)}`).then(r => r.json()),
          iv(`/athlete/${A}/activities?oldest=${addDays(today, -395)}&newest=${today}`).then(r => r.json()),
          iv(`/athlete/${A}/wellness?oldest=${addDays(today, -365)}&newest=${today}`).then(r => r.json()),
        ]);
        const run = sport.find(s => (s.types || []).includes('Run')) || {};
        const snap = {
          generated: new Date().toISOString(),
          today,
          settings: {
            threshold_pace_ms: run.threshold_pace, pace_zones: run.pace_zones, pace_zone_names: run.pace_zone_names,
            lthr: run.lthr, max_hr: run.max_hr, hr_zones: run.hr_zones,
          },
          events: events.map(e => ({
            id: e.id, start_date_local: e.start_date_local, category: e.category, type: e.type, name: e.name,
            description: e.description, moving_time: e.moving_time, icu_training_load: e.icu_training_load,
            paired_activity_id: e.paired_activity_id, distance: e.distance,
            workout_doc: e.workout_doc ? { steps: e.workout_doc.steps || [], duration: e.workout_doc.duration } : null,
          })),
          // Bewusst ohne GPS-Daten
          activities: acts.map(a => ({
            id: a.id, start_date_local: a.start_date_local, type: a.type, name: a.name, distance: a.distance,
            moving_time: a.moving_time, icu_training_load: a.icu_training_load, average_heartrate: a.average_heartrate,
            average_speed: a.average_speed, total_elevation_gain: a.total_elevation_gain,
          })),
          wellness: well.map(w => ({ id: w.id, ctl: w.ctl, atl: w.atl, hrv: w.hrv, restingHR: w.restingHR, sleepSecs: w.sleepSecs, sleepScore: w.sleepScore })),
          streams: {},
        };
        // Verläufe (Pace, Puls) der gekoppelten Läufe der letzten zwei Wochen
        const paired = events.filter(e => e.paired_activity_id && e.start_date_local.slice(0, 10) >= addDays(today, -14)).map(e => e.paired_activity_id);
        await Promise.all(paired.slice(0, 8).map(async id => {
          const s = await iv(`/activity/${id}/streams?types=time,velocity_smooth,heartrate`).then(r => r.json());
          snap.streams[id] = downsample(s);
        }));
        return json(snap, 200, cors);
      }

      // Neues Workout anlegen (Train now: auf die Uhr oder für später)
      if (req.method === 'POST' && url.pathname === '/api/events') {
        const b = await req.json();
        const ev = {
          category: 'WORKOUT', type: b.type || 'Run',
          start_date_local: b.start_date_local, name: b.name, description: b.description,
        };
        const r = await iv(`/athlete/${env.ATHLETE_ID}/events`, { method: 'POST', body: JSON.stringify(ev) });
        return json(await r.json(), r.status, cors);
      }

      // Einheit ändern (Datum verschieben oder Schritte anpassen) bzw. löschen
      const m = url.pathname.match(/^\/api\/events\/(\d+)$/);
      if (req.method === 'DELETE' && m) {
        const r = await iv(`/athlete/${env.ATHLETE_ID}/events/${m[1]}`, { method: 'DELETE' });
        return json({ ok: r.ok }, r.status, cors);
      }
      if (req.method === 'PUT' && m) {
        const body = await req.json();
        const allowed = {};
        if (body.start_date_local) allowed.start_date_local = body.start_date_local;
        if (body.description) allowed.description = body.description;
        if (body.name) allowed.name = body.name;
        const r = await iv(`/athlete/${env.ATHLETE_ID}/events/${m[1]}`, { method: 'PUT', body: JSON.stringify(allowed) });
        return json(await r.json(), r.status, cors);
      }

      // ---------- Coach: KI-Keys und Anfragen ----------
      if (url.pathname.startsWith('/api/ai/')) return await ai(req, url, env, cors);

      return json({ error: 'Unbekannter Pfad' }, 404, cors);
    } catch (err) {
      return json({ error: String(err) }, 500, cors);
    }
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
function berlinToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}
function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function downsample(streams) {
  const S = Object.fromEntries((streams || []).map(x => [x.type, x.data]));
  const t = S.time || [], v = S.velocity_smooth || [], h = S.heartrate || [];
  const out = [];
  for (let i = 0; i < t.length; i += 20) {
    const vv = v.slice(i, i + 20).filter(Boolean), hh = h.slice(i, i + 20).filter(Boolean);
    out.push([t[i], vv.length ? +(vv.reduce((a, b) => a + b, 0) / vv.length).toFixed(3) : 0, hh.length ? Math.round(hh.reduce((a, b) => a + b, 0) / hh.length) : 0]);
  }
  return out;
}

/* ---------- Coach ---------- */
const PROVIDERS = {
  gemini:    { name: 'Gemini' },
  groq:      { name: 'Groq', base: 'https://api.groq.com/openai/v1' },
  openai:    { name: 'ChatGPT', base: 'https://api.openai.com/v1' },
  anthropic: { name: 'Claude' },
};
const DEFAULT_MODEL = { gemini: 'gemini-2.5-flash', groq: 'openai/gpt-oss-120b', openai: 'gpt-4o-mini', anthropic: 'claude-haiku-5-5' };

async function ai(req, url, env, cors) {
  if (!env.AI) return json({ error: 'KV-Bindung "AI" fehlt im Worker. Siehe Anleitung im README.' }, 500, cors);
  const conf = JSON.parse(await env.AI.get('config') || '{}'); // { order:[...], models:{...} }
  const keyOf = p => env.AI.get('key:' + p);

  // Status: welche Anbieter haben Keys (nur die letzten vier Zeichen)
  if (req.method === 'GET' && url.pathname === '/api/ai/status') {
    const out = {};
    for (const p of Object.keys(PROVIDERS)) { const k = await keyOf(p); out[p] = k ? k.slice(-4) : null; }
    return json({ keys: out, order: conf.order || [], models: conf.models || {} }, 200, cors);
  }
  // Key speichern oder löschen
  const km = url.pathname.match(/^\/api\/ai\/keys\/(\w+)$/);
  if (km && PROVIDERS[km[1]]) {
    if (req.method === 'PUT') { const { key } = await req.json(); if (!key || key.length < 10) return json({ error: 'Key zu kurz' }, 400, cors); await env.AI.put('key:' + km[1], key.trim()); return json({ ok: true, last4: key.trim().slice(-4) }, 200, cors); }
    if (req.method === 'DELETE') { await env.AI.delete('key:' + km[1]); return json({ ok: true }, 200, cors); }
  }
  // Reihenfolge und Modelle speichern
  if (req.method === 'PUT' && url.pathname === '/api/ai/config') {
    const b = await req.json();
    const next = { order: (b.order || []).filter(p => PROVIDERS[p]), models: b.models || {} };
    await env.AI.put('config', JSON.stringify(next));
    return json({ ok: true }, 200, cors);
  }
  // Verfügbare Modelle eines Anbieters
  const mm = url.pathname.match(/^\/api\/ai\/models\/(\w+)$/);
  if (req.method === 'GET' && mm && PROVIDERS[mm[1]]) {
    const k = await keyOf(mm[1]); if (!k) return json({ error: 'Kein Key' }, 400, cors);
    return json({ models: await listModels(mm[1], k) }, 200, cors);
  }
  // Frage stellen: Anbieter der Reihe nach, bis einer antwortet
  if (req.method === 'POST' && url.pathname === '/api/ai/chat') {
    const { system, messages } = await req.json();
    const order = (conf.order && conf.order.length ? conf.order : Object.keys(PROVIDERS));
    const errors = [];
    for (const p of order) {
      const k = await keyOf(p); if (!k) continue;
      const model = (conf.models || {})[p] || DEFAULT_MODEL[p];
      try {
        const text = await callModel(p, k, model, system, messages);
        return json({ text, provider: PROVIDERS[p].name, model }, 200, cors);
      } catch (e) { errors.push(`${PROVIDERS[p].name}: ${String(e.message || e).slice(0, 160)}`); }
    }
    return json({ error: errors.length ? errors.join(' | ') : 'Kein KI-Key hinterlegt' }, 502, cors);
  }
  return json({ error: 'Unbekannter Pfad' }, 404, cors);
}

async function callModel(p, key, model, system, messages) {
  if (p === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.4 },
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || r.status);
    return (d.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('').trim();
  }
  if (p === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1200, system, messages, temperature: 0.4 }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || r.status);
    return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  }
  // OpenAI-kompatibel (ChatGPT, Groq)
  const r = await fetch(`${PROVIDERS[p].base}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: 'system', content: system }, ...messages] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || r.status);
  return (d.choices?.[0]?.message?.content || '').trim();
}

async function listModels(p, key) {
  try {
    if (p === 'gemini') {
      const d = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': key } }).then(r => r.json());
      return (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
    }
    if (p === 'anthropic') {
      const d = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } }).then(r => r.json());
      return (d.data || []).map(m => m.id);
    }
    const d = await fetch(`${PROVIDERS[p].base}/models`, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json());
    return (d.data || []).map(m => m.id).sort();
  } catch { return []; }
}
