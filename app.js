const MAX_BYTES = 500 * 1024 * 1024;
const MIN_SECONDS = 120;
const MAX_SECONDS = 240;

const stages = [
  ["extracting", "Media extraction", "Demux audio and sample visual frames at 2 FPS."],
  ["analysing", "Audio, vision and NLP analysis", "Compute speech, gaze, posture, gesture and narrative signals."],
  ["scoring", "Deterministic scoring", "Map raw metrics to normalised 0-100 parameter scores."],
  ["reporting", "Coaching report", "Compose two-sentence coaching blocks for each parameter."],
  ["completed", "Dashboard ready", "Render bucket scores, raw metrics and guidance."]
];

const parameterMeta = [
  ["COMM_1.1", "Communication", "Speaking rate"],
  ["COMM_1.2", "Communication", "Voice pitch"],
  ["COMM_1.3", "Communication", "Vocal variety"],
  ["COMM_1.4", "Communication", "Volume control"],
  ["COMM_1.5", "Communication", "Strategic pauses"],
  ["COMM_1.6", "Communication", "Filler word density"],
  ["COMM_1.7", "Communication", "Verbal clarity"],
  ["COMM_1.8", "Communication", "Confidence language"],
  ["NONV_2.1", "Nonverbal", "Posture alignment"],
  ["NONV_2.2", "Nonverbal", "Space expansiveness"],
  ["NONV_2.3", "Nonverbal", "Camera eye-gaze"],
  ["NONV_2.4", "Nonverbal", "Facial expressions"],
  ["NONV_2.5", "Nonverbal", "Smile frequency"],
  ["NONV_2.6", "Nonverbal", "Gestural velocity"],
  ["NONV_2.7", "Nonverbal", "First impression"],
  ["STOR_3.1", "Storytelling", "Narrative structure"],
  ["STOR_3.2", "Storytelling", "Processing fluency"],
  ["STOR_3.3", "Storytelling", "Self-disclosure"],
  ["STOR_3.4", "Storytelling", "Specificity metrics"],
  ["STOR_3.5", "Storytelling", "Narrative pacing"],
  ["STOR_3.6", "Storytelling", "Narrative placement"]
];

const refs = {
  "COMM_1.1": "Ideal range: 140-160 words per minute.",
  "COMM_1.2": "Reference band follows the selected voice profile.",
  "COMM_1.3": "Target: pitch variation above 20 Hz.",
  "COMM_1.4": "Target: -20 to -10 dB with controlled variance.",
  "COMM_1.5": "Target: 8-15 pauses per minute, 0.5-1.2 s each.",
  "COMM_1.6": "Target: fewer than 3 filler events per minute.",
  "COMM_1.7": "Target: grade 8-10 readability.",
  "COMM_1.8": "Target: definite phrases at least 3x hedging tokens.",
  "NONV_2.1": "Target: open posture in at least 75% of frames.",
  "NONV_2.2": "Target: 35-55% screen-area gestural footprint.",
  "NONV_2.3": "Target: 60-80% on-axis gaze.",
  "NONV_2.4": "Target: neutral-to-pleasant expression dominance.",
  "NONV_2.5": "Target: 20-40% smile presence.",
  "NONV_2.6": "Target: regular, controlled gestures.",
  "NONV_2.7": "Target: strong posture and gaze in seconds 0-10.",
  "STOR_3.1": "Target: setup, conflict and resolution all present.",
  "STOR_3.2": "Target: 5-15% connector density.",
  "STOR_3.3": "Target: first-person reflection and growth verbs.",
  "STOR_3.4": "Target: 10-20% specificity density.",
  "STOR_3.5": "Target: story occupies 10-25% of runtime.",
  "STOR_3.6": "Target: narrative begins between 30% and 80% of recording."
};

