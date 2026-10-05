(() => {
  "use strict";

  const STORAGE_KEY = "ttdl-tasks-v1";
  const DEFAULT_CATEGORIES = ["Read", "Call", "Task", "Idea", "Other"];

  const els = {
    form: document.getElementById("add-form"),
    titleInput: document.getElementById("title-input"),
    linkInput: document.getElementById("link-input"),
    categoryInput: document.getElementById("category-input"),
    noteInput: document.getElementById("note-input"),
    categoryOptions: document.getElementById("category-options"),
    categoryFilter: document.getElementById("category-filter"),
    statusFilter: document.getElementById("status-filter"),
    sortSelect: document.getElementById("sort-select"),
    searchInput: document.getElementById("search-input"),
    taskList: document.getElementById("task-list"),
    emptyState: document.getElementById("empty-state"),
    countLabel: document.getElementById("count-label"),
    clearDoneBtn: document.getElementById("clear-done-btn"),
    template: document.getElementById("task-template"),
  };

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* storage unavailable or full; nothing more we can do */
    }
  }

  let tasks = loadTasks();

  // When hosted on claude.ai, keep tasks in the viewer's private db subtree;
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
          if (snap.empty && tasks.length) {
            for (const t of tasks) await cloudPut(t);
            return;
          }
        }
        tasks = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        saveTasks(tasks);
        render();
      },
      () => {
        cloud = null;
      }
    );
  }

  async function cloudPut(task) {
    if (!cloud) return;
    const { id, ...body } = task;
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

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function allCategories() {
    const fromTasks = tasks.map((t) => t.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromTasks]));
  }

  function refreshCategoryOptions() {
    const cats = allCategories();

    els.categoryOptions.innerHTML = cats
      .map((c) => `<option value="${escapeHtml(c)}"></option>`)
      .join("");

    const currentFilter = els.categoryFilter.value;
    els.categoryFilter.innerHTML =
      '<option value="">All categories</option>' +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (cats.includes(currentFilter)) {
      els.categoryFilter.value = currentFilter;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getFilteredTasks() {
    const status = els.statusFilter.value;
    const category = els.categoryFilter.value;
    const query = els.searchInput.value.trim().toLowerCase();
    const sort = els.sortSelect.value;

    let result = tasks.filter((t) => {
      if (status === "active" && t.done) return false;
      if (status === "done" && !t.done) return false;
      if (category && t.category !== category) return false;
      if (query) {
        const haystack = `${t.title} ${t.note} ${t.category}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    result = result.slice().sort((a, b) => {
      const diff = new Date(a.createdAt) - new Date(b.createdAt);
      return sort === "old" ? diff : -diff;
    });

    return result;
  }

  function render() {
    refreshCategoryOptions();
    const filtered = getFilteredTasks();

    els.taskList.innerHTML = "";
    filtered.forEach((task) => {
      els.taskList.appendChild(buildTaskElement(task));
    });

    els.emptyState.hidden = filtered.length !== 0;

    const total = tasks.length;
    const activeCount = tasks.filter((t) => !t.done).length;
    els.countLabel.textContent = `${activeCount} pending · ${total} total`;
  }

  function buildTaskElement(task) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.classList.toggle("done", !!task.done);

    const checkbox = node.querySelector(".done-checkbox");
    checkbox.checked = !!task.done;
    checkbox.addEventListener("change", () => toggleDone(task.id));

    node.querySelector(".task-title").textContent = task.title;
    node.querySelector(".task-category").textContent = task.category || "";
    node.querySelector(".task-note").textContent = task.note || "";

    const linkEl = node.querySelector(".task-link");
    if (task.link) {
      linkEl.href = task.link;
      linkEl.hidden = false;
    } else {
      linkEl.hidden = true;
    }

    node.querySelector(".task-date").textContent = task.done
      ? `Done: ${formatDate(task.doneAt)}`
      : `Added: ${formatDate(task.createdAt)}`;

    const editBtn = node.querySelector(".edit-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const editPanel = node.querySelector(".task-edit");
    const editTitle = node.querySelector(".edit-title");
    const editLink = node.querySelector(".edit-link");
    const editCategory = node.querySelector(".edit-category");
    const editNote = node.querySelector(".edit-note");

    node.querySelector(".task-title-row").addEventListener("click", () => editBtn.click());

    editBtn.addEventListener("click", () => {
      if (!editPanel.hidden) {
        editPanel.hidden = true;
        return;
      }
      editTitle.value = task.title;
      editLink.value = task.link || "";
      editCategory.value = task.category || "";
      editNote.value = task.note || "";
      editPanel.hidden = false;
      editTitle.focus();
    });

    node.querySelector(".cancel-edit-btn").addEventListener("click", () => {
      editPanel.hidden = true;
    });

    node.querySelector(".save-edit-btn").addEventListener("click", () => {
      const newTitle = editTitle.value.trim();
      if (!newTitle) {
        editTitle.focus();
        return;
      }
      updateTask(task.id, {
        title: newTitle,
        link: editLink.value.trim(),
        category: editCategory.value.trim(),
        note: editNote.value.trim(),
      });
    });

    deleteBtn.addEventListener("click", () =>
      confirmByDoubleTap(deleteBtn, "Delete?", () => deleteTask(task.id))
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

  function addTask({ title, link, category, note }) {
    const task = {
      id: makeId(),
      title,
      link: link || "",
      category: category || "",
      note: note || "",
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
    };
    tasks.unshift(task);
    saveTasks(tasks);
    render();
    cloudPut(task);
    return task.id;
  }

  function updateTask(id, patch) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    saveTasks(tasks);
    render();
    cloudPut(tasks.find((t) => t.id === id));
  }

  function toggleDone(id) {
    const t = tasks.find((x) => x.id === id);
    updateTask(id, { done: !t.done, doneAt: !t.done ? new Date().toISOString() : null });
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks(tasks);
    render();
    cloudDelete(id);
  }

  function clearDone() {
    const doneIds = tasks.filter((t) => t.done).map((t) => t.id);
    if (doneIds.length === 0) return;
    confirmByDoubleTap(els.clearDoneBtn, `Delete ${doneIds.length} done item(s)?`, async () => {
      tasks = tasks.filter((t) => !t.done);
      saveTasks(tasks);
      render();
      for (const id of doneIds) await cloudDelete(id);
    });
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.titleInput.value.trim();
    if (!title) return;
    els.searchInput.value = "";
    els.categoryFilter.value = "";
    if (els.statusFilter.value === "done") els.statusFilter.value = "active";
    const id = addTask({
      title,
      link: els.linkInput.value.trim(),
      category: els.categoryInput.value.trim(),
      note: els.noteInput.value.trim(),
    });
    els.form.reset();
    // Close the phone keyboard so the new item isn't hidden behind it.
    if (document.activeElement) document.activeElement.blur();
    const added = els.taskList.querySelector(`[data-id="${id}"]`);
    if (added) {
      added.classList.add("just-added");
      added.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  els.clearDoneBtn.addEventListener("click", clearDone);
  els.statusFilter.addEventListener("change", render);
  els.categoryFilter.addEventListener("change", render);
  els.sortSelect.addEventListener("change", render);
  els.searchInput.addEventListener("input", render);

  els.statusFilter.value = "active";
  render();
  connectCloud().catch((e) => console.error("Cloud sync unavailable", e));
})();
