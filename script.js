const BASE = "https://api.elevenlabs.io/v1";

let currentAudio = null;
let currentPlayingCard = null;

const languageCache = new Map();
const accentCache = new Map();
const voiceCache = new Map();

let selectedLanguage = null;
let selectedAccent = null;

const $ = (id) => document.getElementById(id);

// MODIFIED: Fetch from local backend proxy instead of direct API call
function fetchJSON(url) {
  // We send the desired URL to our Vercel backend function
  // encodeURIComponent ensures the URL is passed correctly
  return fetch(`/api/voices?urlString=${encodeURIComponent(url)}`)
    .then(r => r.ok ? r.json() : Promise.reject(r.statusText));
}

function getFlagEmoji(code) {
  // Return empty string for Filipino to remove the globe icon
  if (code === 'fil') return ""; 

  const regionCode = (code.split("-")[1] || code).toUpperCase();
  if (regionCode.length !== 2) return "🌐";
  return String.fromCodePoint(...[...regionCode].map(c => 127397 + c.charCodeAt(0)));
}

function langDisplayName(code) {
  try {
    const base = code.split("-")[0];
    return new Intl.DisplayNames(["en"], { type: "language" }).of(base) || code;
  } catch { return code; }
}

function regionDisplayName(code) {
  try {
    const region = code.split("-")[1];
    if (region?.length === 2) {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(region.toUpperCase()) || code;
    }
  } catch {}
  return code;
}

async function discoverLanguages() {
  if (languageCache.size > 0) return languageCache;
  
  const testLangs = ["en","ar","zh","es","fr","de","it","pt","ru","ja","ko","hi","tr","nl","pl","sv","da","fi","cs","el","hu","ro","bg","uk","id","vi","th","ta","te","bn","ur","fa","he","af","fil"];
  
  const results = await Promise.allSettled(
    testLangs.map(lang => 
      fetchJSON(`${BASE}/shared-voices?page_size=1&language=${lang}`)
        .then(data => ({ lang, hasVoices: (data.voices?.length || 0) > 0 }))
    )
  );
  
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.hasVoices) {
      const { lang } = r.value;
      languageCache.set(lang, {
        code: lang,
        name: langDisplayName(lang),
        flag: getFlagEmoji(lang)
      });
    }
  });
  
  return languageCache;
}

async function discoverAccents(langCode) {
  const cacheKey = langCode;
  if (accentCache.has(cacheKey)) return accentCache.get(cacheKey);
  
  const regions = ["US","GB","AU","CA","IN","SA","AE","EG","BH","JO","KW","IQ","DZ","MA","ES","MX","AR","BR","PT","FR","CN","DE","AT"];
  
  const results = await Promise.allSettled(
    regions.map(region => {
      const accent = `${langCode}-${region}`;
      return fetchJSON(`${BASE}/shared-voices?page_size=1&accent=${accent}`)
        .then(data => ({ accent, hasVoices: (data.voices?.length || 0) > 0 }));
    })
  );
  
  const accents = new Map();
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.hasVoices) {
      const { accent } = r.value;
      accents.set(accent, {
        code: accent,
        name: regionDisplayName(accent),
        flag: getFlagEmoji(accent)
      });
    }
  });
  
  accentCache.set(cacheKey, accents);
  return accents;
}

async function loadVoices(language, accent = null) {
  const cacheKey = `${language}-${accent || 'all'}`;
  if (voiceCache.has(cacheKey)) return voiceCache.get(cacheKey);
  
  const params = new URLSearchParams({ page_size: "100", page: "0" });
  if (language) params.set("language", language);
  if (accent) params.set("accent", accent);
  
  const data = await fetchJSON(`${BASE}/shared-voices?${params}`);
  const voices = data.voices || [];
  voiceCache.set(cacheKey, voices);
  return voices;
}

function renderLanguages(searchTerm = "") {
  const languages = Array.from(languageCache.values())
    .filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  $("languageList").innerHTML = languages.map(lang => `
    <div class="filter-item ${selectedLanguage === lang.code ? 'selected' : ''}" 
         onclick="selectLanguage('${lang.code}')">
      ${lang.flag ? `<span class="flag-emoji">${lang.flag}</span>` : ''}
      <span class="filter-name">${lang.name}</span>
    </div>
  `).join("");
}