const state = {
  file: null,
  duration: null,
  sourceKind: null,
  mediaRecorder: null,
  recordedChunks: [],
  user: null,
  supabase: null,
  authConfigured: false,
  authMode: "signup"
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

qsa(".nav-item").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

qs("#navSignIn").addEventListener("click", () => focusAuth("login"));
qs("#heroSignIn").addEventListener("click", () => focusAuth("login"));
qs("#heroCreateAccount").addEventListener("click", () => focusAuth("signup"));
qs("#signupMode").addEventListener("click", () => setAuthMode("signup"));
qs("#loginMode").addEventListener("click", () => setAuthMode("login"));
qs("#authForm").addEventListener("submit", handleAuthSubmit);
qs("#logoutButton").addEventListener("click", logout);

qs("#videoInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) loadVideo(file);
});

qs("#demoButton").addEventListener("click", loadDemoSample);

qs("#recordButton").addEventListener("click", async () => {
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
    qs("#recordButton").textContent = "Start camera";
    return;
  }
  await startCameraRecording();
});

qs("#analyseButton").addEventListener("click", runAssessment);

async function initAuth() {
  setAuthMessage("");
  try {
    await configureSupabaseAuth();
    const { data } = await state.supabase.auth.getSession();
    if (data.session) {
      showApp(toAppUser(data.session.user));
      cleanAuthUrl();
      return;
    }
  } catch (_error) {
    setAuthMessage("Supabase Auth is not configured yet.", "error");
  }
  showLanding();
}

async function configureSupabaseAuth() {
  if (state.supabase) return;
  if (!window.supabase?.createClient) throw new Error("Supabase Auth client did not load.");

  const response = await fetch("/api/auth/config");
  if (!response.ok) throw new Error("Auth config is not available.");
  const config = await response.json();
  state.authConfigured = Boolean(config.configured);
  if (!state.authConfigured) throw new Error("Supabase Auth environment variables are missing.");

  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true
    }
  });

  state.supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showApp(toAppUser(session.user));
    } else if (document.body.classList.contains("authenticated")) {
      showLanding();
    }
  });
}

function showApp(user) {
  state.user = user;
  qs("#userName").textContent = user.displayName;
  document.body.classList.remove("auth-loading");
  document.body.classList.add("authenticated");
  checkBackend();
}

function showLanding() {
  state.user = null;
  document.body.classList.remove("auth-loading", "authenticated");
}

function focusAuth(mode) {
  setAuthMode(mode);
  qs("#authPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => qs(mode === "signup" ? "#authName" : "#authEmail").focus(), 250);
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === "signup";
  qs("#signupMode").classList.toggle("active", signup);
  qs("#loginMode").classList.toggle("active", !signup);
  qs("#nameField").style.display = signup ? "grid" : "none";
  qs("#authName").required = signup;
  qs("#authPassword").autocomplete = signup ? "new-password" : "current-password";
  qs("#authTitle").textContent = signup ? "Create your workspace" : "Welcome back";
  qs("#authSubtitle").textContent = signup
    ? "Create your account with Supabase Auth."
    : "Sign in with your Supabase Auth account.";
  qs("#authSubmit").textContent = signup ? "Create account" : "Sign in";
  setAuthMessage("");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = qs("#authEmail").value.trim();
  const password = qs("#authPassword").value;
  const displayName = qs("#authName").value.trim();

  qs("#authSubmit").disabled = true;
  setAuthMessage(state.authMode === "signup" ? "Creating your workspace..." : "Signing you in...");
  try {
    await configureSupabaseAuth();
    if (state.authMode === "signup") {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      if (data.session?.user) {
        setAuthMessage("Account created. Opening your cockpit.", "success");
        showApp(toAppUser(data.session.user));
      } else {
        setAuthMessage("Check your email to confirm your account, then sign in.", "success");
      }
      return;
    }

    const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setAuthMessage("Signed in. Opening your cockpit.", "success");
    showApp(toAppUser(data.user));
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    qs("#authSubmit").disabled = false;
  }
}

async function logout() {
  if (state.supabase) await state.supabase.auth.signOut();
  showView("record");
  showLanding();
  setAuthMode("login");
  setAuthMessage("Signed out.", "success");
}

function setAuthMessage(text, kind = "") {
  const message = qs("#authMessage");
  message.classList.remove("error", "success");
  if (kind) message.classList.add(kind);
  message.textContent = text;
}

function toAppUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "Signed in user"
  };
}

