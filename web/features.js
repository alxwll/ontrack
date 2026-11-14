/* =====================================================================
   On. Track – Tagesform, Form-Tab, Workout-Bibliothek, Train now, Planerstellung
   ===================================================================== */

/* ---------- Tagesform ---------- */
// Form-Bereiche wie bei Intervals.icu: absolute Form = Fitness minus Ermüdung
const FORMZ = [
  { min: 20,   key:'trans', name:'Sehr erholt',     col:'#C9B6FF', expl:'So ausgeruht, dass die Fitness langsam nachlässt. Zeit für neue Reize.' },
  { min: 5,    key:'fresh', name:'Frisch',          col:'#5AA9FF', expl:'Ausgeruht und bereit. Ideal für Wettkämpfe oder harte Einheiten.' },
  { min: -10,  key:'grey',  name:'Ausgeglichen',    col:'#9B8AD9', expl:'Weder müde noch frisch. Dein Training hält die Fitness, baut aber wenig auf.' },
  { min: -30,  key:'opt',   name:'Im Aufbau',       col:'#7CE38B', expl:'Der beste Trainingsbereich: belastet, aber nicht überlastet. Hier wirst du fitter.' },
  { min: -999, key:'high',  name:'Hohe Belastung',  col:'#FF3B3B', expl:'Mehr Belastung, als dein Körper gerade gewohnt ist. Kurz okay, dauerhaft riskant.' },
];
function formInfo(day = TODAY){
  const w = SNAP.wellness.filter(x => x.ctl != null);
  const i = Math.max(0, w.findIndex(x => x.id === day));
  const t = w[i] || w[w.length-1];
  const ctl = t.ctl || 0, atl = t.atl || 0, tsb = ctl - atl;
  const pct = tsb; // absolut, wie in Intervals.icu
  const zone = FORMZ.find(z => tsb >= z.min);
  const before = w.filter(x => x.id < day).slice(-7);
  const avg = k => { const v = before.map(x => x[k]).filter(Boolean); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const last = k => { const x = [...w].filter(x=>x.id<=day).reverse().find(x => x[k]); return x ? { v:x[k], day:x.id } : null; };
  return {
    ctl:Math.round(ctl), atl:Math.round(atl), tsb:Math.round(tsb), pct:Math.round(pct), zone,
    hrv:last('hrv'), hrvAvg:avg('hrv'), rhr:last('restingHR'), rhrAvg:avg('restingHR'),
    sleep:last('sleepSecs'), sleepAvg:avg('sleepSecs'), ctl28: (() => { const x = w.find(q => q.id >= addDays(day,-28)); return x ? Math.round(x.ctl) : null; })(),
  };
}
/* ---------- Bereitschaft heute: HRV, Ruhepuls, Schlaf, Form und Morgen-Check-in ---------- */
const RDZ = [
  { min:75, key:'go',   name:'Startklar',       col:'#D7FF3D' },
  { min:55, key:'ok',   name:'Solide',          col:'#FFD84D' },
  { min:40, key:'low',  name:'Gedämpft',        col:'#FF8A1F' },
  { min:-1, key:'rest', name:'Erholung zuerst', col:'#FF3B3B' },
];
const CHECK = [
  { k:'sleep',  l:'Schlecht geschlafen', pen:12 },
  { k:'alc',    l:'Alkohol',             pen:12 },
  { k:'stress', l:'Stress',              pen:6 },
  { k:'legs',   l:'Schwere Beine',       pen:8 },
  { k:'ill',    l:'Kränklich',           pen:30 },
];
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function readiness(){
  const f = formInfo();
  // Nachtwerte: heute, sonst der Vortag (Garmin/Intervals legen die letzte Nacht oft auf den Vortag;
  // ein Ruhepuls ohne Nachtdaten ist meist nur ein vorläufiger Tageswert)
  const night = x => x && (x.hrv || x.sleepSecs);
  const today = SNAP.wellness.find(x => x.id === TODAY), yest = SNAP.wellness.find(x => x.id === addDays(TODAY, -1));
  const t = night(today) ? today : night(yest) ? yest : {};
  const prior = SNAP.wellness.filter(x => x.id < t.id && x.id >= addDays(TODAY, -31));
  const base = k => { const v = prior.map(x => x[k]).filter(Boolean); return v.length >= 5 ? v.reduce((a,b)=>a+b,0) / v.length : null; };
  let sc = 70; const why = [];
  const hb = base('hrv');
  if (t.hrv && hb){
    const d = t.hrv / hb - 1; sc += clampN(d * 120, -25, 10);
    if (d <= -0.08) why.push({ t:`HRV ${Math.round(d*100)} %`, neg:true }); else if (d >= 0.08) why.push({ t:`HRV +${Math.round(d*100)} %`, neg:false });
  }
  const rb = base('restingHR');
  if (t.restingHR && rb){
    const d = Math.round(t.restingHR - rb); sc -= clampN(d * 3, -6, 15);
    if (d >= 3) why.push({ t:`Ruhepuls +${d}`, neg:true }); else if (d <= -3) why.push({ t:`Ruhepuls ${d}`, neg:false });
  }
  if (t.sleepScore){
    sc += clampN((t.sleepScore - 75) / 2.5, -12, 6);
    if (t.sleepScore < 65) why.push({ t:`Schlafwert ${Math.round(t.sleepScore)}`, neg:true }); else if (t.sleepScore >= 85) why.push({ t:`Schlafwert ${Math.round(t.sleepScore)}`, neg:false });
    if (t.sleepSecs && t.sleepSecs < 7*3600){ sc -= t.sleepSecs < 6*3600 ? 6 : 3; why.push({ t:`${(t.sleepSecs/3600).toFixed(1).replace('.',',')} h Schlaf`, neg:true }); }
  } else if (t.sleepSecs){
    const h = t.sleepSecs / 3600, hs = `${h.toFixed(1).replace('.',',')} h Schlaf`;
    if (h < 6){ sc -= 12; why.push({ t:hs, neg:true }); } else if (h < 7){ sc -= 5; why.push({ t:hs, neg:true }); } else if (h >= 8){ sc += 4; why.push({ t:hs, neg:false }); }
  }
  if (f.tsb < -30){ sc -= 10; why.push({ t:'Hohe Trainingslast', neg:true }); }
  else if (f.tsb < -10) sc -= 2; else if (f.tsb < 5) sc += 2; else sc += 5;
  const ci = (ST.checkin || {})[TODAY];
  if (ci) CHECK.forEach(c => { if (ci[c.k]){ sc -= c.pen; why.push({ t:c.l, neg:true }); } });
  sc = clampN(Math.round(sc), 0, 100);
  return { score:sc, zone:RDZ.find(z => sc >= z.min), why, hasData: !!(t.hrv || t.restingHR || t.sleepSecs), ci, f };
}
function readySentence(r, todays){
  const ev = todays.find(e => statusOf(e).s !== 'done');
  const hard = ev && ev.cat.hard && !ev.variant;
  const because = '';
  switch (r.zone.key){
    case 'rest': return because + 'Dein Körper braucht heute Ruhe. ' + (hard ? 'Mach die leichte Variante oder lass die Einheit ausfallen.' : ev ? 'Wenn du läufst, dann kurz und ganz locker.' : 'Gut, dass heute frei ist.');
    case 'low':  return because + 'Heute ist kein Tag für Vollgas. ' + (hard ? 'Ich würde die Einheit leichter machen.' : ev ? 'Locker laufen passt, Tempo bewusst rausnehmen.' : 'Ein ruhiger Tag tut dir gut.');
    case 'ok':   return 'Solide Basis. ' + (hard ? 'Die Einheit geht, hör aber unterwegs auf deinen Körper.' : ev ? 'Gut für deinen Lauf heute.' : 'Ein ruhiger Tag schadet nicht.');
    default:     return 'Du bist startklar. ' + (hard ? 'Perfekt für die harte Einheit.' : ev ? 'Genieß den Lauf.' : 'Morgen darf es wieder zur Sache gehen.');
  }
}
function readinessSection(todays){
  const r = readiness(), f = r.f;
  const ev = todays.find(e => statusOf(e).s !== 'done' && e.cat.hard && !e.variant && !isStrength(e.type));
  const showEase = ev && (r.zone.key === 'low' || r.zone.key === 'rest');
  const pill = (t, c) => `<span class="small" style="padding:4px 10px;border-radius:99px;background:var(--bg);color:${c};font-weight:700">${esc(t)}</span>`;
  let h = `<section class="note" style="display:flex;flex-direction:column;gap:10px" aria-label="Bereitschaft heute">
    <div class="row"><span style="font-weight:700;color:var(--text)">Heute: <span style="color:${r.zone.col}">${r.zone.name}</span></span><span style="font-family:var(--display);font-weight:900;font-size:24px;color:${r.zone.col}">${r.score}</span></div>
    <div role="img" aria-label="Bereitschaft ${r.score} von 100" style="position:relative;height:30px;border-radius:99px;background:var(--bg)">
      <div style="position:absolute;left:4px;top:4px;bottom:4px;width:calc((100% - 8px) * ${(r.score/100).toFixed(3)} + 11px);min-width:22px;border-radius:99px;background:${r.zone.col}"></div>
      <span style="position:absolute;top:4px;left:calc(4px + (100% - 30px) * ${(r.score/100).toFixed(3)});width:22px;height:22px;border-radius:99px;background:#F1EAFF;box-shadow:0 0 0 3px var(--bg)"></span></div>
    <div class="row small muted" style="margin-top:-6px"><span>platt</span><span>startklar</span></div>`;
  if (r.why.length) h += `<div style="display:flex;flex-wrap:wrap;gap:6px">${r.why.map(w => pill(w.t, w.neg ? '#FF8A1F' : 'var(--lime)')).join('')}</div>`;
  h += `<p style="color:var(--text);font-size:15px;line-height:1.45">${esc(readySentence(r, todays))}${r.hasData ? '' : ' <span class="muted">Von deiner Uhr sind heute noch keine Schlaf- und HRV-Werte da.</span>'}</p>`;
  if (showEase) h += `<button class="btn lime" data-act="vprev" data-v="leichter" data-id="${ev.id}">Heutige Einheit leichter machen</button>`;
  // Check-in
  const ci = r.ci;
  if (!ci || ST.ciOpen){
    h += `<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:10px"><span class="small" style="font-weight:700;color:var(--text)">Wie geht's dir heute?</span>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${CHECK.map(c => `<button class="chip" data-act="ci" data-v="${c.k}" aria-pressed="${!!(ci && ci[c.k])}" style="${ci && ci[c.k] ? 'background:#FF8A1F;color:var(--bg)' : 'color:var(--lilac)'}">${c.l}</button>`).join('')}
      <button class="chip" data-act="ciok" style="background:var(--lime);color:var(--bg)">${ci ? 'Fertig' : 'Alles gut'}</button></div></div>`;
  } else {
    const on = CHECK.filter(c => ci[c.k]).map(c => c.l);
    h += `<div class="row small" style="border-top:1px solid var(--line);padding-top:10px"><span class="muted">Check-in: ${on.length ? esc(on.join(', ')) : 'alles gut'}</span><button class="chip" data-act="ciedit" style="color:var(--lilac)">Ändern</button></div>`;
  }
  h += `<a href="#form" class="row small" style="text-decoration:none;color:var(--lilac)"><span>Trainingsform: <b style="color:${f.zone.col}">${f.zone.name}</b> · ${f.tsb>0?'+':''}${f.tsb}</span><b>Mehr ›</b></a></section>`;
  return h;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, v } = b.dataset;
  if (!['ci','ciok','ciedit'].includes(act)) return;
  ST.checkin = ST.checkin || {};
  for (const d of Object.keys(ST.checkin)) if (d < addDays(TODAY, -14)) delete ST.checkin[d];
  if (act === 'ci'){ const c = ST.checkin[TODAY] = ST.checkin[TODAY] || {}; c[v] = !c[v]; ST.ciOpen = true; }
  if (act === 'ciok'){ ST.checkin[TODAY] = ST.checkin[TODAY] || {}; ST.ciOpen = false; }
  if (act === 'ciedit') ST.ciOpen = true;
  save(); render();
});
// Harte Einheit in den letzten zwei Tagen?
function recentHard(){
  for (const d of [addDays(TODAY,-1), addDays(TODAY,-2)]){
    const a = activitiesOn(d).filter(a => isRun(a.type)).sort((x,y)=>(y.icu_training_load||0)-(x.icu_training_load||0))[0];
    if (a && (a.icu_training_load||0) >= 55){
      const ev = plan().find(e => statusOf(e).act === a);
      return { name: ev ? ev.name : a.name, when: d === addDays(TODAY,-1) ? 'gestern' : 'vorgestern' };
    }
  }
  return null;
}
function todaySentence(f, todays){
  const ev = todays[0];
  const hard = ev && ev.cat.hard;
  const rest = !ev;
  const rh = recentHard();
  let s = '';
  switch (f.zone.key){
    case 'high':  s = `Du bist gerade ordentlich belastet${rh ? ` – der ${rh.name} von ${rh.when} steckt noch in den Beinen` : ''}. `;
                  s += rest ? 'Gut, dass heute frei ist.' : hard ? 'Geh die Einheit heute kontrolliert an oder tipp auf „Leichter“.' : 'Genau richtig, dass heute nur locker dran ist.'; break;
    case 'opt':   s = 'Du bist im besten Trainingsbereich: belastet, aber nicht überlastet. ';
                  s += rest ? 'Der Ruhetag lässt die Arbeit sacken.' : hard ? 'Die harte Einheit passt.' : 'Locker bleiben, dann wirkt das Training.'; break;
    case 'grey':  s = 'Du bist im Gleichgewicht. ';
                  s += rest ? 'Ein ruhiger Tag schadet nicht.' : 'Gute Basis für heute.'; break;
    case 'fresh': s = 'Du bist frisch und erholt. ';
                  s += rest ? 'Morgen darf es wieder zur Sache gehen.' : hard ? 'Perfekt für die harte Einheit.' : 'Ein guter Tag, um Umfang zu sammeln.'; break;
    default:      s = 'Du bist sehr ausgeruht, fast schon zu sehr. Zeit für neue Reize.';
  }
  // Erholungswerte ergänzen, nur wenn auffällig
  if (f.rhr && f.rhrAvg && f.rhr.day === TODAY && f.rhr.v >= f.rhrAvg + 4) s += ` Dein Ruhepuls ist heute erhöht (${f.rhr.v} statt ~${Math.round(f.rhrAvg)}). Hör besonders auf deinen Körper.`;
  else if (f.hrv && f.hrvAvg && f.hrv.v < f.hrvAvg * 0.85) s += ' Deine HRV liegt unter deinem Schnitt. Hör besonders auf deinen Körper.';
  return s;
}
// Tagesform als Schalter: Bahn füllt sich in der Farbe des Bereichs, runder Knopf zeigt die Position
function formGauge(f){
  const lo = -50, hi = 30;
  const pos = (Math.max(lo, Math.min(hi, f.pct)) - lo) / (hi - lo) * 100;
  return `<div role="img" aria-label="Tagesform: ${f.zone.name}" style="position:relative;height:30px;border-radius:99px;background:var(--bg)">
    <div style="position:absolute;left:4px;top:4px;bottom:4px;width:calc((100% - 8px) * ${(pos/100).toFixed(3)} + 11px);min-width:22px;border-radius:99px;background:${f.zone.col}"></div>
    <span style="position:absolute;top:4px;left:calc(4px + (100% - 30px) * ${(pos/100).toFixed(3)});width:22px;height:22px;border-radius:99px;background:#F1EAFF;box-shadow:0 0 0 3px var(--bg)"></span></div>
  <div class="row small muted" style="margin-top:2px"><span>müde</span><span>frisch</span></div>`;
}
function dayFormSection(todays){
  const f = formInfo();
  return `<section class="note" style="display:flex;flex-direction:column;gap:10px" aria-label="Tagesform">
    <div class="row"><span style="font-weight:700;color:var(--text)">Tagesform: <span style="color:${f.zone.col}">${f.zone.name}</span></span><a href="#form" class="small" style="color:var(--lilac);font-weight:700;text-decoration:none">Mehr ›</a></div>
    ${formGauge(f)}
    <p style="color:var(--text);font-size:15px">${esc(todaySentence(f, todays))}</p></section>`;
}