async function selectLanguage(code) {
  if (selectedLanguage === code) return;
  
  selectedLanguage = code;
  selectedAccent = null;
  renderLanguages();
  
  const langData = languageCache.get(code);
  $("breadcrumb").innerHTML = `
    <div class="breadcrumb-item">
      ${langData.flag ? `<span>${langData.flag}</span>` : ''}
      <span>${langData.name}</span>
    </div>
  `;
  $("contentTitle").textContent = langData.name + " Voices";
  $("contentSubtitle").textContent = "Loading accents and voices...";
  
  $("voiceGrid").innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div>Loading voices...</div>
    </div>
  `;
  
  const [accents, voices] = await Promise.all([
    discoverAccents(code),
    loadVoices(code)
  ]);
  
  if (accents.size > 0) {
    renderAccents(accents);
    $("accentSection").style.display = "block";
  } else {
    $("accentSection").style.display = "none";
  }
  
  renderVoices(voices);
  $("contentSubtitle").textContent = `${voices.length} voices available`;
}

function renderAccents(accents) {
  const sorted = Array.from(accents.values()).sort((a, b) => a.name.localeCompare(b.name));
  
  $("accentList").innerHTML = sorted.map(acc => `
    <div class="filter-item ${selectedAccent === acc.code ? 'selected' : ''}" 
         onclick="selectAccent('${acc.code}')">
      ${acc.flag ? `<span class="flag-emoji">${acc.flag}</span>` : ''}
      <span class="filter-name">${acc.name}</span>
    </div>
  `).join("");
}

async function selectAccent(code) {
  if (selectedAccent === code) {
    selectedAccent = null;
  } else {
    selectedAccent = code;
  }
  
  const accents = accentCache.get(selectedLanguage);
  renderAccents(accents);
  
  const langData = languageCache.get(selectedLanguage);
  if (selectedAccent) {
    const accentData = accents.get(selectedAccent);
    $("breadcrumb").innerHTML = `
      <div class="breadcrumb-item">
        ${langData.flag ? `<span>${langData.flag}</span>` : ''}
        <span>${langData.name}</span>
      </div>
      <span>›</span>
      <div class="breadcrumb-item">
        ${accentData.flag ? `<span>${accentData.flag}</span>` : ''}
        <span>${accentData.name}</span>
      </div>
    `;
    $("contentTitle").textContent = `${langData.name} (${accentData.name})`;
  } else {
    $("breadcrumb").innerHTML = `
      <div class="breadcrumb-item">
        ${langData.flag ? `<span>${langData.flag}</span>` : ''}
        <span>${langData.name}</span>
      </div>
    `;
    $("contentTitle").textContent = langData.name + " Voices";
  }
  
  $("voiceGrid").innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div>Loading voices...</div>
    </div>
  `;
  
  const voices = await loadVoices(selectedLanguage, selectedAccent);
  renderVoices(voices);
  $("contentSubtitle").textContent = `${voices.length} voices available`;
}

function renderVoices(voices) {
  if (!voices.length) {
    $("voiceGrid").innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎤</div>
        <h3>No voices found</h3>
        <p>Try selecting a different filter</p>
      </div>
    `;
    return;
  }
  
  $("voiceGrid").innerHTML = voices.map((v, i) => {
    const id = v.voice_id || v.id;
    const name = v.name || "Unnamed";
    const category = v.category || "";
    const labels = v.labels || {};
    const preview = v.preview_url || "";
    
    const initial = name.charAt(0).toUpperCase();
    const tags = [
      category,
      labels.gender,
      labels.age,
      labels.accent
    ].filter(Boolean);
    
    return `
      <div class="voice-card" id="card-${id}">
        <div class="voice-header">
          <div>
            <div class="voice-name">${name}</div>
            <div class="voice-id">ID: ${id}</div>
          </div>
          <div class="voice-avatar">${initial}</div>
        </div>
        
        <div class="voice-tags">
          ${tags.map(tag => `<span class="voice-tag">${tag}</span>`).join('')}
        </div>
        
        <button class="play-button" id="btn-${id}" onclick="playVoice('${id}', '${preview}')" ${!preview ? 'disabled' : ''}>
          <span class="play-icon" id="icon-${id}">▶</span>
          <span id="text-${id}">${preview ? 'Play Preview' : 'No Preview'}</span>
        </button>
        
        <audio id="audio-${id}" src="${preview}"></audio>
      </div>
    `;
  }).join("");
}

function playVoice(id, url) {
  if (!url) return;
  
  const audio = $(`audio-${id}`);
  const btn = $(`btn-${id}`);
  const icon = $(`icon-${id}`);
  const text = $(`text-${id}`);
  const card = $(`card-${id}`);
  
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentPlayingCard) {
      currentPlayingCard.classList.remove('playing');
      const oldBtn = currentPlayingCard.querySelector('.play-button');
      oldBtn.classList.remove('playing');
      currentPlayingCard.querySelector('.play-icon').textContent = '▶';
      currentPlayingCard.querySelector('.play-button span:last-child').textContent = 'Play Preview';
    }
  }
  
  if (audio.paused) {
    audio.play();
    btn.classList.add('playing');
    card.classList.add('playing');
    icon.textContent = '⏸';
    text.textContent = 'Playing...';
    currentAudio = audio;
    currentPlayingCard = card;
  } else {
    audio.pause();
    audio.currentTime = 0;
    btn.classList.remove('playing');
    card.classList.remove('playing');
    icon.textContent = '▶';
    text.textContent = 'Play Preview';
    currentAudio = null;
    currentPlayingCard = null;
  }
  
  audio.onended = () => {
    btn.classList.remove('playing');
    card.classList.remove('playing');
    icon.textContent = '▶';
    text.textContent = 'Play Preview';
    currentAudio = null;
    currentPlayingCard = null;
  };
}

async function init() {
  try {
    await discoverLanguages();
    $("loadingMessage").style.display = "none";
    $("mainContent").style.display = "grid";
    renderLanguages();
  } catch (e) {
    alert("Error loading voices. Please check the API key.");
    console.error(e);
  }
}

let timer;
$("searchBox").oninput = (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => renderLanguages(e.target.value), 300);
};

window.onload = init;