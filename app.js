(() => {
  "use strict";

  const STORAGE_KEY = "ttdl-tasks-v1";
  const DEFAULT_CATEGORIES = ["Διάβασμα", "Τηλεφώνημα", "Εργασία", "Ιδέα", "Άλλο"];

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

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString("el-GR", {
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
      '<option value="">Όλες οι κατηγορίες</option>' +
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
    els.countLabel.textContent = `${activeCount} σε εκκρεμότητα · ${total} σύνολο`;
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
      ? `Ολοκληρώθηκε: ${formatDate(task.doneAt)}`
      : `Προστέθηκε: ${formatDate(task.createdAt)}`;

    const editBtn = node.querySelector(".edit-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const editPanel = node.querySelector(".task-edit");
    const editTitle = node.querySelector(".edit-title");
    const editLink = node.querySelector(".edit-link");
    const editCategory = node.querySelector(".edit-category");
    const editNote = node.querySelector(".edit-note");

    editBtn.addEventListener("click", () => {
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

    deleteBtn.addEventListener("click", () => {
      if (confirm(`Διαγραφή "${task.title}";`)) {
        deleteTask(task.id);
      }
    });

    return node;
  }

  function addTask({ title, link, category, note }) {
    tasks.unshift({
      id: makeId(),
      title,
      link: link || "",
      category: category || "",
      note: note || "",
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
    });
    saveTasks(tasks);
    render();
  }

  function updateTask(id, patch) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    saveTasks(tasks);
    render();
  }

  function toggleDone(id) {
    tasks = tasks.map((t) =>
      t.id === id
        ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null }
        : t
    );
    saveTasks(tasks);
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks(tasks);
    render();
  }

  function clearDone() {
    const doneCount = tasks.filter((t) => t.done).length;
    if (doneCount === 0) return;
    if (!confirm(`Διαγραφή ${doneCount} ολοκληρωμένων εγγραφών;`)) return;
    tasks = tasks.filter((t) => !t.done);
    saveTasks(tasks);
    render();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.titleInput.value.trim();
    if (!title) return;
    addTask({
      title,
      link: els.linkInput.value.trim(),
      category: els.categoryInput.value.trim(),
      note: els.noteInput.value.trim(),
    });
    els.form.reset();
    els.titleInput.focus();
  });

  els.clearDoneBtn.addEventListener("click", clearDone);
  els.statusFilter.addEventListener("change", render);
  els.categoryFilter.addEventListener("change", render);
  els.sortSelect.addEventListener("change", render);
  els.searchInput.addEventListener("input", render);

  els.statusFilter.value = "active";
  render();
})();
