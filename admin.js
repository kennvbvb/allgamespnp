/* ============================================================
   หน้าจัดการเกม (admin) — เพิ่ม/แก้/ลบเกม แล้ว commit ไฟล์ games.js
   กลับเข้า GitHub repo ผ่าน GitHub REST API
   Token เก็บใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น
   ============================================================ */

(function () {
  "use strict";

  const LS_TOKEN = "gamehub_gh_token";
  const LS_CFG = "gamehub_gh_cfg";

  const GRADE_PRESET = [
    "อนุบาล 1", "อนุบาล 2", "อนุบาล 3",
    "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
    "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  ];
  const GRADE_ORDER = GRADE_PRESET.slice();

  // รายการเกมที่กำลังแก้ (เริ่มจากข้อมูลที่ bundle มากับหน้า = games.js ปัจจุบัน)
  let games = deepCopy(Array.isArray(window.GAMES) ? window.GAMES : []);

  // ---------- DOM ----------
  const $ = function (id) { return document.getElementById(id); };
  const el = {
    owner: $("cfgOwner"), repo: $("cfgRepo"), branch: $("cfgBranch"), path: $("cfgPath"),
    token: $("cfgToken"), remember: $("cfgRemember"),
    btnTest: $("btnTest"), btnForget: $("btnForget"), connStatus: $("connStatus"),
    form: $("gameForm"), formHeading: $("formHeading"), editIndex: $("editIndex"),
    fTitle: $("fTitle"), fDesc: $("fDesc"), fSubject: $("fSubject"), fUrl: $("fUrl"),
    fEmoji: $("fEmoji"), fColor: $("fColor"), fGradeCustom: $("fGradeCustom"),
    subjectList: $("subjectList"), gradePicker: $("gradePicker"),
    btnSaveGame: $("btnSaveGame"), btnResetForm: $("btnResetForm"),
    list: $("gameList"), listCount: $("listCount"), listNote: $("listNote"),
    btnCommit: $("btnCommit"), btnReload: $("btnReload"), commitStatus: $("commitStatus"),
    btnExport: $("btnExport"), btnImport: $("btnImport"), importBox: $("importBox"),
  };

  // ---------- Utils ----------
  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

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
    const t = localStorage.getItem(LS_TOKEN);
    if (t) { el.token.value = t; el.remember.checked = true; }
  }

  function saveCfg() {
    const cfg = {
      owner: el.owner.value.trim(), repo: el.repo.value.trim(),
      branch: el.branch.value.trim(), path: el.path.value.trim(),
    };
    localStorage.setItem(LS_CFG, JSON.stringify(cfg));
    if (el.remember.checked && el.token.value.trim()) {
      localStorage.setItem(LS_TOKEN, el.token.value.trim());
    } else {
      localStorage.removeItem(LS_TOKEN);
    }
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
  function apiUrl(c) {
    return "https://api.github.com/repos/" + encodeURIComponent(c.owner) +
      "/" + encodeURIComponent(c.repo) + "/contents/" + c.path;
  }

  function ghHeaders(c) {
    return {
      "Authorization": "Bearer " + c.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  // ดึงไฟล์ปัจจุบัน → คืน { sha, text }
  function ghGetFile(c) {
    const url = apiUrl(c) + "?ref=" + encodeURIComponent(c.branch);
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
  function ghPutFile(c, text, sha, message) {
    const body = {
      message: message,
      content: utf8ToB64(text),
      branch: c.branch,
    };
    if (sha) body.sha = sha;
    return fetch(apiUrl(c), {
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
      "   ============================================================ */\n\n";
    const clean = list.map(function (g) {
      const o = {
        title: g.title || "",
        description: g.description || "",
        subject: g.subject || "",
        grades: Array.isArray(g.grades) ? g.grades : [],
        url: g.url || "",
      };
      if (g.emoji) o.emoji = g.emoji;
      if (g.color) o.color = g.color;
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

  // ---------- Render list ----------
  function renderList() {
    el.list.innerHTML = "";
    games.forEach(function (g, i) {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      li.style.setProperty("--item-color", g.color || "#4f8ef7");
      li.innerHTML =
        '<span class="li-emoji">' + escapeHtml(g.emoji || "🎮") + "</span>" +
        '<div class="li-main">' +
          '<div class="li-title">' + escapeHtml(g.title) + "</div>" +
          '<div class="li-meta">' + escapeHtml(g.subject || "") +
            " · " + escapeHtml((g.grades || []).join(", ")) + "</div>" +
        "</div>" +
        '<div class="li-actions">' +
          '<button type="button" class="mini" data-act="up" title="เลื่อนขึ้น">↑</button>' +
          '<button type="button" class="mini" data-act="down" title="เลื่อนลง">↓</button>' +
          '<button type="button" class="mini" data-act="edit" title="แก้ไข">✏️</button>' +
          '<button type="button" class="mini danger" data-act="del" title="ลบ">🗑️</button>' +
        "</div>";
      li.querySelectorAll("button[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function () { itemAction(btn.dataset.act, i); });
      });
      el.list.appendChild(li);
    });
    el.listCount.textContent = String(games.length);
    refreshSubjectList();
  }

  function itemAction(act, i) {
    if (act === "up" && i > 0) { swap(i, i - 1); }
    else if (act === "down" && i < games.length - 1) { swap(i, i + 1); }
    else if (act === "del") {
      if (confirm('ลบเกม "' + games[i].title + '" ออกจากรายการ?')) {
        games.splice(i, 1);
        renderList();
      }
    } else if (act === "edit") {
      startEdit(i);
    }
  }

  function swap(a, b) {
    const t = games[a]; games[a] = games[b]; games[b] = t;
    renderList();
  }

  // ---------- Form ----------
  function readForm() {
    return {
      title: el.fTitle.value.trim(),
      description: el.fDesc.value.trim(),
      subject: el.fSubject.value.trim(),
      grades: getSelectedGrades(),
      url: el.fUrl.value.trim(),
      emoji: el.fEmoji.value.trim(),
      color: el.fColor.value,
    };
  }

  function resetForm() {
    el.editIndex.value = "-1";
    el.form.reset();
    el.fColor.value = "#4f8ef7";
    setSelectedGrades([]);
    el.formHeading.textContent = "2. เพิ่มเกมใหม่";
    el.btnSaveGame.textContent = "➕ เพิ่มเข้ารายการ";
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
    setSelectedGrades(g.grades || []);
    el.formHeading.textContent = "2. แก้ไขเกม: " + g.title;
    el.btnSaveGame.textContent = "💾 บันทึกการแก้ไข";
    el.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  el.form.addEventListener("submit", function (e) {
    e.preventDefault();
    const g = readForm();
    if (!g.title || !g.subject || !g.url) {
      alert("กรุณากรอก ชื่อเกม / วิชา / ลิงก์ ให้ครบ");
      return;
    }
    if (g.grades.length === 0) {
      alert("กรุณาเลือกระดับชั้นอย่างน้อย 1 ชั้น");
      return;
    }
    const idx = Number(el.editIndex.value);
    if (idx >= 0) { games[idx] = g; } else { games.push(g); }
    resetForm();
    renderList();
    setStatus(el.commitStatus, "เพิ่ม/แก้ในรายการแล้ว — อย่าลืมกด “บันทึกขึ้นเว็บ” เพื่อให้นักเรียนเห็น", "warn");
  });

  el.btnResetForm.addEventListener("click", resetForm);

  // ---------- Connection test ----------
  el.btnTest.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.connStatus, "ยังไม่ได้ใส่ token", "err"); return; }
    saveCfg();
    setStatus(el.connStatus, "กำลังทดสอบ…", "");
    ghGetFile(c).then(function (res) {
      if (res.text === null) {
        setStatus(el.connStatus, "✅ เชื่อมต่อได้ แต่ยังไม่พบไฟล์ " + c.path + " (จะสร้างใหม่ตอน commit)", "ok");
      } else {
        setStatus(el.connStatus, "✅ เชื่อมต่อสำเร็จ อ่านไฟล์ " + c.path + " ได้", "ok");
      }
    }).catch(function (err) {
      setStatus(el.connStatus, "❌ " + err.message + " — ตรวจ token/สิทธิ์ Contents:write และชื่อ repo", "err");
    });
  });

  el.btnForget.addEventListener("click", function () {
    localStorage.removeItem(LS_TOKEN);
    el.token.value = "";
    el.remember.checked = false;
    setStatus(el.connStatus, "ลบ token ออกจากเบราว์เซอร์นี้แล้ว", "ok");
  });

  // ---------- Reload from GitHub ----------
  el.btnReload.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.commitStatus, "ใส่ token แล้วกดทดสอบก่อน", "err"); return; }
    saveCfg();
    setStatus(el.commitStatus, "กำลังโหลดข้อมูลล่าสุด…", "");
    ghGetFile(c).then(function (res) {
      if (res.text === null) { setStatus(el.commitStatus, "ยังไม่มีไฟล์บน GitHub", "warn"); return; }
      const parsed = parseGamesFromText(res.text);
      if (!parsed) { setStatus(el.commitStatus, "อ่านข้อมูลจากไฟล์ไม่ได้ (รูปแบบไม่ตรง)", "err"); return; }
      games = parsed;
      renderList();
      resetForm();
      setStatus(el.commitStatus, "✅ โหลดข้อมูลล่าสุดจาก GitHub แล้ว (" + games.length + " เกม)", "ok");
    }).catch(function (err) {
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
  el.btnCommit.addEventListener("click", function () {
    const c = cfg();
    if (!c.token) { setStatus(el.commitStatus, "❌ ยังไม่ได้ใส่ token (ดูขั้นที่ 1)", "err"); return; }
    if (games.length === 0 && !confirm("รายการเกมว่าง จะบันทึกไฟล์ว่างจริงหรือ?")) return;
    saveCfg();
    el.btnCommit.disabled = true;
    setStatus(el.commitStatus, "กำลังบันทึกขึ้น GitHub…", "");
    // ดึง sha ล่าสุดก่อน กัน conflict
    ghGetFile(c).then(function (res) {
      const text = buildGamesJs(games);
      const msg = "อัปเดตรายการเกมผ่านหน้า admin (" + games.length + " เกม)";
      return ghPutFile(c, text, res.sha, msg);
    }).then(function (j) {
      const link = j && j.commit && j.commit.html_url;
      setStatus(el.commitStatus,
        "✅ บันทึกสำเร็จ! เว็บจะอัปเดตอัตโนมัติภายใน ~1 นาที" + (link ? "" : ""), "ok");
      if (link) {
        const a = document.createElement("a");
        a.href = link; a.target = "_blank"; a.rel = "noopener";
        a.textContent = " ดู commit ↗"; a.className = "inline-link";
        el.commitStatus.appendChild(a);
      }
    }).catch(function (err) {
      let hint = "";
      if (/409/.test(err.message)) hint = " — ไฟล์ถูกแก้ที่อื่น กด “โหลดใหม่จาก GitHub” แล้วลองใหม่";
      setStatus(el.commitStatus, "❌ " + err.message + hint, "err");
    }).then(function () {
      el.btnCommit.disabled = false;
    });
  });

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
    if (!confirm("แทนที่รายการปัจจุบันด้วยข้อมูลที่วาง (" + data.length + " เกม)?")) return;
    games = data;
    renderList();
    resetForm();
    setStatus(el.commitStatus, "นำเข้าแล้ว — กด “บันทึกขึ้นเว็บ” เพื่อให้ถาวร", "warn");
  });

  // ---------- Init ----------
  buildGradePicker();
  loadCfg();
  renderList();
  resetForm();
  el.listNote.textContent =
    games.length + " เกม (จากข้อมูลที่โหลดมากับหน้านี้) — ใส่ token แล้วกด “โหลดใหม่จาก GitHub” เพื่อดึงล่าสุด";
})();
