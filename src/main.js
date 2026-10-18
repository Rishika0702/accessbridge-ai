import './style.css';
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};
const configured = Boolean(config.apiKey && config.projectId && config.appId);
let app, model, auth, db, user;
if (configured) {
  app = initializeApp(config);
  if (env.VITE_RECAPTCHA_SITE_KEY) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model: 'gemini-2.5-flash' });
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, async current => {
    user = current;
    if (!current) { try { await signInAnonymously(auth); } catch (error) { console.warn('Anonymous history unavailable', error.code); } }
    else loadHistory();
  });
}

const modes = {
  simplify: { title: 'Make it easier to understand', icon: '✦', prompt: 'Explain the supplied content in plain language for a general audience. Start with a two-sentence summary, then list the key points. Preserve important numbers and uncertainty. If the content is incomplete, say so.' },
  describe: { title: 'Describe an image', icon: '◉', prompt: 'Describe the image objectively for a person who cannot see it. State the main subject, important text, layout and relevant details. Do not infer identity, intent, or unshown facts.' },
  translate: { title: 'Translate and explain', icon: '↗', prompt: 'Translate the supplied content to the requested language in clear, natural wording. Preserve names, numbers and warnings. Follow with a short plain-language explanation.' },
};
let mode = 'simplify';
let selectedFile = null;
let lastResponse = '';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
$('#app').innerHTML = `
  <a class="skip" href="#workspace">Skip to workspace</a>
  <header class="site-header"><div class="brand"><span class="brand-mark" aria-hidden="true">✳</span><span>AccessBridge <strong>AI</strong></span></div><span class="header-tag">Understand anything, your way</span><a href="#how-it-works">How it works <span aria-hidden="true">↗</span></a></header>
  <main>
    <section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="eyebrow-dot"></span> MADE FOR ACCESS</p><h1>Information should<br><em>make sense</em> to everyone.</h1><p class="hero-description">Turn dense text, documents, and images into clear explanations you can read or hear — in the language that works for you.</p><a class="hero-link" href="#workspace">Try AccessBridge <span aria-hidden="true">↘</span></a></div><div class="hero-visual" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="visual-core"><span>✳</span></div><span class="visual-label label-one">Plain language</span><span class="visual-label label-two">Image context</span><span class="visual-label label-three">Hear it aloud</span></div></section>
    <section id="workspace" class="workspace" aria-labelledby="workspace-title"><div class="section-heading"><p class="eyebrow">YOUR WORKSPACE</p><h2 id="workspace-title">Make information easier to access</h2><p>Choose what you need. Add text or a small image/PDF, then get a useful answer.</p></div>
      <div class="tool-layout"><div class="input-panel"><div class="mode-list" role="group" aria-label="Choose a task">${Object.entries(modes).map(([id,item])=>`<button class="mode ${id==='simplify'?'active':''}" data-mode="${id}" type="button" aria-pressed="${id==='simplify'}"><span class="mode-icon" aria-hidden="true">${item.icon}</span>${item.title}</button>`).join('')}</div><label for="source">Paste text or ask a question</label><textarea id="source" rows="8" placeholder="Paste a letter, instructions, article, or ask a question about your file…"></textarea><div class="field-row"><div><label for="language">Output language</label><select id="language"><option>English</option><option>Hindi</option><option>Tamil</option><option>Telugu</option><option>Bengali</option><option>Spanish</option></select></div><div class="upload-wrap"><label for="file">Image or PDF (under 8 MB)</label><input id="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf"/><span id="file-name">No file selected</span></div></div><div class="action-row"><button id="generate" class="primary" type="button">Generate explanation <span aria-hidden="true">↗</span></button><span id="status" role="status" aria-live="polite"></span></div></div>
      <div class="result-panel" aria-labelledby="result-title"><div class="result-top"><div><p class="eyebrow">YOUR RESULT</p><h3 id="result-title">A clearer answer appears here</h3></div><span class="result-spark" aria-hidden="true">✳</span></div><div id="result" class="result-body">Choose a task on the left and add text or a file to begin. Your input is sent to Gemini only when you select Generate explanation.</div><div class="result-actions"><button id="speak" type="button" disabled>▶ Read aloud</button><button id="stop" type="button" disabled>■ Stop</button><button id="copy" type="button" disabled>Copy text</button></div></div></div><p class="privacy-note">AI can make mistakes. Review important details. Avoid submitting sensitive personal data. Files are processed for your request and are not stored in history.</p>
    </section>
    <section id="how-it-works" class="how"><div><p class="eyebrow">HOW IT WORKS</p><h2>Clarity in three steps.</h2></div><div class="steps"><article><span>01</span><h3>Share</h3><p>Paste difficult text or attach an image or PDF.</p></article><article><span>02</span><h3>Understand</h3><p>Gemini creates a plain-language answer in your chosen language.</p></article><article><span>03</span><h3>Listen</h3><p>Use your device’s speech engine to hear the explanation.</p></article></div></section>
    <section class="history-section"><div><p class="eyebrow">RECENT EXPLANATIONS</p><h2>Your recent work</h2></div><div id="history" class="history-list">History appears here when Firebase sign-in and Firestore are enabled.</div></section>
  </main><footer><span>✳ AccessBridge AI</span><span>Built for the AI Builder Cup · Social Impact</span><span>Made to make information accessible.</span></footer>`;

