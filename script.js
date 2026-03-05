// Helpers
const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => [...document.querySelectorAll(sel)];

function encodeForm(data) {
  return Object.keys(data)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k] ?? ""))
    .join("&");
}

// ----------------------
// Side menu
// ----------------------
const burger = $("burger");
const sideMenu = $("sideMenu");
const menuScrim = $("menuScrim");
const sideClose = $("sideClose");

function openMenu(){
  sideMenu.classList.add("open");
  menuScrim.classList.add("show");
  sideMenu.setAttribute("aria-hidden","false");
}
function closeMenu(){
  sideMenu.classList.remove("open");
  menuScrim.classList.remove("show");
  sideMenu.setAttribute("aria-hidden","true");
}

burger?.addEventListener("click", openMenu);
sideClose?.addEventListener("click", closeMenu);
menuScrim?.addEventListener("click", closeMenu);

qsa(".nav-link").forEach(a=>{
  a.addEventListener("click", ()=>{
    closeMenu();
  });
});

// Global back
$("backGlobal")?.addEventListener("click", ()=>{
  if (history.length > 1) history.back();
  else window.scrollTo({top:0, behavior:"smooth"});
});

// ----------------------
// Hero parallax
// ----------------------
const heroBg = $("heroBg");
window.addEventListener("scroll", ()=>{
  const y = window.scrollY || 0;
  if(heroBg){
    heroBg.style.transform = `translateY(${y * 0.18}px) scale(1.06)`;
  }
});

// Rotating hero quote
const heroQuote = $("heroQuote");
const heroQuotes = [
  { t: "Cheap training is expensive. You pay later with confidence.", by: "Abhishek Sessions Principle" },
  { t: "It is better to pay than to later unlearn and lose confidence.", by: "Abhishek Sessions Principle" },
  { t: "Parents do not buy classes. They buy trust and results.", by: "Abhishek Sessions Principle" },
  { t: "If you learn wrong now, you will spend twice later.", by: "Abhishek Sessions Principle" },
];
let heroQuoteIndex = 0;

setInterval(()=>{
  if(!heroQuote) return;
  heroQuoteIndex = (heroQuoteIndex + 1) % heroQuotes.length;
  const q = heroQuotes[heroQuoteIndex];
  heroQuote.style.opacity = "0";
  setTimeout(()=>{
    heroQuote.innerHTML = `${q.t} <span class="by">${q.by}</span>`;
    heroQuote.style.opacity = "1";
  }, 220);
}, 3400);

// ----------------------
// Lightbox (gallery)
// ----------------------
const lightbox = $("lightbox");
const lbScrim = $("lbScrim");
const lbClose = $("lbClose");
const lbImg = $("lbImg");

function openLightbox(src){
  if(!lightbox || !lbImg) return;
  lbImg.src = src;
  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden","false");
}
function closeLightbox(){
  if(!lightbox) return;
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden","true");
}
qsa(".gcard").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const src = btn.getAttribute("data-full") || btn.querySelector("img")?.getAttribute("src");
    if(src) openLightbox(src);
  });
});
lbScrim?.addEventListener("click", closeLightbox);
lbClose?.addEventListener("click", closeLightbox);
window.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") closeLightbox();
});

// ----------------------
// FAQ
// ----------------------
qsa(".faq-q").forEach(q=>{
  q.addEventListener("click", ()=>{
    q.classList.toggle("active");
  });
});

// ----------------------
// Apply modal
// ----------------------
const applyModal = $("applyModal");
const applyScrim = $("applyScrim");
const applyClose = $("applyClose");

function showApply(){
  applyModal?.classList.add("show");
  applyModal?.setAttribute("aria-hidden","false");
}
function hideApply(){
  applyModal?.classList.remove("show");
  applyModal?.setAttribute("aria-hidden","true");
}

$("openApply")?.addEventListener("click", showApply);
$("openApply2")?.addEventListener("click", showApply);
$("openApplyFromMenu")?.addEventListener("click", ()=>{ closeMenu(); showApply(); });
$("openApplyMobile")?.addEventListener("click", showApply);

applyScrim?.addEventListener("click", hideApply);
applyClose?.addEventListener("click", hideApply);

