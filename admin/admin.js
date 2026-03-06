const SUPABASE_URL = "https://acuzccqiwzelpllblags.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_46elweHoFHMZOzYvzZRqJw_gXUyfOrc";

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
  selectedStudent: null,
  selectedAttendanceStudent: null,
  selectedPackageStudent: null,
  selectedPaymentStudent: null,
  studentFilter: "all",
  studentSearch: ""
};

function byId(id){ return document.getElementById(id); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

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
    const noteBox = byId("attendanceNote");
    noteBox.value = noteBox.value ? `${noteBox.value}, ${chip.dataset.note}` : chip.dataset.note;
  }
});

function setView(viewName){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(v => v.classList.remove("active"));
  byId(`view-${viewName}`).classList.add("active");
  document.querySelector(`.nav-item[data-view="${viewName}"]`)?.classList.add("active");
}

function packageForStudent(studentId){
  return state.packages.find(p => p.student_id === studentId && p.status === "active");
}

function classesForStudent(studentId){
  return state.classes.filter(c => c.student_id === studentId).sort((a,b) => (b.class_date || "").localeCompare(a.class_date || ""));
}

function paymentTag(status){
  if(status === "paid") return "green";
  if(status === "overdue") return "red";
  return "orange";
}

function packageAlertTag(pkg){
  if(!pkg) return { text: "No Package", cls: "red" };
  if(pkg.used_classes >= 8) return { text: "8/8 Completed", cls: "red" };
  if(pkg.used_classes >= 7) return { text: `${pkg.used_classes}/8 Renewal Due`, cls: "orange" };
  if(pkg.used_classes >= 5) return { text: `${pkg.used_classes}/8 Watch`, cls: "gold" };
  return { text: `${pkg.used_classes}/8 Active`, cls: "green" };
}

