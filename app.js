/* ============================================================
   โลจิกหน้าเว็บ: สร้างการ์ด, กรอง, ค้นหา, โมดัลพรีวิว
   ข้อมูลเกมอยู่ใน games.js (ตัวแปร GAMES)
   ============================================================ */

(function () {
  "use strict";

  // สีสำรองสำหรับเกมที่ไม่ได้กำหนด color
  const FALLBACK_COLORS = [
    "#4f8ef7", "#8b5cf6", "#f59e0b", "#ef4444",
    "#10b981", "#06b6d4", "#ec4899", "#f97316",
  ];

  // ลำดับระดับชั้นสำหรับเรียงชิป (ป.1→ป.6, ม.1→ม.6, อื่นๆ ต่อท้าย)
  const GRADE_ORDER = [
    "อนุบาล 1", "อนุบาล 2", "อนุบาล 3",
    "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
    "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  ];

  // เตรียมข้อมูลเกม: ใส่ id + สีสำรองถ้าไม่มี
  const games = (Array.isArray(window.GAMES) ? window.GAMES : []).map(function (g, i) {
    return Object.assign({}, g, {
      id: i,
      emoji: g.emoji || "🎮",
      color: g.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      grades: Array.isArray(g.grades) ? g.grades : (g.grades ? [g.grades] : []),
    });
  });

  // สถานะตัวกรอง (null = ทั้งหมด)
  const state = { subject: null, grade: null, search: "" };

  // ---------- DOM ----------
  const el = {
    grid: document.getElementById("gameGrid"),
    subjectChips: document.getElementById("subjectChips"),
    gradeChips: document.getElementById("gradeChips"),
    search: document.getElementById("searchInput"),
    resultCount: document.getElementById("resultCount"),
    clearFilters: document.getElementById("clearFilters"),
    emptyState: document.getElementById("emptyState"),
    modal: document.getElementById("gameModal"),
    frame: document.getElementById("gameFrame"),
    frameLoading: document.getElementById("iframeLoading"),
    modalTitle: document.getElementById("modalTitle"),
    modalEmoji: document.getElementById("modalEmoji"),
    modalTags: document.getElementById("modalTags"),
    openFull: document.getElementById("openFull"),
    copyLink: document.getElementById("copyLink"),
  };

  // ---------- Utils ----------
  function sortGrades(list) {
    return list.slice().sort(function (a, b) {
      const ia = GRADE_ORDER.indexOf(a);
      const ib = GRADE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "th");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function uniqueSubjects() {
    const set = new Set();
    games.forEach(function (g) {
      if (g.subject) set.add(g.subject);
    });
    return Array.from(set).sort(function (a, b) {
      return a.localeCompare(b, "th");
    });
  }

  function uniqueGrades() {
    const set = new Set();
    games.forEach(function (g) {
      g.grades.forEach(function (gr) {
        set.add(gr);
      });
    });
    return sortGrades(Array.from(set));
  }

  // ---------- Build filter chips ----------
  function buildChips(container, values, key) {
    container.innerHTML = "";
    values.forEach(function (value) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = value;
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", function () {
        state[key] = state[key] === value ? null : value;
        syncChips();
        render();
      });
      chip.dataset.value = value;
      container.appendChild(chip);
    });
  }

  function syncChips() {
    document.querySelectorAll("#subjectChips .chip").forEach(function (c) {
      const on = state.subject === c.dataset.value;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("#gradeChips .chip").forEach(function (c) {
      const on = state.grade === c.dataset.value;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // ---------- Filter ----------
  function filteredGames() {
    const q = state.search.trim().toLowerCase();
    return games.filter(function (g) {
      if (state.subject && g.subject !== state.subject) return false;
      if (state.grade && g.grades.indexOf(state.grade) === -1) return false;
      if (q) {
        const hay = (g.title + " " + (g.description || "") + " " + g.subject).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  // ---------- Render cards ----------
  function render() {
    const list = filteredGames();
    el.grid.innerHTML = "";

    list.forEach(function (g) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "game-card";
      card.style.setProperty("--card-color", g.color);
      card.setAttribute("aria-label", "เปิดเกม " + g.title);

      const gradeTags = g.grades
        .map(function (gr) {
          return '<span class="tag tag-grade">' + escapeHtml(gr) + "</span>";
        })
        .join("");

      card.innerHTML =
        '<span class="card-emoji">' + escapeHtml(g.emoji) + "</span>" +
        '<h3 class="card-title">' + escapeHtml(g.title) + "</h3>" +
        '<p class="card-desc">' + escapeHtml(g.description || "") + "</p>" +
        '<div class="card-tags">' +
          '<span class="tag tag-subject">' + escapeHtml(g.subject || "") + "</span>" +
          gradeTags +
        "</div>";

      card.addEventListener("click", function () {
        openModal(g);
      });
      el.grid.appendChild(card);
    });

    // สรุปผล + สถานะว่าง
    const total = games.length;
    el.resultCount.textContent = "แสดง " + list.length + " จาก " + total + " เกม";
    el.emptyState.hidden = list.length !== 0;
    const hasFilter = state.subject || state.grade || state.search.trim();
    el.clearFilters.hidden = !hasFilter;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;",
      }[c];
    });
  }

  // ---------- Modal ----------
  function openModal(g) {
    el.modalTitle.textContent = g.title;
    el.modalEmoji.textContent = g.emoji;
    el.modalTags.innerHTML =
      '<span class="tag tag-subject">' + escapeHtml(g.subject || "") + "</span>" +
      g.grades
        .map(function (gr) {
          return '<span class="tag tag-grade">' + escapeHtml(gr) + "</span>";
        })
        .join("");

    el.openFull.href = g.url;
    el.copyLink.dataset.url = g.url;
    el.copyLink.textContent = "🔗 คัดลอกลิงก์";

    // โหลด iframe
    el.frameLoading.style.display = "flex";
    el.frame.src = g.url;
    el.frame.onload = function () {
      el.frameLoading.style.display = "none";
    };

    el.modal.hidden = false;
    document.body.classList.add("modal-open");

    // อัปเดต URL ให้แชร์เกมเดียวได้
    if (history.replaceState) {
      history.replaceState(null, "", "#game=" + g.id);
    }
  }

  function closeModal() {
    el.modal.hidden = true;
    el.frame.src = "about:blank";
    document.body.classList.remove("modal-open");
    if (history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  // ---------- Events ----------
  el.search.addEventListener("input", function () {
    state.search = el.search.value;
    render();
  });

  el.clearFilters.addEventListener("click", function () {
    state.subject = null;
    state.grade = null;
    state.search = "";
    el.search.value = "";
    syncChips();
    render();
  });

  el.modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !el.modal.hidden) closeModal();
  });

  el.copyLink.addEventListener("click", function () {
    const url = el.copyLink.dataset.url;
    const done = function () {
      el.copyLink.textContent = "✅ คัดลอกแล้ว";
      setTimeout(function () {
        el.copyLink.textContent = "🔗 คัดลอกลิงก์";
      }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch (err) {
        /* ไม่รองรับ */
      }
      document.body.removeChild(ta);
    }
  });

  // ---------- Deep link (#game=<id>) ----------
  function openFromHash() {
    const m = location.hash.match(/game=(\d+)/);
    if (m) {
      const g = games[Number(m[1])];
      if (g) openModal(g);
    }
  }

  // รองรับการเปลี่ยน hash ระหว่างใช้งาน (แชร์ลิงก์/ปุ่ม back-forward)
  window.addEventListener("hashchange", openFromHash);

  // ---------- ป๊อปอัปประกาศ (announcement.js) ----------
  function announceSignature(a) {
    // ลายเซ็นข้อความ ใช้เช็คว่าเปลี่ยนไหม (ถ้าเปลี่ยนจะแสดงใหม่แม้เคยกดไม่แสดงอีก)
    return (a.title || "") + "" + (a.message || "");
  }

  function showAnnouncement() {
    const a = window.ANNOUNCEMENT;
    if (!a || !a.enabled || !(a.message || a.title)) return;

    const sig = announceSignature(a);
    try {
      if (localStorage.getItem("gamehub_announce_dismissed") === sig) return;
    } catch (e) { /* localStorage ปิดอยู่ ก็แสดงตามปกติ */ }

    const overlay = document.createElement("div");
    overlay.className = "announce-overlay";

    const msgHtml = escapeHtml(a.message || "").replace(/\n/g, "<br>");
    overlay.innerHTML =
      '<div class="announce-box" role="dialog" aria-modal="true" aria-labelledby="announceTitle">' +
        '<button type="button" class="announce-close" aria-label="ปิด">✕</button>' +
        '<h2 class="announce-title" id="announceTitle">' + escapeHtml(a.title || "ประกาศ") + "</h2>" +
        '<div class="announce-msg">' + msgHtml + "</div>" +
        '<label class="announce-hide"><input type="checkbox" id="announceHide" /> ไม่แสดงข้อความนี้อีก</label>' +
        '<button type="button" class="btn btn-primary announce-ok">รับทราบ</button>' +
      "</div>";

    function close() {
      const hide = overlay.querySelector("#announceHide");
      if (hide && hide.checked) {
        try { localStorage.setItem("gamehub_announce_dismissed", sig); } catch (e) { /* ignore */ }
      }
      overlay.remove();
      document.body.classList.remove("modal-open");
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".announce-close").addEventListener("click", close);
    overlay.querySelector(".announce-ok").addEventListener("click", close);
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape" && document.body.contains(overlay)) {
        close();
        document.removeEventListener("keydown", onEsc);
      }
    });

    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
  }

  // ---------- Init ----------
  buildChips(el.subjectChips, uniqueSubjects(), "subject");
  buildChips(el.gradeChips, uniqueGrades(), "grade");
  render();
  openFromHash();
  showAnnouncement();
})();