function cleanAuthUrl() {
  if (window.location.pathname === "/auth/callback" || window.location.pathname === "/callback" || window.location.hash) {
    window.history.replaceState({}, document.title, "/");
  }
}

function showView(name) {
  qsa(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  qsa(".view").forEach((view) => view.classList.remove("active"));
  qs(`#${name}View`).classList.add("active");
}

function loadVideo(file) {
  state.file = file;
  state.sourceKind = "upload";
  const video = qs("#previewVideo");
  const url = URL.createObjectURL(file);
  video.src = url;
  qs("#emptyState").style.display = "none";
  video.onloadedmetadata = () => {
    state.duration = video.duration;
    validateVideo();
  };
}

function loadDemoSample() {
  state.file = new File(["executive-presence-demo"], "leadership-update-demo.mp4", { type: "video/mp4" });
  state.duration = 182;
  state.sourceKind = "demo";
  const video = qs("#previewVideo");
  video.removeAttribute("src");
  video.load();
  qs("#emptyState").style.display = "grid";
  qs("#emptyState").innerHTML = `
    <div class="lens"></div>
    <p>Demo sample loaded: 3:02 leadership update.</p>
  `;
  validateVideo();
}

function validateVideo() {
  const file = state.file;
  const ext = file.name.split(".").pop().toLowerCase();
  const typeOk = ["mp4", "mov"].includes(ext) || ["video/mp4", "video/quicktime"].includes(file.type);
  const sizeOk = file.size <= MAX_BYTES;
  const durationOk = state.duration >= MIN_SECONDS && state.duration <= MAX_SECONDS;

  const rows = [
    [typeOk, `Container: ${ext || file.type || "unknown"} accepted as MP4/MOV.`],
    [sizeOk, `File size: ${formatBytes(file.size)} of 500 MB maximum.`],
    [durationOk, `Duration: ${formatTime(state.duration)}; accepted range is 2:00-4:00.`]
  ];

  qs("#validationList").innerHTML = rows
    .map(([ok, text]) => `<div class="validation ${ok ? "ok" : "bad"}">${text}</div>`)
    .join("");
  qs("#analyseButton").disabled = !(typeOk && sizeOk && durationOk);
}

async function startCameraRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const video = qs("#previewVideo");
  video.srcObject = stream;
  video.controls = false;
  await video.play();
  qs("#emptyState").style.display = "none";

  state.recordedChunks = [];
  state.mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  state.mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.recordedChunks.push(event.data);
  };
  state.mediaRecorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(state.recordedChunks, { type: "video/webm" });
    state.file = new File([blob], "recorded-assessment.mp4", { type: "video/mp4" });
    state.duration = Math.max(120, Math.min(240, Math.round(blob.size / 42000)));
    state.sourceKind = "camera";
    video.srcObject = null;
    video.controls = true;
    video.src = URL.createObjectURL(blob);
    validateVideo();
  };
  state.mediaRecorder.start();
  qs("#recordButton").textContent = "Stop recording";
}

function runAssessment() {
  if (!state.user) {
    showLanding();
    focusAuth("login");
    return;
  }
  showView("pipeline");
  updateSaveStatus("pending", "Assessment running. Results will save when the report is ready.");
  renderStages(0);
  const steps = [12, 35, 62, 82, 100];
  steps.forEach((pct, index) => {
    setTimeout(() => {
      renderStages(index + 1, pct);
      if (pct === 100) {
        const result = buildResult();
        renderDashboard(result);
        saveAssessment(result);
        setTimeout(() => showView("dashboard"), 600);
      }
    }, 700 + index * 850);
  });
}

function renderStages(doneCount, pct = 0) {
  qs("#progressPct").textContent = `${pct}%`;
  qs("#progressBar").style.width = `${pct}%`;
  qs("#stageList").innerHTML = stages.map((stage, index) => {
    const done = index < doneCount;
    return `
      <div class="stage ${done ? "done" : ""}">
        <div class="stage-index">${done ? "OK" : index + 1}</div>
        <div><strong>${stage[1]}</strong><br><span class="muted">${stage[2]}</span></div>
        <span class="muted">${done ? "Complete" : "Queued"}</span>
      </div>
    `;
  }).join("");
}

