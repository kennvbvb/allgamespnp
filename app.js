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

  // สถานะตัวกรอง (null = ทั้งหมด) + การจัดเรียง ("" = ตามลำดับในไฟล์) + มุมมอง ("" | "fav" | "recent")
  const state = { subject: null, grade: null, tag: null, search: "", sort: "", view: "" };

  // ---------- DOM ----------
  const el = {
    grid: document.getElementById("gameGrid"),
    subjectChips: document.getElementById("subjectChips"),
    gradeChips: document.getElementById("gradeChips"),
    tagChips: document.getElementById("tagChips"),
    tagFilterGroup: document.getElementById("tagFilterGroup"),
    search: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
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
    favToggle: document.getElementById("favToggle"),
    viewFav: document.getElementById("viewFav"),
    viewRecent: document.getElementById("viewRecent"),
    installBtn: document.getElementById("installBtn"),
  };

  // ---------- รายการโปรด + เล่นล่าสุด (เก็บใน localStorage ต่อเครื่อง) ----------
  const LS_FAV = "gamehub_favorites";
  const LS_RECENT = "gamehub_recent";
  function lsGet(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; } }
  function lsSet(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* ignore */ } }
  function isFavorite(id) { return lsGet(LS_FAV).indexOf(id) !== -1; }
  function toggleFavorite(id) {
    const favs = lsGet(LS_FAV);
    const i = favs.indexOf(id);
    if (i === -1) favs.push(id); else favs.splice(i, 1);
    lsSet(LS_FAV, favs);
    return i === -1; // true = เพิ่งเพิ่ม
  }
  function pushRecent(id) {
    let r = lsGet(LS_RECENT).filter(function (x) { return x !== id; });
    r.unshift(id);
    r = r.slice(0, 8);
    lsSet(LS_RECENT, r);
  }

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

  function uniqueTags() {
    const set = new Set();
    games.forEach(function (g) {
      if (Array.isArray(g.tags)) g.tags.forEach(function (t) { if (t) set.add(t); });
    });
    return Array.from(set).sort(function (a, b) {
      return a.localeCompare(b, "th");
    });
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
    document.querySelectorAll("#tagChips .chip").forEach(function (c) {
      const on = state.tag === c.dataset.value;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
    [["fav", el.viewFav], ["recent", el.viewRecent]].forEach(function (pair) {
      if (!pair[1]) return;
      const on = state.view === pair[0];
      pair[1].classList.toggle("active", on);
      pair[1].setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // ---------- Sync ตัวกรอง/ค้นหา/เรียง กับ URL (refresh/แชร์ผลลัพธ์ได้) ----------
  function readFiltersFromUrl() {
    const p = new URLSearchParams(location.search);
    state.subject = p.get("subject") || null;
    state.grade = p.get("grade") || null;
    state.tag = p.get("tag") || null;
    state.search = p.get("q") || "";
    state.sort = p.get("sort") || "";
    state.view = p.get("view") || "";
    if (el.search) el.search.value = state.search;
    if (el.sortSelect) el.sortSelect.value = state.sort;
  }

  function writeFiltersToUrl() {
    const p = new URLSearchParams();
    if (state.subject) p.set("subject", state.subject);
    if (state.grade) p.set("grade", state.grade);
    if (state.tag) p.set("tag", state.tag);
    if (state.search.trim()) p.set("q", state.search.trim());
    if (state.sort) p.set("sort", state.sort);
    if (state.view) p.set("view", state.view);
    const qs = p.toString();
    const url = location.pathname + (qs ? "?" + qs : "") + location.hash;
    if (history.replaceState) history.replaceState(history.state, "", url);
  }

  // ---------- Filter + Sort ----------
  function filteredGames() {
    const q = state.search.trim().toLowerCase();
    let list = games.filter(function (g) {
      if (state.subject && g.subject !== state.subject) return false;
      if (state.grade && g.grades.indexOf(state.grade) === -1) return false;
      if (state.tag && (!Array.isArray(g.tags) || g.tags.indexOf(state.tag) === -1)) return false;
      if (q) {
        const hay = (g.title + " " + (g.description || "") + " " + g.subject +
          " " + (g.topic || "") + " " + (g.tags ? g.tags.join(" ") : "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (state.view === "fav") {
      const favs = lsGet(LS_FAV);
      list = list.filter(function (g) { return favs.indexOf(g.id) !== -1; });
    } else if (state.view === "recent") {
      const r = lsGet(LS_RECENT);
      list = list.filter(function (g) { return r.indexOf(g.id) !== -1; });
      list.sort(function (a, b) { return r.indexOf(a.id) - r.indexOf(b.id); });
      return list; // ลำดับ "เล่นล่าสุด" มาก่อน sort
    }
    return sortGames(list);
  }

  function sortGames(list) {
    const arr = list.slice();
    if (state.sort === "name") {
      arr.sort(function (a, b) { return a.title.localeCompare(b.title, "th"); });
    } else if (state.sort === "new") {
      arr.sort(function (a, b) { return String(b.added || "").localeCompare(String(a.added || "")); });
    } else if (state.sort === "recommended") {
      const rank = function (g) { return g.badge === "แนะนำ" ? 0 : 1; };
      arr.sort(function (a, b) { return rank(a) - rank(b); });
    }
    return arr; // "" = คงลำดับเดิมในไฟล์
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
      // accessible name รวมวิชา/ระดับชั้น เพื่อให้ screen reader ได้บริบท
      card.setAttribute("aria-label",
        "เปิดเกม " + g.title + " — " + (g.subject || "") + " " + g.grades.join(" "));

      const gradeTags = g.grades
        .map(function (gr) {
          return '<span class="tag tag-grade">' + escapeHtml(gr) + "</span>";
        })
        .join("");

      const descHtml = (g.description && g.description.trim())
        ? '<p class="card-desc">' + escapeHtml(g.description) + "</p>"
        : "";

      // รูปปก (ถ้ามีและเป็น https) ไม่งั้น emoji
      const media = (g.cover && /^https:\/\//i.test(g.cover))
        ? '<span class="card-media"><img src="' + escapeHtml(g.cover) + '" alt="" loading="lazy" /></span>'
        : '<span class="card-emoji" aria-hidden="true">' + escapeHtml(g.emoji) + "</span>";

      const badge = g.badge
        ? '<span class="card-badge">' + escapeHtml(g.badge) + "</span>"
        : "";

      const metaBits = [];
      if (g.minutes) metaBits.push("⏱ " + escapeHtml(String(g.minutes)) + " นาที");
      if (g.mode) metaBits.push("👥 " + escapeHtml(g.mode));
      const metaHtml = metaBits.length
        ? '<div class="card-meta">' + metaBits.map(function (b) { return "<span>" + b + "</span>"; }).join("") + "</div>"
        : "";

      card.innerHTML =
        badge +
        media +
        '<h3 class="card-title">' + escapeHtml(g.title) + "</h3>" +
        descHtml +
        metaHtml +
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
    if (list.length === 0) {
      if (state.view === "fav") el.emptyState.textContent = "💛 ยังไม่มีเกมโปรด — กดการ์ดเกมแล้วกด “เพิ่มในโปรด” ในหน้าต่างเกม";
      else if (state.view === "recent") el.emptyState.textContent = "🕘 ยังไม่มีเกมที่เพิ่งเล่น";
      else el.emptyState.textContent = "😅 ไม่พบเกมที่ตรงกับเงื่อนไข ลองล้างตัวกรองดูนะ";
    }
    const hasFilter = state.subject || state.grade || state.tag || state.search.trim() || state.view;
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

  // นับจำนวน dialog ที่เปิดซ้อนกัน (โมดัลเกม + ป๊อปอัปประกาศ)
  // ปลดล็อกพื้นหลัง (modal-open + inert) เฉพาะตอนไม่มี dialog เหลือแล้ว
  // แก้บั๊ก: เปิด deep link พร้อมประกาศสำคัญ แล้วปิดประกาศ ต้องไม่ปลดล็อกโมดัลเกม
  let layerCount = 0;
  function pushLayer() {
    layerCount++;
    document.body.classList.add("modal-open");
    backgroundInert(true);
  }
  function popLayer() {
    layerCount = Math.max(0, layerCount - 1);
    if (layerCount === 0) {
      document.body.classList.remove("modal-open");
      backgroundInert(false);
    }
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
  let currentModalGame = null;

  function updateFavButton() {
    if (!el.favToggle || !currentModalGame) return;
    const fav = isFavorite(currentModalGame.id);
    el.favToggle.textContent = fav ? "❤️ อยู่ในโปรด" : "🤍 เพิ่มในโปรด";
    el.favToggle.setAttribute("aria-pressed", fav ? "true" : "false");
    el.favToggle.classList.toggle("is-fav", fav);
  }
  if (el.favToggle) {
    el.favToggle.addEventListener("click", function () {
      if (!currentModalGame) return;
      toggleFavorite(currentModalGame.id);
      updateFavButton();
      if (state.view === "fav") render(); // อัปเดตกริดถ้ากำลังดูเฉพาะโปรด
    });
  }

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
        .join("") +
      (Array.isArray(g.tags) ? g.tags.map(function (t) {
        return '<span class="tag tag-topic">#' + escapeHtml(t) + "</span>";
      }).join("") : "");

    el.openFull.href = g.url;
    if (el.errOpenNew) el.errOpenNew.href = g.url;
    // ปุ่มคัดลอก = ลิงก์แชร์หน้ารวมเกม (#game=id) ไม่ใช่ URL เกมดิบ
    el.copyLink.dataset.url = location.origin + location.pathname + "#game=" + encodeURIComponent(g.id);
    el.copyLink.textContent = "🔗 คัดลอกลิงก์แชร์";
    el.frame.title = "พรีวิวเกม " + g.title;

    currentModalGame = g;
    pushRecent(g.id);
    updateFavButton();

    loadGameFrame(g.url);

    modalOpener = document.activeElement;
    el.modal.hidden = false;
    pushLayer();

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
    popLayer();
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

  if (el.sortSelect) {
    el.sortSelect.addEventListener("change", function () {
      state.sort = el.sortSelect.value;
      render();
      writeFiltersToUrl();
    });
  }

  function toggleView(v) {
    state.view = state.view === v ? "" : v;
    syncChips();
    render();
    writeFiltersToUrl();
  }
  if (el.viewFav) el.viewFav.addEventListener("click", function () { toggleView("fav"); });
  if (el.viewRecent) el.viewRecent.addEventListener("click", function () { toggleView("recent"); });

  el.clearFilters.addEventListener("click", function () {
    state.subject = null;
    state.grade = null;
    state.tag = null;
    state.search = "";
    state.view = "";
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
        el.copyLink.textContent = "🔗 คัดลอกลิงก์แชร์";
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
    // ถ้ามีโมดัลเกมเปิดอยู่ข้างใต้ (เช่นมาจาก deep link) ให้กัก focus ไม่ให้หลุดเข้าไป
    const gameModalOpen = !el.modal.hidden;
    if (gameModalOpen) { el.modal.setAttribute("inert", ""); el.modal.setAttribute("aria-hidden", "true"); }

    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "Tab") trapTab(e, box);
    }
    function close() {
      const hide = overlay.querySelector("#announceHide");
      if (hide && hide.checked) rememberDismiss(sig);
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (gameModalOpen) { el.modal.removeAttribute("inert"); el.modal.removeAttribute("aria-hidden"); }
      popLayer(); // ปลดล็อกพื้นหลังเฉพาะเมื่อไม่มี dialog เหลือ (โมดัลเกมอาจยังเปิด)
      // คืน focus: ถ้าโมดัลเกมยังเปิด กลับไปที่ปุ่มปิดของมัน ไม่งั้นกลับไป opener
      if (gameModalOpen) {
        const cb = el.modal.querySelector(".icon-btn[data-close]");
        if (cb) cb.focus();
      } else if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
    }

    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".announce-close").addEventListener("click", close);
    overlay.querySelector(".announce-ok").addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);
    pushLayer();
    overlay.querySelector(".announce-close").focus();
  }

  // ---------- SEO: JSON-LD ItemList (สร้างจากรายชื่อเกม) ----------
  function injectJsonLd() {
    try {
      const data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "รวมเกมการศึกษา",
        "numberOfItems": games.length,
        "itemListElement": games.map(function (g, i) {
          return { "@type": "ListItem", "position": i + 1, "name": g.title };
        }),
      };
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
    } catch (e) { /* ignore */ }
  }

  // ---------- PWA: ลงทะเบียน service worker + ปุ่มเพิ่มลงจอโฮม ----------
  function initPwa() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("service-worker.js").catch(function () { /* เงียบไว้ */ });
      });
    }
    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (el.installBtn) el.installBtn.hidden = false;
    });
    if (el.installBtn) {
      el.installBtn.addEventListener("click", function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
          el.installBtn.hidden = true;
        });
      });
    }
    window.addEventListener("appinstalled", function () {
      if (el.installBtn) el.installBtn.hidden = true;
    });
  }

  // ---------- Init ----------
  readFiltersFromUrl();
  buildChips(el.subjectChips, uniqueSubjects(), "subject");
  buildChips(el.gradeChips, uniqueGrades(), "grade");
  const tags = uniqueTags();
  if (el.tagChips) buildChips(el.tagChips, tags, "tag");
  if (el.tagFilterGroup) el.tagFilterGroup.hidden = tags.length === 0;
  syncChips();
  render();
  openFromHash();
  showAnnouncement();
  injectJsonLd();
  initPwa();
})();
