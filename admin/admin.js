const SUPABASE_URL = "https://acuzccqiwzelpllblags.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

const BUSINESS_UPI_ID = "7011328912@pthdfc";
const BUSINESS_PAYEE_NAME = "Abhishek Sessions";

function buildUpiLink({ amount, title, studentName, note }) {
  const cleanAmount = Number(amount || 0).toFixed(2);
  const txnNote = `${title}${studentName ? " - " + studentName : ""}${note ? " | " + note : ""}`;
  return `upi://pay?pa=${encodeURIComponent(BUSINESS_UPI_ID)}&pn=${encodeURIComponent(BUSINESS_PAYEE_NAME)}&am=${encodeURIComponent(cleanAmount)}&cu=INR&tn=${encodeURIComponent(txnNote)}`;
}

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

const state = {
  students: [],
  packages: [],
  classes: [],
  payments: [],
  route_logs: [],
  messages: [],
  schedule_events: [],
  selectedAttendanceStudent: null,
  selectedPackageStudent: null,
  selectedPaymentStudent: null,
  selectedScheduleEvent: null,
  studentFilter: "all",
  studentSearch: "",
  calendarFilter: "all",
  calendarTab: "agenda"
};

function byId(id){ return document.getElementById(id); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function tomorrowISO(){ const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function capitalize(v){ return (v || "").charAt(0).toUpperCase() + (v || "").slice(1); }

async function apiGet(table, query = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiInsert(table, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiUpdate(table, matchField, matchValue, payload) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${matchField}=eq.${encodeURIComponent(matchValue)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function openModal(id){ byId(id).classList.remove("hidden"); }
function closeModal(id){ byId(id).classList.add("hidden"); }

document.addEventListener("click", (e) => {
  const closeId = e.target.getAttribute("data-close");
  if (closeId) closeModal(closeId);

  const navItem = e.target.closest(".nav-item");
  if (navItem) setView(navItem.dataset.view);

  const chip = e.target.closest(".chip-select");
  if (chip && byId("attendanceNote")) {
    if (chip.dataset.note) {
      const noteBox = byId("attendanceNote");
      noteBox.value = noteBox.value ? `${noteBox.value}, ${chip.dataset.note}` : chip.dataset.note;
    }
    if (chip.dataset.resNote) {
      const noteBox = byId("re_note");
      noteBox.value = noteBox.value ? `${noteBox.value}, ${chip.dataset.resNote}` : chip.dataset.resNote;
    }
  }
});

function setView(viewName){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(v => v.classList.remove("active"));
  byId(`view-${viewName}`).classList.add("active");
  document.querySelector(`.nav-item[data-view="${viewName}"]`)?.classList.add("active");
}

function packageForStudent(studentId){
  return state.packages.find(p => Number(p.student_id) === Number(studentId) && p.status === "active");
}

function classesForStudent(studentId){
  return state.classes
    .filter(c => Number(c.student_id) === Number(studentId))
    .sort((a,b) => `${b.class_date || ""}${b.class_time || ""}`.localeCompare(`${a.class_date || ""}${a.class_time || ""}`));
}

function paymentTag(status){
  if(status === "paid") return "green";
  if(status === "overdue") return "red";
  return "orange";
}

function packageAlertTag(pkg){
  if(!pkg) return { text: "No Package", cls: "red" };
  if(Number(pkg.used_classes) >= 8) return { text: "8/8 Completed", cls: "red" };
  if(Number(pkg.used_classes) >= 7) return { text: `${pkg.used_classes}/8 Renewal Due`, cls: "orange" };
  if(Number(pkg.used_classes) >= 5) return { text: `${pkg.used_classes}/8 Watch`, cls: "gold" };
  return { text: `${pkg.used_classes}/8 Active`, cls: "green" };
}

function whatsappLink(number, text){
  const clean = (number || "").replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

function formatDatePretty(dateStr){
  if(!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(time){
  if(!time) return "-";
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m || 0));
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

async function loadAllData(){
  try{
    state.students = await apiGet("students", "select=*&order=student_name.asc");
    state.packages = await apiGet("packages", "select=*&order=created_at.desc");
    state.classes = await apiGet("classes", "select=*&order=class_date.desc");
    state.payments = await apiGet("payments", "select=*&order=created_at.desc");
    state.route_logs = await apiGet("route_logs", "select=*&order=visit_date.desc");
    state.messages = await apiGet("messages", "select=*&order=created_at.desc");
    state.schedule_events = await apiGet("schedule_events", "select=*&order=event_date.asc,event_time.asc");

    renderHome();
    renderStudents();
    renderCalendar();
    renderAttendance();
    renderPayments();
    renderMore();
  }catch(err){
    alert("Data load failed. Check Supabase URL, key, or table setup.");
    console.error(err);
  }
}

function renderHome(){
  const today = todayISO();
  const tomorrow = tomorrowISO();
  const todayClasses = state.schedule_events.filter(e => e.event_type === "class" && e.event_date === today && e.status === "scheduled").length;
  const pendingRenewals = state.packages.filter(p => p.status === "active" && Number(p.used_classes) >= 7).length;
  const overduePayments = state.payments.filter(p => p.status === "overdue").length;
  const month = today.slice(0,7);
  const revenue = state.payments
    .filter(p => p.status === "paid" && (p.payment_date || "").startsWith(month))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const rescheduledToday = state.schedule_events.filter(e => e.event_date === today && e.status === "rescheduled").length;
  const cancelledToday = state.schedule_events.filter(e => e.event_date === today && e.status === "cancelled").length;
  const paymentDueToday = state.schedule_events.filter(e => e.event_type === "payment" && e.event_date === today && (e.status === "pending" || e.status === "overdue")).length;
  const paymentDueTomorrow = state.schedule_events.filter(e => e.event_type === "payment" && e.event_date === tomorrow && (e.status === "pending" || e.status === "overdue")).length;

  const todayAgenda = state.schedule_events
    .filter(e => e.event_date === today)
    .sort((a,b) => `${a.event_time || ""}`.localeCompare(`${b.event_time || ""}`))
    .slice(0, 8);

  byId("view-home").innerHTML = `
    <div class="card" style="padding:18px;">
      <h2 class="section-title">Dashboard</h2>
      <p class="section-sub">Mobile-first command center for Abhishek Sessions.</p>

      <div class="snapshot-grid">
        <div class="card snapshot-card">
          <div class="label">Today’s Classes</div>
          <div class="value">${todayClasses}</div>
        </div>
        <div class="card snapshot-card">
          <div class="label">Pending Renewals</div>
          <div class="value">${pendingRenewals}</div>
        </div>
        <div class="card snapshot-card">
          <div class="label">Revenue This Month</div>
          <div class="value">₹${revenue}</div>
        </div>
        <div class="card snapshot-card">
          <div class="label">Overdue Payments</div>
          <div class="value">${overduePayments}</div>
        </div>
      </div>

      <div class="quick-actions">
        <button class="action-btn" id="quickMarkClass">Mark Class</button>
        <button class="action-btn" id="quickAddStudent">Add Student</button>
        <button class="action-btn" id="quickAddSchedule">Add Schedule</button>
        <button class="action-btn" id="quickOpenCalendar">Open Calendar</button>
      </div>
    </div>

    <div class="stack">
      <div class="card alert-card">
        <div class="row">
          <h3 style="margin:0;">Today Snapshot</h3>
          <span class="tag gold">Live</span>
        </div>
        <div class="kpi-line"><span>Rescheduled Today</span><span>${rescheduledToday}</span></div>
        <div class="kpi-line"><span>Cancelled Today</span><span>${cancelledToday}</span></div>
        <div class="kpi-line"><span>Payment Due Today</span><span>${paymentDueToday}</span></div>
        <div class="kpi-line"><span>Payment Due Tomorrow</span><span>${paymentDueTomorrow}</span></div>
      </div>

      <div class="card alert-card">
        <div class="row">
          <h3 style="margin:0;">Today Agenda</h3>
          <span class="tag green">Schedule</span>
        </div>
        <div class="stack" style="margin-top:12px;">
          ${todayAgenda.length ? todayAgenda.map(ev => {
            const student = state.students.find(s => Number(s.id) === Number(ev.student_id));
            const isClass = ev.event_type === "class";
            const tagClass = ev.status === "scheduled" ? "gold" : ev.status === "completed" ? "green" : ev.status === "cancelled" ? "red" : "orange";
            return `
              <div class="card list-card">
                <div class="row">
                  <div>
                    <div class="event-time">${formatTime(ev.event_time)}</div>
                    <div style="font-weight:800;">${student?.student_name || ev.title || "Event"}</div>
                    <div class="meta">${ev.area || student?.area || "-"} • ${capitalize(ev.event_type)}</div>
                  </div>
                  <span class="tag ${tagClass}">${ev.status}</span>
                </div>
                <div class="mini-actions">
                  ${isClass && ev.status === "scheduled" ? `
                    <button class="small-btn gold" onclick="markScheduledDone('${ev.id}')">Done</button>
                    <button class="small-btn" onclick="openRescheduleEvent('${ev.id}')">Reschedule</button>
                    <button class="small-btn" onclick="cancelScheduleEvent('${ev.id}')">Cancel</button>
                  ` : ""}
                  ${ev.event_type === "payment" ? `
                    <button class="small-btn gold" onclick="openPaymentForStudent('${ev.student_id}')">Send Link</button>
                    <button class="small-btn" onclick="markPaymentEventPaid('${ev.id}','${ev.student_id}')">Mark Paid</button>
                  ` : ""}
                </div>
              </div>
            `;
          }).join("") : `<div class="empty-state">No schedule events today.</div>`}
        </div>
      </div>
    </div>
  `;

  byId("quickMarkClass").onclick = () => setView("attendance");
  byId("quickAddStudent").onclick = () => openModal("studentModal");
  byId("quickAddSchedule").onclick = openScheduleModal;
  byId("quickOpenCalendar").onclick = () => setView("calendar");
}

function renderStudents(){
  const q = state.studentSearch.toLowerCase();
  const students = state.students.filter(s => {
    const text = `${s.student_name} ${s.parent_name} ${s.area} ${s.instrument} ${s.status}`.toLowerCase();
    const matchSearch = !q || text.includes(q);
    const matchFilter = state.studentFilter === "all"
      || s.instrument === state.studentFilter
      || s.format === state.studentFilter
      || s.status === state.studentFilter
      || (state.studentFilter === "renewal" && (packageForStudent(s.id)?.used_classes || 0) >= 7);
    return matchSearch && matchFilter;
  });

  byId("view-students").innerHTML = `
    <div class="card" style="padding:18px;">
      <div class="row">
        <div>
          <h2 class="section-title">Students</h2>
          <p class="section-sub">Card-based active student CRM.</p>
        </div>
        <button class="primary-btn" id="studentsAddBtn" style="width:120px;">Add</button>
      </div>

      <input class="search-box" id="studentSearchBox" placeholder="Search students" value="${state.studentSearch}" />

      <div class="chip-row">
        ${[
          ["all","All"],["guitar","Guitar"],["piano","Piano"],["vocal","Vocal"],
          ["home","Home"],["online","Online"],["renewal","Renewal Due"],["active","Active"]
        ].map(([val,label]) => `
          <button class="chip ${state.studentFilter === val ? "active" : ""}" data-student-filter="${val}">${label}</button>
        `).join("")}
      </div>
    </div>

    <div class="stack">
      ${students.length ? students.map(student => {
        const pkg = packageForStudent(student.id);
        const lastClass = classesForStudent(student.id)[0];
        const tag = packageAlertTag(pkg);
        return `
          <div class="card list-card">
            <div class="row">
              <div>
                <div style="font-size:18px;font-weight:800;">${student.student_name}</div>
                <div class="meta">Parent: ${student.parent_name || "-"}<br>${student.area || "-"} • ${student.instrument || "-"}</div>
              </div>
              <span class="tag ${tag.cls}">${tag.text}</span>
            </div>
            <div class="kpi-line"><span>Status</span><span>${student.status || "-"}</span></div>
            <div class="kpi-line"><span>Last Class</span><span>${lastClass?.class_date || "-"}</span></div>
            <div class="mini-actions">
              <button class="small-btn gold" onclick="openAttendanceForStudent('${student.id}')">Mark Class</button>
              <button class="small-btn" onclick="openPackageForStudent('${student.id}')">Renew</button>
              <button class="small-btn" onclick="openPaymentForStudent('${student.id}')">Payment</button>
              <button class="small-btn" onclick="openMapForStudent('${student.id}')">Map</button>
              <button class="small-btn" onclick="prefillScheduleForStudent('${student.id}')">Schedule</button>
            </div>
          </div>
        `;
      }).join("") : `<div class="card list-card"><div class="empty-state">No students found.</div></div>`}
    </div>
  `;

  byId("studentsAddBtn").onclick = () => openModal("studentModal");
  byId("studentSearchBox").oninput = (e) => {
    state.studentSearch = e.target.value;
    renderStudents();
  };
  document.querySelectorAll("[data-student-filter]").forEach(btn => {
    btn.onclick = () => {
      state.studentFilter = btn.dataset.studentFilter;
      renderStudents();
    };
  });
}

function filteredCalendarEvents(){
  const today = todayISO();
  let events = [...state.schedule_events];

  if (state.calendarTab === "today") {
    events = events.filter(e => e.event_date === today);
  } else if (state.calendarTab === "week") {
    const d = new Date();
    const in7 = new Date();
    in7.setDate(d.getDate() + 7);
    const end = in7.toISOString().slice(0,10);
    events = events.filter(e => e.event_date >= today && e.event_date <= end);
  }

  if (state.calendarFilter === "classes") events = events.filter(e => e.event_type === "class");
  if (state.calendarFilter === "payments") events = events.filter(e => e.event_type === "payment");
  if (state.calendarFilter === "rescheduled") events = events.filter(e => e.status === "rescheduled");
  if (state.calendarFilter === "cancelled") events = events.filter(e => e.status === "cancelled");
  if (state.calendarFilter === "completed") events = events.filter(e => e.status === "completed");

  return events.sort((a,b) => `${a.event_date}${a.event_time || ""}`.localeCompare(`${b.event_date}${b.event_time || ""}`));
}

function renderCalendar(){
  const events = filteredCalendarEvents();
  let currentDate = "";

  byId("view-calendar").innerHTML = `
    <div class="card" style="padding:18px;">
      <div class="row">
        <div>
          <h2 class="section-title">Calendar</h2>
          <p class="section-sub">Classes, reschedules, cancellations, and payment due events.</p>
        </div>
        <button class="primary-btn" id="calendarAddBtn" style="width:120px;">Add</button>
      </div>

      <div class="chip-row">
        ${[
          ["agenda","Agenda"],["today","Today"],["week","Week"]
        ].map(([val,label]) => `
          <button class="chip ${state.calendarTab === val ? "active" : ""}" data-cal-tab="${val}">${label}</button>
        `).join("")}
      </div>

      <div class="chip-row">
        ${[
          ["all","All"],["classes","Classes"],["payments","Payments"],["rescheduled","Rescheduled"],["cancelled","Cancelled"],["completed","Completed"]
        ].map(([val,label]) => `
          <button class="chip ${state.calendarFilter === val ? "active" : ""}" data-cal-filter="${val}">${label}</button>
        `).join("")}
      </div>
    </div>

    <div class="stack">
      ${events.length ? events.map(ev => {
        const student = state.students.find(s => Number(s.id) === Number(ev.student_id));
        const typeTag = ev.event_type === "payment" ? "orange" : ev.status === "completed" ? "green" : ev.status === "cancelled" ? "red" : ev.status === "rescheduled" ? "orange" : "gold";
        const header = currentDate !== ev.event_date ? (currentDate = ev.event_date, `<div class="agenda-day">${formatDatePretty(ev.event_date)}</div>`) : "";
        return `
          ${header}
          <div class="card list-card">
            <div class="row">
              <div>
                <div class="event-time">${formatTime(ev.event_time)}</div>
                <div style="font-size:18px;font-weight:800;">${student?.student_name || ev.title || "Event"}</div>
                <div class="meta">${capitalize(ev.event_type)} • ${ev.area || student?.area || "-"}<br>${ev.title || "-"}${ev.note ? `<br>Note: ${ev.note}` : ""}</div>
              </div>
              <span class="tag ${typeTag}">${ev.status}</span>
            </div>
            <div class="mini-actions">
              ${ev.event_type === "class" && ev.status === "scheduled" ? `
                <button class="small-btn gold" onclick="markScheduledDone('${ev.id}')">Done</button>
                <button class="small-btn" onclick="openRescheduleEvent('${ev.id}')">Reschedule</button>
                <button class="small-btn" onclick="cancelScheduleEvent('${ev.id}')">Cancel</button>
              ` : ""}
              ${ev.event_type === "payment" && ev.status !== "paid" ? `
                <button class="small-btn gold" onclick="openPaymentForStudent('${ev.student_id}')">Send Link</button>
                <button class="small-btn" onclick="markPaymentEventPaid('${ev.id}','${ev.student_id}')">Mark Paid</button>
              ` : ""}
            </div>
          </div>
        `;
      }).join("") : `<div class="card list-card"><div class="empty-state">No calendar events found.</div></div>`}
    </div>
  `;

  byId("calendarAddBtn").onclick = openScheduleModal;
  document.querySelectorAll("[data-cal-tab]").forEach(btn => {
    btn.onclick = () => { state.calendarTab = btn.dataset.calTab; renderCalendar(); };
  });
  document.querySelectorAll("[data-cal-filter]").forEach(btn => {
    btn.onclick = () => { state.calendarFilter = btn.dataset.calFilter; renderCalendar(); };
  });
}

function renderAttendance(){
  const students = state.students.filter(s => s.status === "active");

  byId("view-attendance").innerHTML = `
    <div class="card" style="padding:18px;">
      <h2 class="section-title">Attendance</h2>
      <p class="section-sub">One tap to mark class, update count, and prepare parent trust message.</p>
    </div>

    <div class="stack">
      ${students.length ? students.map(student => {
        const pkg = packageForStudent(student.id);
        const lastClass = classesForStudent(student.id)[0];
        return `
          <div class="card list-card">
            <div class="row">
              <div>
                <div style="font-size:18px;font-weight:800;">${student.student_name}</div>
                <div class="meta">${student.area || "-"} • ${student.instrument || "-"}<br>Last Note: ${lastClass?.note || "-"}</div>
              </div>
              <span class="tag ${packageAlertTag(pkg).cls}">${pkg ? `${pkg.used_classes}/${pkg.total_classes}` : "No Package"}</span>
            </div>
            <div class="mini-actions">
              <button class="small-btn gold" onclick="openAttendanceForStudent('${student.id}')">Done</button>
              <button class="small-btn" onclick="quickAttendanceStatus('${student.id}','missed')">Missed</button>
              <button class="small-btn" onclick="quickAttendanceStatus('${student.id}','rescheduled')">Reschedule</button>
            </div>
          </div>
        `;
      }).join("") : `<div class="card list-card"><div class="empty-state">No active students.</div></div>`}
    </div>
  `;
}

function renderPayments(){
  byId("view-payments").innerHTML = `
    <div class="card" style="padding:18px;">
      <h2 class="section-title">Payments</h2>
      <p class="section-sub">Track renewals, package payments, and payment link flow.</p>
    </div>

    <div class="stack">
      ${state.payments.length ? state.payments.map(p => {
        const student = state.students.find(s => Number(s.id) === Number(p.student_id));
        return `
          <div class="card list-card">
            <div class="row">
              <div>
                <div style="font-size:18px;font-weight:800;">${student?.student_name || "Unknown"}</div>
                <div class="meta">${p.payment_title || "Payment"}<br>${p.payment_note || "-"}</div>
              </div>
              <span class="tag ${paymentTag(p.status)}">${p.status}</span>
            </div>
            <div class="kpi-line"><span>Amount</span><span>₹${p.amount || 0}</span></div>
            <div class="kpi-line"><span>Date</span><span>${p.payment_date || "-"}</span></div>
            <div class="mini-actions">
              <button class="small-btn gold" onclick="openPaymentForStudent('${p.student_id}')">New Payment</button>
              ${p.payment_link ? `<button class="small-btn" onclick="window.open('${p.payment_link}','_self')">Open UPI</button>` : ""}
            </div>
          </div>
        `;
      }).join("") : `<div class="card list-card"><div class="empty-state">No payment records yet.</div></div>`}
    </div>
  `;
}

function renderMore(){
  const totalDistance = state.route_logs.reduce((sum, r) => sum + Number(r.distance_km || 0), 0);
  const totalFuel = state.route_logs.reduce((sum, r) => sum + Number(r.fuel_cost || 0), 0);

  byId("view-more").innerHTML = `
    <div class="card" style="padding:18px;">
      <h2 class="section-title">Routes & Reports</h2>
      <p class="section-sub">Travel intelligence, route economics, and business visibility.</p>
    </div>

    <div class="snapshot-grid">
      <div class="card snapshot-card">
        <div class="label">Travel Entries</div>
        <div class="value">${state.route_logs.length}</div>
      </div>
      <div class="card snapshot-card">
        <div class="label">Distance Logged</div>
        <div class="value">${totalDistance.toFixed(1)} km</div>
      </div>
      <div class="card snapshot-card">
        <div class="label">Fuel Estimate</div>
        <div class="value">₹${totalFuel.toFixed(0)}</div>
      </div>
      <div class="card snapshot-card">
        <div class="label">Active Students</div>
        <div class="value">${state.students.filter(s => s.status === "active").length}</div>
      </div>
    </div>

    <div class="stack">
      <div class="card list-card">
        <div class="row">
          <h3 style="margin:0;">Quick Tools</h3>
          <span class="tag gold">Mobile First</span>
        </div>
        <div class="mini-actions">
          <button class="small-btn gold" onclick="window.open('https://maps.google.com','_blank')">Open Maps</button>
          <button class="small-btn" onclick="exportSummary()">Copy Summary</button>
        </div>
      </div>
    </div>
  `;
}

function resetStudentForm(){
  ["s_student_name","s_parent_name","s_phone","s_whatsapp","s_area","s_address","s_pincode","s_maps_link","s_start_date","s_fee_per_package","s_notes"]
    .forEach(id => byId(id).value = "");
  byId("s_instrument").value = "guitar";
  byId("s_format").value = "home";
}

async function saveStudent(){
  const payload = {
    student_name: byId("s_student_name").value.trim(),
    parent_name: byId("s_parent_name").value.trim(),
    phone: byId("s_phone").value.trim(),
    whatsapp: byId("s_whatsapp").value.trim(),
    instrument: byId("s_instrument").value,
    format: byId("s_format").value,
    area: byId("s_area").value.trim(),
    address: byId("s_address").value.trim(),
    pincode: byId("s_pincode").value.trim(),
    maps_link: byId("s_maps_link").value.trim(),
    start_date: byId("s_start_date").value || todayISO(),
    status: "active",
    fee_per_package: Number(byId("s_fee_per_package").value || 0),
    notes: byId("s_notes").value.trim()
  };

  if(!payload.student_name) return alert("Student name required.");

  await apiInsert("students", payload);
  closeModal("studentModal");
  resetStudentForm();
  await loadAllData();
}

window.openAttendanceForStudent = function(studentId){
  const student = state.students.find(s => Number(s.id) === Number(studentId));
  if(!student) return;
  state.selectedAttendanceStudent = student;

  const pkg = packageForStudent(student.id);
  byId("attendanceStudentMeta").innerHTML = `
    <strong>${student.student_name}</strong><br>
    ${student.area || "-"} • ${student.instrument || "-"}<br>
    Package: ${pkg ? `${pkg.used_classes}/${pkg.total_classes}` : "No active package"}
  `;
  byId("attendanceNote").value = "";
  openModal("attendanceModal");
};

window.quickAttendanceStatus = async function(studentId, status){
  const student = state.students.find(s => Number(s.id) === Number(studentId));
  const pkg = packageForStudent(student.id);

  await apiInsert("classes", {
    student_id: student.id,
    package_id: pkg?.id || null,
    class_date: todayISO(),
    class_time: null,
    status,
    note: status,
    parent_update_sent: false
  });

  await loadAllData();
  alert(`Marked ${status} for ${student.student_name}.`);
};

async function ensurePaymentEvent(studentId, packageId, amount, title, whenStatus = "pending"){
  const existing = state.schedule_events.find(
    e => Number(e.student_id) === Number(studentId) && Number(e.package_id) === Number(packageId) && e.event_type === "payment" && e.status !== "paid"
  );
  if (existing) return;

  await apiInsert("schedule_events", {
    student_id: studentId,
    package_id: packageId,
    event_type: "payment",
    title: title || "Payment Due",
    event_date: todayISO(),
    event_time: "10:00",
    duration_minutes: 15,
    status: whenStatus,
    area: "",
    note: `Amount due: ₹${amount || 0}`
  });
}

async function saveAttendance(sendMessage = false){
  const student = state.selectedAttendanceStudent;
  if(!student) return;

  const pkg = packageForStudent(student.id);
  if(!pkg) return alert("No active package found. Create/Renew package first.");

  const note = byId("attendanceNote").value.trim() || "Class completed";

  await apiInsert("classes", {
    student_id: student.id,
    package_id: pkg.id,
    class_date: todayISO(),
    class_time: null,
    status: "completed",
    note,
    parent_update_sent: sendMessage
  });

  const used = Number(pkg.used_classes || 0) + 1;
  const remaining = Math.max(Number(pkg.total_classes || 8) - used, 0);
  const pkgStatus = used >= Number(pkg.total_classes || 8) ? "completed" : "active";
  const payment_status = used >= Number(pkg.total_classes || 8) ? "pending" : pkg.payment_status;

  await apiUpdate("packages", "id", pkg.id, {
    used_classes: used,
    remaining_classes: remaining,
    status: pkgStatus,
    payment_status
  });

  const scheduledEvent = state.schedule_events.find(
    e => Number(e.student_id) === Number(student.id) && e.event_type === "class" && e.event_date === todayISO() && e.status === "scheduled"
  );
  if (scheduledEvent) {
    await apiUpdate("schedule_events", "id", scheduledEvent.id, { status: "completed", note });
  }

  if(student.format === "home"){
    await apiInsert("route_logs", {
      student_id: student.id,
      class_id: null,
      visit_date: todayISO(),
      area: student.area || "",
      route_order: 1,
      distance_km: 0,
      fuel_cost: 0,
      travel_time_minutes: 0
    });
  }

  if (used >= 7) {
    await ensurePaymentEvent(student.id, pkg.id, pkg.amount, `${pkg.package_title} Payment Due`, used >= 8 ? "overdue" : "pending");
  }

  closeModal("attendanceModal");
  await loadAllData();

  if(sendMessage){
    const message = `Hello, today’s session for ${student.student_name} has been completed successfully.\n\nCurrent package usage: ${used}/8 classes.\nFocus area: ${note}.\n\n— Abhishek Sessions`;
    window.open(whatsappLink(student.whatsapp || student.phone, message), "_blank");
  }else{
    alert(`Attendance saved for ${student.student_name}. Package usage: ${used}/8`);
  }
}

window.openPackageForStudent = function(studentId){
  const student = state.students.find(s => Number(s.id) === Number(studentId));
  if(!student) return;
  state.selectedPackageStudent = student;

  byId("p_student_name").value = student.student_name;
  byId("p_package_title").value = `${new Date().toLocaleString("default",{month:"long"})} ${capitalize(student.instrument)} Cycle`;
  byId("p_topic_focus").value = "";
  byId("p_amount").value = student.fee_per_package || "";
  byId("p_start_date").value = todayISO();
  openModal("packageModal");
};

async function savePackage(){
  const student = state.selectedPackageStudent;
  if(!student) return;

  const active = packageForStudent(student.id);
  if(active){
    await apiUpdate("packages", "id", active.id, { status: "completed" });
  }

  const rows = await apiInsert("packages", {
    student_id: student.id,
    package_title: byId("p_package_title").value.trim(),
    topic_focus: byId("p_topic_focus").value.trim(),
    total_classes: 8,
    used_classes: 0,
    remaining_classes: 8,
    amount: Number(byId("p_amount").value || 0),
    start_date: byId("p_start_date").value || todayISO(),
    status: "active",
    payment_status: "pending"
  });

  const pkg = rows?.[0];
  if (pkg) {
    await apiInsert("schedule_events", {
      student_id: student.id,
      package_id: pkg.id,
      event_type: "reminder",
      title: `${pkg.package_title} Started`,
      event_date: pkg.start_date || todayISO(),
      event_time: "09:00",
      duration_minutes: 15,
      status: "pending",
      area: student.area || "",
      note: pkg.topic_focus || ""
    });
  }

  closeModal("packageModal");
  await loadAllData();
  alert(`Package created for ${student.student_name}.`);
}

window.openPaymentForStudent = function(studentId){
  const student = state.students.find(s => Number(s.id) === Number(studentId));
  if(!student) return;
  state.selectedPaymentStudent = student;

  const active = packageForStudent(student.id);
  const title = active?.package_title || `${new Date().toLocaleString("default",{month:"long"})} Learning Cycle`;
  const note = active?.topic_focus || "";
  const amount = active?.amount || student.fee_per_package || "";

  byId("pay_student_name").value = student.student_name;
  byId("pay_title").value = title;
  byId("pay_note").value = note;
  byId("pay_amount").value = amount;
  byId("pay_status").value = "pending";
  byId("pay_method").value = "upi";
  byId("pay_date").value = todayISO();

  byId("pay_link").value = buildUpiLink({
    amount,
    title,
    studentName: student.student_name,
    note
  });

  openModal("paymentModal");
};

async function savePayment(){
  const student = state.selectedPaymentStudent;
  if(!student) return;
  const pkg = packageForStudent(student.id);

  const title = byId("pay_title").value.trim();
  const note = byId("pay_note").value.trim();
  const amount = Number(byId("pay_amount").value || 0);

  const upiLink = byId("pay_method").value === "upi"
    ? buildUpiLink({ amount, title, studentName: student.student_name, note })
    : byId("pay_link").value.trim();

  byId("pay_link").value = upiLink;

  await apiInsert("payments", {
    student_id: student.id,
    package_id: pkg?.id || null,
    amount,
    status: byId("pay_status").value,
    payment_method: byId("pay_method").value,
    payment_date: byId("pay_date").value || todayISO(),
    payment_link: upiLink,
    payment_title: title,
    payment_note: note
  });

  if(pkg && byId("pay_status").value === "paid"){
    await apiUpdate("packages", "id", pkg.id, { payment_status: "paid" });
    const paymentEvent = state.schedule_events.find(
      e => Number(e.student_id) === Number(student.id) && Number(e.package_id) === Number(pkg.id) && e.event_type === "payment" && e.status !== "paid"
    );
    if (paymentEvent) {
      await apiUpdate("schedule_events", "id", paymentEvent.id, { status: "paid", note: `Paid ₹${amount}` });
    }
  }

  closeModal("paymentModal");
  await loadAllData();
  alert(`Payment record saved for ${student.student_name}.`);
}

function openPaymentMessage(){
  const student = state.selectedPaymentStudent;
  if(!student) return;

  const title = byId("pay_title").value.trim();
  const note = byId("pay_note").value.trim();
  const amount = byId("pay_amount").value || 0;

  const upiLink = buildUpiLink({ amount, title, studentName: student.student_name, note });
  byId("pay_link").value = upiLink;

  const message = `Hello, here is the next 8-class learning cycle for ${student.student_name}.

Focus: ${note || "Structured progress"}
Package: ${title}
Amount: ₹${amount}

UPI ID: ${BUSINESS_UPI_ID}
Payee Name: ${BUSINESS_PAYEE_NAME}

Please complete the payment via any UPI app and share confirmation once done.

— Abhishek Sessions`;

  window.open(whatsappLink(student.whatsapp || student.phone, message), "_blank");
}

function openScheduleModal(){
  byId("sch_student_id").innerHTML = state.students
    .filter(s => s.status === "active")
    .map(s => `<option value="${s.id}">${s.student_name}</option>`)
    .join("");

  const firstStudent = state.students.find(s => s.status === "active");
  byId("sch_title").value = firstStudent ? `${firstStudent.student_name} Class` : "Class";
  byId("sch_date").value = todayISO();
  byId("sch_time").value = "16:00";
  byId("sch_duration").value = "60";
  byId("sch_area").value = firstStudent?.area || "";
  byId("sch_note").value = "";
  openModal("scheduleModal");
}

window.prefillScheduleForStudent = function(studentId){
  openScheduleModal();
  setTimeout(() => {
    const student = state.students.find(s => Number(s.id) === Number(studentId));
    if (!student) return;
    byId("sch_student_id").value = student.id;
    byId("sch_title").value = `${student.student_name} Class`;
    byId("sch_area").value = student.area || "";
  }, 50);
};

async function saveScheduleEvent(){
  const studentId = Number(byId("sch_student_id").value);
  const student = state.students.find(s => Number(s.id) === studentId);
  const pkg = packageForStudent(studentId);

  await apiInsert("schedule_events", {
    student_id: studentId,
    package_id: pkg?.id || null,
    event_type: "class",
    title: byId("sch_title").value.trim() || `${student?.student_name || "Student"} Class`,
    event_date: byId("sch_date").value || todayISO(),
    event_time: byId("sch_time").value || "16:00",
    duration_minutes: Number(byId("sch_duration").value || 60),
    status: "scheduled",
    area: byId("sch_area").value.trim() || student?.area || "",
    note: byId("sch_note").value.trim()
  });

  closeModal("scheduleModal");
  await loadAllData();
  alert("Class scheduled.");
}

window.openRescheduleEvent = function(eventId){
  const ev = state.schedule_events.find(e => Number(e.id) === Number(eventId));
  if(!ev) return;
  state.selectedScheduleEvent = ev;

  const student = state.students.find(s => Number(s.id) === Number(ev.student_id));
  byId("rescheduleMeta").innerHTML = `<strong>${student?.student_name || "Student"}</strong><br>${formatDatePretty(ev.event_date)} • ${formatTime(ev.event_time)}`;
  byId("re_date").value = ev.event_date || todayISO();
  byId("re_time").value = ev.event_time || "16:00";
  byId("re_note").value = "";
  openModal("rescheduleModal");
};

async function saveReschedule(){
  const ev = state.selectedScheduleEvent;
  if(!ev) return;

  await apiUpdate("schedule_events", "id", ev.id, {
    status: "rescheduled",
    note: byId("re_note").value.trim() || "Rescheduled"
  });

  await apiInsert("schedule_events", {
    student_id: ev.student_id,
    package_id: ev.package_id,
    event_type: "class",
    title: ev.title,
    event_date: byId("re_date").value || todayISO(),
    event_time: byId("re_time").value || "16:00",
    duration_minutes: ev.duration_minutes || 60,
    status: "scheduled",
    area: ev.area || "",
    note: byId("re_note").value.trim() || ""
  });

  closeModal("rescheduleModal");
  await loadAllData();
  alert("Class rescheduled.");
}

window.cancelScheduleEvent = async function(eventId){
  await apiUpdate("schedule_events", "id", eventId, {
    status: "cancelled"
  });
  await loadAllData();
  alert("Class cancelled.");
};

window.markScheduledDone = async function(eventId){
  const ev = state.schedule_events.find(e => Number(e.id) === Number(eventId));
  if(!ev) return;
  const student = state.students.find(s => Number(s.id) === Number(ev.student_id));
  if(!student) return;

  state.selectedAttendanceStudent = student;
  byId("attendanceStudentMeta").innerHTML = `
    <strong>${student.student_name}</strong><br>
    ${student.area || "-"} • ${student.instrument || "-"}<br>
    Scheduled Time: ${formatTime(ev.event_time)}
  `;
  byId("attendanceNote").value = ev.note || "";
  openModal("attendanceModal");
};

window.markPaymentEventPaid = async function(eventId, studentId){
  const student = state.students.find(s => Number(s.id) === Number(studentId));
  const pkg = packageForStudent(studentId);

  await apiUpdate("schedule_events", "id", eventId, {
    status: "paid",
    note: "Marked paid manually"
  });

  if (pkg) {
    await apiUpdate("packages", "id", pkg.id, { payment_status: "paid" });
  }

  await apiInsert("payments", {
    student_id: Number(studentId),
    package_id: pkg?.id || null,
    amount: pkg?.amount || 0,
    status: "paid",
    payment_method: "upi",
    payment_date: todayISO(),
    payment_link: "",
    payment_title: pkg?.package_title || "Package Payment",
    payment_note: "Marked paid from calendar"
  });

  await loadAllData();
  alert(`Payment marked paid for ${student?.student_name || "student"}.`);
};

window.openMapForStudent = function(studentId){
  const student = state.students.find(s => Number(s.id) === Number(studentId));
  if(!student) return;
  if(student.maps_link){
    window.open(student.maps_link, "_blank");
  }else if(student.area){
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(student.area)}`, "_blank");
  }else{
    alert("No map or area saved for this student.");
  }
};

function exportSummary(){
  const active = state.students.filter(s => s.status === "active").length;
  const pendingRenewals = state.packages.filter(p => p.status === "active" && Number(p.used_classes) >= 7).length;
  const overdue = state.payments.filter(p => p.status === "overdue").length;
  const totalDistance = state.route_logs.reduce((sum, r) => sum + Number(r.distance_km || 0), 0);
  const text = `Abhishek Sessions Admin Summary

Active students: ${active}
Pending renewals: ${pendingRenewals}
Overdue payments: ${overdue}
Distance logged: ${totalDistance.toFixed(1)} km`;
  navigator.clipboard.writeText(text);
  alert("Summary copied.");
}

byId("saveStudentBtn").onclick = saveStudent;
byId("saveAttendanceBtn").onclick = () => saveAttendance(false);
byId("saveAttendanceSendBtn").onclick = () => saveAttendance(true);
byId("savePackageBtn").onclick = savePackage;
byId("savePaymentBtn").onclick = savePayment;
byId("openPaymentMessageBtn").onclick = openPaymentMessage;
byId("saveScheduleBtn").onclick = saveScheduleEvent;
byId("saveRescheduleBtn").onclick = saveReschedule;
byId("refreshBtn").onclick = loadAllData;

loadAllData();