/* ---------- Form-Tab ---------- */
const FR = { key:'6w' };
const RANGES = [ ['6w','6 Wochen',42], ['3m','3 Monate',91], ['1y','1 Jahr',365] ];
function rangeData(){
  const days = RANGES.find(r => r[0] === FR.key)[2];
  const from = addDays(TODAY, -days+1);
  return SNAP.wellness.filter(x => x.ctl != null && x.id >= from && x.id <= TODAY);
}
const shortD = s => `${parseD(s).getUTCDate()}. ${MON[parseD(s).getUTCMonth()]}`;
function axisLabels(w){
  if (!w.length) return '';
  const n = w.length - 1;
  const idx = FR.key === '1y' ? [0, Math.round(n/3), Math.round(2*n/3), n] : [0, Math.round(n/2), n];
  const lab = i => i === n ? 'Heute' : FR.key === '1y' ? MON[parseD(w[i].id).getUTCMonth()] : shortD(w[i].id);
  return `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--lilac);margin-top:4px">${idx.map(i=>`<span>${lab(i)}</span>`).join('')}</div>`;
}
function chartWrap(svg, id){
  return `<div class="scrub" data-scrub="${id}" style="position:relative;touch-action:pan-y;cursor:crosshair">${svg}
    <div class="scrubline" style="display:none;position:absolute;top:0;bottom:0;width:2px;background:var(--text);opacity:.7;pointer-events:none"></div></div>`;
}
function viewForm(){
  const w = rangeData();
  const f = formInfo();
  const W = 350, H = 140;
  const X = i => i / Math.max(1, w.length-1) * W;
  const vals = w.flatMap(x => [x.ctl, x.atl]);
  const minV = Math.max(0, Math.min(...vals) - 5), maxV = Math.max(...vals) + 5;
  const Y = v => H - ((v - minV) / (maxV - minV)) * H;
  const line = (k, c) => `<polyline fill="none" stroke="${c}" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${w.map((x,i)=>`${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}`).join(' ')}"></polyline>`;
  const lo = -40, hi = 25;
  const Yp = v => H - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * H;
  const bands = [['fresh',5,25],['grey',-10,5],['opt',-30,-10],['high',-40,-30]].map(([k,a,b]) => {
    const z = FORMZ.find(q => q.key === k);
    return `<rect x="0" y="${Yp(b)}" width="${W}" height="${Yp(a)-Yp(b)}" fill="${z.col}" fill-opacity="0.4"></rect>`;
  }).join('');
  const pctPts = w.map((x,i) => `${X(i).toFixed(1)},${Yp(x.ctl-x.atl).toFixed(1)}`).join(' ');
  const trend = f.ctl28 != null ? f.ctl - f.ctl28 : 0;
  const trendTxt = trend >= 2 ? `deine Fitness ist von ${f.ctl28} auf ${f.ctl} gestiegen` : trend <= -2 ? `deine Fitness ist von ${f.ctl28} auf ${f.ctl} leicht gesunken` : `deine Fitness ist mit ${f.ctl} etwa gleich geblieben`;
  let advice = '';
  if (trend <= -2) advice = 'Für einen Aufbau braucht es etwas mehr regelmäßigen Umfang, vor allem lockere Kilometer.';
  else if (trend >= 2) advice = 'Weiter so, der Aufbau greift.';
  else advice = 'Um fitter zu werden, darf die Belastung behutsam steigen, etwa 3 bis 4 Fitnesspunkte pro Woche.';
  const peak = w.reduce((a,x)=>x.ctl>a.ctl?x:a, w[0]);
  let h = topBar();
  h += `<h1>Deine Form</h1>`;
  h += `<section class="card" style="gap:10px"><div class="row"><span class="tag" style="background:${f.zone.col};color:var(--bg)">${f.zone.name}</span><span class="small" style="color:var(--soft)">Form ${f.tsb>0?'+':''}${f.tsb}</span></div>
    <p style="line-height:1.5">In den letzten vier Wochen ${trendTxt}. ${advice}</p>
    <p style="line-height:1.5;color:var(--soft)">${esc(todaySentence(f, plan().filter(e=>e.date===TODAY)))}</p></section>`;
  h += `<div class="seg" role="group" aria-label="Zeitraum">${RANGES.map(([k,l])=>`<button data-act="frange" data-v="${k}" aria-pressed="${FR.key===k}" class="${FR.key===k?'on':''}">${l}</button>`).join('')}</div>`;
  h += `<div class="scrubtip" id="scrubtip" aria-live="polite" style="display:none"></div>`;
  h += runBuildSection();
  h += `<section style="background:var(--bg2);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px">
    <h2>Form</h2>
    ${chartWrap(`<svg width="100%" height="140" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Verlauf der Form mit Bereichen" style="display:block">${bands}<polyline fill="none" stroke="#F1EAFF" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${pctPts}"></polyline></svg>`, 'form')}
    ${axisLabels(w)}
    <div class="legend">${['fresh','grey','opt','high'].map(k=>{const z=FORMZ.find(q=>q.key===k);return `<span><i style="background:${z.col}"></i>${z.name}</span>`;}).join('')}</div>
    <p class="small" style="color:var(--soft);line-height:1.5"><b style="color:var(--text)">Form</b> = Fitness minus Ermüdung. Unter null heißt: Du trainierst gerade. Über null heißt: Du bist ausgeruht. Für Wettkämpfe willst du leicht im Plus sein.</p></section>`;
  h += `<section style="background:var(--bg2);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px">
    <h2>Fitness und Ermüdung</h2>
    ${chartWrap(`<svg width="100%" height="140" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Verlauf von Fitness und Ermüdung" style="display:block">${line('atl','#FF8A1F')}${line('ctl','#F1EAFF')}</svg>`, 'fit')}
    ${axisLabels(w)}
    <div class="legend"><span><i style="background:#F1EAFF"></i>Fitness ${f.ctl}</span><span><i style="background:#FF8A1F"></i>Ermüdung ${f.atl}</span>${FR.key!=='6w'?`<span>Höchststand ${Math.round(peak.ctl)} am ${shortD(peak.id)}</span>`:''}</div>
    <p class="small" style="color:var(--soft);line-height:1.5"><b style="color:var(--text)">Fitness</b> ist, was du dir über etwa sechs Wochen aufgebaut hast. Sie steigt langsam und fällt langsam.<br><b style="color:var(--text)">Ermüdung</b> ist die Belastung der letzten etwa sieben Tage. Sie springt nach harten Tagen hoch und fällt in Ruhephasen schnell.</p></section>`;
  const val = (label, cur, avg, unit, fmt, betterHigh) => {
    if (!cur) return `<div><p class="k">${label}</p><p class="v">–</p></div>`;
    const v = fmt(cur.v), a = avg ? fmt(avg) : null;
    let word = '';
    if (avg){ const d = (cur.v - avg) / avg; word = Math.abs(d) < 0.06 ? 'normal' : ((d > 0) === betterHigh ? 'besser als sonst' : 'schlechter als sonst'); }
    return `<div><p class="k">${label}</p><p class="v">${v}${unit}</p><p class="small muted">${word}${a?` · Ø ${a}${unit}`:''}${cur.day!==TODAY?' · gestern':''}</p></div>`;
  };
  h += `<h2>Erholung</h2><section class="form">
    ${val('HRV', f.hrv, f.hrvAvg, '', v=>Math.round(v), true)}
    ${val('Ruhepuls', f.rhr, f.rhrAvg, '', v=>Math.round(v), false)}
    ${val('Schlaf', f.sleep, f.sleepAvg, ' h', v=>(v/3600).toFixed(1).replace('.',','), true)}</section>
    <p class="small muted" style="line-height:1.5">HRV und Ruhepuls zeigen, wie gut dein Körper sich erholt hat. Eine niedrige HRV oder ein erhöhter Ruhepuls sind ein Hinweis, es ruhiger angehen zu lassen.</p>`;
  return h + navBar('form');
}
// Antippen oder Ziehen im Diagramm: Linie und kleines Fenster mit Datum und Werten
function scrubAt(el, clientX){
  const w = rangeData(); if (!w.length) return;
  const r = el.getBoundingClientRect();
  const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  const i = Math.round(t * (w.length-1)), x = w[i];
  const px = i / Math.max(1, w.length-1);
  document.querySelectorAll('.scrub').forEach(s => { const l = s.querySelector('.scrubline'); l.style.display='block'; l.style.left = `calc(${(px*100).toFixed(2)}% - 1px)`; });
  const tsb = Math.round(x.ctl - x.atl), z = FORMZ.find(q => tsb >= q.min);
  const tip = document.getElementById('scrubtip');
  tip.style.display = 'flex';
  tip.innerHTML = `<b>${x.id===TODAY?'Heute':`${WD[wd(x.id)]}, ${shortD(x.id)}`}</b><span>Fitness <b>${Math.round(x.ctl)}</b></span><span>Ermüdung <b>${Math.round(x.atl)}</b></span><span>Form <b style="color:${z.col}">${tsb>0?'+':''}${tsb}</b></span>`;
}
function scrubEnd(){
  document.querySelectorAll('.scrubline').forEach(l => l.style.display = 'none');
  const tip = document.getElementById('scrubtip'); if (tip) tip.style.display = 'none';
}
let scrubbing = null;
document.addEventListener('pointerdown', e => { const s = e.target.closest('.scrub'); if (!s) return; scrubbing = s; scrubAt(s, e.clientX); });
document.addEventListener('pointermove', e => { if (scrubbing) scrubAt(scrubbing, e.clientX); });
document.addEventListener('pointerup', () => { if (scrubbing){ scrubbing = null; setTimeout(scrubEnd, 1500); } });
document.addEventListener('pointercancel', () => { scrubbing = null; scrubEnd(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-act="frange"]'); if (b){ FR.key = b.dataset.v; render(); } });

/* ---------- Workout-Bibliothek ---------- */
// Schritte in % der Schwellenpace. step(Minuten, von %, bis %, Text)
const st = (min, a, b, text, extra = {}) => Object.assign({ duration: Math.round(min*60), pace:{ start:a, end:b, units:'%pace' }, text }, extra);
const rep = (n, steps) => ({ reps:n, steps });
const WU = min => st(min, 72, 82, 'Einlaufen', { warmup:true });
const CD = min => st(min, 70, 80, 'Auslaufen', { cooldown:true });
const JOG = min => st(min, 65, 75, 'Traben');
const EASY = (min, t='Locker') => st(min, 80, 88, t);

const CATS = [
  { key:'erholung', name:'Erholung', dots:1, col:'#C9B6FF', sub:'Ganz locker, Beine lockern' },
  { key:'grundlage', name:'Grundlage', dots:2, col:'#FFD84D', sub:'Lockere und lange Läufe' },
  { key:'tempo', name:'Tempo', dots:3, col:'#FF8A1F', sub:'Zügig, angenehm hart' },
  { key:'schwelle', name:'Schwelle', dots:4, col:'#FF3B3B', sub:'Cruise-Intervalle, Schwellenläufe' },
  { key:'berg', name:'Berg', dots:4, col:'#FF8A1F', sub:'Kraft und Schwelle am Hang' },
  { key:'vo2', name:'VO2max', dots:5, col:'#E838A8', sub:'Harte Intervalle, 30/30' },
  { key:'speed', name:'Speed', dots:3, col:'#E838A8', sub:'Steigerungen und Sprints' },
  { key:'wettkampf', name:'Wettkampf', dots:2, col:'#FFD84D', sub:'Vorbelastung, Renntempo' },
  { key:'test', name:'Tests', dots:5, col:'#FF3B3B', sub:'Leistung messen' },
];
const LEVELS = { intro:'Einstieg', standard:'Standard', pro:'Fortgeschritten' };
// main(l): l = 0 Einstieg, 1 Standard, 2 Fortgeschritten. wu/cd: Minuten Ein-/Auslaufen (Standard)
const LIB = [
  { id:'ERH-1', cat:'erholung', name:'Erholungslauf', desc:'Ganz locker, Unterhaltungstempo. Lieber zu langsam als zu schnell.', wu:0, cd:0, main:l=>[st([25,35,45][l], 70, 78, 'Erholung')] },
  { id:'ERH-2', cat:'erholung', name:'Shakeout mit Steigerungen', desc:'Kurzer Lauf zum Lockern, am Ende ein paar lockere Steigerungen.', wu:0, cd:3, main:l=>[st([15,20,25][l],70,78,'Locker traben'), rep([3,4,4][l],[st(1/3,105,115,'Steigerung'), JOG(1)])] },
  { id:'GRU-1', cat:'grundlage', name:'Lockerer Dauerlauf', desc:'Grundlagenausdauer. Du solltest dich problemlos unterhalten können.', wu:5, cd:3, main:l=>[EASY([30,40,50][l])] },
  { id:'GRU-2', cat:'grundlage', name:'Langer Lauf', desc:'Der wichtigste Lauf der Woche für die Ausdauer. Gleichmäßig und ruhig.', wu:10, cd:5, main:l=>[EASY([60,75,95][l],'Langer Lauf')] },
  { id:'GRU-3', cat:'grundlage', name:'Progressiver Dauerlauf', desc:'Locker starten, das letzte Drittel zügig zu Ende laufen.', wu:10, cd:5, main:l=>[EASY([20,30,35][l]), st([10,12,15][l], 88, 93, 'Zügig')] },
  { id:'GRU-4', cat:'grundlage', name:'Dauerlauf mit Steigerungen', desc:'Lockerer Lauf mit kurzen Steigerungen für einen runden Laufstil.', wu:10, cd:5, main:l=>[EASY([20,25,30][l]), rep([4,6,8][l],[st(1/3,110,118,'Steigerung'), JOG(1)])] },
  { id:'TEM-1', cat:'tempo', name:'Tempodauerlauf', desc:'Zügig und gleichmäßig. Angenehm hart, aber kontrolliert.', wu:15, cd:10, main:l=>[st([15,20,25][l], 90, 95, 'Tempo')] },
  { id:'TEM-2', cat:'tempo', name:'2 × Tempo', desc:'Zwei lange Tempoblöcke mit kurzer Trabpause.', wu:15, cd:10, main:l=>[rep(2,[st([10,15,18][l],90,95,'Tempo'), JOG(3)])] },
  { id:'TEM-3', cat:'tempo', name:'Fahrtspiel 2/1', desc:'Wechsel aus zwei Minuten zügig und einer Minute locker.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(2,92,96,'Zügig'), st(1,75,82,'Locker')])] },
  { id:'SCH-1', cat:'schwelle', name:'Cruise-Intervalle 6 min', desc:'Klassische Schwellenintervalle. Tempo halten, nicht steigern.', wu:15, cd:10, main:l=>[rep([3,5,6][l],[st(6,98,102,'Schwelle'), JOG(2)])] },
  { id:'SCH-2', cat:'schwelle', name:'3 × 10 min Schwelle', desc:'Längere Schwellenblöcke für Tempohärte.', wu:15, cd:10, main:l=>[rep([2,3,3][l],[st([8,10,12][l],97,101,'Schwelle'), JOG(2.5)])] },
  { id:'SCH-3', cat:'schwelle', name:'Norwegische Unterschwelle', desc:'Viele kurze Blöcke knapp unter der Schwelle. Viel Umfang bei wenig Ermüdung.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(3,94,98,'Unterschwelle'), JOG(1)])] },
  { id:'SCH-4', cat:'schwelle', name:'Schwellendauerlauf', desc:'Ein langer, gleichmäßiger Block knapp unter der Schwelle.', wu:15, cd:10, main:l=>[st([15,20,25][l], 94, 98, 'Schwelle')] },
  { id:'BER-1', cat:'berg', name:'Bergsprints', desc:'Kurze, explosive Sprints einen steilen Hang hoch. Gehpause zurück.', wu:15, cd:10, main:l=>[EASY(5), rep([6,8,10][l],[st(0.25,125,135,'Bergsprint'), st(2,60,70,'Zurückgehen')])] },
  { id:'BER-2', cat:'berg', name:'Hügel 90 s', desc:'Kräftig bergauf nach Gefühl, locker zurück. Die Pace am Hang ist zweitrangig.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(1.5,100,106,'Bergauf'), JOG(2)])] },
  { id:'BER-3', cat:'berg', name:'Lange Hügel', desc:'Längere Anstiege im Schwellenbereich, gleichmäßige Anstrengung.', wu:15, cd:10, main:l=>[rep([3,4,5][l],[st(3,96,102,'Bergauf'), JOG(3)])] },
  { id:'VO2-1', cat:'vo2', name:'5 × 3 min', desc:'Harte Intervalle nahe 5-km-Tempo. Die letzten müssen sich hart anfühlen, nicht unmöglich.', wu:15, cd:10, main:l=>[rep([4,5,6][l],[st(3,104,109,'VO2max'), JOG(2.5)])] },
  { id:'VO2-2', cat:'vo2', name:'Billat 30/30', desc:'30 s schnell, 30 s locker. Kurze Reize mit viel Zeit im hohen Pulsbereich.', wu:15, cd:10, main:l=>[rep([1,2,2][l],[rep([8,10,12][l],[st(0.5,112,118,'Schnell'), st(0.5,72,80,'Locker')]), JOG(3)])] },
  { id:'VO2-3', cat:'vo2', name:'4 × 4 min', desc:'Lange VO2max-Intervalle. Gleichmäßig verteilen, nicht zu schnell anlaufen.', wu:15, cd:10, main:l=>[rep([3,4,5][l],[st(4,103,107,'VO2max'), JOG(3)])] },
  { id:'VO2-4', cat:'vo2', name:'6 × 2 min', desc:'Kürzere VO2max-Intervalle mit flottem Rhythmus.', wu:15, cd:10, main:l=>[rep([5,6,8][l],[st(2,106,111,'VO2max'), JOG(2)])] },
  { id:'SPD-1', cat:'speed', name:'Steigerungen', desc:'Lockerer Lauf mit 20-s-Steigerungen bis knapp unter Sprint.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(1/3,115,125,'Steigerung'), JOG(1.5)])] },
  { id:'SPD-2', cat:'speed', name:'Tempohärte 8 × 30 s', desc:'Schnelle 30-s-Abschnitte mit voller Erholung. Sauber laufen statt verkrampfen.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(0.5,118,125,'Schnell'), JOG(2)])] },
  { id:'SPD-3', cat:'speed', name:'Neuromuskuläre Sprints', desc:'Ganz kurze, maximale Sprints. Volle Pausen, Qualität vor Menge.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(1/6,130,145,'Sprint'), JOG(2)])] },
  { id:'WET-1', cat:'wettkampf', name:'Vorbelastung', desc:'Am Tag vor dem Rennen: kurz locker mit ein paar Abschnitten im Renntempo.', wu:10, cd:5, main:l=>[rep([3,4,4][l],[st(1,100,104,'Renntempo'), JOG(1.5)])] },
  { id:'WET-2', cat:'wettkampf', name:'10-km-Renntempo', desc:'Längere Abschnitte im Renntempo für das Gefühl.', wu:15, cd:10, main:l=>[rep([2,3,4][l],[st(8,100,103,'Renntempo'), JOG(2.5)])] },
  { id:'WET-3', cat:'wettkampf', name:'Halbmarathon-Tempo', desc:'Lange Blöcke im HM-Renntempo, kontrolliert und gleichmäßig.', wu:15, cd:10, main:l=>[rep([2,3,3][l],[st([10,12,15][l],95,99,'HM-Tempo'), JOG(3)])] },
  { id:'GRU-5', cat:'grundlage', name:'Langer Lauf mit schnellem Schluss', desc:'Ruhig beginnen, die letzten Minuten zügig nach Hause laufen. Trainiert das Tempo auf müden Beinen.', wu:10, cd:5, main:l=>[EASY([45,55,70][l],'Langer Lauf'), st([10,15,20][l], 92, 96, 'Endbeschleunigung')] },
  { id:'GRU-6', cat:'grundlage', name:'Langer Lauf mit Renntempo', desc:'Langer Lauf mit eingebauten Blöcken im Halbmarathon- oder Marathontempo.', wu:10, cd:5, main:l=>[EASY(20,'Langer Lauf'), rep([2,3,3][l],[st([8,10,12][l],95,99,'Renntempo'), EASY(8,'Langer Lauf')])] },
  { id:'TEM-4', cat:'tempo', name:'Tempo-Wechsellauf', desc:'Ohne Pause zwischen Tempo und zügig-locker wechseln. Du lernst, im Tempo zu entspannen.', wu:15, cd:10, main:l=>[rep([4,5,6][l],[st(4,92,96,'Tempo'), st(2,84,88,'Zügig locker')])] },
  { id:'TEM-5', cat:'tempo', name:'Progressiver Tempolauf', desc:'Drei Stufen, jede etwas schneller. Am Ende knapp an der Schwelle.', wu:15, cd:10, main:l=>[st(8,86,90,'Stufe 1'), st(8,90,94,'Stufe 2'), st([6,8,10][l],95,99,'Stufe 3')] },
  { id:'SCH-5', cat:'schwelle', name:'Über-Unter', desc:'Abwechselnd knapp über und knapp unter der Schwelle, ohne Pause dazwischen. Trainiert den Abbau von Laktat im Lauf.', wu:15, cd:10, main:l=>[rep([2,3,3][l],[rep(l===2?3:2,[st(2,103,106,'Drüber'), st(3,94,97,'Drunter')]), JOG(3)])] },
  { id:'SCH-6', cat:'schwelle', name:'2 × 15 min Schwelle', desc:'Zwei lange, gleichmäßige Schwellenblöcke. Klassiker für Halbmarathon und 10 km.', wu:15, cd:10, main:l=>[rep(2,[st([12,15,18][l],96,100,'Schwelle'), JOG(3)])] },
  { id:'VO2-5', cat:'vo2', name:'Pyramide', desc:'1–2–3–2–1 Minuten hart mit gleich langer Trabpause. Die Mitte ist der Gipfel, danach wird es leichter.', wu:15, cd:10, main:l=>[[1,2,2,1],[1,2,3,2,1],[1,2,3,4,3,2,1]][l].flatMap(m=>[st(m,106,112,'VO2max'), JOG(m)]) },
  { id:'VO2-6', cat:'vo2', name:'90-Sekunden-Intervalle', desc:'Kurze, harte Intervalle mit gleich langer Pause. Gut als Einstieg in VO2max-Training.', wu:15, cd:10, main:l=>[rep([6,8,10][l],[st(1.5,106,112,'VO2max'), JOG(1.5)])] },
  { id:'TES-2', cat:'test', name:'Critical-Speed-Test', desc:'Zwei Läufe, so schnell wie möglich: 3 und 12 Minuten, dazwischen 15 Minuten locker. Aus beiden Ergebnissen lässt sich deine Schwelle genau bestimmen.', wu:15, cd:10, main:l=>[st(3,110,120,'Test 3 min'), EASY(15,'Locker erholen'), st(12,102,108,'Test 12 min')] },
  { id:'TES-3', cat:'test', name:'5-km-Test', desc:'5 Kilometer so schnell wie gleichmäßig möglich. Die Dauer richtet sich nach deiner aktuellen Prognose.', wu:15, cd:10, main:l=>[st(Math.round(5000/(THR*1.06)/60*10)/10, 104, 110, '5 km Test')] },
  { id:'TES-1', cat:'test', name:'30-min-Test', desc:'30 Minuten so schnell wie gleichmäßig möglich. Daraus ergibt sich deine Schwellenpace.', wu:15, cd:10, main:l=>[st(30, 100, 106, 'Test')] },
];

function flatSteps(steps){ return flatten(steps); }
function libWorkout(t, l = 1, scaleWu = 1){
  const main = t.main(l);
  const steps = [];
  if (t.wu) steps.push(WU(t.wu * scaleWu));
  steps.push(...main);
  if (t.cd) steps.push(CD(t.cd * scaleWu));
  return steps;
}
const durOf = steps => flatSteps(steps).reduce((a,s)=>a+(s.duration||0),0);
const loadOf = steps => Math.round(estLoad(flatSteps(steps)));
// Workout auf eine Wunschdauer bringen: Stufe wählen, dann Ein-/Auslaufen bzw. Grundlage anpassen
function fitWorkout(t, minutes){
  const target = minutes * 60;
  let best = null;
  for (const l of [2,1,0]){
    const core = durOf(t.main(l));
    const minWrap = ((t.wu ? 10 : 0) + (t.cd ? 5 : 0)) * 60;
    if (core + minWrap <= target + 60 || l === 0){ best = l; break; }
  }
  const main = t.main(best);
  const core = durOf(main);
  let left = Math.max(0, target - core);
  const steps = [];
  if (!t.wu && !t.cd){
    // reine Dauerläufe: Hauptteil auf die Dauer strecken
    const f = flatSteps(main);
    if (f.length === 1) return { steps:[Object.assign({}, f[0], { duration: Math.max(600, target) })], level:best };
  }
  let wu = t.wu ? Math.min(Math.max(600, left * 0.6), 20*60) : 0;
  let cd = t.cd ? Math.min(Math.max(300, left - wu), 15*60) : 0;
  const extra = Math.max(0, left - wu - cd);
  if (t.wu) steps.push(Object.assign(WU(0), { duration: Math.round(wu/30)*30 }));
  steps.push(...main);
  if (extra >= 300) steps.push(EASY(Math.round(extra/60), 'Locker'));
  if (t.cd) steps.push(Object.assign(CD(0), { duration: Math.round(cd/30)*30 }));
  // Passt selbst die Einstiegsstufe nicht, werden die lockeren Teile gestaucht (harte bleiben gleich)
  let flat = flatSteps(steps);
  const total = flat.reduce((a,x)=>a+x.duration,0);
  if (total > target + 60){
    const easySum = flat.filter(x => stepPct(x) < 90 && x.duration >= 120).reduce((a,x)=>a+x.duration,0);
    const hardSum = total - easySum;
    const f = Math.max(0.3, (target - hardSum) / Math.max(1, easySum));
    flat = flat.map(x => (stepPct(x) < 90 && x.duration >= 120) ? Object.assign({}, x, { duration: Math.max(60, Math.round(x.duration * f / 30) * 30) }) : x);
    return { steps: flat, level: best };
  }
  return { steps, level:best };
}
// Für später: Schritte als Intervals-Text (so landen sie auf der Uhr)
function toIntervalsText(steps){
  const one = s => `- ${s.duration%60 ? s.duration+'s' : (s.duration/60)+'m'} ${Math.round(s.pace.start)}-${Math.round(s.pace.end)}% Pace${s.text?` ${s.text}`:''}`;
  return steps.map(s => s.reps ? `\n${s.reps}x\n${s.steps.map(x=>x.reps?toIntervalsText([x]):one(x)).join('\n')}\n` : one(s)).join('\n');
}
function dotsHTML(n, col){ return `<span aria-label="Intensität ${n} von 5" style="display:inline-flex;gap:3px">${[1,2,3,4,5].map(i=>`<i style="width:7px;height:7px;border-radius:99px;background:${i<=n?col:'var(--line)'};display:inline-block"></i>`).join('')}</span>`; }

/* ---------- Train now ---------- */
const TN = { minutes: 45 };
function readinessPick(){
  const f = formInfo();
  const rh = recentHard();
  const todayPlan = plan().find(e => e.date === TODAY && statusOf(e).s !== 'done');
  const r = readiness(), neg = r.why.filter(w => w.neg).map(w => w.t).join(', ');
  if (r.zone.key === 'rest') return { cat:'erholung', why:`${neg ? neg + ': ' : ''}Dein Körper braucht heute Ruhe. Wenn du läufst, dann ganz locker.` };
  if (r.zone.key === 'low') return { cat:'grundlage', why:`${neg ? neg + ': ' : ''}Kein Tag für Intervalle. Ein lockerer Lauf bringt dich heute weiter.` };
  if (f.zone.key === 'high' || (f.rhr && f.rhrAvg && f.rhr.day===TODAY && f.rhr.v >= f.rhrAvg + 4)) return { cat:'erholung', why:'Du bist gerade stark belastet. Heute bringt dich ganz lockeres Laufen am meisten weiter.' };
  if (rh) return { cat:'grundlage', why:`Der ${rh.name} von ${rh.when} wirkt noch nach. Locker sammeln ist heute das Richtige.` };
  if (f.zone.key === 'opt') return { cat:'grundlage', why:'Du bist im Aufbau. Ein lockerer Lauf festigt das, ohne dich zu überladen.' };
  if (f.zone.key === 'grey') return { cat:'schwelle', why:'Du bist ausgeglichen und hattest keine harte Einheit in den letzten Tagen. Zeit für einen Schwellenreiz.' };
  return { cat:'vo2', why:'Du bist frisch. Ein guter Tag für harte Intervalle.' };
}
function pickTemplate(cat, minutes){
  const list = LIB.filter(t => t.cat === cat);
  // das Workout wählen, das am natürlichsten in die Dauer passt
  return list.map(t => ({ t, d: Math.abs(durOf(libWorkout(t,1)) - minutes*60) })).sort((a,b)=>a.d-b.d)[0].t;
}
function viewWorkouts(){
  const pick = readinessPick();
  const pc = CATS.find(c => c.key === pick.cat);
  let h = topBar();
  h += `<h1>Train now</h1><p class="muted">Spontan laufen: Dauer wählen, Art antippen, los.</p>`;
  h += `<section class="note" style="display:flex;flex-direction:column;gap:10px">
    <div class="row"><span style="font-weight:700;color:var(--text)">Dauer</span><span style="font-family:var(--display);font-weight:900;font-size:28px;color:var(--text)"><span id="tnmin">${TN.minutes}</span> min</span></div>
    <input type="range" min="20" max="120" step="5" value="${TN.minutes}" id="tnrange" aria-label="Dauer in Minuten" style="width:100%;accent-color:#D7FF3D;height:28px"></section>`;
  h += `<button class="card" data-act="tn" data-v="${pick.cat}" style="border:none;text-align:left;color:var(--text);gap:8px">
    <div class="row"><span class="tag">Passt heute</span>${dotsHTML(pc.dots, pc.col)}</div>
    <h1>${pc.name}</h1><p style="line-height:1.5">${esc(pick.why)}</p><span class="small" style="font-weight:700;color:var(--lime)">Workout erstellen ›</span></button>`;
  h += `<h2>Oder selbst wählen</h2><section class="list">`;
  for (const c of CATS){
    h += `<button class="ev" data-act="tn" data-v="${c.key}"><span class="stripe" style="background:${c.col}"></span><span class="t"><span class="n">${c.name}</span><span class="m">${c.sub}</span></span>${dotsHTML(c.dots, c.col)}</button>`;
  }
  h += `</section><div class="row"><h2>Bibliothek</h2><a href="#bib" class="small" style="font-weight:700;color:var(--lilac);text-decoration:none">Alle ${LIB.length} Workouts ›</a></div>`;
  return h + navBar('workouts');
}
let GEN = null; // aktuell erzeugtes Workout
function viewGenerated(){
  if (!GEN) return viewWorkouts();
  const t = GEN.t, steps = flatSteps(GEN.steps);
  const c = CATS.find(x => x.key === t.cat);
  let h = `<a class="back" href="${GEN.from || '#workouts'}">‹ Zurück</a>`;
  h += `<div style="display:flex;flex-direction:column;gap:8px"><div class="row" style="justify-content:flex-start;gap:8px"><span class="tag" style="background:var(--card)">${c.name} · ${mins(durOf(steps))} min · Belastung ${loadOf(steps)}</span></div>
    <h1>${esc(t.name)}</h1></div>`;
  h += `<div class="row" style="margin-bottom:-8px"><p class="small muted">${LEVELS[['intro','standard','pro'][GEN.level]]}</p><button class="chip" data-act="swap" aria-label="Anderes Training wählen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4L3 8l4 4"></path><path d="M3 8h14"></path><path d="M17 20l4-4-4-4"></path><path d="M21 16H7"></path></svg>Tauschen</button></div>`;
  h += `<section style="background:var(--bg2);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px">${profileSVG(steps,140)}${legendHTML()}</section>`;
  if (GEN.mode === 'lib'){
    h += `<div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[0,1,2].map(l=>`<button class="btn${GEN.level===l?' sel':''}" data-act="lvl" data-v="${l}">${LEVELS[['intro','standard','pro'][l]]}</button>`).join('')}</div>`;
  }
  h += `<p class="note">${esc(t.desc)}</p>`;
  h += `<section class="steps"><h2 style="margin-bottom:6px">Ablauf</h2>`;
  for (const s of compress(steps)) h += stepRow(s);
  h += `</section><div class="grid2"><button class="btn ghost" data-act="tnlater">Für später</button><button class="btn lime" data-act="tnsend">Auf die Uhr</button></div>`;
  return h;
}
function viewLibrary(cat){
  let h = `<a class="back" href="${cat ? '#bib' : '#workouts'}">‹ Zurück</a>`;
  if (!cat){
    h += `<h1>Bibliothek</h1><p class="muted">${LIB.length} Workouts in ${CATS.length} Kategorien. Jedes in drei Stufen.</p><section class="grid2" style="gap:10px">`;
    CATS.forEach((c,i) => {
      const n = LIB.filter(t => t.cat === c.key).length;
      h += `<a href="#bib-${i}" style="background:var(--bg2);border-radius:18px;padding:14px;text-decoration:none;color:var(--text);display:flex;flex-direction:column;gap:6px;border-left:6px solid ${c.col}">
        <span class="row"><b style="font-size:16px">${c.name}</b><span class="muted">${n}</span></span><span class="small muted">${c.sub}</span></a>`;
    });
    return h + `</section>`;
  }
  const c = CATS[Number(cat)];
  h += `<h1>${c.name}</h1><p class="muted">${c.sub}</p><section class="list">`;
  LIB.filter(t => t.cat === c.key).forEach(t => {
    const s = libWorkout(t, 1);
    h += `<button class="ev" data-act="libopen" data-v="${t.id}" style="flex-direction:column;align-items:stretch;gap:8px">
      <span class="row"><span class="n" style="font-weight:700">${esc(t.name)}</span><span class="small muted">${mins(durOf(s))} min · ${loadOf(s)}</span></span>
      <span style="display:block;background:var(--bg);border-radius:10px;padding:6px">${profileSVG(flatSteps(s),40)}</span></button>`;
  });
  return h + `</section>`;
}

/* ---------- Planerstellung ---------- */
const GOAL = { dist:'hm', date:'', time:'', days:4, long:'So' };
const DISTS = {
  '5k':  { name:'5 km', km:5,      minW:6,  taper:1, ctl:35, speed:1.06, keyB:'vo2',      keyA:'schwelle' },
  '10k': { name:'10 km', km:10,    minW:8,  taper:1, ctl:40, speed:1.02, keyB:'schwelle', keyA:'vo2' },
  'hm':  { name:'Halbmarathon', km:21.0975, minW:10, taper:2, ctl:45, speed:0.97, keyB:'schwelle', keyA:'tempo' },
  'm':   { name:'Marathon', km:42.195, minW:14, taper:2, ctl:55, speed:0.91, keyB:'tempo',    keyA:'schwelle' },
};
const fmtTime = sec => { sec = Math.round(sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60; return h ? `${h}:${d2(m)}:${d2(s)}` : `${m}:${d2(s)}`; };
const parseTime = t => { const p = (t||'').trim().split(':').map(Number); if (!p.length || p.some(isNaN)) return null; return p.length===3 ? p[0]*3600+p[1]*60+p[2] : p.length===2 ? p[0]*60+p[1] : null; };
function predictTime(dk){ const d = DISTS[dk]; return d.km*1000 / (THR * d.speed); }
function otherLoadPerWeek(){
  const from = addDays(TODAY, -28);
  const tot = SNAP.activities.filter(a => !isRun(a.type) && dateOf(a.start_date_local) >= from).reduce((a,x)=>a+(x.icu_training_load||0),0);
  return Math.round(tot / 4);
}
function runMinutesPerWeek(){
  const from = addDays(TODAY, -28);
  const tot = SNAP.activities.filter(a => isRun(a.type) && dateOf(a.start_date_local) >= from).reduce((a,x)=>a+(x.moving_time||0),0);
  return Math.round(tot / 60 / 4);
}
const PEAK_MIN = { '5k':210, '10k':240, 'hm':300, 'm':390 };
const DAYF = { 2:0.7, 3:0.8, 4:0.9, 5:1, 6:1.1 };
const LONG = { '5k':[50,80], '10k':[60,95], 'hm':[70,120], 'm':[90,180] };
const WD7 = ['Mo','Di','Mi','Do','Fr','Sa','So'];
// Lauftage verteilen: alle Kombinationen durchprobieren, harte Tage nie direkt nebeneinander oder neben dem langen Lauf
function assignDays(sessions, anchor, raceWeek){
  const anc = sessions.find(s => s.anchor), rest = sessions.filter(s => !s.anchor);
  const hard = rest.filter(s => s.hard), easy = rest.filter(s => !s.hard);
  const pool = [0,1,2,3,4,5,6].filter(d => d !== anchor && (!raceWeek || d < anchor));
  const need = Math.min(rest.length, pool.length);
  const dist = (a,b) => { const x = Math.abs(a-b); return raceWeek ? x : Math.min(x, 7-x); };
  let best = null;
  const combos = (arr, k, start = 0, cur = []) => { if (cur.length === k) return [cur.slice()]; let o = []; for (let i = start; i < arr.length; i++){ cur.push(arr[i]); o = o.concat(combos(arr, k, i+1, cur)); cur.pop(); } return o; };
  const nH = Math.min(hard.length, need);
  for (const set of combos(pool, need)){
    for (const hs of combos(set, nH)){
      let sc = 0;
      const all = [anchor, ...set].sort((x,y)=>x-y);
      for (let i = 0; i < all.length - (raceWeek ? 1 : 0); i++){ const g = dist(all[i], all[(i+1) % all.length]); if (g === 1) sc += 1; }
      hs.forEach((h, i) => {
        if (raceWeek) sc += Math.abs(anchor - 2 - h) * 3;
        else if (dist(h, anchor) === 1) sc += 10;
        hs.slice(i+1).forEach(h2 => { if (dist(h, h2) === 1) sc += 10; });
      });
      if (!best || sc < best.sc) best = { sc, set, hs };
    }
  }
  if (anc) anc.di = anchor;
  if (best){
    const hs = [...best.hs], es = best.set.filter(d => !hs.includes(d));
    hard.slice(0, nH).forEach(s => s.di = hs.shift());
    [...hard.slice(nH), ...easy].forEach(s => { s.di = es.length ? es.shift() : null; });
  }
  for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].di == null) sessions.splice(i, 1);
  sessions.forEach(s => s.day = WD7[s.di]);
  sessions.sort((a,b) => a.di - b.di);
}
function buildPlan(g){
  const d = DISTS[g.dist];
  const start = addDays(monday(TODAY), 7); // Start: nächster Montag
  const race = g.date;
  const weeks = Math.floor((parseD(race) - parseD(start)) / 864e5 / 7) + 1;
  if (weeks < 2) return { error:'Das Renndatum liegt zu nah für einen eigenen Plan.' };
  const f = formInfo(), ctl0 = f.ctl;
  const warn = [];
  const taper = Math.min(d.taper, weeks-1);
  const build = weeks - taper;
  const startMin = Math.max(90, runMinutesPerWeek());
  const peak = Math.round(PEAK_MIN[g.dist] * DAYF[g.days]);
  // Umfang steigt höchstens 10 % pro Woche (ohne Erholungswochen)
  const steps = Math.max(1, build - Math.floor(build/4) - 1);
  let growth = Math.pow(peak / startMin, 1/steps) - 1;
  if (weeks < d.minW) warn.push({ lvl:'r', t:`Sehr knapp: Für ${d.name} sind mindestens ${d.minW} Wochen Vorbereitung sinnvoll, du hast ${weeks}.` });
  if (growth > 0.12) warn.push({ lvl:'r', t:`Zu steil: Dein Laufumfang müsste um ${Math.round(growth*100)} % pro Woche steigen, von ${fmtH(startMin)} auf ${fmtH(peak)}. Sicher sind etwa 10 %. Ich deckele das, du startest dann mit weniger Umfang ins Rennen als ideal.` });
  else if (growth > 0.10) warn.push({ lvl:'y', t:`Ambitioniert: ${Math.round(growth*100)} % mehr Laufumfang pro Woche liegen knapp über den empfohlenen 10 %. Achte besonders auf Erholung.` });
  growth = Math.min(growth, 0.10);
  if (g.dist === 'm' && g.days === 2) warn.push({ lvl:'r', t:'Zwei Lauftage reichen für einen Marathon nicht sicher aus. Der lange Lauf müsste fast den ganzen Umfang tragen, das Verletzungsrisiko steigt deutlich. Nimm mindestens einen dritten Tag dazu.' });
  else if (g.dist === 'm' && g.days < 4) warn.push({ lvl:'y', t:'Für einen Marathon sind vier oder mehr Lauftage pro Woche deutlich besser. Mit drei Tagen wird der lange Lauf sehr lang.' });
  if (g.dist === 'hm' && g.days === 2) warn.push({ lvl:'y', t:'Mit zwei Lauftagen kommst du gut ins Ziel, für eine Zielzeit fehlt aber Umfang. Rad oder Kraft an anderen Tagen helfen, die Grundlage aufzubauen.' });
  const pred = predictTime(g.dist), goal = parseTime(g.time);
  if (goal){
    const gap = (pred - goal) / pred * 100;
    if (gap > 8) warn.push({ lvl:'r', t:`Zielzeit ${fmtTime(goal)} liegt ${Math.round(gap)} % unter deiner aktuellen Prognose von ${fmtTime(pred)}. Das ist in ${weeks} Wochen kaum realistisch.` });
    else if (gap > 4) warn.push({ lvl:'y', t:`Zielzeit ${fmtTime(goal)} ist ambitioniert: Deine aktuelle Prognose liegt bei ${fmtTime(pred)}. Machbar, wenn das Training gut läuft.` });
  }
  const other = otherLoadPerWeek();
  const perMinEasy = 100*Math.pow(0.84,2)/60;
  const out = [];
  let ctl = ctl0, vol = startMin, maxRamp = 0;
  for (let i = 0; i < weeks; i++){
    const wStart = addDays(start, i*7);
    const isRace = i === weeks-1;
    let phase;
    if (i >= build) phase = 'Tapering';
    else if (i < Math.round(build*0.4)) phase = 'Grundlage';
    else if (i < Math.round(build*0.8)) phase = 'Aufbau';
    else phase = 'Spitze';
    const recovery = phase !== 'Tapering' && (i+1) % 4 === 0;
    if (!recovery && phase !== 'Tapering' && i > 0) vol = Math.min(peak, vol * (1 + growth));
    let wMin = recovery ? vol * 0.75 : vol;
    if (phase === 'Tapering') wMin = vol * (isRace ? 0.5 : 0.7);
    wMin = Math.round(wMin / 5) * 5;
    // Qualitätseinheiten
    const q = [];
    if (phase === 'Grundlage') q.push('GRU-4');
    if (phase === 'Aufbau') q.push(pickId(d.keyB, i), pickId(d.keyA, i));
    if (phase === 'Spitze') q.push(pickId(d.keyB, i), g.dist==='m'||g.dist==='hm' ? 'WET-3' : 'WET-2');
    if (phase === 'Tapering') q.push(isRace ? 'WET-1' : pickId(d.keyB, i));
    const nQ = Math.min(q.length, Math.max(1, g.days - 2) + (isRace && g.days > 2 ? 1 : 0));
    const qSessions = q.slice(0, nQ).map(id => { const t = LIB.find(x=>x.id===id); const st_ = libWorkout(t, recovery || phase==='Tapering' ? 0 : 1); return { name:t.name, min:mins(durOf(st_)), load:loadOf(st_), col:CATS.find(c=>c.key===t.cat).col, hard:t.cat!=='erholung'&&t.cat!=='grundlage' }; });
    const sessions = [...qSessions];
    let rest = wMin - qSessions.reduce((a,s)=>a+s.min,0);
    if (!isRace){
      const [lo, hi] = LONG[g.dist];
      const prog = Math.min(1, i / Math.max(1, build-1));
      let longMin = lo + (hi-lo) * prog;
      if (recovery) longMin *= 0.8;
      if (phase==='Tapering') longMin = lo * 0.8;
      longMin = Math.round(Math.min(longMin, wMin * (g.days === 2 ? 0.6 : 0.42)) / 5) * 5;
      sessions.push({ name:'Langer Lauf', min:longMin, load:Math.round(longMin*perMinEasy), col:'#FFD84D', anchor:true });
      rest -= longMin;
    }
    const nEasy = g.days - sessions.length - (isRace ? 1 : 0);
    for (let k = 0; k < nEasy; k++){
      const m = Math.max(30, Math.round(rest / nEasy / 5) * 5);
      sessions.push({ name:'Lockerer Lauf', min:m, load:Math.round(m*perMinEasy), col:'#FFD84D' });
    }
    if (isRace) sessions.push({ name:`Rennen: ${d.name}`, min:Math.round(pred/60), load:Math.round(pred/60*1.5), col:'#D7FF3D', anchor:true });
    assignDays(sessions, isRace ? (parseD(race).getUTCDay()+6)%7 : Math.max(0, WD7.indexOf(g.long)), isRace);
    const totMin = sessions.reduce((a,s)=>a+s.min,0);
    const load = sessions.reduce((a,s)=>a+s.load,0) + other;
    const prev = ctl;
    ctl = ctl + (load/7 - ctl) * (1 - Math.exp(-7/42));
    maxRamp = Math.max(maxRamp, ctl - prev);
    const long = sessions.find(s=>s.name==='Langer Lauf');
    if (long && long.min > totMin*0.4 && !warn.some(w=>w.k==='long')) warn.push({ k:'long', lvl:'y', t:'In manchen Wochen macht der lange Lauf mehr als 40 % deiner Laufzeit aus. Ein Lauftag mehr würde das entzerren.' });
    out.push({ i, wStart, phase, recovery, load: Math.round(load), ctl:Math.round(ctl), sessions, totMin });
  }
  if (maxRamp > 6) warn.push({ lvl:'r', t:`In einzelnen Wochen steigt deine Fitness um bis zu ${maxRamp.toFixed(1)} Punkte. Mehr als etwa 5 pro Woche erhöht das Verletzungsrisiko deutlich.` });
  const target = Math.round(d.ctl * (0.75 + g.days * 0.0625));
  const ctlEnd = Math.round(out[out.length-1].ctl);
  if (ctlEnd < target - 8) warn.push({ lvl:'y', t:`Am Renntag liegt deine Fitness voraussichtlich bei ${ctlEnd}, für ${d.name} wären etwa ${target} ideal. Das Ziel ist trotzdem schaffbar, aber eher zum Ankommen als für eine Bestzeit.` });
  return { weeks: out, warn, target, ctlEnd, ctl0, pred, goal, other, d, race, startMin, peak };
}
function fmtH(m){ return `${Math.floor(m/60)}:${d2(Math.round(m%60))} h`; }
function pickId(cat, i){ const l = LIB.filter(t=>t.cat===cat); return l[i % l.length].id; }

function viewGoal(){
  const defDate = GOAL.date || addDays(TODAY, 7*16);
  let h = `<a class="back" href="#woche">‹ Zurück</a><h1>Neuer Plan</h1><p class="muted">Was ist dein Ziel? Daraus baue ich deinen Plan und sage dir, ob er realistisch ist.</p>`;
  h += `<form id="goalform" style="display:flex;flex-direction:column;gap:16px">
    <fieldset style="border:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px"><legend class="small muted" style="margin-bottom:8px">Strecke</legend>
      <div class="grid2">${Object.entries(DISTS).map(([k,d])=>`<label class="btn${GOAL.dist===k?' sel':''}" style="display:flex;align-items:center;justify-content:center"><input type="radio" name="dist" value="${k}" ${GOAL.dist===k?'checked':''} style="position:absolute;opacity:0">${d.name}</label>`).join('')}</div></fieldset>
    <label class="small muted" style="display:flex;flex-direction:column;gap:6px">Renndatum<input type="date" name="date" value="${defDate}" min="${addDays(TODAY,14)}" style="height:48px;border-radius:14px;border:2px solid var(--line);background:var(--bg2);color:var(--text);padding:0 12px;font-family:inherit;font-size:16px"></label>
    <label class="small muted" style="display:flex;flex-direction:column;gap:6px">Zielzeit (optional)<input type="text" name="time" value="${esc(GOAL.time)}" placeholder="1:45:00" inputmode="numeric" style="height:48px;border-radius:14px;border:2px solid var(--line);background:var(--bg2);color:var(--text);padding:0 12px;font-family:inherit;font-size:16px"></label>
    <fieldset style="border:none;padding:0;margin:0"><legend class="small muted" style="margin-bottom:8px">Lauftage pro Woche</legend>
      <div class="grid2" style="grid-template-columns:repeat(5,minmax(0,1fr))">${[2,3,4,5,6].map(n=>`<label class="btn${GOAL.days===n?' sel':''}" style="display:flex;align-items:center;justify-content:center"><input type="radio" name="days" value="${n}" ${GOAL.days===n?'checked':''} style="position:absolute;opacity:0">${n}</label>`).join('')}</div></fieldset>
    <fieldset style="border:none;padding:0;margin:0"><legend class="small muted" style="margin-bottom:8px">Langer Lauf am</legend>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${WD7.map(n=>`<label class="btn${GOAL.long===n?' sel':''}" style="height:40px;border-radius:10px;font-size:13px;display:flex;align-items:center;justify-content:center;position:relative"><input type="radio" name="long" value="${n}" ${GOAL.long===n?'checked':''} style="position:absolute;opacity:0">${n}</label>`).join('')}</div></fieldset>
    <p class="small" id="goalerr" style="color:#FF6B6B;min-height:18px" role="alert"></p>
    <button type="submit" class="btn lime" style="height:56px;font-size:16px">Plan erstellen</button></form>`;
  h += `<p class="small muted" style="line-height:1.5">Deine aktuelle Prognose aus der Schwellenpace (${paceStr(THR)} /km): 5 km ${fmtTime(predictTime('5k'))}, 10 km ${fmtTime(predictTime('10k'))}, Halbmarathon ${fmtTime(predictTime('hm'))}, Marathon ${fmtTime(predictTime('m'))}.</p>`;
  return h;
}
function viewPlanPreview(){
  if (!GOAL.date) return viewGoal();
  const p = buildPlan(GOAL);
  let h = `<a class="back" href="#ziel">‹ Ziel ändern</a>`;
  if (p.error) return h + `<p class="note">${esc(p.error)}</p>`;
  h += `<h1>${p.d.name} am ${nice(p.race)}</h1><p class="muted">${p.weeks.length} Wochen · ${GOAL.days} Lauftage · Prognose heute ${fmtTime(p.pred)}${p.goal?` · Ziel ${fmtTime(p.goal)}`:''}</p>`;
  if (p.warn.length){
    h += `<section class="list">${p.warn.map(w=>`<p class="note" style="border-left:0;border:2px solid ${w.lvl==='r'?'#FF3B3B':'#FFD84D'}"><b style="color:${w.lvl==='r'?'#FF6B6B':'#FFD84D'}">${w.lvl==='r'?'Kritisch':'Achtung'}:</b> ${esc(w.t)}</p>`).join('')}</section>`;
  } else h += `<p class="note"><b style="color:var(--lime)">Läuft.</b> Der Plan steigert sich in einem sicheren Tempo und passt zu deinem Ziel.</p>`;
  // Phasenleiste
  const PH = { Grundlage:'#FFD84D', Aufbau:'#FF8A1F', Spitze:'#FF3B3B', Tapering:'#C9B6FF' };
  h += `<section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:2px;height:14px;border-radius:7px;overflow:hidden">${p.weeks.map(w=>`<span style="flex:1;background:${PH[w.phase]};opacity:${w.recovery?0.45:1}"></span>`).join('')}</div>
    <div class="legend">${Object.entries(PH).map(([k,c])=>`<span><i style="background:${c}"></i>${k}</span>`).join('')}</div></section>`;
  // Fitnesskurve
  const W = 350, H = 110, maxC = Math.max(p.target, ...p.weeks.map(w=>w.ctl)) * 1.15;
  const X = i => (i+1) / p.weeks.length * W, Y = v => H - v / maxC * H;
  const pts = `0,${Y(p.ctl0).toFixed(1)} ` + p.weeks.map((w,i)=>`${X(i).toFixed(1)},${Y(w.ctl).toFixed(1)}`).join(' ');
  h += `<section style="background:var(--bg2);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:8px"><h2>Fitness bis zum Rennen</h2>
    <svg width="100%" height="110" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Geplanter Verlauf der Fitness"><line x1="0" x2="${W}" y1="${Y(p.target)}" y2="${Y(p.target)}" stroke="#D7FF3D" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"></line><polyline fill="none" stroke="#F1EAFF" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${pts}"></polyline></svg>
    <p class="small muted">Heute ${p.ctl0} → am Renntag ${p.ctlEnd}. Gestrichelt: Zielfitness ${p.target} für ${p.d.name}. Laufumfang von zuletzt ${fmtH(p.startMin)} auf bis zu ${fmtH(p.peak)} pro Woche.${p.other?` Rad, Kraft und Roller Derby sind mit etwa ${p.other} Belastung pro Woche eingerechnet.`:''}</p></section>`;
  h += `<section class="list">`;
  for (const w of p.weeks){
    h += `<div class="wday"><p class="lbl">Woche ${w.i+1} · ${nice(w.wStart)} · <span style="color:${PH[w.phase]}">${w.phase}${w.recovery?' (Erholungswoche)':''}</span></p>
      <div style="background:var(--bg2);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:6px">
      ${w.sessions.map(s=>`<div class="row small"><span style="display:flex;align-items:center;gap:8px"><i style="width:6px;height:18px;border-radius:3px;background:${s.col};display:inline-block"></i>${s.day?`<b style="width:22px">${s.day}</b>`:''}${esc(s.name)}</span><span class="muted">${s.min} min</span></div>`).join('')}
      <div class="row small muted" style="border-top:1px solid var(--line);padding-top:6px"><span>Laufzeit ${Math.floor(w.totMin/60)}:${d2(w.totMin%60)} h</span><span>Belastung gesamt ${w.load}</span></div></div></div>`;
  }
  h += `</section><button class="btn lime" data-act="planok" style="height:56px">Plan übernehmen</button>
  <p class="small muted" style="line-height:1.5">In der Vorschau wird der Plan noch nicht in Intervals geschrieben. Das kommt, sobald der Server läuft. Dann ersetzt er deinen IntervalCoach-Plan ab dem Startdatum.</p>`;
  return h;
}

/* ---------- Ereignisse der neuen Ansichten ---------- */
document.addEventListener('input', e => {
  if (e.target.id === 'tnrange'){ TN.minutes = Number(e.target.value); const o = document.getElementById('tnmin'); if (o) o.textContent = TN.minutes; }
});
document.addEventListener('change', e => {
  const f = e.target.form;
  if (f && f.id === 'goalform' && e.target.type === 'radio'){
    GOAL[e.target.name] = e.target.name === 'days' ? Number(e.target.value) : e.target.value;
    f.querySelectorAll(`input[name="${e.target.name}"]`).forEach(i => i.parentElement.classList.toggle('sel', i.checked));
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'goalform') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const date = fd.get('date'), time = String(fd.get('time')||'').trim();
  const err = document.getElementById('goalerr');
  if (!date || date < addDays(TODAY, 14)){ err.textContent = 'Wähl ein Renndatum mindestens zwei Wochen in der Zukunft.'; return; }
  if (time && !parseTime(time)){ err.textContent = 'Zielzeit bitte als h:mm:ss oder mm:ss eingeben, z. B. 1:45:00.'; return; }
  Object.assign(GOAL, { dist:fd.get('dist'), date, time, days:Number(fd.get('days')), long:fd.get('long') });
  location.hash = '#planvorschau';
});
document.addEventListener('input', e => { if (e.target.form && e.target.form.id === 'goalform'){ const err = document.getElementById('goalerr'); if (err) err.textContent=''; } });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, v } = b.dataset;
  if (act === 'tn'){
    const t = pickTemplate(v, TN.minutes);
    const fw = fitWorkout(t, TN.minutes);
    GEN = { t, steps: fw.steps, level: fw.level, mode:'tn', from:'#workouts', minutes: TN.minutes };
    location.hash = '#gen';
  }
  if (act === 'libopen'){
    const t = LIB.find(x => x.id === v);
    GEN = { t, steps: libWorkout(t, 1), level: 1, mode:'lib', from: location.hash || '#bib' };
    location.hash = '#gen';
  }
  if (act === 'lvl' && GEN){ GEN.level = Number(v); GEN.steps = libWorkout(GEN.t, GEN.level); render(); }
  if (act === 'tnsend'){ if (!LIVE) toast('In der Vorschau wird nichts gesendet. In der Live-App geht das Workout direkt auf die Uhr.'); else pushCreate(GEN, TODAY); }
  if (act === 'tnlater'){
    let h = `<h2>Für später einplanen</h2><p class="small muted">An welchem Tag?</p><div class="mv">`;
    for (let i = 1; i <= 7; i++){ const d = addDays(TODAY, i); const c = conflict({ id:-1, cat:{ hard: GEN && ['schwelle','vo2','tempo','berg','test','speed'].includes(GEN.t.cat) } }, d); h += `<button class="${c.c}" data-act="tnat" data-d="${d}"><span>${WD[wd(d)]}</span><span>${parseD(d).getUTCDate()}.</span></button>`; }
    openSheet(h + `</div><p class="hint">Grün passt, gelb geht mit Hinweis, rot kollidiert mit einer harten Einheit.</p>`);
  }
  if (act === 'tnat'){ closeSheet(); if (!LIVE) toast('In der Vorschau wird nichts gesendet.'); else pushCreate(GEN, b.dataset.d); }
  if (act === 'planok') toast('Gespeichert für später. Übernommen wird der Plan, sobald der Server läuft.');
});


/* ---------- Tagesschalter "Läuft." ---------- */
// An, sobald das heutige Training erledigt ist. Ruhetage sind automatisch an.
function dayDone(day){
  const evs = plan().filter(e => e.date === day);
  if (!evs.length) return { rest:true, done:true };
  return { rest:false, done: evs.every(e => statusOf(e).s === 'done'), evs };
}
function dayStatus(){
  const d = dayDone(TODAY);
  if (d.rest) return { on:true, label:'Läuft.', sub:'Ruhetag. Erholung gehört zum Plan.' };
  if (d.done) return { on:true, label:'Läuft.', sub:'Heute erledigt. Stark.' };
  const ev = d.evs.find(e => statusOf(e).s !== 'done');
  return { on:false, label:`Heute: ${ev.cat.name} · ${mins(ev.dur)} min`, sub:'' };
}
function streakDays(){
  let n = dayDone(TODAY).done ? 1 : 0;
  for (let i = 1; i < 60; i++){
    const day = addDays(TODAY, -i);
    const first = SNAP.events.map(e=>dateOf(e.start_date_local)).sort()[0];
    if (!first || day < first) break; // nur Tage, für die ein Plan vorliegt
    if (!dayDone(day).done) break;
    n++;
  }
  return n;
}

/* ---------- Automatisch umplanen ---------- */
// Verpasste Schlüsseleinheit dieser Woche auf einen späteren lockeren Tag legen, wenn das sicher geht.
function autoReplan(){
  const mon = monday(TODAY), sun = addDays(mon, 6);
  const f = formInfo();
  const all = plan();
  for (const ev of all){
    if (ev.date < mon || ev.date >= TODAY || !ev.cat.key || !ev.cat.hard) continue;
    if (statusOf(ev).s !== 'missed') continue;
    if (ST.auto[ev.id] !== undefined) continue;
    if (ST.unfit[ev.date]) { ST.auto[ev.id] = { none:true, reason:'unfit' }; continue; }
    const hardOn = day => plan().some(e => e.id !== ev.id && e.date === day && e.cat.hard && statusOf(e).s !== 'missed');
    const doneHard = day => activitiesOn(day).some(a => isRun(a.type) && (a.icu_training_load||0) >= 55);
    const cands = plan().filter(e => e.date >= TODAY && e.date <= sun && isRun(e.type) && !e.cat.hard && statusOf(e).s !== 'done' && !ST.variants[e.id]);
    let pick = null;
    for (const c of cands){
      const prev = addDays(c.date, -1), next = addDays(c.date, 1);
      if (hardOn(prev) || hardOn(next) || doneHard(prev)) continue;
      if (f.zone.key === 'high' && c.date <= addDays(TODAY, 1)) continue; // müde: nicht sofort hart
      pick = c; break;
    }
    if (pick && isOwn(ev.raw) && isOwn(pick.raw)){
      ST.moves[ev.id] = pick.date;
      ST.removed[pick.id] = 'auto';
      ST.auto[ev.id] = { to: pick.id, from: ev.date, day: pick.date, name: ev.name, easy: pick.name };
    } else if (pick){
      // Fremde Trainings fasst die Automatik nicht an: nur ein Vorschlag
      ST.auto[ev.id] = { suggest:true, to: pick.id, from: ev.date, day: pick.date, name: ev.name, easy: pick.name, src: sourceOf(ev.raw) };
    } else {
      ST.auto[ev.id] = { none:true, from: ev.date, name: ev.name };
    }
    save();
  }
}
function autoNote(){
  const items = Object.entries(ST.auto).filter(([id,a]) => !a.seen && a.from && a.from >= monday(TODAY));
  if (!items.length) return '';
  return items.map(([id,a]) => a.suggest
    ? `<p class="note"><b>Vorschlag:</b> ${esc(a.name)} von ${WDL[wd(a.from)]} ist ausgefallen. Soll die Einheit auf <b>${WDL[wd(a.day)]}</b> rutschen? Dafür fällt ${esc(a.easy)} weg. <span class="small" style="display:block;margin-top:6px;color:var(--lilac)">Die Einheiten sind von ${esc(a.src)}, deshalb ändere ich nichts ohne dich.</span><span style="display:flex;gap:8px;margin-top:10px"><button class="chip" data-act="autoapply" data-id="${id}">Übernehmen</button><button class="chip" data-act="autook" data-id="${id}" style="color:var(--lilac)">Nein, danke</button></span></p>`
    : a.none
    ? `<p class="note"><b>Plan angepasst:</b> ${esc(a.name)} von ${WDL[wd(a.from)]} passt diese Woche nicht mehr sicher rein und fällt weg. Fehlender Umfang wird locker ausgeglichen. <button class="chip" data-act="autook" data-id="${id}" style="margin-top:8px">Okay</button></p>`
    : `<p class="note"><b>Plan angepasst:</b> ${WDL[wd(a.from)]} ist ausgefallen, deshalb ist ${WDL[wd(a.day)]} jetzt <b>${esc(a.name)}</b> statt ${esc(a.easy)}.<span style="display:flex;gap:8px;margin-top:10px"><button class="chip" data-act="autook" data-id="${id}">Passt</button><button class="chip" data-act="autoundo" data-id="${id}" style="color:var(--lilac)">Rückgängig</button></span></p>`).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id } = b.dataset;
  const a = ST.auto[id];
  if (act === 'autook' && a){ a.seen = true; save(); render(); if (!a.none && !a.suggest){ pushMove(id, a.day); pushDelete(String(a.to)); } }
  if (act === 'autoapply' && a){
    ST.moves[id] = a.day; ST.removed[a.to] = 'auto'; a.seen = true; delete a.suggest; save(); render();
    toast(`Übernommen: ${WDL[wd(a.day)]} ist jetzt ${a.name}`); pushMove(id, a.day); pushDelete(String(a.to));
  }
  if (act === 'autoundo' && a){
    delete ST.moves[id]; if (a.to) delete ST.removed[a.to];
    ST.auto[id] = { none:true, undone:true, seen:true, from:a.from, name:a.name };
    save(); render(); toast('Rückgängig gemacht. Die Woche ist wie vorher.');
  }
});


/* ---------- Training tauschen ---------- */
function swapCandidate(t){
  if (GEN.mode === 'tn'){ const fw = fitWorkout(t, GEN.minutes || TN.minutes); return { steps: fw.steps, level: fw.level }; }
  return { steps: libWorkout(t, GEN.level), level: GEN.level };
}
function swapSheet(cat){
  if (!GEN) return;
  cat = cat || GEN.t.cat;
  let h = `<h2>Training tauschen</h2><p class="small muted">${GEN.mode==='tn' ? `Alle auf ${GEN.minutes || TN.minutes} min angepasst.` : 'In derselben Stufe.'}</p>`;
  h += `<div class="catrow" style="display:flex;gap:6px;overflow-x:auto;padding:2px 2px 6px">${CATS.map(c => `<button class="chip" data-act="swapcat" data-v="${c.key}" style="flex:none;${c.key===cat?`background:${c.col};color:var(--bg)`:'color:var(--lilac)'}">${c.name}</button>`).join('')}</div>`;
  h += `<div class="list">`;
  for (const t of LIB.filter(x => x.cat === cat)){
    const c = swapCandidate(t), fl = flatSteps(c.steps), cur = t.id === GEN.t.id;
    h += `<button class="ev" data-act="swappick" data-v="${t.id}" style="flex-direction:column;align-items:stretch;gap:8px;${cur?'outline:2px solid var(--lime)':''}">
      <span class="row"><span class="n" style="font-weight:700">${esc(t.name)}</span><span class="small muted">${cur?'aktuell · ':''}${mins(durOf(fl))} min · ${loadOf(fl)}</span></span>
      <span style="display:block;background:var(--bg);border-radius:10px;padding:6px">${profileSVG(fl,40)}</span></button>`;
  }
  openCatSheet(h + `</div>`);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, v } = b.dataset;
  if (act === 'swap') swapSheet();
  if (act === 'swapcat') swapSheet(v);
  if (act === 'swappick' && GEN){
    const t = LIB.find(x => x.id === v), c = swapCandidate(t);
    Object.assign(GEN, { t, steps: c.steps, level: c.level });
    closeSheet(); render(); window.scrollTo(0,0);
  }
});


/* ---------- Woche: durchgehende Ansicht über mehrere Wochen ---------- */
let showPrevWeek = false;
function lastPlanDate(){ return SNAP.events.map(e=>dateOf(e.start_date_local)).sort().pop() || TODAY; }
function weekBlock(mon){
  const wi = weekInfo(mon);
  const pct = wi.planned ? Math.min(100, Math.round(wi.done/wi.planned*100)) : 0;
  const thisMon = monday(TODAY);
  const title = mon === thisMon ? 'Diese Woche' : mon === addDays(thisMon,7) ? 'Nächste Woche' : mon === addDays(thisMon,-7) ? 'Letzte Woche' : `${shortD(mon)} – ${shortD(addDays(mon,6))}`;
  let h = `<div class="weeksep"><div class="row"><h2>${title}</h2><span class="small muted">${mon<=TODAY?`Belastung ${wi.done} von ${wi.planned}`:`geplant ${wi.planned}`}</span></div>${mon<=TODAY?`<div class="bar"><i style="width:${pct}%"></i></div>`:''}</div>`;
  for (const d of wi.days){
    const evs = wi.evs.filter(e=>e.date===d);
    h += `<div class="wday" data-day="${d}"><p class="lbl${d===TODAY?' today':''}">${nice(d)}${d===TODAY?' · heute':''}</p>`;
    if (!evs.length) h += `<p class="empty">Ruhetag</p>`;
    for (const ev of evs){
      const st = statusOf(ev);
      const right = st.s==='done' ? '<span class="st" style="color:var(--lime)">✓ erledigt</span>' : st.s==='missed' ? '<span class="st" style="color:#FF6B6B">verpasst</span>' : `<span class="st muted">${ev.load}</span>`;
      const meta = st.s==='done' && st.act ? (isRun(st.act.type) ? `${(st.act.distance/1000).toFixed(1)} km · ${mins(st.act.moving_time)} min · ${paceStr(st.act.average_speed)} /km` : `${st.act.name} · ${mins(st.act.moving_time)} min`) : `${ev.cat.name}${ev.dur?` · ${mins(ev.dur)} min`:''}${ev.variant?` · ${VARIANTS[ev.variant]}`:''}${ev.extra?` · +${mins(ev.extra)} min Ausgleich`:''}${ST.moves[ev.id]?' · verschoben':''}`;
      const movable = st.s!=='done' && ev.date >= TODAY;
      const srcTag = `<span style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${isOwn(ev.raw)?'var(--lime)':'var(--lilac)'};opacity:.85">${sourceOf(ev.raw)}</span>`;
      h += `<button class="ev ${st.s}" data-act="menu" data-id="${ev.id}"${movable?' data-drag="1"':''}><span class="stripe" style="background:${ev.cat.col}"></span><span class="t">${srcTag}<span class="n">${esc(ev.name)}</span><span class="m">${esc(meta)}</span></span>${right}</button>`;
    }
    h += `</div>`;
  }
  const extras = SNAP.activities.filter(a=>{const d=dateOf(a.start_date_local);return d>=mon&&d<=wi.days[6] && !wi.evs.some(e=>statusOf(e).act===a);});
  if (extras.length){
    h += `<div class="wday"><p class="lbl">Zusätzlich trainiert</p>`;
    for (const a of extras) h += `<div class="ev done"><span class="stripe" style="background:var(--line)"></span><span class="t"><span class="n">${esc(a.name)}</span><span class="m">${nice(dateOf(a.start_date_local))} · ${esc(a.type)} · ${mins(a.moving_time)} min</span></span><span class="st muted">${a.icu_training_load??''}</span></div>`;
    h += `</div>`;
  }
  return h;
}
function viewWeek(){
  let h = topBar();
  h += `<a href="#ziel" class="btn lime" style="display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;height:56px;font-family:var(--display);font-weight:900;font-size:15px;letter-spacing:.5px;text-transform:uppercase"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>Neuen Plan erstellen</a>`;
  h += `<p class="small muted" style="text-align:center">Kurz tippen für Details · lange drücken zum Verschieben</p>`;
  const thisMon = monday(TODAY), end = lastPlanDate();
  h += `<section class="list">`;
  h += showPrevWeek ? weekBlock(addDays(thisMon,-7)) : `<button class="chip" data-act="prevweek" style="align-self:center;color:var(--lilac)">Letzte Woche anzeigen</button>`;
  for (let mon = thisMon; mon <= end || mon === thisMon; mon = addDays(mon,7)) h += weekBlock(mon);
  return h + `</section>` + navBar('woche');
}

