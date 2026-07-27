/* ============================================================
   หน้าจัดการเกม (admin) — เพิ่ม/แก้/ลบเกม แล้ว commit ไฟล์ games.js
   กลับเข้า GitHub repo ผ่าน GitHub REST API
   Token เก็บใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น
   ============================================================ */

(function () {
  "use strict";

  // token เก็บใน sessionStorage เท่านั้น (หายเมื่อปิดแท็บ) — ไม่ค้างถาวรบน public origin
  const SS_TOKEN = "gamehub_gh_token";
  const LS_CFG = "gamehub_gh_cfg"; // owner/repo/branch/path (ไม่ใช่ความลับ) เก็บใน localStorage ได้
  const ANNOUNCE_PATH = "announcement.js";

  const GRADE_PRESET = [
    "อนุบาล 1", "อนุบาล 2", "อนุบาล 3",
    "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
    "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  ];
  const GRADE_ORDER = GRADE_PRESET.slice();

  // รายการเกมที่กำลังแก้ (เริ่มจากข้อมูลที่ bundle มากับหน้า = games.js ปัจจุบัน)
  let games = deepCopy(Array.isArray(window.GAMES) ? window.GAMES : []);

  // สถานะสำหรับกันเขียนทับ + เตือนงานที่ยังไม่บันทึก
  let gamesBaseSha = null;   // sha ของ games.js ตอนโหลดล่าสุด (null = ยังไม่เคยโหลดจาก GitHub)
  let annBaseSha = null;     // sha ของ announcement.js ตอนโหลดล่าสุด
  let dirty = false;         // มีการแก้รายการเกมที่ยังไม่ commit หรือไม่

  // ---------- DOM ----------
  const $ = function (id) { return document.getElementById(id); };
  const el = {
    owner: $("cfgOwner"), repo: $("cfgRepo"), branch: $("cfgBranch"), path: $("cfgPath"),
    token: $("cfgToken"), remember: $("cfgRemember"),
    btnTest: $("btnTest"), btnForget: $("btnForget"), connStatus: $("connStatus"),
    form: $("gameForm"), formHeading: $("formHeading"), editIndex: $("editIndex"),
    fTitle: $("fTitle"), fDesc: $("fDesc"), fSubject: $("fSubject"), fUrl: $("fUrl"),
    fEmoji: $("fEmoji"), fColor: $("fColor"), fGradeCustom: $("fGradeCustom"),
    fTopic: $("fTopic"), fMinutes: $("fMinutes"), fMode: $("fMode"),
    fBadge: $("fBadge"), fCover: $("fCover"), errCover: $("errCover"),
    fTags: $("fTags"), tagList: $("tagList"),
    subjectList: $("subjectList"), gradePicker: $("gradePicker"),
    btnSaveGame: $("btnSaveGame"), btnResetForm: $("btnResetForm"),
    list: $("gameList"), listCount: $("listCount"), listNote: $("listNote"),
    btnCommit: $("btnCommit"), btnReload: $("btnReload"), commitStatus: $("commitStatus"),
    btnExport: $("btnExport"), btnImport: $("btnImport"), importBox: $("importBox"),
    annEnabled: $("annEnabled"), annTitle: $("annTitle"), annMessage: $("annMessage"),
    annImportant: $("annImportant"),
    btnSaveAnnounce: $("btnSaveAnnounce"), btnReloadAnnounce: $("btnReloadAnnounce"),
    annStatus: $("annStatus"),
    publishBar: $("publishBar"), btnCommitSticky: $("btnCommitSticky"), dirtyBadge: $("dirtyBadge"),
    btnToggleToken: $("btnToggleToken"), tokenStored: $("tokenStored"),
    formErrors: $("formErrors"), errTitle: $("errTitle"), errSubject: $("errSubject"),
    errUrl: $("errUrl"), errGrades: $("errGrades"),
    listSearch: $("listSearch"), listSubjectFilter: $("listSubjectFilter"), listEmpty: $("listEmpty"),
    snackbar: $("snackbar"), snackbarText: $("snackbarText"), snackbarAction: $("snackbarAction"),
    changeSummary: $("changeSummary"),
  };

  // สถานะตัวกรองรายการ + ตัวนับการเปลี่ยนแปลง (สำหรับสรุปก่อนเผยแพร่)
  const listState = { search: "", subject: "" };
  const changes = { added: 0, edited: 0, deleted: 0, reordered: false };
  function resetChanges() { changes.added = 0; changes.edited = 0; changes.deleted = 0; changes.reordered = false; updateChangeSummary(); }
  function updateChangeSummary() {
    if (!el.changeSummary) return;
    const parts = [];
    if (changes.added) parts.push("เพิ่ม " + changes.added);
    if (changes.edited) parts.push("แก้ " + changes.edited);
    if (changes.deleted) parts.push("ลบ " + changes.deleted);
    if (changes.reordered) parts.push("จัดลำดับใหม่");
    el.changeSummary.textContent = parts.length ? "(" + parts.join(" · ") + ")" : "";
  }

  // ---------- Utils ----------
  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

  // สร้าง id (slug) คงที่ ไม่ซ้ำ และไม่เป็นเลขล้วน (กันชนกับลิงก์เลขเดิม)
  function makeId(title, existing) {
    let b = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!b || /^[0-9]+$/.test(b)) b = "game";
    let id = b, n = 2;
    while (existing.indexOf(id) !== -1) { id = b + "-" + n++; }
    return id;
  }

  // ให้ทุกเกมมี id (เกมเก่าที่ยังไม่มี/นำเข้ามาไม่มี ก็สร้างให้ ไม่ซ้ำ)
  function ensureIds(list) {
    const used = [];
    list.forEach(function (g) { if (g.id) used.push(g.id); });
    list.forEach(function (g) {
      if (!g.id) { g.id = makeId(g.title, used); used.push(g.id); }
    });
  }

  function isHttpsUrl(u) {
    try { return new URL(String(u)).protocol === "https:"; } catch (e) { return false; }
  }

  // ตรวจ JSON import ทีละ record → คืน { errors:[ข้อความ], clean:[record ที่ปกติแล้ว] }
  function validateImportRecords(data) {
    const errors = [];
    const clean = [];
    const usedIds = [];
    data.forEach(function (raw, idx) {
      const n = idx + 1;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push("เกมที่ " + n + ": ต้องเป็นอ็อบเจกต์"); return;
      }
      const g = {};
      // title
      if (typeof raw.title !== "string" || !raw.title.trim()) { errors.push("เกมที่ " + n + ": ไม่มีชื่อเกม"); }
      else if (raw.title.length > 120) { errors.push("เกมที่ " + n + ": ชื่อเกมยาวเกิน 120 ตัวอักษร"); }
      g.title = String(raw.title || "").trim();
      // subject
      if (typeof raw.subject !== "string" || !raw.subject.trim()) { errors.push("เกมที่ " + n + " (" + g.title + "): ไม่มีวิชา"); }
      else if (raw.subject.length > 60) { errors.push("เกมที่ " + n + ": ชื่อวิชายาวเกินไป"); }
      g.subject = String(raw.subject || "").trim();
      // description
      if (raw.description != null && typeof raw.description !== "string") { errors.push("เกมที่ " + n + ": คำอธิบายต้องเป็นข้อความ"); }
      g.description = String(raw.description || "").slice(0, 240);
      // grades
      if (!Array.isArray(raw.grades) || raw.grades.length === 0 ||
          !raw.grades.every(function (x) { return typeof x === "string" && x.trim(); })) {
        errors.push("เกมที่ " + n + " (" + g.title + "): grades ต้องเป็น array ของข้อความอย่างน้อย 1 ชั้น");
        g.grades = Array.isArray(raw.grades) ? raw.grades.filter(function (x) { return typeof x === "string" && x.trim(); }) : [];
      } else { g.grades = raw.grades.map(function (x) { return x.trim(); }); }
      // url — ต้องเป็น https
      if (typeof raw.url !== "string" || !isHttpsUrl(raw.url)) { errors.push("เกมที่ " + n + " (" + g.title + "): url ต้องเป็น https://"); }
      g.url = String(raw.url || "").trim();
      // id
      if (raw.id != null) {
        if (typeof raw.id !== "string" || !/^[a-z0-9-]+$/.test(raw.id) || /^[0-9]+$/.test(raw.id)) {
          errors.push("เกมที่ " + n + ": id ต้องเป็น a-z 0-9 ขีดกลาง และไม่เป็นเลขล้วน");
        } else if (usedIds.indexOf(raw.id) !== -1) {
          errors.push("เกมที่ " + n + ": id ซ้ำ (" + raw.id + ")");
        } else { g.id = raw.id; usedIds.push(raw.id); }
      }
      // emoji / color (ไม่บังคับ)
      if (raw.emoji != null) {
        if (typeof raw.emoji !== "string" || raw.emoji.length > 8) errors.push("เกมที่ " + n + ": emoji ไม่ถูกต้อง");
        else if (raw.emoji.trim()) g.emoji = raw.emoji.trim();
      }
      if (raw.color != null) {
        if (typeof raw.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(raw.color)) errors.push("เกมที่ " + n + ": color ต้องเป็น #RRGGBB");
        else g.color = raw.color;
      }
      // ฟิลด์เพิ่มเติม (ไม่บังคับ)
      if (raw.topic != null) { if (typeof raw.topic === "string") g.topic = raw.topic.trim(); }
      if (raw.mode != null) { if (typeof raw.mode === "string") g.mode = raw.mode.trim(); }
      if (raw.minutes != null && raw.minutes !== "") {
        const m = Number(raw.minutes);
        if (!isFinite(m) || m <= 0) errors.push("เกมที่ " + n + ": minutes ต้องเป็นตัวเลขบวก");
        else g.minutes = m;
      }
      if (raw.badge != null && raw.badge !== "") {
        if (["แนะนำ", "ใหม่"].indexOf(raw.badge) === -1) errors.push("เกมที่ " + n + ": badge ต้องเป็น แนะนำ หรือ ใหม่");
        else g.badge = raw.badge;
      }
      if (raw.cover != null && raw.cover !== "") {
        if (typeof raw.cover !== "string" || !isHttpsUrl(raw.cover)) errors.push("เกมที่ " + n + ": cover ต้องเป็นลิงก์ https://");
        else g.cover = raw.cover;
      }
      if (Array.isArray(raw.tags)) {
        g.tags = raw.tags.filter(function (x) { return typeof x === "string" && x.trim(); }).map(function (x) { return x.trim(); });
      }
      if (raw.added != null && typeof raw.added === "string") g.added = raw.added;
      clean.push(g);
    });
    return { errors: errors, clean: clean };
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function sortGrades(list) {
    return list.slice().sort(function (a, b) {
      const ia = GRADE_ORDER.indexOf(a), ib = GRADE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "th");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  // เข้ารหัส/ถอดรหัส base64 แบบรองรับ UTF-8 (ภาษาไทย)
  function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64ToUtf8(b64) { return decodeURIComponent(escape(atob(b64.replace(/\s/g, "")))); }

  function setStatus(node, msg, kind) {
    node.textContent = msg;
    node.className = "status" + (kind ? " status-" + kind : "");
  }

  // ---------- Config (localStorage) ----------
  function loadCfg() {
    try {
      const cfg = JSON.parse(localStorage.getItem(LS_CFG) || "{}");
      if (cfg.owner) el.owner.value = cfg.owner;
      if (cfg.repo) el.repo.value = cfg.repo;
      if (cfg.branch) el.branch.value = cfg.branch;
      if (cfg.path) el.path.value = cfg.path;
    } catch (e) { /* ignore */ }
    const t = sessionStorage.getItem(SS_TOKEN);
    if (t) { el.token.value = t; el.remember.checked = true; }
  }

  function saveCfg() {
    const cfg = {
      owner: el.owner.value.trim(), repo: el.repo.value.trim(),
      branch: el.branch.value.trim(), path: el.path.value.trim(),
    };
    localStorage.setItem(LS_CFG, JSON.stringify(cfg));
    if (el.remember.checked && el.token.value.trim()) {
      sessionStorage.setItem(SS_TOKEN, el.token.value.trim());
    } else {
      sessionStorage.removeItem(SS_TOKEN);
    }
    updateTokenStored();
  }

  function cfg() {
    return {
      owner: el.owner.value.trim(),
      repo: el.repo.value.trim(),
      branch: el.branch.value.trim() || "main",
      path: el.path.value.trim() || "games.js",
      token: el.token.value.trim(),
    };
  }

  // ---------- GitHub API ----------
  function apiUrl(c, path) {
    return "https://api.github.com/repos/" + encodeURIComponent(c.owner) +
      "/" + encodeURIComponent(c.repo) + "/contents/" + path;
  }

  function ghHeaders(c) {
    return {
      "Authorization": "Bearer " + c.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  // ดึงไฟล์ปัจจุบัน → คืน { sha, text }
  function ghGetFile(c, path) {
    const url = apiUrl(c, path) + "?ref=" + encodeURIComponent(c.branch);
    return fetch(url, { headers: ghHeaders(c), cache: "no-store" }).then(function (r) {
      if (r.status === 404) return { sha: null, text: null };
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) {
        throw new Error("โหลดไฟล์ไม่สำเร็จ (" + r.status + ") " + (j.message || ""));
      });
      return r.json().then(function (j) {
        return { sha: j.sha, text: j.content ? b64ToUtf8(j.content) : null };
      });
    });
  }

  // เขียนไฟล์ (create/update)
  function ghPutFile(c, path, text, sha, message) {
    const body = {
      message: message,
      content: utf8ToB64(text),
      branch: c.branch,
    };
    if (sha) body.sha = sha;
    return fetch(apiUrl(c, path), {
      method: "PUT",
      headers: Object.assign(ghHeaders(c), { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error("commit ไม่สำเร็จ (" + r.status + ") " + (j.message || ""));
        return j;
      });
    });
  }

  // ---------- สร้างเนื้อไฟล์ games.js ----------
  function buildGamesJs(list) {
    const header =
      "/* ============================================================\n" +
      "   รายการเกมทั้งหมด — ไฟล์นี้แก้ผ่านหน้า \"จัดการเกม\" (admin.html)\n" +
      "   หรือจะแก้มือก็ได้ (เป็น JSON ปกติ)\n" +
      "   หมายเหตุ: ห้ามเปลี่ยน \"id\" ของเกมที่เผยแพร่แล้ว (ลิงก์แชร์อ้างจาก id)\n" +
      "   ============================================================ */\n\n";
    const clean = list.map(function (g) {
      const o = {
        id: g.id || "",
        title: g.title || "",
        description: g.description || "",
        subject: g.subject || "",
        grades: Array.isArray(g.grades) ? g.grades : [],
        url: g.url || "",
      };
      if (g.emoji) o.emoji = g.emoji;
      if (g.color) o.color = g.color;
      if (g.topic) o.topic = g.topic;
      if (g.minutes != null && g.minutes !== "") o.minutes = Number(g.minutes);
      if (g.mode) o.mode = g.mode;
      if (g.badge) o.badge = g.badge;
      if (g.cover) o.cover = g.cover;
      if (Array.isArray(g.tags) && g.tags.length) o.tags = g.tags;
      if (g.added) o.added = g.added;
      return o;
    });
    return header +
      "const GAMES = " + JSON.stringify(clean, null, 2) + ";\n\n" +
      "window.GAMES = GAMES;\n";
  }

  // ---------- Grade picker ----------
  function buildGradePicker() {
    el.gradePicker.innerHTML = "";
    GRADE_PRESET.forEach(function (gr) {
      const id = "grade_" + gr.replace(/[^\wก-๙]/g, "");
      const label = document.createElement("label");
      label.className = "grade-chip";
      label.innerHTML =
        '<input type="checkbox" value="' + escapeHtml(gr) + '" /> ' + escapeHtml(gr);
      el.gradePicker.appendChild(label);
    });
  }

  function getSelectedGrades() {
    const set = [];
    el.gradePicker.querySelectorAll("input:checked").forEach(function (cb) {
      set.push(cb.value);
    });
    el.fGradeCustom.value.split(",").forEach(function (s) {
      const v = s.trim();
      if (v && set.indexOf(v) === -1) set.push(v);
    });
    return sortGrades(set);
  }

  function setSelectedGrades(grades) {
    const preset = [];
    const custom = [];
    (grades || []).forEach(function (gr) {
      if (GRADE_PRESET.indexOf(gr) !== -1) preset.push(gr);
      else custom.push(gr);
    });
    el.gradePicker.querySelectorAll("input").forEach(function (cb) {
      cb.checked = preset.indexOf(cb.value) !== -1;
    });
    el.fGradeCustom.value = custom.join(", ");
  }

  // ---------- Subject datalist ----------
  function refreshSubjectList() {
    const set = {};
    games.forEach(function (g) { if (g.subject) set[g.subject] = 1; });
    el.subjectList.innerHTML = Object.keys(set).map(function (s) {
      return '<option value="' + escapeHtml(s) + '"></option>';
    }).join("");
  }

  function refreshTagList() {
    const set = {};
    games.forEach(function (g) { (g.tags || []).forEach(function (t) { set[t] = 1; }); });
    if (el.tagList) {
      el.tagList.innerHTML = Object.keys(set).map(function (t) {
        return '<option value="' + escapeHtml(t) + '"></option>';
      }).join("");
    }
  }

  // ---------- Render list (มีค้นหา/กรองในรายการ) ----------
  function matchesListFilter(g) {
    if (listState.subject && g.subject !== listState.subject) return false;
    if (listState.search) {
      const hay = ((g.title || "") + " " + (g.subject || "") + " " + (g.grades || []).join(" ")).toLowerCase();
      if (hay.indexOf(listState.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function renderList() {
    const filtering = !!(listState.search || listState.subject);
    el.list.innerHTML = "";
    let shown = 0;
    games.forEach(function (g, i) {
      if (!matchesListFilter(g)) return;
      shown++;
      const li = document.createElement("li");
      li.className = "admin-list-item";
      li.style.setProperty("--item-color", g.color || "#4f8ef7");
      const t = escapeHtml(g.title);
      // ปิดปุ่มเลื่อนเมื่อกำลังกรอง (ลำดับจริงสับสน) หรืออยู่หัว/ท้ายรายการ
      const upDis = (filtering || i === 0) ? " disabled" : "";
      const downDis = (filtering || i === games.length - 1) ? " disabled" : "";
      li.innerHTML =
        '<span class="li-emoji" aria-hidden="true">' + escapeHtml(g.emoji || "🎮") + "</span>" +
        '<div class="li-main">' +
          '<div class="li-title">' + t + "</div>" +
          '<div class="li-meta">' + escapeHtml(g.subject || "") +
            " · " + escapeHtml((g.grades || []).join(", ")) + "</div>" +
        "</div>" +
        '<div class="li-actions">' +
          '<button type="button" class="mini" data-act="up" aria-label="เลื่อนขึ้น ' + t + '"' + upDis + ">↑</button>" +
          '<button type="button" class="mini" data-act="down" aria-label="เลื่อนลง ' + t + '"' + downDis + ">↓</button>" +
          '<button type="button" class="mini" data-act="edit" aria-label="แก้ไข ' + t + '">✏️</button>' +
          '<button type="button" class="mini danger" data-act="del" aria-label="ลบ ' + t + '">🗑️</button>' +
        "</div>";
      li.querySelectorAll("button[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function () { itemAction(btn.dataset.act, i); });
      });
      el.list.appendChild(li);
    });
    el.listCount.textContent = String(games.length);
    el.listEmpty.hidden = shown !== 0;
    refreshSubjectList();
    refreshTagList();
    refreshListSubjectFilter();
  }

  function refreshListSubjectFilter() {
    const cur = el.listSubjectFilter.value;
    const subs = [];
    games.forEach(function (g) { if (g.subject && subs.indexOf(g.subject) === -1) subs.push(g.subject); });
    subs.sort(function (a, b) { return a.localeCompare(b, "th"); });
    el.listSubjectFilter.innerHTML = '<option value="">ทุกวิชา</option>' +
      subs.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + "</option>"; }).join("");
    if (subs.indexOf(cur) !== -1) el.listSubjectFilter.value = cur;
  }

  function itemAction(act, i) {
    if (act === "up" && i > 0) { swap(i, i - 1); }
    else if (act === "down" && i < games.length - 1) { swap(i, i + 1); }
    else if (act === "del") { deleteWithUndo(i); }
    else if (act === "edit") { startEdit(i); }
  }

  function swap(a, b) {
    const t = games[a]; games[a] = games[b]; games[b] = t;
    changes.reordered = true;
    renderList();
    setDirty(true);
    updateChangeSummary();
  }

  // ลบพร้อม snackbar เลิกทำ (ไม่ใช้ confirm)
  let undoTimer = null;
  function deleteWithUndo(i) {
    const removed = games[i];
    games.splice(i, 1);
    changes.deleted++;
    renderList();
    setDirty(true);
    updateChangeSummary();
    showSnackbar('ลบ "' + removed.title + '" แล้ว', function () {
      games.splice(i, 0, removed);
      changes.deleted = Math.max(0, changes.deleted - 1);
      renderList();
      updateChangeSummary();
    });
  }

  function showSnackbar(text, onUndo) {
    clearTimeout(undoTimer);
    el.snackbarText.textContent = text;
    el.snackbar.hidden = false;
    el.snackbarAction.onclick = function () {
      clearTimeout(undoTimer);
      el.snackbar.hidden = true;
      if (onUndo) onUndo();
    };
    undoTimer = setTimeout(function () { el.snackbar.hidden = true; }, 6000);
  }

  // ค้นหา/กรองในรายการ
  el.listSearch.addEventListener("input", function () {
    listState.search = el.listSearch.value.trim();
    renderList();
  });
  el.listSubjectFilter.addEventListener("change", function () {
    listState.subject = el.listSubjectFilter.value;
    renderList();
  });

  // ---------- Dirty state (งานที่ยังไม่เผยแพร่) ----------
  function setDirty(v) {
    dirty = v;
    if (el.publishBar) el.publishBar.hidden = !v;
    if (el.dirtyBadge) el.dirtyBadge.hidden = !v;
    document.body.classList.toggle("has-unsaved", v);
  }

  // ---------- Form ----------
  function readForm() {
    const g = {
      title: el.fTitle.value.trim(),
      description: el.fDesc.value.trim(),
      subject: el.fSubject.value.trim(),
      grades: getSelectedGrades(),
      url: el.fUrl.value.trim(),
      emoji: el.fEmoji.value.trim(),
      color: el.fColor.value,
    };
    // ฟิลด์เพิ่มเติม (ไม่บังคับ)
    const topic = el.fTopic.value.trim(); if (topic) g.topic = topic;
    const minutes = el.fMinutes.value.trim(); if (minutes) g.minutes = Number(minutes);
    const mode = el.fMode.value.trim(); if (mode) g.mode = mode;
    if (el.fBadge.value) g.badge = el.fBadge.value;
    const cover = el.fCover.value.trim(); if (cover) g.cover = cover;
    const tags = el.fTags.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (tags.length) g.tags = tags;
    return g;
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function resetForm() {
    el.editIndex.value = "-1";
    el.form.reset();
    el.fColor.value = "#4f8ef7";
    setSelectedGrades([]);
    el.formHeading.textContent = "2. เพิ่มเกมใหม่";
    el.btnSaveGame.textContent = "➕ เพิ่มเข้ารายการ";
    clearFormErrors();
  }

  function startEdit(i) {
    const g = games[i];
    el.editIndex.value = String(i);
    el.fTitle.value = g.title || "";
    el.fDesc.value = g.description || "";
    el.fSubject.value = g.subject || "";
    el.fUrl.value = g.url || "";
    el.fEmoji.value = g.emoji || "";
    el.fColor.value = g.color || "#4f8ef7";
    el.fTopic.value = g.topic || "";
    el.fMinutes.value = g.minutes != null ? g.minutes : "";
    el.fMode.value = g.mode || "";
    el.fBadge.value = g.badge || "";
    el.fCover.value = g.cover || "";
    el.fTags.value = Array.isArray(g.tags) ? g.tags.join(", ") : "";
    setSelectedGrades(g.grades || []);
    el.formHeading.textContent = "2. แก้ไขเกม: " + g.title;
    el.btnSaveGame.textContent = "💾 บันทึกการแก้ไข";
    el.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFormErrors() {
    el.formErrors.hidden = true;
    el.formErrors.textContent = "";
    [["errTitle", "fTitle"], ["errSubject", "fSubject"], ["errUrl", "fUrl"], ["errGrades", null], ["errCover", "fCover"]]
      .forEach(function (pair) {
        el[pair[0]].hidden = true;
        el[pair[0]].textContent = "";
        if (pair[1]) el[pair[1]].classList.remove("invalid");
      });
  }

  function setFieldError(errId, inputId, msg) {
    el[errId].textContent = msg;
    el[errId].hidden = false;
    if (inputId) el[inputId].classList.add("invalid");
  }

  // ตรวจฟอร์ม → คืน element แรกที่ผิด (null = ผ่าน)
  function validateForm(g) {
    clearFormErrors();
    let firstBad = null;
    const problems = [];
    if (!g.title) { setFieldError("errTitle", "fTitle", "กรุณากรอกชื่อเกม"); problems.push("ชื่อเกม"); firstBad = firstBad || el.fTitle; }
    if (!g.subject) { setFieldError("errSubject", "fSubject", "กรุณากรอกวิชา"); problems.push("วิชา"); firstBad = firstBad || el.fSubject; }
    if (!g.url) { setFieldError("errUrl", "fUrl", "กรุณาวางลิงก์เกม"); problems.push("ลิงก์"); firstBad = firstBad || el.fUrl; }
    else if (!isHttpsUrl(g.url)) { setFieldError("errUrl", "fUrl", "ลิงก์ต้องเป็น https:// (เพื่อความปลอดภัย)"); problems.push("ลิงก์"); firstBad = firstBad || el.fUrl; }
    if (g.grades.length === 0) { setFieldError("errGrades", null, "เลือกระดับชั้นอย่างน้อย 1 ชั้น"); problems.push("ระดับชั้น"); firstBad = firstBad || el.fGradeCustom; }
    if (g.cover && !isHttpsUrl(g.cover)) { setFieldError("errCover", "fCover", "รูปปกต้องเป็นลิงก์ https://"); problems.push("รูปปก"); firstBad = firstBad || el.fCover; }
    if (problems.length) {
      el.formErrors.textContent = "กรุณาแก้ไข: " + problems.join(", ");
      el.formErrors.hidden = false;
    }
    return firstBad;
  }

  el.form.addEventListener("submit", function (e) {
    e.preventDefault();
    const g = readForm();
    const bad = validateForm(g);
    if (bad) { bad.focus(); return; }
    const idx = Number(el.editIndex.value);
    if (idx >= 0) {
      // แก้ไข: คง id/added/tags เดิมไว้ (ลิงก์แชร์อ้างจาก id, added ใช้เรียง "ใหม่ล่าสุด")
      g.id = games[idx].id || makeId(g.title, otherIds(idx));
      if (games[idx].added) g.added = games[idx].added;
      games[idx] = g;
      changes.edited++;
    } else {
      // เพิ่มใหม่: สร้าง id ไม่ซ้ำจากชื่อ + บันทึกวันที่เพิ่ม
      g.id = makeId(g.title, games.map(function (x) { return x.id; }));
      g.added = todayISO();
      games.push(g);
      changes.added++;
    }
    resetForm();
    renderList();
    setDirty(true);
    updateChangeSummary();
  });

  function otherIds(exceptIdx) {
    return games.filter(function (_, i) { return i !== exceptIdx; })
      .map(function (x) { return x.id; });
  }

  el.btnResetForm.addEventListener("click", resetForm);

  // ---------- Connection test ----------
  el.btnTest.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.connStatus, "ยังไม่ได้ใส่ token", "err"); return; }
    saveCfg();
    setStatus(el.connStatus, "กำลังทดสอบ…", "");
    ghGetFile(c, c.path).then(function (res) {
      if (res.text === null) {
        gamesBaseSha = null;
        setStatus(el.connStatus, "✅ เชื่อมต่อได้ แต่ยังไม่พบไฟล์ " + c.path + " (จะสร้างใหม่ตอน commit)", "ok");
        return;
      }
      setStatus(el.connStatus, "✅ เชื่อมต่อสำเร็จ กำลังดึงข้อมูลล่าสุด…", "ok");
      // โหลดข้อมูลล่าสุดอัตโนมัติ (ถ้ายังไม่มีงานค้าง) เพื่อตั้ง baseSha สำหรับกันเขียนทับ
      return loadGamesFromGitHub(c, { silent: true }).then(function () {
        loadAnnouncementFromGitHub(c, { silent: true });
        setStatus(el.connStatus, "✅ เชื่อมต่อสำเร็จ + โหลดข้อมูลล่าสุดแล้ว (" + games.length + " เกม)", "ok");
      });
    }).catch(function (err) {
      setStatus(el.connStatus, "❌ " + err.message + " — ตรวจ token/สิทธิ์ Contents:write และชื่อ repo", "err");
    });
  });

  el.btnForget.addEventListener("click", function () {
    sessionStorage.removeItem(SS_TOKEN);
    el.token.value = "";
    el.remember.checked = false;
    updateTokenStored();
    setStatus(el.connStatus, "ลบ token ออกจากแท็บนี้แล้ว", "ok");
  });

  // แสดง/ซ่อน token
  el.btnToggleToken.addEventListener("click", function () {
    const show = el.token.type === "password";
    el.token.type = show ? "text" : "password";
    el.btnToggleToken.textContent = show ? "🙈 ซ่อน" : "👁 แสดง";
    el.btnToggleToken.setAttribute("aria-pressed", show ? "true" : "false");
  });

  // บอกว่า token ถูกเก็บในเครื่องนี้หรือไม่
  function updateTokenStored() {
    const stored = !!sessionStorage.getItem(SS_TOKEN);
    el.tokenStored.textContent = stored
      ? "🔒 เก็บ token ไว้ในแท็บนี้ชั่วคราว (หายเองเมื่อปิดแท็บ)"
      : "token ไม่ได้ถูกเก็บ — ต้องวางใหม่เมื่อรีเฟรช/เปิดแท็บใหม่";
    el.tokenStored.className = "token-stored" + (stored ? " is-stored" : "");
  }

  // ---------- Load games from GitHub (ตั้ง baseSha สำหรับกันเขียนทับ) ----------
  function loadGamesFromGitHub(c, opts) {
    opts = opts || {};
    if (dirty && !opts.force) {
      if (!confirm("มีการแก้ไขที่ยังไม่บันทึก การโหลดใหม่จะทับของที่แก้ไว้ ยืนยันไหม?")) {
        return Promise.resolve(false);
      }
    }
    return ghGetFile(c, c.path).then(function (res) {
      if (res.text === null) {
        gamesBaseSha = null;
        if (!opts.silent) setStatus(el.commitStatus, "ยังไม่มีไฟล์เกมบน GitHub (จะสร้างใหม่ตอน commit)", "warn");
        return true;
      }
      const parsed = parseGamesFromText(res.text);
      if (!parsed) {
        if (!opts.silent) setStatus(el.commitStatus, "อ่านข้อมูลจากไฟล์ไม่ได้ (รูปแบบไม่ตรง)", "err");
        return false;
      }
      games = parsed;
      ensureIds(games);
      gamesBaseSha = res.sha;
      renderList();
      resetForm();
      setDirty(false);
      resetChanges();
      if (!opts.silent) setStatus(el.commitStatus, "✅ โหลดข้อมูลล่าสุดจาก GitHub แล้ว (" + games.length + " เกม)", "ok");
      return true;
    });
  }

  el.btnReload.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.commitStatus, "ใส่ token แล้วกดทดสอบก่อน", "err"); return; }
    saveCfg();
    setStatus(el.commitStatus, "กำลังโหลดข้อมูลล่าสุด…", "");
    loadGamesFromGitHub(c).catch(function (err) {
      setStatus(el.commitStatus, "❌ " + err.message, "err");
    });
  });

  // แกะ array GAMES จากเนื้อไฟล์ (รองรับทั้งรูปแบบ JSON ที่ admin เขียน)
  function parseGamesFromText(text) {
    const m = text.match(/const\s+GAMES\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }

  // ---------- Commit ----------
  function commitGames() {
    const c = cfg();
    if (!c.token) { setStatus(el.commitStatus, "❌ ยังไม่ได้ใส่ token (ดูขั้นที่ 1)", "err"); return; }
    if (games.length === 0 && !confirm("รายการเกมว่าง จะบันทึกไฟล์ว่างจริงหรือ?")) return;
    saveCfg();
    ensureIds(games);
    el.btnCommit.disabled = true;
    if (el.btnCommitSticky) el.btnCommitSticky.disabled = true;
    setStatus(el.commitStatus, "กำลังบันทึกขึ้น GitHub…", "");
    // ดึง sha ล่าสุด แล้วเทียบกับตอนโหลด — ถ้าไม่ตรง = มีคนแก้ที่อื่น ห้ามเขียนทับ
    ghGetFile(c, c.path).then(function (res) {
      if (gamesBaseSha !== null && res.sha && res.sha !== gamesBaseSha) {
        throw new Error("CONFLICT");
      }
      const text = buildGamesJs(games);
      const msg = "อัปเดตรายการเกมผ่านหน้า admin (" + games.length + " เกม)";
      return ghPutFile(c, c.path, text, res.sha, msg);
    }).then(function (j) {
      if (j && j.content && j.content.sha) gamesBaseSha = j.content.sha; // อัปเดต base เป็นเวอร์ชันล่าสุด
      setDirty(false);
      resetChanges();
      const now = new Date();
      const time = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      setStatus(el.commitStatus, "✅ บันทึกสำเร็จเมื่อ " + time + " น. — เว็บจะอัปเดตภายใน ~1 นาที ", "ok");
      const link = j && j.commit && j.commit.html_url;
      if (link) {
        const a = document.createElement("a");
        a.href = link; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "ดู commit ↗"; a.className = "inline-link";
        el.commitStatus.appendChild(a);
      }
      const site = document.createElement("a");
      site.href = "index.html"; site.target = "_blank"; site.rel = "noopener";
      site.textContent = " · เปิดหน้าเว็บเพื่อตรวจ ↗"; site.className = "inline-link";
      el.commitStatus.appendChild(site);
    }).catch(function (err) {
      if (err.message === "CONFLICT") {
        setStatus(el.commitStatus,
          "⚠️ ไฟล์ถูกแก้จากที่อื่นหลังคุณโหลด — ระบบไม่บันทึกทับให้ กด “โหลดใหม่จาก GitHub” (จะทับงานที่ยังไม่บันทึก) แล้วทำซ้ำ", "err");
      } else {
        let hint = "";
        if (/409/.test(err.message)) hint = " — ไฟล์ถูกแก้ที่อื่น กด “โหลดใหม่จาก GitHub” แล้วลองใหม่";
        setStatus(el.commitStatus, "❌ " + err.message + hint, "err");
      }
    }).then(function () {
      el.btnCommit.disabled = false;
      if (el.btnCommitSticky) el.btnCommitSticky.disabled = false;
    });
  }

  el.btnCommit.addEventListener("click", commitGames);
  if (el.btnCommitSticky) el.btnCommitSticky.addEventListener("click", commitGames);

  // ---------- Export / Import ----------
  el.btnExport.addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(games, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "games-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el.btnImport.addEventListener("click", function () {
    const raw = el.importBox.value.trim();
    if (!raw) { setStatus(el.commitStatus, "วาง JSON ในช่องก่อน", "err"); return; }
    let data;
    try { data = JSON.parse(raw); } catch (e) { setStatus(el.commitStatus, "JSON ไม่ถูกต้อง", "err"); return; }
    if (!Array.isArray(data)) { setStatus(el.commitStatus, "JSON ต้องเป็น array ของเกม", "err"); return; }

    const result = validateImportRecords(data);
    if (result.errors.length) {
      const show = result.errors.slice(0, 8).join("\n");
      const more = result.errors.length > 8 ? "\n…และอีก " + (result.errors.length - 8) + " รายการ" : "";
      setStatus(el.commitStatus, "❌ นำเข้าไม่ได้ พบ " + result.errors.length + " ข้อผิดพลาด — ดูรายละเอียดในกล่องแจ้งเตือน", "err");
      alert("ข้อมูลนำเข้าไม่ผ่านการตรวจ:\n\n" + show + more);
      return;
    }
    if (!confirm("แทนที่รายการปัจจุบันด้วยข้อมูลที่วาง (" + result.clean.length + " เกม)?")) return;
    games = result.clean;
    ensureIds(games);
    renderList();
    resetForm();
    setDirty(true);
    setStatus(el.commitStatus, "นำเข้าแล้ว (" + games.length + " เกม) — กด “บันทึกขึ้นเว็บ” เพื่อให้ถาวร", "warn");
  });

  // ---------- ประกาศหน้าเว็บ ----------
  function buildAnnouncementJs(obj) {
    const clean = {
      enabled: !!obj.enabled,
      important: !!obj.important,
      title: obj.title || "",
      message: obj.message || "",
    };
    const header =
      "/* ============================================================\n" +
      "   ประกาศหน้าเว็บ — แก้ผ่านหน้า \"จัดการเกม\" (admin.html) หรือแก้มือ\n" +
      "   ============================================================ */\n\n";
    return header + "window.ANNOUNCEMENT = " + JSON.stringify(clean, null, 2) + ";\n";
  }

  function parseAnnouncementFromText(text) {
    const m = text.match(/ANNOUNCEMENT\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }

  function loadAnnouncementToForm(a) {
    a = a || {};
    el.annEnabled.checked = !!a.enabled;
    if (el.annImportant) el.annImportant.checked = !!a.important;
    el.annTitle.value = a.title || "";
    el.annMessage.value = a.message || "";
  }

  function readAnnouncementForm() {
    return {
      enabled: el.annEnabled.checked,
      important: el.annImportant ? el.annImportant.checked : false,
      title: el.annTitle.value.trim(),
      message: el.annMessage.value.trim(),
    };
  }

  function loadAnnouncementFromGitHub(c, opts) {
    opts = opts || {};
    return ghGetFile(c, ANNOUNCE_PATH).then(function (res) {
      if (res.text === null) { annBaseSha = null; return false; }
      const parsed = parseAnnouncementFromText(res.text);
      if (!parsed) {
        if (!opts.silent) setStatus(el.annStatus, "อ่านไฟล์ประกาศไม่ได้ (รูปแบบไม่ตรง)", "err");
        return false;
      }
      loadAnnouncementToForm(parsed);
      annBaseSha = res.sha;
      if (!opts.silent) setStatus(el.annStatus, "✅ โหลดประกาศล่าสุดจาก GitHub แล้ว", "ok");
      return true;
    });
  }

  el.btnSaveAnnounce.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.annStatus, "❌ ยังไม่ได้ใส่ token (ดูขั้นที่ 1)", "err"); return; }
    const ann = readAnnouncementForm();
    if (ann.enabled && !ann.message && !ann.title) {
      setStatus(el.annStatus, "เปิดประกาศแล้วแต่ยังไม่มีข้อความ กรุณาใส่หัวข้อหรือเนื้อหา", "err");
      return;
    }
    saveCfg();
    el.btnSaveAnnounce.disabled = true;
    setStatus(el.annStatus, "กำลังบันทึกประกาศ…", "");
    ghGetFile(c, ANNOUNCE_PATH).then(function (res) {
      if (annBaseSha !== null && res.sha && res.sha !== annBaseSha) {
        throw new Error("CONFLICT");
      }
      const text = buildAnnouncementJs(ann);
      const msg = "อัปเดตประกาศหน้าเว็บผ่าน admin (" + (ann.enabled ? "เปิด" : "ปิด") + ")";
      return ghPutFile(c, ANNOUNCE_PATH, text, res.sha, msg);
    }).then(function (j) {
      if (j && j.content && j.content.sha) annBaseSha = j.content.sha;
      setStatus(el.annStatus,
        "✅ บันทึกประกาศแล้ว เว็บจะอัปเดตภายใน ~1 นาที" +
        (ann.enabled ? "" : " (ปิดประกาศแล้ว)"), "ok");
    }).catch(function (err) {
      if (err.message === "CONFLICT") {
        setStatus(el.annStatus, "⚠️ ไฟล์ประกาศถูกแก้จากที่อื่น กด “โหลดใหม่จาก GitHub” แล้วทำซ้ำ", "err");
      } else {
        let hint = "";
        if (/409/.test(err.message)) hint = " — ไฟล์ถูกแก้ที่อื่น กด “โหลดใหม่จาก GitHub” แล้วลองใหม่";
        setStatus(el.annStatus, "❌ " + err.message + hint, "err");
      }
    }).then(function () {
      el.btnSaveAnnounce.disabled = false;
    });
  });

  el.btnReloadAnnounce.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.annStatus, "ใส่ token แล้วกดทดสอบก่อน", "err"); return; }
    saveCfg();
    setStatus(el.annStatus, "กำลังโหลดประกาศล่าสุด…", "");
    loadAnnouncementFromGitHub(c).then(function (ok) {
      if (ok === false && annBaseSha === null) setStatus(el.annStatus, "ยังไม่มีไฟล์ประกาศบน GitHub", "warn");
    }).catch(function (err) {
      setStatus(el.annStatus, "❌ " + err.message, "err");
    });
  });

  // เตือนก่อนออกจากหน้าเมื่อมีงานที่ยังไม่บันทึก
  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; return ""; }
  });

  // ---------- Init ----------
  buildGradePicker();
  loadCfg();
  updateTokenStored();
  ensureIds(games);
  renderList();
  resetForm();
  setDirty(false);
  resetChanges();
  loadAnnouncementToForm(window.ANNOUNCEMENT || {});
  el.listNote.textContent =
    games.length + " เกม (จากข้อมูลที่โหลดมากับหน้านี้)";

  // ถ้าเครื่องนี้จำ token ไว้ ให้ดึงข้อมูลล่าสุดอัตโนมัติ (ตั้ง baseSha กันเขียนทับ)
  if (el.token.value.trim()) {
    const c = cfg();
    setStatus(el.commitStatus, "กำลังดึงข้อมูลล่าสุดจาก GitHub…", "");
    loadGamesFromGitHub(c, { silent: true, force: true }).then(function () {
      loadAnnouncementFromGitHub(c, { silent: true });
      setStatus(el.commitStatus, "พร้อมแก้ไข — โหลดข้อมูลล่าสุดแล้ว (" + games.length + " เกม)", "ok");
    }).catch(function () {
      setStatus(el.commitStatus, "โหลดอัตโนมัติไม่สำเร็จ ลองกด “ทดสอบการเชื่อมต่อ”", "warn");
    });
  }
})();
