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

  // เตรียมข้อมูลเกม: ใส่ id คงที่ (slug) + สีสำรองถ้าไม่มี
  const games = (Array.isArray(window.GAMES) ? window.GAMES : []).map(function (g, i) {
    return Object.assign({}, g, {
      id: g.id || String(i), // ใช้ slug คงที่จาก games.js; เกมเก่าที่ไม่มี id ใช้เลขลำดับ (เผื่อไว้)
      index: i,
      emoji: g.emoji || "🎮",
      color: g.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      grades: Array.isArray(g.grades) ? g.grades : (g.grades ? [g.grades] : []),
    });
  });

  function findGame(key) {
    // หาเกมจาก slug ก่อน ถ้าไม่เจอและเป็นตัวเลข ใช้เลขลำดับ (รองรับลิงก์เก่า #game=0)
    for (var i = 0; i < games.length; i++) {
      if (games[i].id === key) return games[i];
    }
    if (/^\d+$/.test(key) && games[Number(key)]) return games[Number(key)];
    return null;
  }

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
    frameError: document.getElementById("iframeError"),
    errOpenNew: document.getElementById("errOpenNew"),
    errRetry: document.getElementById("errRetry"),
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
        writeFiltersToUrl();
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

  // ---------- Sync ตัวกรอง/ค้นหา กับ URL (refresh/แชร์ผลลัพธ์ได้) ----------
  function readFiltersFromUrl() {
    const p = new URLSearchParams(location.search);
    state.subject = p.get("subject") || null;
    state.grade = p.get("grade") || null;
    state.search = p.get("q") || "";
    if (el.search) el.search.value = state.search;
  }

  function writeFiltersToUrl() {
    const p = new URLSearchParams();
    if (state.subject) p.set("subject", state.subject);
    if (state.grade) p.set("grade", state.grade);
    if (state.search.trim()) p.set("q", state.search.trim());
    const qs = p.toString();
    const url = location.pathname + (qs ? "?" + qs : "") + location.hash;
    if (history.replaceState) history.replaceState(history.state, "", url);
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

      const descHtml = (g.description && g.description.trim())
        ? '<p class="card-desc">' + escapeHtml(g.description) + "</p>"
        : "";

      card.innerHTML =
        '<span class="card-emoji" aria-hidden="true">' + escapeHtml(g.emoji) + "</span>" +
        '<h3 class="card-title">' + escapeHtml(g.title) + "</h3>" +
        descHtml +
        '<div class="card-tags">' +
          '<span class="tag tag-subject">' + escapeHtml(g.subject || "") + "</span>" +
          gradeTags +
        "</div>" +
        '<span class="card-cta" aria-hidden="true">▶ เล่นเกม</span>';

      card.addEventListener("click", function () {
        openModal(g, true);
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

  // ---------- ตัวช่วยจัดการ focus ของ dialog (ใช้ร่วมกับป๊อปอัปประกาศ) ----------
  const PAGE_REGIONS = [".site-header", ".container", ".site-footer"];

  function backgroundInert(on) {
    PAGE_REGIONS.forEach(function (sel) {
      const node = document.querySelector(sel);
      if (!node) return;
      if (on) { node.setAttribute("inert", ""); node.setAttribute("aria-hidden", "true"); }
      else { node.removeAttribute("inert"); node.removeAttribute("aria-hidden"); }
    });
  }

  function focusables(panel) {
    const sel =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
      ' textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(panel.querySelectorAll(sel), function (elm) {
      return elm.offsetWidth > 0 || elm.offsetHeight > 0 || elm === document.activeElement;
    });
  }

  function trapTab(e, panel) {
    if (e.key !== "Tab") return;
    const list = focusables(panel);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  // ---------- Modal ----------
  let modalOpener = null;
  let frameTimer = null;
  let currentGameUrl = "";

  // โหลดเกมในกรอบ พร้อม timeout + สถานะ error (มีปุ่มลองใหม่/เปิดแท็บใหม่)
  function loadGameFrame(url) {
    currentGameUrl = url;
    clearTimeout(frameTimer);
    el.frameError.hidden = true;
    el.frame.style.visibility = "hidden";
    el.frameLoading.style.display = "flex";
    el.frame.onload = function () {
      clearTimeout(frameTimer);
      el.frameLoading.style.display = "none";
      el.frame.style.visibility = "visible";
    };
    el.frame.src = url;
    // ถ้าไม่โหลดใน 9 วินาที (อาจถูกบล็อกไม่ให้ฝัง iframe หรือช้า) → แสดงทางเลือก
    frameTimer = setTimeout(function () {
      el.frameLoading.style.display = "none";
      el.frameError.hidden = false;
    }, 9000);
  }

  if (el.errRetry) {
    el.errRetry.addEventListener("click", function () {
      if (currentGameUrl) loadGameFrame(currentGameUrl);
    });
  }

  function openModal(g, pushHistory) {
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
    if (el.errOpenNew) el.errOpenNew.href = g.url;
    el.copyLink.dataset.url = g.url;
    el.copyLink.textContent = "🔗 คัดลอกลิงก์";
    el.frame.title = "พรีวิวเกม " + g.title;

    loadGameFrame(g.url);

    modalOpener = document.activeElement;
    el.modal.hidden = false;
    document.body.classList.add("modal-open");
    backgroundInert(true);

    // ย้าย focus เข้า dialog (ปุ่มปิด)
    const closeBtn = el.modal.querySelector(".icon-btn[data-close]");
    if (closeBtn) closeBtn.focus();

    if (pushHistory && history.pushState) {
      history.pushState({ modal: g.id }, "", "#game=" + encodeURIComponent(g.id));
    } else if (history.replaceState) {
      history.replaceState({ modalInitial: g.id }, "", "#game=" + encodeURIComponent(g.id));
    }
  }

  // ปิดจริง (คืนสถานะทุกอย่าง) — ไม่ยุ่งกับ history
  function hideModal() {
    if (el.modal.hidden) return;
    clearTimeout(frameTimer);
    el.modal.hidden = true;
    el.frame.onload = null;
    el.frame.src = "about:blank";
    el.frameError.hidden = true;
    el.frameLoading.style.display = "none";
    document.body.classList.remove("modal-open");
    backgroundInert(false);
    if (modalOpener && typeof modalOpener.focus === "function") {
      modalOpener.focus();
    }
    modalOpener = null;
  }

  // ปิดจากการกดปุ่ม/Escape/backdrop → ถ้ามี state ที่ push ไว้ ให้ย้อน history (Back จะปิดเอง)
  function closeModal() {
    if (history.state && history.state.modal) {
      history.back();
    } else {
      hideModal();
      if (history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    }
  }

  // ---------- Events ----------
  el.search.addEventListener("input", function () {
    state.search = el.search.value;
    render();
    writeFiltersToUrl();
  });

  el.clearFilters.addEventListener("click", function () {
    state.subject = null;
    state.grade = null;
    state.search = "";
    el.search.value = "";
    syncChips();
    render();
    writeFiltersToUrl();
  });

  el.modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (el.modal.hidden) return;
    if (e.key === "Escape") closeModal();
    else if (e.key === "Tab") trapTab(e, el.modal.querySelector(".modal-panel"));
  });

  // Back/Forward: ปิดโมดัลเมื่อ history ย้อนออกจาก state ของโมดัล
  window.addEventListener("popstate", function () {
    if (!el.modal.hidden) hideModal();
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
    const m = location.hash.match(/game=([^&]+)/);
    if (m) {
      const key = decodeURIComponent(m[1]);
      const g = findGame(key);
      if (g && el.modal.hidden) openModal(g, false);
    }
  }

  // รองรับการเปลี่ยน hash ระหว่างใช้งาน (แชร์ลิงก์/ปุ่ม back-forward)
  window.addEventListener("hashchange", openFromHash);

  // ---------- ป๊อปอัปประกาศ (announcement.js) ----------
  function announceSignature(a) {
    // ลายเซ็นข้อความ ใช้เช็คว่าเปลี่ยนไหม (ถ้าเปลี่ยนจะแสดงใหม่แม้เคยกดไม่แสดงอีก)
    return (a.title || "") + "" + (a.message || "");
  }

  function announceDismissed(sig) {
    try { return localStorage.getItem("gamehub_announce_dismissed") === sig; }
    catch (e) { return false; }
  }
  function rememberDismiss(sig) {
    try { localStorage.setItem("gamehub_announce_dismissed", sig); } catch (e) { /* ignore */ }
  }

  function showAnnouncement() {
    const a = window.ANNOUNCEMENT;
    if (!a || !a.enabled || !(a.message || a.title)) return;
    const sig = announceSignature(a);
    if (announceDismissed(sig)) return;

    if (a.important) showAnnounceDialog(a, sig);
    else showAnnounceBanner(a, sig);
  }

  // ประกาศทั่วไป → แถบด้านบน ไม่บล็อกการใช้งาน (ปิดแล้วจำไว้จนกว่าข้อความจะเปลี่ยน)
  function showAnnounceBanner(a, sig) {
    const banner = document.createElement("div");
    banner.className = "announce-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "ประกาศ");
    const msgHtml = escapeHtml(a.message || "").replace(/\n/g, "<br>");
    banner.innerHTML =
      '<div class="announce-banner-inner">' +
        '<span class="announce-banner-icon" aria-hidden="true">📢</span>' +
        '<div class="announce-banner-text">' +
          (a.title ? '<strong>' + escapeHtml(a.title) + "</strong> " : "") + msgHtml +
        "</div>" +
        '<button type="button" class="announce-banner-close" aria-label="ปิดประกาศ">✕</button>' +
      "</div>";
    banner.querySelector(".announce-banner-close").addEventListener("click", function () {
      rememberDismiss(sig);
      banner.remove();
    });
    const header = document.querySelector(".site-header");
    if (header && header.parentNode) header.parentNode.insertBefore(banner, header.nextSibling);
    else document.body.insertBefore(banner, document.body.firstChild);
  }

  // ประกาศสำคัญ → กล่องกลางจอ (บล็อก) พร้อมจัดการ focus เต็มรูปแบบ
  function showAnnounceDialog(a, sig) {
    const opener = document.activeElement;
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
    const box = overlay.querySelector(".announce-box");

    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "Tab") trapTab(e, box);
    }
    function close() {
      const hide = overlay.querySelector("#announceHide");
      if (hide && hide.checked) rememberDismiss(sig);
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      document.body.classList.remove("modal-open");
      backgroundInert(false);
      if (opener && typeof opener.focus === "function") opener.focus();
    }

    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".announce-close").addEventListener("click", close);
    overlay.querySelector(".announce-ok").addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    backgroundInert(true);
    overlay.querySelector(".announce-close").focus();
  }

  // ---------- Init ----------
  readFiltersFromUrl();
  buildChips(el.subjectChips, uniqueSubjects(), "subject");
  buildChips(el.gradeChips, uniqueGrades(), "grade");
  syncChips();
  render();
  openFromHash();
  showAnnouncement();
})();