/* ---------- Verschieben-Menü über mehrere Wochen ---------- */
function moveSheet(id){
  const ev = plan().find(e=>String(e.id)===String(id)); if(!ev) return;
  let h = `<h2>Verschieben</h2><p class="small muted">${esc(ev.name)} · aktuell ${nice(ev.date)}</p>`;
  const end = lastPlanDate();
  for (let mon = monday(TODAY), n = 0; (mon <= end || n === 0) && n < 5; mon = addDays(mon,7), n++){
    h += `<div class="mvweek"><p class="small" style="font-weight:700;color:var(--soft)">${n===0?'Diese Woche':n===1?'Nächste Woche':`${shortD(mon)} – ${shortD(addDays(mon,6))}`}</p><div class="mv">`;
    for (let i=0;i<7;i++){
      const d = addDays(mon,i);
      if (d < TODAY){ h += `<button class="x" disabled aria-label="${WDL[wd(d)]} vorbei"><span>${WD[wd(d)]}</span><span>${parseD(d).getUTCDate()}.</span></button>`; continue; }
      const c = d===ev.date ? {c:'g'} : conflict(ev,d);
      h += `<button class="${c.c}${d===ev.date?' cur':''}" data-act="moveto" data-id="${ev.id}" data-d="${d}"><span>${WD[wd(d)]}</span><span>${parseD(d).getUTCDate()}.</span></button>`;
    }
    h += `</div></div>`;
  }
  h += `<p class="hint" id="mvhint">Grün passt, gelb geht mit Hinweis, rot kollidiert mit einer harten Einheit.</p>`;
  openSheet(h);
}

