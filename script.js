/* ==========================================================
   Sonrisa Profesional — lógica de la página
   ========================================================== */

// Configuración de la clínica: ajusta estos valores a la realidad.
const CONFIG = {
  whatsapp: "56900000000", // número sin "+" ni espacios
  // Horario por día de la semana (0 = domingo … 6 = sábado). null = cerrado.
  horario: {
    0: null,
    1: { desde: "09:00", hasta: "19:00" },
    2: { desde: "09:00", hasta: "19:00" },
    3: { desde: "09:00", hasta: "19:00" },
    4: { desde: "09:00", hasta: "19:00" },
    5: { desde: "09:00", hasta: "19:00" },
    6: { desde: "09:00", hasta: "13:00" },
  },
  duracionMin: 30,
  diasMaxAnticipacion: 60,
  almuerzo: { desde: "13:30", hasta: "14:30" },
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ---------- Utilidades de fecha ---------- */
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseISODate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatLongDate = (d) =>
  d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

// Simula horas ya tomadas de forma determinista según la fecha,
// para que la agenda se vea realista. Reemplazar por datos reales del backend.
function horasOcupadas(iso, slots) {
  let seed = [...iso].reduce((acc, c) => acc + c.charCodeAt(0) * 31, 7);
  const ocupadas = new Set();
  slots.forEach((s) => {
    seed = (seed * 9301 + 49297) % 233280;
    if (seed / 233280 < 0.3) ocupadas.add(s);
  });
  return ocupadas;
}

function generarHorarios(date) {
  const h = CONFIG.horario[date.getDay()];
  if (!h) return [];
  const slots = [];
  const almIni = toMinutes(CONFIG.almuerzo.desde);
  const almFin = toMinutes(CONFIG.almuerzo.hasta);
  for (let t = toMinutes(h.desde); t + CONFIG.duracionMin <= toMinutes(h.hasta); t += CONFIG.duracionMin) {
    if (t >= almIni && t < almFin) continue;
    slots.push(toHHMM(t));
  }
  return slots;
}

// Devuelve los horarios con su estado, descartando los que ya pasaron hoy.
function disponibilidad(date) {
  const iso = toISODate(date);
  const slots = generarHorarios(date);
  const ocupadas = horasOcupadas(iso, slots);
  const now = new Date();
  const esHoy = iso === toISODate(now);
  const minActual = now.getHours() * 60 + now.getMinutes() + 60; // al menos 1 h de margen
  return slots.map((s) => ({
    hora: s,
    libre: !ocupadas.has(s) && !(esHoy && toMinutes(s) < minActual),
  }));
}

/* ---------- Próxima hora disponible (hero) ---------- */
function proximaHora() {
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    const libre = disponibilidad(d).find((s) => s.libre);
    if (libre) return { date: new Date(d), hora: libre.hora };
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/* ---------- Formulario ---------- */
const form = $("#bookingForm");
const fechaInput = $("#fecha");
const horaInput = $("#hora");
const slotsBox = $("#slots");

function initFecha() {
  const hoy = new Date();
  const max = new Date();
  max.setDate(hoy.getDate() + CONFIG.diasMaxAnticipacion);
  fechaInput.min = toISODate(hoy);
  fechaInput.max = toISODate(max);
}

function renderSlots() {
  horaInput.value = "";
  const field = fechaInput.closest(".field");
  if (!fechaInput.value) {
    slotsBox.innerHTML = '<p class="slots__empty">Primero elige una fecha.</p>';
    return;
  }
  const date = parseISODate(fechaInput.value);
  if (fechaInput.value < fechaInput.min || fechaInput.value > fechaInput.max) {
    $("#fechaError").textContent = "Elige una fecha dentro de los próximos 60 días.";
    field.classList.add("is-invalid");
    slotsBox.innerHTML = '<p class="slots__empty">Fecha fuera de rango.</p>';
    return;
  }
  if (!CONFIG.horario[date.getDay()]) {
    $("#fechaError").textContent = "Los domingos no atendemos. Elige otro día.";
    field.classList.add("is-invalid");
    slotsBox.innerHTML = '<p class="slots__empty">Sin horarios para este día.</p>';
    return;
  }
  field.classList.remove("is-invalid");

  const slots = disponibilidad(date);
  if (!slots.some((s) => s.libre)) {
    slotsBox.innerHTML = '<p class="slots__empty">No quedan horas este día. Prueba con otra fecha.</p>';
    return;
  }
  slotsBox.innerHTML = slots
    .map(
      (s) =>
        `<button type="button" class="slot" role="radio" aria-checked="false" data-hora="${s.hora}" ${s.libre ? "" : "disabled"}>${s.hora}</button>`
    )
    .join("");
}

slotsBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".slot");
  if (!btn || btn.disabled) return;
  $$(".slot", slotsBox).forEach((b) => b.setAttribute("aria-checked", "false"));
  btn.setAttribute("aria-checked", "true");
  horaInput.value = btn.dataset.hora;
  slotsBox.closest(".field").classList.remove("is-invalid");
});