function whatsappLink(number, text){
  const clean = (number || "").replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

async function loadAllData(){
  try{
    state.students = await apiGet("students", "select=*&order=student_name.asc");
    state.packages = await apiGet("packages", "select=*&order=created_at.desc");
    state.classes = await apiGet("classes", "select=*&order=class_date.desc");
    state.payments = await apiGet("payments", "select=*&order=created_at.desc");
    state.route_logs = await apiGet("route_logs", "select=*&order=visit_date.desc");

    renderHome();
    renderStudents();
    renderAttendance();
    renderPayments();
    renderMore();
  }catch(err){
    alert("Data load failed. Check Supabase URL, anon key, or table setup.");
    console.error(err);
  }
}

function renderHome(){
  const today = todayISO();
  const todayClasses = state.classes.filter(c => c.class_date === today && c.status === "completed").length;
  const pendingRenewals = state.packages.filter(p => p.status === "active" && p.used_classes >= 7).length;
  const overduePayments = state.payments.filter(p => p.status === "overdue").length;
  const month = today.slice(0,7);
  const revenue = state.payments
    .filter(p => p.status === "paid" && (p.payment_date || "").startsWith(month))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const alertPackages = state.packages
    .filter(p => p.status === "active" && p.used_classes >= 5)
    .sort((a,b) => b.used_classes - a.used_classes)
    .slice(0, 8);

  const activeStudents = state.students
    .filter(s => s.status === "active")
    .slice(0, 8);

  byId("view-home").innerHTML = `
    <div class="card" style="padding:18px;">
      <h2 class="section-title">Dashboard</h2>
      <p class="section-sub">Click-first private command center for Abhishek Sessions.</p>

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
        <button class="action-btn" id="quickCreateRenewal">Create Renewal</button>
        <button class="action-btn" id="quickOpenRoute">Open Route</button>
      </div>
    </div>

    <div class="stack">
      <div class="card alert-card">
        <div class="row">
          <h3 style="margin:0;">Attention Needed</h3>
          <span class="tag gold">Alerts</span>
        </div>
        <div class="stack" style="margin-top:12px;">
          ${alertPackages.length ? alertPackages.map(pkg => {
            const student = state.students.find(s => s.id === pkg.student_id);
            const tag = packageAlertTag(pkg);
            return `
              <div class="card list-card">
                <div class="row">
                  <div>
                    <div style="font-weight:800;">${student?.student_name || "Unknown Student"}</div>
                    <div class="meta">${student?.area || "-"} • ${pkg.package_title || "Learning Cycle"}</div>
                  </div>
                  <span class="tag ${tag.cls}">${tag.text}</span>
                </div>
                <div class="mini-actions">
                  <button class="small-btn gold" onclick="openPackageForStudent('${pkg.student_id}')">Renew</button>
                  <button class="small-btn" onclick="openPaymentForStudent('${pkg.student_id}')">Payment</button>
                </div>
              </div>
            `;
          }).join("") : `<div class="empty-state">No urgent alerts right now.</div>`}
        </div>
      </div>

      <div class="card alert-card">
        <div class="row">
          <h3 style="margin:0;">Quick Student Actions</h3>
          <span class="tag green">Active</span>
        </div>
        <div class="stack" style="margin-top:12px;">
          ${activeStudents.map(student => {
            const pkg = packageForStudent(student.id);
            const tag = packageAlertTag(pkg);
            return `
              <div class="card list-card">
                <div class="row">
                  <div>
                    <div style="font-weight:800;">${student.student_name}</div>
                    <div class="meta">${student.area || "-"} • ${student.instrument || "-"}</div>
                  </div>
                  <span class="tag ${tag.cls}">${tag.text}</span>
                </div>
                <div class="mini-actions">
                  <button class="small-btn gold" onclick="openAttendanceForStudent('${student.id}')">Mark Class</button>
                  <button class="small-btn" onclick="openPaymentForStudent('${student.id}')">Payment</button>
                  <button class="small-btn" onclick="openMapForStudent('${student.id}')">Map</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;

  byId("quickMarkClass").onclick = () => setView("attendance");
  byId("quickAddStudent").onclick = () => openModal("studentModal");
  byId("quickCreateRenewal").onclick = () => setView("students");
  byId("quickOpenRoute").onclick = () => setView("more");
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
        const student = state.students.find(s => s.id === p.student_id);
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
              ${p.payment_link ? `<a class="small-btn" style="display:inline-flex;align-items:center;text-decoration:none;" href="${p.payment_link}" target="_blank">Link</a>` : ""}
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
  const student = state.students.find(s => s.id === Number(studentId));
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
  const student = state.students.find(s => s.id === Number(studentId));
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
  const status = used >= Number(pkg.total_classes || 8) ? "completed" : "active";
  const payment_status = used >= Number(pkg.total_classes || 8) ? "pending" : pkg.payment_status;

  await apiUpdate("packages", "id", pkg.id, {
    used_classes: used,
    remaining_classes: remaining,
    status,
    payment_status
  });

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
  const student = state.students.find(s => s.id === Number(studentId));
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

  await apiInsert("packages", {
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

  closeModal("packageModal");
  await loadAllData();
  alert(`Package created for ${student.student_name}.`);
}

window.openPaymentForStudent = function(studentId){
  const student = state.students.find(s => s.id === Number(studentId));
  if(!student) return;
  state.selectedPaymentStudent = student;

  const active = packageForStudent(student.id);
  byId("pay_student_name").value = student.student_name;
  byId("pay_title").value = active?.package_title || `${new Date().toLocaleString("default",{month:"long"})} Learning Cycle`;
  byId("pay_note").value = active?.topic_focus || "";
  byId("pay_amount").value = active?.amount || student.fee_per_package || "";
  byId("pay_status").value = "pending";
  byId("pay_method").value = "upi";
  byId("pay_link").value = "";
  byId("pay_date").value = todayISO();

  openModal("paymentModal");
};

async function savePayment(){
  const student = state.selectedPaymentStudent;
  if(!student) return;
  const pkg = packageForStudent(student.id);

  await apiInsert("payments", {
    student_id: student.id,
    package_id: pkg?.id || null,
    amount: Number(byId("pay_amount").value || 0),
    status: byId("pay_status").value,
    payment_method: byId("pay_method").value,
    payment_date: byId("pay_date").value || todayISO(),
    payment_link: byId("pay_link").value.trim(),
    payment_title: byId("pay_title").value.trim(),
    payment_note: byId("pay_note").value.trim()
  });

  if(pkg && byId("pay_status").value === "paid"){
    await apiUpdate("packages", "id", pkg.id, { payment_status: "paid" });
  }

  closeModal("paymentModal");
  await loadAllData();
  alert(`Payment record saved for ${student.student_name}.`);
}

function openPaymentMessage(){
  const student = state.selectedPaymentStudent;
  if(!student) return;

  const message = `Hello, here is the next 8-class learning cycle for ${student.student_name}.\n\nFocus: ${byId("pay_note").value.trim() || "Structured progress"}\nPackage: ${byId("pay_title").value.trim()}\nAmount: ₹${byId("pay_amount").value || 0}\n\nPlease use the payment link below to confirm the next cycle.\n${byId("pay_link").value.trim() || ""}\n\n— Abhishek Sessions`;

  window.open(whatsappLink(student.whatsapp || student.phone, message), "_blank");
}

window.openMapForStudent = function(studentId){
  const student = state.students.find(s => s.id === Number(studentId));
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
  const pendingRenewals = state.packages.filter(p => p.status === "active" && p.used_classes >= 7).length;
  const overdue = state.payments.filter(p => p.status === "overdue").length;
  const totalDistance = state.route_logs.reduce((sum, r) => sum + Number(r.distance_km || 0), 0);
  const text = `Abhishek Sessions Admin Summary\n\nActive students: ${active}\nPending renewals: ${pendingRenewals}\nOverdue payments: ${overdue}\nDistance logged: ${totalDistance.toFixed(1)} km`;
  navigator.clipboard.writeText(text);
  alert("Summary copied.");
}

function capitalize(v){ return (v || "").charAt(0).toUpperCase() + (v || "").slice(1); }

byId("saveStudentBtn").onclick = saveStudent;
byId("saveAttendanceBtn").onclick = () => saveAttendance(false);
byId("saveAttendanceSendBtn").onclick = () => saveAttendance(true);
byId("savePackageBtn").onclick = savePackage;
byId("savePaymentBtn").onclick = savePayment;
byId("openPaymentMessageBtn").onclick = openPaymentMessage;
byId("refreshBtn").onclick = loadAllData;

loadAllData();