/* ---------- Drag & Drop: lange drücken, ziehen, loslassen ---------- */
const DRAG = { timer:null, start:null, el:null, ghost:null, ev:null, over:null, active:false, justDragged:false, raf:null, y:0 };
function dragCancelPending(){ clearTimeout(DRAG.timer); DRAG.timer = null; DRAG.start = null; }
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.ev[data-drag]'); if (!el) return;
  DRAG.start = { x:e.clientX, y:e.clientY }; DRAG.el = el;
  DRAG.timer = setTimeout(() => startDrag(e.clientX, e.clientY), 420);
});
function startDrag(x, y){
  const el = DRAG.el; if (!el) return;
  const ev = plan().find(v => String(v.id) === el.dataset.id); if (!ev) return;
  DRAG.active = true; DRAG.ev = ev; DRAG.y = y;
  try { navigator.vibrate && navigator.vibrate(25); } catch(_){}
  const r = el.getBoundingClientRect();
  const g = el.cloneNode(true); g.classList.add('drag-ghost'); g.style.width = r.width + 'px';
  g.dataset.dx = x - r.left; g.dataset.dy = y - r.top;
  document.body.appendChild(g); DRAG.ghost = g; el.classList.add('lifted');
  moveGhost(x, y);
  autoScroll();
}
function moveGhost(x, y){
  const g = DRAG.ghost; if (!g) return;
  g.style.transform = `translate(${x - g.dataset.dx}px, ${y - g.dataset.dy}px) scale(1.03)`;
  DRAG.y = y;
  g.style.display = 'none';
  const under = document.elementFromPoint(x, y);
  g.style.display = '';
  const day = under && under.closest('.wday[data-day]');
  if (DRAG.over && DRAG.over !== day) DRAG.over.classList.remove('drop-g','drop-y','drop-r');
  DRAG.over = null;
  if (day && day.dataset.day >= TODAY){
    const d = day.dataset.day;
    const c = d === DRAG.ev.date ? {c:'g'} : conflict(DRAG.ev, d);
    day.classList.remove('drop-g','drop-y','drop-r'); day.classList.add('drop-' + c.c);
    DRAG.over = day;
  }
}
function autoScroll(){
  if (!DRAG.active) return;
  const edge = 90, H = window.innerHeight;
  if (DRAG.y < edge) window.scrollBy(0, -Math.ceil((edge - DRAG.y) / 6));
  else if (DRAG.y > H - edge - 70) window.scrollBy(0, Math.ceil((DRAG.y - (H - edge - 70)) / 6));
  DRAG.raf = requestAnimationFrame(autoScroll);
}
document.addEventListener('pointermove', e => {
  if (DRAG.active){ moveGhost(e.clientX, e.clientY); return; }
  if (DRAG.start && Math.hypot(e.clientX - DRAG.start.x, e.clientY - DRAG.start.y) > 8) dragCancelPending();
});
// Während des Ziehens darf die Seite nicht von selbst scrollen
document.addEventListener('touchmove', e => {
  if (DRAG.active){ e.preventDefault(); const t = e.touches[0]; if (t) moveGhost(t.clientX, t.clientY); }
  else if (DRAG.start && e.touches[0] && Math.hypot(e.touches[0].clientX - DRAG.start.x, e.touches[0].clientY - DRAG.start.y) > 8) dragCancelPending();
}, { passive:false });
document.addEventListener('touchend', () => { if (DRAG.active) endDrag(false); else dragCancelPending(); });
function endDrag(cancel){
  dragCancelPending();
  if (!DRAG.active) return;
  cancelAnimationFrame(DRAG.raf);
  const ev = DRAG.ev, over = DRAG.over;
  if (DRAG.ghost) DRAG.ghost.remove();
  if (DRAG.el) DRAG.el.classList.remove('lifted');
  if (over) over.classList.remove('drop-g','drop-y','drop-r');
  DRAG.active = false; DRAG.ghost = null; DRAG.over = null; DRAG.justDragged = true;
  setTimeout(() => DRAG.justDragged = false, 350);
  if (cancel || !over) return;
  const d = over.dataset.day;
  if (d === ev.date) return;
  const c = conflict(ev, d);
  const apply = () => {
    if (d === dateOf(ev.raw.start_date_local)) delete ST.moves[ev.id]; else ST.moves[ev.id] = d;
    save(); render(); toast(`Verschoben auf ${nice(d)}${c.c!=='g' ? ' · ' + c.why : ''}`);
    pushMove(String(ev.id), d);
  };
  if (c.c === 'r'){
    openSheet(`<h2>Trotzdem verschieben?</h2><p style="line-height:1.5">${esc(c.why)}</p><div class="grid2"><button class="btn ghost" data-act="dragno">Abbrechen</button><button class="btn" data-act="dragyes" data-id="${ev.id}" data-d="${d}" style="background:#FF6B6B;color:var(--bg)">Verschieben</button></div>`);
  } else apply();
}
document.addEventListener('pointerup', () => endDrag(false));
document.addEventListener('pointercancel', () => { if (!DRAG.active) dragCancelPending(); }); // aktives Ziehen endet über touchend
document.addEventListener('contextmenu', e => { if (e.target.closest('.ev[data-drag]')) e.preventDefault(); });
// Klick nach dem Ziehen nicht als Tippen werten
document.addEventListener('click', e => { if (DRAG.justDragged && e.target.closest('.ev')){ e.stopImmediatePropagation(); e.preventDefault(); } }, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'prevweek'){ showPrevWeek = true; render(); }
  if (b.dataset.act === 'dragno') closeSheet();
  if (b.dataset.act === 'dragyes'){
    const { id, d } = b.dataset; const ev = plan().find(v => String(v.id) === id);
    if (d === dateOf(ev.raw.start_date_local)) delete ST.moves[id]; else ST.moves[id] = d;
    save(); closeSheet(); render(); toast(`Verschoben auf ${nice(d)}`);
    pushMove(id, d);
  }
});


