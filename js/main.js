(function () {
  var cfg = window.ECOTERM || {};

  // --- Popuni podatke firme iz config.js ---
  var telDigits = (cfg.tel || "").replace(/[^\d+]/g, "");
  var fill = {
    "tel": cfg.tel,
    "email": cfg.email,
    "area": cfg.area,
    "hours": cfg.hours,
    "company": cfg.company
  };
  Object.keys(fill).forEach(function (key) {
    if (!fill[key]) return;
    document.querySelectorAll('[data-cfg="' + key + '"]').forEach(function (el) {
      el.textContent = fill[key];
    });
  });
  document.querySelectorAll('[data-cfg="tel-link"]').forEach(function (el) {
    if (telDigits) el.href = "tel:" + telDigits;
  });
  document.querySelectorAll('[data-cfg="email-link"]').forEach(function (el) {
    if (cfg.email) el.href = "mailto:" + cfg.email;
  });
  document.querySelectorAll('[data-cfg="instagram-link"]').forEach(function (el) {
    if (cfg.instagram) el.href = cfg.instagram;
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  // --- Header sjena pri skrolanju ---
  var header = document.querySelector(".site-header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // --- Mobilni izbornik ---
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  burger.addEventListener("click", function () {
    var open = document.body.classList.toggle("nav-open");
    burger.setAttribute("aria-expanded", open);
  });
  nav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      document.body.classList.remove("nav-open");
      burger.setAttribute("aria-expanded", "false");
    });
  });

  // --- Termostat: grijanje / hlađenje ---
  var hero = document.querySelector(".hero");
  var ticks = document.querySelector(".dial .ticks");
  for (var i = 0; i < 40; i++) {
    var a = (i / 40) * Math.PI * 2;
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 110 + Math.cos(a) * 100);
    line.setAttribute("y1", 110 + Math.sin(a) * 100);
    line.setAttribute("x2", 110 + Math.cos(a) * (i % 5 ? 104 : 107));
    line.setAttribute("y2", 110 + Math.sin(a) * (i % 5 ? 104 : 107));
    ticks.appendChild(line);
  }

  var tempEl = document.getElementById("dialTemp");
  var labelEl = document.getElementById("dialLabel");
  var modes = {
    heat: { temp: 22, label: "ugodno grijanje" },
    cool: { temp: 24, label: "osvježavajuće hlađenje" }
  };
  var anim;
  function animateTemp(to) {
    cancelAnimationFrame(anim);
    var from = parseFloat(tempEl.textContent) || to;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / 600, 1);
      tempEl.textContent = Math.round(from + (to - from) * p);
      if (p < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }
  function setMode(mode) {
    hero.setAttribute("data-mode", mode);
    document.querySelectorAll(".mode-btn").forEach(function (b) {
      var on = b.getAttribute("data-set-mode") === mode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on);
    });
    animateTemp(modes[mode].temp);
    labelEl.textContent = modes[mode].label;
  }
  var userPicked = false;
  document.querySelectorAll(".mode-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      userPicked = true;
      setMode(b.getAttribute("data-set-mode"));
    });
  });
  // Lagana automatska izmjena dok korisnik sam ne klikne
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    setInterval(function () {
      if (userPicked || document.hidden) return;
      setMode(hero.getAttribute("data-mode") === "heat" ? "cool" : "heat");
    }, 5000);
  }

  // --- Pojavljivanje pri skrolanju ---
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  // --- Galerija radova: filteri ---
  var gItems = Array.prototype.slice.call(document.querySelectorAll(".g-item"));
  document.querySelectorAll(".filter").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-filter");
      document.querySelectorAll(".filter").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      gItems.forEach(function (li) {
        li.hidden = f !== "sve" && li.getAttribute("data-cat") !== f;
      });
    });
  });

  // --- Galerija radova: povećanje slike ---
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCap");
  var lbIndex = 0;
  function visibleItems() { return gItems.filter(function (li) { return !li.hidden; }); }
  function showItem(li) {
    var btn = li.querySelector(".g-btn");
    var img = btn.querySelector("img");
    lbImg.src = btn.getAttribute("data-full");
    lbImg.alt = img.alt;
    lbCap.innerHTML = btn.querySelector(".g-cap").innerHTML;
  }
  function step(dir) {
    var list = visibleItems();
    lbIndex = (lbIndex + dir + list.length) % list.length;
    showItem(list[lbIndex]);
  }
  gItems.forEach(function (li) {
    li.querySelector(".g-btn").addEventListener("click", function () {
      lbIndex = visibleItems().indexOf(li);
      showItem(li);
      if (lb.showModal) lb.showModal(); else lb.setAttribute("open", "");
    });
  });
  lb.addEventListener("click", function (e) {
    var action = e.target.getAttribute("data-lb");
    if (action === "close" || e.target === lb) lb.close();
    else if (action === "prev") step(-1);
    else if (action === "next") step(1);
  });
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  var touchX = null;
  lb.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });

  // --- Obrazac: otvara e-mail s ispunjenim upitom (GitHub Pages nema backend) ---
  var form = document.getElementById("contactForm");
  var note = document.getElementById("formNote");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ime = form.ime.value.trim();
    var tel = form.telefon.value.trim();
    if (!ime || !tel) {
      note.textContent = "Molimo upišite ime i telefon.";
      note.classList.add("is-error");
      (!ime ? form.ime : form.telefon).focus();
      return;
    }
    note.classList.remove("is-error");
    var usluge = Array.prototype.map.call(
      form.querySelectorAll('input[name="usluga"]:checked'),
      function (c) { return c.value; }
    ).join(", ");
    var body =
      "Ime i prezime: " + ime + "\n" +
      "Telefon: " + tel + "\n" +
      "Mjesto: " + form.mjesto.value.trim() + "\n" +
      "Zanima me: " + (usluge || "-") + "\n\n" +
      form.poruka.value.trim();
    var subject = "Upit s web stranice" + (usluge ? " – " + usluge : "");
    window.location.href = "mailto:" + (cfg.email || "") +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    note.textContent = "Otvara se vaš e-mail program – samo kliknite Pošalji.";
  });
})();
