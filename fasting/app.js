(() => {
  "use strict";

  const STORAGE_KEY = "fast-log-v1";
  const GOAL_KEY = "fast-goal-v1";
  const HOUR = 3600 * 1000;
  const PRESET_GOALS = [13, 14, 16, 18, 20, 24, 36];

  // Rough, commonly cited milestones; shown as a guide only.
  const STAGES = [
    { from: 0, text: "🍽️ Digesting — blood sugar rises, then settles" },
    { from: 4, text: "📉 Blood sugar normalizing" },
    { from: 8, text: "🔄 Switching over — glycogen stores running down" },
    { from: 12, text: "🔥 Fat burning ramps up, early ketosis" },
    { from: 18, text: "⚡ Ketosis deepening" },
    { from: 24, text: "🧹 Extended fast — autophagy is often cited from here" },
    { from: 48, text: "🧘 Long fast — stay hydrated and watch how you feel" },
  ];

  const els = {
    ring: document.getElementById("ring-progress"),
    timerLabel: document.getElementById("timer-label"),
    timerValue: document.getElementById("timer-value"),
    timerSub: document.getElementById("timer-sub"),
    stageLabel: document.getElementById("stage-label"),
    goalSelect: document.getElementById("goal-select"),
    goalCustom: document.getElementById("goal-custom"),
    activeTimes: document.getElementById("active-times"),
    startInput: document.getElementById("start-input"),
    goalAt: document.getElementById("goal-at"),
    toggleBtn: document.getElementById("toggle-btn"),
    statCount: document.getElementById("stat-count"),
    statStreak: document.getElementById("stat-streak"),
    statAvg: document.getElementById("stat-avg"),
    statLongest: document.getElementById("stat-longest"),
    statRate: document.getElementById("stat-rate"),
    weekChart: document.getElementById("week-chart"),
    fastList: document.getElementById("fast-list"),
    emptyState: document.getElementById("empty-state"),
    template: document.getElementById("fast-template"),
  };

  const RING_LENGTH = 2 * Math.PI * Number(els.ring.getAttribute("r"));
  els.ring.style.strokeDasharray = String(RING_LENGTH);
  els.ring.style.strokeDashoffset = String(RING_LENGTH);

  function loadFasts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveFasts(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable or full; nothing more we can do */
    }
  }

  function loadGoal() {
    try {
      const n = Number(localStorage.getItem(GOAL_KEY));
      return n > 0 ? n : 16;
    } catch {
      return 16;
    }
  }

  function saveGoal(hours) {
    try {
      localStorage.setItem(GOAL_KEY, String(hours));
    } catch {
      /* ignore */
    }
  }

  let fasts = loadFasts();
  let goalHours = loadGoal();

  // When hosted on claude.ai, keep fasts in the viewer's private db subtree;
  // elsewhere (GitHub Pages, local file) localStorage is the only store.
  let cloud = null;

  async function connectCloud() {
    if (!window.claude || typeof window.claude.use !== "function") return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    const uid = user ? await user.id() : null;
    if (!db || !uid) return;
    cloud = db.collection("data/users/" + uid);

    let first = true;
    cloud.onSnapshot(
      async (snap) => {
        if (first && !snap.metadata.fromCache) {
          first = false;
          if (snap.empty && fasts.length) {
            for (const f of fasts) await cloudPut(f);
            return;
          }
        }
        fasts = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        saveFasts(fasts);
        render();
      },
      () => {
        cloud = null;
      }
    );
  }

  async function cloudPut(fast) {
    if (!cloud) return;
    const { id, ...body } = fast;
    try {
      await cloud.doc(id).set(body);
    } catch (e) {
      console.error("Save failed", e);
    }
  }

  async function cloudDelete(id) {
    if (!cloud) return;
    try {
      await cloud.doc(id).delete();
    } catch (e) {
      console.error("Delete failed", e);
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // ---- Formatting helpers ----

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function formatDuration(ms) {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h ? `${h}h ${pad(m)}m` : `${m}m`;
  }

  function formatDateTime(iso) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTime(date) {
    const sameDay = date.toDateString() === new Date().toDateString();
    return date.toLocaleString("en-GB", sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }

  // <input type="datetime-local"> works in local time without a zone suffix.
  function toLocalInput(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInput(value) {
    const d = new Date(value);
    return isNaN(d) ? null : d.toISOString();
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // ---- Derived data ----

  function activeFast() {
    return fasts.find((f) => !f.endedAt) || null;
  }

  function completedFasts() {
    return fasts
      .filter((f) => f.endedAt)
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
  }

  function durationOf(f) {
    return new Date(f.endedAt || Date.now()) - new Date(f.startedAt);
  }

  function metGoal(f) {
    return durationOf(f) >= f.goalHours * HOUR;
  }

  function stageFor(hours) {
    let stage = STAGES[0];
    for (const s of STAGES) if (hours >= s.from) stage = s;
    return stage;
  }

  function computeStreak(done) {
    const metDays = new Set(done.filter(metGoal).map((f) => dayKey(new Date(f.endedAt))));
    const cursor = new Date();
    // A streak is still alive if the last goal was hit yesterday.
    if (!metDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (metDays.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ---- Rendering ----

  function syncGoalControls() {
    const isPreset = PRESET_GOALS.includes(goalHours);
    els.goalSelect.value = isPreset ? String(goalHours) : "custom";
    els.goalCustom.hidden = isPreset;
    if (!isPreset) els.goalCustom.value = String(goalHours);
  }

  function renderTimer() {
    const active = activeFast();
    let progress = 0;

    if (active) {
      const elapsed = durationOf(active);
      const goalMs = active.goalHours * HOUR;
      const reached = elapsed >= goalMs;
      progress = Math.min(1, elapsed / goalMs);

      els.timerLabel.textContent = reached ? "Goal reached 🎉" : "Fasting";
      els.timerValue.textContent = formatClock(elapsed);
      els.timerSub.textContent = reached
        ? `+${formatDuration(elapsed - goalMs)} over ${active.goalHours}h`
        : `${formatDuration(goalMs - elapsed)} left · ${Math.floor(progress * 100)}%`;
      els.ring.classList.toggle("reached", reached);

      els.stageLabel.textContent = stageFor(elapsed / HOUR).text;
      els.stageLabel.hidden = false;
    } else {
      const last = completedFasts()[0];
      els.timerLabel.textContent = last ? "Eating window" : "Ready to fast";
      els.timerValue.textContent = last ? formatClock(Date.now() - new Date(last.endedAt)) : "00:00:00";
      els.timerSub.textContent = last ? "since your last fast" : `Goal: ${goalHours}h`;
      els.ring.classList.remove("reached");
      els.stageLabel.hidden = true;
    }

    els.ring.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
    // A round line cap would still draw a dot at zero length.
    els.ring.style.visibility = progress > 0 ? "visible" : "hidden";
  }

  function renderControls() {
    const active = activeFast();
    els.activeTimes.hidden = !active;

    if (active) {
      if (document.activeElement !== els.startInput) {
        els.startInput.value = toLocalInput(active.startedAt);
      }
      els.startInput.max = toLocalInput(new Date().toISOString());
      els.goalAt.textContent = formatTime(new Date(new Date(active.startedAt).getTime() + active.goalHours * HOUR));
    }

    if (els.toggleBtn.dataset.armed !== "1") {
      els.toggleBtn.textContent = active ? "■ End fast" : "▶ Start fast";
      els.toggleBtn.classList.toggle("stop", !!active);
    }
  }

  function renderStats() {
    const done = completedFasts();
    els.statCount.textContent = String(done.length);
    els.statStreak.textContent = String(computeStreak(done));

    if (done.length) {
      const durations = done.map(durationOf);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      els.statAvg.textContent = formatDuration(avg);
      els.statLongest.textContent = formatDuration(Math.max(...durations));
      els.statRate.textContent = `${Math.round((done.filter(metGoal).length / done.length) * 100)}%`;
    } else {
      els.statAvg.textContent = "–";
      els.statLongest.textContent = "–";
      els.statRate.textContent = "–";
    }

    // Each fast counts toward the day it ended on (the active one toward today).
    const byDay = new Map();
    for (const f of fasts) {
      const key = dayKey(f.endedAt ? new Date(f.endedAt) : new Date());
      const entry = byDay.get(key) || { ms: 0, met: false };
      entry.ms += durationOf(f);
      entry.met = entry.met || (!!f.endedAt && metGoal(f));
      byDay.set(key, entry);
    }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d, ...(byDay.get(dayKey(d)) || { ms: 0, met: false }) });
    }
    const maxHours = Math.max(goalHours, ...days.map((d) => d.ms / HOUR));

    els.weekChart.innerHTML = "";
    days.forEach((d, i) => {
      const hours = d.ms / HOUR;
      const label = Math.round(hours * 10) / 10;
      const col = document.createElement("div");
      col.className = "day" + (i === 6 ? " today" : "");
      col.innerHTML =
        `<span class="day-hours">${label ? label + "h" : ""}</span>` +
        `<div class="day-bar-area"><div class="day-bar${d.met ? " met" : ""}"></div></div>` +
        `<span class="day-name">${d.date.toLocaleDateString("en-GB", { weekday: "narrow" })}</span>`;
      col.querySelector(".day-bar").style.height = `${(hours / maxHours) * 100}%`;
      col.title = `${d.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}: ${formatDuration(d.ms)}`;
      els.weekChart.appendChild(col);
    });
  }

  function renderHistory() {
    const done = completedFasts();
    els.fastList.innerHTML = "";
    done.forEach((f) => els.fastList.appendChild(buildFastElement(f)));
    els.emptyState.hidden = done.length !== 0;
  }

  function render() {
    // A running fast keeps its own goal, which may have come from another device.
    const active = activeFast();
    if (active) goalHours = active.goalHours;
    syncGoalControls();
    renderTimer();
    renderControls();
    renderStats();
    renderHistory();
  }

  function buildFastElement(fast) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = fast.id;

    const met = metGoal(fast);
    node.querySelector(".fast-duration").textContent = formatDuration(durationOf(fast));
    const badge = node.querySelector(".fast-badge");
    badge.textContent = met ? `✓ ${fast.goalHours}h goal` : `${fast.goalHours}h goal`;
    badge.classList.toggle("met", met);
    node.querySelector(".fast-meta").textContent =
      `${formatDateTime(fast.startedAt)} → ${formatDateTime(fast.endedAt)}`;

    const editBtn = node.querySelector(".edit-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const editPanel = node.querySelector(".fast-edit");
    const editStart = node.querySelector(".edit-start");
    const editEnd = node.querySelector(".edit-end");
    const editGoal = node.querySelector(".edit-goal");

    editBtn.addEventListener("click", () => {
      if (!editPanel.hidden) {
        editPanel.hidden = true;
        return;
      }
      editStart.value = toLocalInput(fast.startedAt);
      editEnd.value = toLocalInput(fast.endedAt);
      editGoal.value = String(fast.goalHours);
      editPanel.hidden = false;
    });

    node.querySelector(".cancel-edit-btn").addEventListener("click", () => {
      editPanel.hidden = true;
    });

    node.querySelector(".save-edit-btn").addEventListener("click", () => {
      const startedAt = fromLocalInput(editStart.value);
      const endedAt = fromLocalInput(editEnd.value);
      const goal = Number(editGoal.value);
      if (!startedAt) return editStart.focus();
      if (!endedAt || new Date(endedAt) <= new Date(startedAt)) return editEnd.focus();
      if (!(goal > 0)) return editGoal.focus();
      updateFast(fast.id, { startedAt, endedAt, goalHours: goal });
    });

    deleteBtn.addEventListener("click", () =>
      confirmByDoubleTap(deleteBtn, "Delete?", () => deleteFast(fast.id))
    );

    return node;
  }

  // Native confirm() is blocked in some embedded views, so ask for a second tap instead.
  function confirmByDoubleTap(btn, prompt, onConfirm) {
    if (btn.dataset.armed === "1") {
      clearTimeout(Number(btn.dataset.timer));
      btn.dataset.armed = "";
      btn.classList.remove("armed");
      btn.innerHTML = btn.dataset.original;
      onConfirm();
      return;
    }
    const original = btn.innerHTML;
    btn.dataset.original = original;
    btn.dataset.armed = "1";
    btn.classList.add("armed");
    btn.textContent = prompt;
    btn.dataset.timer = String(
      setTimeout(() => {
        btn.dataset.armed = "";
        btn.classList.remove("armed");
        btn.innerHTML = original;
      }, 3000)
    );
  }

  // ---- Mutations ----

  function startFast() {
    const fast = {
      id: makeId(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      goalHours,
    };
    fasts.unshift(fast);
    saveFasts(fasts);
    render();
    cloudPut(fast);
  }

  function updateFast(id, patch) {
    fasts = fasts.map((f) => (f.id === id ? { ...f, ...patch } : f));
    saveFasts(fasts);
    render();
    cloudPut(fasts.find((f) => f.id === id));
  }

  function endFast() {
    const active = activeFast();
    if (active) updateFast(active.id, { endedAt: new Date().toISOString() });
  }

  function deleteFast(id) {
    fasts = fasts.filter((f) => f.id !== id);
    saveFasts(fasts);
    render();
    cloudDelete(id);
  }

  function setGoal(hours) {
    if (!(hours > 0)) return;
    goalHours = hours;
    saveGoal(hours);
    const active = activeFast();
    if (active) updateFast(active.id, { goalHours: hours });
    else render();
  }

  // ---- Events ----

  els.toggleBtn.addEventListener("click", () => {
    const active = activeFast();
    if (!active) return startFast();
    if (metGoal(active)) return endFast();
    confirmByDoubleTap(els.toggleBtn, "Tap again to end early", endFast);
  });

  els.goalSelect.addEventListener("change", () => {
    if (els.goalSelect.value === "custom") {
      els.goalCustom.hidden = false;
      els.goalCustom.value = String(goalHours);
      els.goalCustom.focus();
      return;
    }
    setGoal(Number(els.goalSelect.value));
  });

  els.goalCustom.addEventListener("change", () => {
    const hours = Math.round(Number(els.goalCustom.value));
    if (hours >= 1 && hours <= 168) setGoal(hours);
  });

  els.startInput.addEventListener("change", () => {
    const active = activeFast();
    const startedAt = fromLocalInput(els.startInput.value);
    if (!active || !startedAt || new Date(startedAt) > new Date()) {
      renderControls();
      return;
    }
    updateFast(active.id, { startedAt });
  });

  render();
  setInterval(renderTimer, 1000);
  // Refresh day boundaries and goal time periodically, and when coming back to the tab.
  setInterval(() => {
    renderControls();
    renderStats();
  }, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
  connectCloud().catch((e) => console.error("Cloud sync unavailable", e));
})();