/* ---------- Zurückschreiben nach Intervals.icu (nur Live-App) ---------- */
function compTargets(){ return Object.keys(ST.comp).filter(k => !k.endsWith('_from') && ST.comp[k]); }
async function api(method, path, body){
  let token = ''; try { token = localStorage.getItem('ontrack.token') || ''; } catch(e){}
  const r = await fetch(`${CONFIG.apiBase}${path}`, { method, headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json().catch(() => ({}));
}
let syncQueue = Promise.resolve(), syncPending = 0;
function sync(label, fn){
  if (!LIVE) return;
  syncPending++;
  syncQueue = syncQueue.then(fn).then(() => {
    if (--syncPending === 0){ toast('Gespeichert · geht auf deine Uhr'); refreshLive(); }
  }).catch(err => {
    syncPending = Math.max(0, syncPending-1);
    toast(`${label} konnte nicht an Intervals gesendet werden. Bitte später nochmal versuchen.`);
  });
}
async function refreshLive(){
  let token = ''; try { token = localStorage.getItem('ontrack.token') || ''; } catch(e){}
  try { if (await loadLive(token) === 'ok') render(); } catch(e){}
}
const fmtSec = s => s % 60 ? `${Math.round(s)}s` : `${s/60}m`;
function stepsToText(steps){
  const rng = s => { const a = Math.round(s.pace.start), b = Math.round(s.pace.end); return s.ramp ? `ramp ${a}-${b}%` : `${Math.min(a,b)}-${Math.max(a,b)}%`; };
  const line = s => `- ${(s.text || stepLabel(s)).replace(/[\n-]/g,' ').trim()} ${fmtSec(s.duration)}${s.pace ? ` ${rng(s)} Pace` : ''}`;
  return compress(steps).map(s => s.pair ? `\n${s.n}x\n${line(s)}\n${line(s.pair)}\n` : s.n > 1 ? `\n${s.n}x\n${line(s)}\n` : line(s)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function pushMove(id, d){ sync('Das Verschieben', () => api('PUT', `/api/events/${id}`, { start_date_local: `${d}T00:00:00` })); }
function pushDelete(id){ sync('Das Streichen', () => api('DELETE', `/api/events/${id}`)); }
function pushShape(id){
  const raw = SNAP.events.find(e => String(e.id) === String(id)); if (!raw || isStrength(raw.type)) return;
  const changed = ST.variants[id] || ST.comp[id] || (ST.swaps && ST.swaps[id]);
  if (!changed){
    const o = ST.orig[id]; if (!o) return;
    sync('Das Zurücksetzen', async () => { await api('PUT', `/api/events/${id}`, { name:o.name, description:o.description || stepsToText(flatten(o.workout_doc && o.workout_doc.steps)) }); delete ST.orig[id]; save(); });
    return;
  }
  if (!ST.orig[id]) { ST.orig[id] = { name:raw.name, description:raw.description || '', workout_doc:raw.workout_doc, load:raw.icu_training_load }; save(); }
  const ev = buildEvent(raw);
  const base = cleanName(ST.orig[id].name).replace(/^On\.Track · /,'');
  const sw = ST.swaps && ST.swaps[id] && LIB.find(t => t.id === ST.swaps[id].tpl);
  const tag = ev.eased ? ` (statt ${base})` : ST.variants[id] ? ` (${VARIANTS[ST.variants[id]]})` : ST.comp[id] ? ' (Ausgleich)' : '';
  sync('Die Anpassung', () => api('PUT', `/api/events/${id}`, { name:`On.Track · ${ev.eased || (sw ? sw.name : base)}${tag}`, description: stepsToText(ev.steps) + `\n\n${OWN_MARK}` }));
}
function syncShapes(ids){ [...new Set(ids.map(String))].forEach(pushShape); }
function pushCreate(gen, day){
  if (!gen) return;
  const steps = flatSteps(gen.steps);
  sync('Das Workout', () => api('POST', '/api/events', { type:'Run', start_date_local:`${day}T00:00:00`, name:`On.Track · ${gen.t.name}`, description: stepsToText(steps) + `\n\n${OWN_MARK}` }));
  toast(day === TODAY ? 'Wird an deine Uhr gesendet …' : `Wird für ${nice(day)} eingeplant …`);
}


/* ---------- Laufaufbau: Kilometer der letzten 7 Tage im Soll-Band (nur Läufe) ---------- */
// Soll-Band: 0,8- bis 1,3-fache deines Wochenschnitts der letzten 4 Wochen. Nach vorn mit den geplanten Läufen.
function runKmOn(day){ return SNAP.activities.filter(a => isRun(a.type) && dateOf(a.start_date_local) === day).reduce((x,a)=>x+(a.distance||0)/1000,0); }
function stepsKm(steps){ return steps.reduce((x,s)=>x + (s.duration||0) * THR * (s.pace ? stepPct(s) : 75) / 100 / 1000, 0); }
function plannedKmOn(day){ return plan().filter(e => e.date === day && isRun(e.type) && statusOf(e).s !== 'done').reduce((x,e)=>x + (e.steps.length ? stepsKm(e.steps) : (e.raw.distance||0)/1000), 0); }
function runSeries(){
  const days = RANGES.find(r => r[0] === FR.key)[2];
  const ahead = 14;
  const from = addDays(TODAY, -days + 1), to = addDays(TODAY, ahead);
  const daily = {};
  for (let d = addDays(from, -28); d <= to; d = addDays(d, 1)) daily[d] = d < TODAY ? runKmOn(d) : runKmOn(d) + plannedKmOn(d);
  const sum = (d, n) => { let x = 0; for (let i = 0; i < n; i++) x += daily[addDays(d, -i)] || 0; return x; };
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)){
    const km = FR.key === '1y' ? sum(d, 14) / 2 : sum(d, 7), chronic = sum(d, 28) / 4; // 1 Jahr: über 2 Wochen gemittelt, ruhiger
    out.push({ d, km, chronic, lo: chronic * 0.8, hi: chronic * 1.3, future: d > TODAY });
  }
  const step = FR.key === '1y' ? 7 : FR.key === '3m' ? 3 : 2;
  const iT = out.findIndex(p => p.d === TODAY);
  return out.filter((p, i) => i === iT || i === 0 || i === out.length - 1 || Math.abs(i - iT) % step === 0);
}
// Weiche Kurve durch Punkte (Catmull-Rom als Bézier)
function smoothPath(pts){
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++){
    const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
    const c1 = [p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6], c2 = [p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function kmTrend(){
  let a = 0, b = 0;
  for (let i = 0; i < 28; i++){ a += runKmOn(addDays(TODAY, -i)); b += runKmOn(addDays(TODAY, -28 - i)); }
  return { now: a, before: b, pct: b > 0 ? Math.round((a - b) / b * 100) : null };
}
const kmStr = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
function runBuildSection(){
  const S = runSeries(); if (S.length < 2) return '';
  const W = 350, H = 130;
  const max = Math.max(5, ...S.map(p => Math.max(p.km, p.hi))) * 1.12;
  const X = i => i / (S.length - 1) * W, Y = v => H - 6 - v / max * (H - 12);
  const iT = S.findIndex(p => p.d === TODAY);
  const hiPts = S.map((p,i) => [X(i), Y(p.hi)]), loPts = S.map((p,i) => [X(i), Y(p.lo)]);
  const band = `<path d="${smoothPath(hiPts)} L${X(S.length-1)} ${Y(S[S.length-1].lo)} ${smoothPath(loPts.slice().reverse()).replace(/^M/,'L')} Z" fill="#5ED68A" fill-opacity="0.8"></path>`;
  const past = S.slice(0, iT + 1).map((p,i) => [X(i), Y(p.km)]);
  const fut = S.slice(iT).map((p,i) => [X(i + iT), Y(p.km)]);
  const line = `<path d="${smoothPath(past)}" fill="none" stroke="#F1EAFF" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
    <path d="${smoothPath(fut)}" fill="none" stroke="#F1EAFF" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7" vector-effect="non-scaling-stroke"></path>`;
  const t = S[iT];
  const tr = kmTrend();
  const head = tr.pct == null ? `<span style="font-family:var(--display);font-weight:900;font-size:40px;line-height:1;color:var(--lime)">${kmStr(tr.now)} km</span><span class="small muted">in den letzten 4 Wochen</span>`
    : `<span style="font-family:var(--display);font-weight:900;font-size:40px;line-height:1;color:${tr.pct >= 0 ? 'var(--lime)' : 'var(--lilac)'}">${tr.pct > 0 ? '+' : ''}${tr.pct} %</span><span class="small muted">${kmStr(tr.now)} km in 4 Wochen · davor ${kmStr(tr.before)} km</span>`;
  let msg;
  if (t.km < t.lo) msg = 'Gerade etwas unter deinem gewohnten Umfang. Ein lockerer Lauf mehr bringt dich zurück ins grüne Band.';
  else if (t.km > t.hi) msg = 'Mehr Kilometer, als dein Körper gerade gewohnt ist. Die nächsten Tage lieber ruhig.';
  else msg = tr.pct != null && tr.pct > 25 ? 'Stark: Du läufst deutlich mehr als zuvor und liegst trotzdem im grünen Band.' : 'Du liegst im grünen Band: Dein Laufen wächst gesund.';
  const over = S.slice(iT + 1).find(p => p.km > p.hi * 1.05);
  if (over) msg += ` Um den ${shortD(over.d)} sieht dein Plan mehr vor, als gesund mitwächst.`;
  const tx = X(iT), ty = Y(t.km);
  return `<section style="background:var(--bg2);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px">
    <h2>Laufaufbau</h2>
    <div style="display:flex;flex-direction:column;gap:4px">${head}</div>
    <div class="scrub" data-scrub="run" style="position:relative;touch-action:pan-y;cursor:crosshair">
      <svg width="100%" height="130" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kilometer der letzten sieben Tage im Soll-Band" style="display:block;overflow:visible">${band}${line}</svg>
      <span aria-hidden="true" style="position:absolute;left:calc(${(tx/W*100).toFixed(2)}% - 9px);top:${(ty/H*130 - 9).toFixed(1)}px;width:18px;height:18px;border-radius:99px;background:var(--lime);box-shadow:0 0 0 4px var(--bg2)"></span>
      <div class="scrubline" style="display:none;position:absolute;top:0;bottom:0;width:2px;background:var(--text);opacity:.7;pointer-events:none"></div></div>
    <div style="position:relative;height:16px;font-size:12px;color:var(--lilac)">
      <span style="position:absolute;left:0">${FR.key==='1y'?'vor 1 Jahr':FR.key==='3m'?'vor 3 Monaten':'vor 6 Wochen'}</span>
      <span style="position:absolute;left:${(iT/(S.length-1)*100).toFixed(1)}%;transform:translateX(-50%)">Heute</span>
      ${iT/(S.length-1) < 0.72 ? `<span style="position:absolute;right:0">+2 Wochen</span>` : ''}</div>
    <p style="line-height:1.5">${esc(msg)}</p>
    <p class="small" style="color:var(--soft);line-height:1.5">Linie: deine Kilometer der letzten 7 Tage, nur Läufe. Grünes Band: dein Soll, es wächst mit dir. Gepunktet: was dein Plan vorsieht.</p></section>`;
}
// Antippen im Laufaufbau-Diagramm
document.addEventListener('pointerdown', e => {
  const s = e.target.closest('.scrub[data-scrub="run"]'); if (!s) return;
  e.stopImmediatePropagation();
  runScrub(s, e.clientX);
  const mv = ev => runScrub(s, ev.clientX);
  const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); setTimeout(scrubEnd, 1500); };
  document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
}, true);
function runScrub(el, clientX){
  const S = runSeries(); const r = el.getBoundingClientRect();
  const i = Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (S.length - 1)), p = S[i];
  const l = el.querySelector('.scrubline'); l.style.display = 'block'; l.style.left = `calc(${(i/(S.length-1)*100).toFixed(2)}% - 1px)`;
  const tip = document.getElementById('scrubtip'); tip.style.display = 'flex';
  const inZone = p.km >= p.lo && p.km <= p.hi;
  tip.innerHTML = `<b>${p.d===TODAY?'Heute':`${WD[wd(p.d)]}, ${shortD(p.d)}`}${p.future?' (Plan)':''}</b><span>7 Tage <b>${kmStr(p.km)} km</b></span><span>Soll <b>${kmStr(p.lo)}–${kmStr(p.hi)} km</b></span><span style="color:${inZone?'#2E8B3E':'#C0392B'};font-weight:700">${inZone?'im Soll':p.km<p.lo?'darunter':'darüber'}</span>`;
}
/* ---------- Anpassen mit Vorschau, Tauschen für geplante Einheiten, Original wiederherstellen ---------- */
function swapRow(ev){
  return `<div class="row"><span class="small muted">${ev.modified ? 'Angepasst' : esc(sourceOf(ev.raw))}</span><button class="chip" data-act="pswap" data-id="${ev.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4L3 8l4 4"></path><path d="M3 8h14"></path><path d="M17 20l4-4-4-4"></path><path d="M21 16H7"></path></svg>Tauschen</button></div>`;
}
function variantGrid(ev){
  return `<div class="grid2">${Object.entries(VARIANTS).map(([k,l])=>`<button class="btn${ev.variant===k?' sel':''}" data-act="vprev" data-v="${k}" data-id="${ev.id}">${l}${ev.variant===k?' ✓':''}</button>`).join('')}</div>`;
}
function modBanner(ev){
  const what = ev.swapped ? `getauscht (vorher: ${esc(ev.origName)})` : ev.eased ? `leichter: lockerer Dauerlauf statt ${esc(ev.origName)}` : `angepasst: ${VARIANTS[ev.variant]}`;
  return `<div class="note" style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span>Diese Einheit ist <b>${what}</b>.</span><button class="chip" data-act="restore" data-id="${ev.id}" style="flex:none">Zurücksetzen</button></div>`;
}
function corePace(steps){
  const hard = steps.filter(s => s.pace && stepPct(s) >= 75);
  if (!hard.length) return '';
  const top = hard.reduce((a,s)=>stepPct(s)>stepPct(a)?s:a, hard[0]);
  return `${pctToPace(top.pace.end)}–${pctToPace(top.pace.start)}`;
}
// Änderung probehalber berechnen, ohne sie zu speichern
function tryChange(id, change){
  const keep = { v: ST.variants[id], s: ST.swaps[id] };
  if ('variant' in change){ if (change.variant) ST.variants[id] = change.variant; else delete ST.variants[id]; }
  if ('swap' in change){ if (change.swap) ST.swaps[id] = change.swap; else delete ST.swaps[id]; if (change.swap) delete ST.variants[id]; }
  const raw = SNAP.events.find(e => String(e.id) === String(id));
  const after = buildEvent(raw);
  if (keep.v) ST.variants[id] = keep.v; else delete ST.variants[id];
  if (keep.s) ST.swaps[id] = keep.s; else delete ST.swaps[id];
  return after;
}
let PENDING = null;
function previewSheet(id, change, title){
  const raw = SNAP.events.find(e => String(e.id) === String(id)); if (!raw) return;
  const now = buildEvent(raw), next = tryChange(id, change);
  PENDING = { id, change };
  const arrow = (a, b) => a === b ? `<b>${a}</b>` : `${a} → <b style="color:var(--lime)">${b}</b>`;
  let h = `<h2>${esc(title)}</h2><p class="small muted">${esc(now.name)} · ${nice(now.date)}</p>`;
  h += `<div style="background:var(--bg);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:6px">
    <span class="small muted">Jetzt</span>${profileSVG(now.steps,44)}
    <span class="small" style="color:var(--lime);margin-top:6px">Danach${next.name!==now.name?` · ${esc(next.name)}`:''}</span>${profileSVG(next.steps,44)}</div>`;
  h += `<div class="note" style="display:flex;flex-direction:column;gap:4px">
    <span>Dauer: ${arrow(mins(now.dur)+' min', mins(next.dur)+' min')}</span>
    <span>Belastung: ${arrow(String(now.load), String(next.load))}</span>
    ${corePace(next.steps) ? `<span>Pace Hauptteil: ${arrow(corePace(now.steps)+' /km', corePace(next.steps)+' /km')}</span>` : ''}</div>`;
  h += `<div class="grid2"><button class="btn ghost" data-act="pcancel">Abbrechen</button><button class="btn lime" data-act="papply">Übernehmen</button></div>`;
  openSheet(h);
}
function planSwapSheet(id, cat){
  const raw = SNAP.events.find(e => String(e.id) === String(id)); if (!raw) return;
  const ev = buildEvent(raw);
  const curCat = ev.swapped ? LIB.find(t=>t.id===ev.swapped).cat : (CATS.find(c => c.name === ev.cat.name) || CATS[1]).key;
  cat = cat || curCat;
  let h = `<h2>Training tauschen</h2><p class="small muted">Alle auf ${mins(ev.baseDur)} min angepasst · ${nice(ev.date)}</p>`;
  h += `<div class="catrow" style="display:flex;gap:6px;overflow-x:auto;padding:2px 2px 6px">${CATS.map(c => `<button class="chip" data-act="pswapcat" data-id="${id}" data-v="${c.key}" style="flex:none;${c.key===cat?`background:${c.col};color:var(--bg)`:'color:var(--lilac)'}">${c.name}</button>`).join('')}</div>`;
  h += `<div class="list">`;
  for (const t of LIB.filter(x => x.cat === cat)){
    const cand = tryChange(id, { swap:{ tpl:t.id } });
    const cur = ev.swapped === t.id;
    h += `<button class="ev" data-act="pswappick" data-id="${id}" data-v="${t.id}" style="flex-direction:column;align-items:stretch;gap:8px;${cur?'outline:2px solid var(--lime)':''}">
      <span class="row"><span class="n" style="font-weight:700">${esc(t.name)}</span><span class="small muted">${cur?'aktuell · ':''}${mins(cand.dur)} min · ${cand.load}</span></span>
      <span style="display:block;background:var(--bg);border-radius:10px;padding:6px">${profileSVG(cand.steps,40)}</span></button>`;
  }
  openCatSheet(h + `</div>`);
}
function applyChange(id, change){
  const before = compTargets();
  if ('variant' in change){ if (change.variant) ST.variants[id] = change.variant; else delete ST.variants[id]; }
  if ('swap' in change){ if (change.swap){ ST.swaps[id] = change.swap; delete ST.variants[id]; } else delete ST.swaps[id]; }
  const ev = plan().find(e => String(e.id) === String(id));
  const c = ev ? compensate(ev) : null;
  save(); closeSheet(); render();
  syncShapes([id, ...before, ...compTargets()]);
  if (c) toast(`Übernommen. Ausgleich: ${WD[wd(c.tgt.date)]} ${c.tgt.name} +${mins(c.extra)} min locker`);
  else toast('Übernommen');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id, v } = b.dataset;
  if (act === 'vprev'){
    const raw = SNAP.events.find(x => String(x.id) === String(id)); const cur = ST.variants[id];
    if (cur === v){ previewSheet(id, { variant:null }, 'Zurücksetzen'); return; }
    previewSheet(id, { variant:v }, VARIANTS[v]);
  }
  if (act === 'pswap') planSwapSheet(id);
  if (act === 'pswapcat') planSwapSheet(id, v);
  if (act === 'pswappick') previewSheet(id, { swap:{ tpl:v } }, 'Training tauschen');
  if (act === 'pcancel'){ PENDING = null; closeSheet(); }
  if (act === 'papply' && PENDING){ const P = PENDING; PENDING = null; applyChange(P.id, P.change); }
  if (act === 'restore'){
    const raw = SNAP.events.find(x => String(x.id) === String(id)); if (!raw) return;
    if (!b.dataset.confirmed){ previewSheet(id, { variant:null, swap:null }, 'Original wiederherstellen'); return; }
  }
});

// Kategorie-Reihe behält ihre Scroll-Position, wenn man eine Kategorie antippt
function openCatSheet(html){
  const row = document.querySelector('.sheet .catrow');
  const keep = row ? row.scrollLeft : null;
  openSheet(html);
  const nr = document.querySelector('.sheet .catrow');
  if (!nr) return;
  // Beim Öffnen immer bei Erholung starten (leicht → schwer), beim Wechseln die Position halten
  if (keep !== null) nr.scrollLeft = keep;
}