// Policies modal
const policyModal = $("policyModal");
const policyScrim = $("policyScrim");
const policyClose = $("policyClose");

function showPolicies(){
  policyModal?.classList.add("show");
  policyModal?.setAttribute("aria-hidden","false");
}
function hidePolicies(){
  policyModal?.classList.remove("show");
  policyModal?.setAttribute("aria-hidden","true");
}
$("openPolicies")?.addEventListener("click", showPolicies);
policyScrim?.addEventListener("click", hidePolicies);
policyClose?.addEventListener("click", hidePolicies);

// ----------------------
// Multi-step form logic
// ----------------------
const steps = ["step1","step2","step3","step4","step5"];
const dots  = ["dot1","dot2","dot3","dot4","dot5"];

function setStep(n){
  steps.forEach((id, idx)=>{
    const el = $(id);
    if(!el) return;
    el.classList.toggle("active", idx === (n-1));
  });
  dots.forEach((id, idx)=>{
    const d = $(id);
    if(!d) return;
    d.classList.toggle("active", idx <= (n-1));
  });
}

let state = {
  fullName:"",
  phone:"",
  location:"",
  pincode:"",
  instrument:"",
  format:"",
  pricingTier:""
};

function sanitizePhone(p){
  return (p || "").replace(/[^\d]/g, "").slice(0, 13);
}

async function submitLeadPartial(){
  const payload = {
    "form-name": "leads",
    page: "step1",
    fullName: state.fullName,
    phone: state.phone,
    location: "",
    pincode: "",
    instrument: "",
    format: "",
    pricingTier: ""
  };
  try{
    await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeForm(payload)
    });
  }catch(e){}
}

async function submitLeadFull(){
  const payload = {
    "form-name": "leads",
    page: "final",
    fullName: state.fullName,
    phone: state.phone,
    location: state.location,
    pincode: state.pincode,
    instrument: state.instrument,
    format: state.format,
    pricingTier: state.pricingTier
  };
  try{
    await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeForm(payload)
    });
  }catch(e){}
}

$("next1")?.addEventListener("click", async ()=>{
  const nm = $("fullName")?.value?.trim() || "";
  const ph = sanitizePhone($("phone")?.value || "");

  if(nm.length < 2){ $("fullName")?.focus(); return; }
  if(ph.length < 10){ $("phone")?.focus(); return; }

  state.fullName = nm;
  state.phone = ph;

  await submitLeadPartial();
  setStep(2);
});

$("back2")?.addEventListener("click", ()=> setStep(1));

qsa(".sug").forEach(b=>{
  b.addEventListener("click", ()=>{
    const v = b.getAttribute("data-val") || "";
    const pin = b.getAttribute("data-pin") || "";
    $("location").value = v;
    if(pin) $("pincode").value = pin;
  });
});

$("next2")?.addEventListener("click", ()=>{
  state.location = ($("location")?.value || "").trim();
  state.pincode = ($("pincode")?.value || "").trim();
  if(state.location.length < 2){ $("location")?.focus(); return; }
  setStep(3);
});
$("back3")?.addEventListener("click", ()=> setStep(2));

function activateTile(groupId, val){
  qsa(`#${groupId} .tile`).forEach(t=>{
    t.classList.toggle("active", t.getAttribute("data-val") === val);
  });
}

qsa("#instrumentTiles .tile").forEach(t=>{
  t.addEventListener("click", ()=>{
    state.instrument = t.getAttribute("data-val");
    activateTile("instrumentTiles", state.instrument);
  });
});

$("next3")?.addEventListener("click", ()=>{
  if(!state.instrument) return;
  setStep(4);
});
$("back4")?.addEventListener("click", ()=> setStep(3));

qsa("#formatTiles .tile").forEach(t=>{
  t.addEventListener("click", ()=>{
    state.format = t.getAttribute("data-val");
    activateTile("formatTiles", state.format);
  });
});

function computePricingTier(){
  const pin = (state.pincode || "").trim();
  const loc = (state.location || "").toLowerCase();

  if(state.format === "Online"){
    state.pricingTier = "Online (₹8,000 / 8 classes)";
    return;
  }
  if(pin === "110010" || loc.includes("cantt")){
    state.pricingTier = "Delhi Cantt (₹12,000 → ₹10,000 / 8 classes)";
    return;
  }
  if(loc.includes("dwarka")){
    state.pricingTier = "Beyond 7 km (₹15,000 / 8 classes)";
    return;
  }
  state.pricingTier = "Under 7 km (₹12,000 / 8 classes)";
}