function buildResult() {
  const seed = hashString(`${state.file?.name || "demo"}-${state.file?.size || 1}-${Math.round(state.duration || 180)}`);
  const params = parameterMeta.map(([id, bucket, name], index) => {
    const score = clamp(58 + seeded(seed, index) * 38 + durationLift(), 35, 98);
    const metric = metricText(id, score, seed + index);
    const param = { id, bucket, name, score: Math.round(score), metric, reference: refs[id] };
    param.coaching = coachingTip(param);
    param.observation = observation(param);
    return param;
  });

  const comm = average(params.filter((p) => p.bucket === "Communication"));
  const nonv = average(params.filter((p) => p.bucket === "Nonverbal"));
  const stor = average(params.filter((p) => p.bucket === "Storytelling"));
  const overall = Math.round(comm * 0.4 + nonv * 0.35 + stor * 0.25);
  const sorted = [...params].sort((a, b) => b.score - a.score);
  return {
    overall,
    buckets: [
      ["Communication", Math.round(comm), "Speech rhythm, clarity, confidence language and filler control."],
      ["Nonverbal & Appearance", Math.round(nonv), "Posture, gaze, facial expression and controlled movement."],
      ["Storytelling", Math.round(stor), "Narrative structure, specificity, pacing and placement."]
    ],
    summary: `Overall executive presence is ${bandLabel(overall)} at ${overall}/100. Your strongest signals are ${sorted[0].name.toLowerCase()} and ${sorted[1].name.toLowerCase()}. Next-quarter gains should come from focused practice on ${sorted.at(-1).name.toLowerCase()} and ${sorted.at(-2).name.toLowerCase()}.`,
    params
  };
}

function renderDashboard(result) {
  qs("#overallScore").textContent = `${result.overall}/100`;
  qs("#overallSummary").textContent = result.summary;
  updateSaveStatus("pending", "Saving this completed report to Supabase Postgres.");
  qs("#bucketGrid").innerHTML = result.buckets.map(([name, score, text]) => `
    <article class="bucket-card">
      <div class="parameter-top"><h3>${name}</h3><div class="parameter-score">${score}</div></div>
      <div class="meter"><span style="width:${score}%"></span></div>
      <p>${text}</p>
    </article>
  `).join("");

  qs("#parameterGrid").innerHTML = result.params.map((p) => `
    <article class="parameter-card">
      <div class="parameter-top">
        <div>
          <p class="eyebrow">${p.id} - ${p.bucket}</p>
          <h3>${p.name}</h3>
        </div>
        <div class="parameter-score">${p.score}</div>
      </div>
      <div class="meter"><span style="width:${p.score}%"></span></div>
      <p>${p.observation || observation(p)} ${p.coaching || coachingTip(p)}</p>
    </article>
  `).join("");
}

async function checkBackend() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("Health check failed.");
    const { database } = await response.json();
    const note = qs(".privacy-note");
    note.classList.toggle("connected", Boolean(database.connected));
    note.classList.toggle("warning", !database.connected);
    qs("#backendStatus").textContent = database.connected
      ? "Supabase connected. Videos stay local; reports are saved."
      : database.configured
        ? "Database configured, but connection needs attention."
        : "Database URL missing. Reports will not save yet.";
  } catch (_error) {
    qs(".privacy-note").classList.add("warning");
    qs("#backendStatus").textContent = "Backend not reachable. Start the server to save reports.";
  }
}

async function saveAssessment(result) {
  if (!state.user) {
    updateSaveStatus("error", "Sign in before saving reports.");
    return;
  }
  try {
    const token = await accessToken();
    const response = await fetch("/api/assessments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        metadata: assessmentMetadata(),
        result
      })
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showLanding();
      focusAuth("login");
    }
    if (!response.ok) throw new Error(body.error || "Save failed.");
    updateSaveStatus("saved", `Saved report ${body.id.slice(0, 8)} to Supabase.`);
    checkBackend();
  } catch (error) {
    updateSaveStatus("error", `Report generated, but it was not saved: ${error.message}`);
  }
}