function setStatus(message, type='') { $('#status').textContent = message; $('#status').dataset.type = type; }
function setBusy(busy) { $('#generate').disabled = busy; $('#generate').textContent = busy ? 'Working…' : 'Generate explanation ↗'; }
function renderResult(text) { lastResponse = text; $('#result-title').textContent = 'Your explanation'; $('#result').textContent = text; $('#speak').disabled = !text; $('#copy').disabled = !text; $('#stop').disabled = !text; }
function filePart(file) { return new Promise((resolve,reject)=>{ const reader = new FileReader(); reader.onerror = reject; reader.onload=()=>resolve({inlineData:{data:String(reader.result).split(',')[1],mimeType:file.type}}); reader.readAsDataURL(file); }); }
async function loadHistory() { if (!user || !db) return; try { const records=await getDocs(query(collection(db,'users',user.uid,'history'),orderBy('createdAt','desc'),limit(5))); $('#history').innerHTML=records.empty?'No explanations saved yet.':records.docs.map(doc=>{const d=doc.data();return `<article><span>${escapeHtml(d.mode || 'Explain')}</span><p>${escapeHtml((d.response || '').slice(0,180))}${(d.response||'').length>180?'…':''}</p></article>`}).join(''); } catch { $('#history').textContent='History is unavailable until Firestore is enabled.'; } }
async function saveHistory(response) { if (!user || !db) return; try { await addDoc(collection(db,'users',user.uid,'history'),{ mode, response, createdAt:Date.now() }); loadHistory(); } catch(error) { console.warn('History was not saved',error.code); } }

document.querySelectorAll('.mode').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;document.querySelectorAll('.mode').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});$('#source').placeholder=mode==='describe'?'Optional: ask a specific question about your image…':mode==='translate'?'Paste content to translate or attach a file…':'Paste a letter, instructions, article, or ask a question about your file…';}));
$('#file').addEventListener('change',event=>{selectedFile=event.target.files[0]||null;$('#file-name').textContent=selectedFile?selectedFile.name:'No file selected';});
$('#generate').addEventListener('click',async()=>{const input=$('#source').value.trim();if(!input&&!selectedFile){setStatus('Add text or a file first.','error');$('#source').focus();return;}if(selectedFile&&selectedFile.size>8*1024*1024){setStatus('Choose a file under 8 MB.','error');return;}if(!configured){setStatus('Firebase setup is pending. See README for deployment.','error');return;}setBusy(true);setStatus('Gemini is preparing your answer…');try { const language=$('#language').value;const prompt=`You are AccessBridge AI, an accessibility assistant. ${modes[mode].prompt} Respond in ${language}. Be accurate, concise, respectful, and avoid medical, legal, or financial advice.\n\nUser content or question: ${input||'(See attached file)'}`; const parts=[prompt];if(selectedFile)parts.push(await filePart(selectedFile));const result=await model.generateContent(parts);const answer=result.response.text();if(!answer)throw new Error('No answer returned.');renderResult(answer);setStatus('Done.');saveHistory(answer);}catch(error){console.error(error);setStatus(error?.message||'Could not generate an answer.','error');}finally{setBusy(false);}});
$('#speak').addEventListener('click',()=>{if(!('speechSynthesis'in window))return setStatus('Speech is unavailable in this browser.','error');speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(lastResponse);utterance.lang=({English:'en-IN',Hindi:'hi-IN',Tamil:'ta-IN',Telugu:'te-IN',Bengali:'bn-IN',Spanish:'es-ES'})[$('#language').value]||'en-IN';utterance.rate=.9;speechSynthesis.speak(utterance);});
$('#stop').addEventListener('click',()=>speechSynthesis.cancel());
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lastResponse);setStatus('Copied.');}catch{setStatus('Copy is unavailable.','error');}});
if (!configured) setStatus('Firebase project setup pending.');