function renderInvestment(){
  const box = $("investmentBox");
  const note = $("pricingNote");
  if(!box || !note) return;

  computePricingTier();
  const isCantt = state.pricingTier.toLowerCase().includes("delhi cantt");
  const isOnline = state.pricingTier.toLowerCase().includes("online");

  box.innerHTML = "";

  if(isOnline){
    box.innerHTML = `
      <div><b>Online 1 to 1</b></div>
      <div class="price-row"><span class="price-now">₹8,000</span><span class="price-suffix"> / 8 classes</span></div>
    `;
    note.textContent = "Online fees are fixed. Home fees depend on operational distance.";
    return;
  }

  if(isCantt){
    box.innerHTML = `
      <div><b>Home sessions (Delhi Cantt)</b></div>
      <div class="price-row">
        <span class="price-old">₹12,000</span>
        <span class="price-now">₹10,000</span>
        <span class="price-suffix"> / 8 classes</span>
      </div>
    `;
    note.textContent = "Cantt has a priority allocation offer. Confirm on WhatsApp to lock it.";
    return;
  }

  if(state.pricingTier.toLowerCase().includes("beyond 7")){
    box.innerHTML = `
      <div><b>Home sessions</b></div>
      <div class="price-row"><span class="price-now">₹15,000</span><span class="price-suffix"> / 8 classes</span></div>
    `;
    note.textContent = "This tier is for longer travel time and restricted availability.";
    return;
  }

  box.innerHTML = `
    <div><b>Home sessions</b></div>
    <div class="price-row"><span class="price-now">₹12,000</span><span class="price-suffix"> / 8 classes</span></div>
  `;
  note.textContent = "Final distance is verified on WhatsApp.";
}

$("next4")?.addEventListener("click", ()=>{
  if(!state.format) return;
  renderInvestment();
  setStep(5);
});
$("back5")?.addEventListener("click", ()=> setStep(4));

function buildWhatsAppText(){
  const lines = [
    "Hello Abhishek,",
    "",
    "I would like to request private consideration for classes.",
    "",
    `Name: ${state.fullName}`,
    `Phone: ${state.phone}`,
    `Location: ${state.location}${state.pincode ? " ("+state.pincode+")" : ""}`,
    `Instrument: ${state.instrument}`,
    `Format: ${state.format}`,
    "",
    "Please share the next steps and available options.",
    "Thank you."
  ];
  return lines.join("\n");
}

$("confirmWhatsApp")?.addEventListener("click", async ()=>{
  await submitLeadFull();
  const txt = buildWhatsAppText();
  const url = `https://wa.me/917011328912?text=${encodeURIComponent(txt)}`;
  window.open(url, "_blank", "noopener");
});

$("openVip")?.addEventListener("click", showApply);
(async function loadBlogPreview(){
  const grid = document.getElementById("blogPreviewGrid");
  if(!grid) return;

  try{
    const res = await fetch("/blog/index.json", { cache: "no-store" });
    if(!res.ok) throw new Error("index.json not found");
    const posts = await res.json();

    const top = posts.slice(0,3);
    grid.innerHTML = top.map((p, i) => `
      <article class="blog-preview-card">
        <div class="tag">New • ${p.date || "Update"}</div>
        <h3><a href="/post.html?f=${encodeURIComponent(p.file)}">${p.title}</a></h3>
        <p>${p.excerpt || "Practical tips, simple explanations and pro guidance."}</p>
        <a class="read" href="/post.html?f=${encodeURIComponent(p.file)}">Read →</a>
      </article>
    `).join("");
  }catch(e){
    grid.innerHTML = `
      <article class="blog-preview-card">
        <div class="tag">Insights</div>
        <h3><a href="/blog.html">Open blog</a></h3>
        <p>Your blog is live. Auto posts will appear here as they publish.</p>
        <a class="read" href="/blog.html">View →</a>
      </article>
    `;
  }
})();