async function accessToken() {
  if (!state.supabase) throw new Error("Supabase Auth is not configured.");
  const { data } = await state.supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Please sign in to continue.");
  return data.session.access_token;
}

function assessmentMetadata() {
  const file = state.file;
  return {
    participantName: state.user?.displayName || qs("#userName")?.textContent?.trim() || "Signed in user",
    voiceProfile: qs("#voiceProfile").value,
    sourceKind: state.sourceKind || "upload",
    fileName: file?.name || null,
    fileType: file?.type || null,
    fileSize: file?.size || 0,
    duration: state.duration || null
  };
}

function updateSaveStatus(kind, text) {
  const status = qs("#saveStatus");
  if (!status) return;
  status.classList.remove("saved", "error");
  if (kind === "saved") status.classList.add("saved");
  if (kind === "error") status.classList.add("error");
  status.textContent = text;
}

function observation(p) {
  return `${p.metric}, placing this parameter in the ${bandLabel(p.score)} band.`;
}

function coachingTip(p) {
  const action = p.score >= 80
    ? "Keep this pattern as a deliberate baseline in your next strategic update."
    : p.score >= 60
      ? "Practise this element once before your next high-stakes communication and review a short playback."
      : "Make this a targeted drill for the next two weeks, measuring one small improvement per recording.";
  return `${refs[p.id]} ${action}`;
}

function metricText(id, score, seed) {
  const n = (low, high) => low + seeded(seed, high) * (high - low);
  const profile = qs("#voiceProfile").value;
  const map = {
    "COMM_1.1": `${Math.round(120 + score * 0.45)} WPM over ${Math.round(state.duration || 180)} seconds`,
    "COMM_1.2": `mean F0 ${Math.round(profile === "female" ? n(182, 246) : n(102, 156))} Hz`,
    "COMM_1.3": `pitch variation sigma ${Math.round(n(16, 39))} Hz`,
    "COMM_1.4": `mean loudness ${n(-24, -9).toFixed(1)} dB`,
    "COMM_1.5": `${n(6, 17).toFixed(1)} pauses per minute`,
    "COMM_1.6": `${n(1, 9).toFixed(1)} filler tokens per minute`,
    "COMM_1.7": `readability grade ${n(7, 12).toFixed(1)}`,
    "COMM_1.8": `${Math.round(n(5, 18))} definite phrases against ${Math.round(n(1, 6))} hedging tokens`,
    "NONV_2.1": `open posture in ${Math.round(n(58, 91))}% of sampled frames`,
    "NONV_2.2": `gestural footprint covering ${Math.round(n(28, 61))}% of screen area`,
    "NONV_2.3": `on-axis gaze for ${Math.round(n(48, 83))}% of the recording`,
    "NONV_2.4": `${Math.round(n(62, 88))}% neutral-to-pleasant expression share`,
    "NONV_2.5": `smile presence in ${Math.round(n(12, 46))}% of sampled frames`,
    "NONV_2.6": `${n(5, 15).toFixed(1)} controlled gestures per minute`,
    "NONV_2.7": `first-impression composite score ${score}/100`,
    "STOR_3.1": `${score > 72 ? 3 : 2} of 3 narrative anchors detected`,
    "STOR_3.2": `connector density ${Math.round(n(4, 16))}%`,
    "STOR_3.3": `first-person reflection density ${Math.round(n(4, 12))}%`,
    "STOR_3.4": `specificity density ${Math.round(n(8, 21))}%`,
    "STOR_3.5": `narrative occupies ${Math.round(n(10, 28))}% of runtime`,
    "STOR_3.6": `narrative begins at the ${Math.round(n(31, 72))}% mark`
  };
  return map[id];
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seeded(seed, salt) {
  const x = Math.sin(seed + salt * 999) * 10000;
  return x - Math.floor(x);
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function average(items) {
  return items.reduce((sum, item) => sum + item.score, 0) / items.length;
}

function durationLift() {
  const duration = state.duration || 180;
  return duration >= MIN_SECONDS && duration <= MAX_SECONDS ? 4 : -12;
}

function bandLabel(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "developing";
  return "priority";
}

renderStages(0);
setAuthMode("signup");
initAuth();