fechaInput.addEventListener("change", renderSlots);

function validar() {
  let ok = true;
  const check = (el, valido) => {
    el.closest(".field").classList.toggle("is-invalid", !valido);
    if (!valido) ok = false;
  };
  check(form.servicio, !!form.servicio.value);
  check(fechaInput, !!fechaInput.value && !fechaInput.closest(".field").classList.contains("is-invalid"));
  check(horaInput, !!horaInput.value);
  check(form.nombre, form.nombre.value.trim().length >= 3);
  check(form.telefono, form.telefono.checkValidity());
  check(form.correo, form.correo.checkValidity());
  return ok;
}

// Limpia el error de un campo cuando el usuario lo corrige.
$$("input, select, textarea", form).forEach((el) => {
  el.addEventListener("input", () => {
    if (el !== fechaInput) el.closest(".field")?.classList.remove("is-invalid");
  });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validar()) {
    $(".is-invalid", form)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const data = {
    Servicio: form.servicio.value,
    Fecha: formatLongDate(parseISODate(fechaInput.value)),
    Hora: horaInput.value,
    Nombre: form.nombre.value.trim(),
    Teléfono: form.telefono.value.trim(),
    Correo: form.correo.value.trim(),
  };
  const comentario = form.comentario.value.trim();

  // Aquí se puede enviar `data` a un backend, Google Sheets, Formspree, etc.

  $("#summary").innerHTML = Object.entries(data)
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHTML(v)}</dd>`)
    .join("");

  const msg =
    `Hola Sonrisa Profesional, quiero confirmar mi hora:\n` +
    Object.entries(data).map(([k, v]) => `• ${k}: ${v}`).join("\n") +
    (comentario ? `\n• Comentario: ${comentario}` : "");
  $("#whatsappLink").href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;

  $("#confirmModal").showModal();
});

$("#closeModal").addEventListener("click", () => $("#confirmModal").close());

// Tras abrir WhatsApp, deja el formulario listo para otra reserva.
$("#whatsappLink").addEventListener("click", () => {
  setTimeout(() => {
    $("#confirmModal").close();
    form.reset();
    renderSlots();
  }, 300);
});

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Header y menú móvil ---------- */
const header = $(".header");
const nav = $("#nav");
const toggle = $("#menuToggle");

window.addEventListener("scroll", () => header.classList.toggle("is-scrolled", window.scrollY > 8), { passive: true });

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", open);
});
$$("a", nav).forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

/* ---------- Disponibilidad en el hero ---------- */
// Precarga una fecha (y opcionalmente una hora) en el formulario.
function preseleccionar(date, hora) {
  fechaInput.value = toISODate(date);
  renderSlots();
  if (hora) $(`.slot[data-hora="${hora}"]`, slotsBox)?.click();
}

function renderSemana() {
  const dias = [];
  const d = new Date();
  while (dias.length < 6) {
    if (CONFIG.horario[d.getDay()]) {
      const libres = disponibilidad(d).filter((s) => s.libre).length;
      if (libres) dias.push({ date: new Date(d), libres });
    }
    d.setDate(d.getDate() + 1);
  }
  const dow = (x) => x.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", "");
  $("#week").innerHTML = dias
    .map(
      (x, i) =>
        `<button type="button" class="day${i === 0 ? " day--first" : ""}" data-iso="${toISODate(x.date)}" aria-label="${formatLongDate(x.date)}, ${x.libres} horas libres">
          <span class="day__dow">${dow(x.date)}</span>
          <span class="day__num">${x.date.getDate()}</span>
          <span class="day__free">${x.libres} libres</span>
        </button>`
    )
    .join("");
}

$("#week").addEventListener("click", (e) => {
  const btn = e.target.closest(".day");
  if (!btn) return;
  preseleccionar(parseISODate(btn.dataset.iso));
  $("#agendar").scrollIntoView({ behavior: "smooth" });
});

/* ---------- Inicio ---------- */
initFecha();
renderSemana();

const prox = proximaHora();
if (prox) {
  $("#nextSlotDate").textContent = formatLongDate(prox.date);
  $("#nextSlotTime").textContent = `${prox.hora} hrs`;
  $("#nextSlotBtn").addEventListener("click", () => preseleccionar(prox.date, prox.hora));
}

$("#year").textContent = new Date().getFullYear();
