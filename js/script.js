(function () {
  "use strict";

  const CONSTANTS = {
    WHATSAPP_NUMBER: "8669048892",
    THROTTLE_MS: 16,
    FORM_DELAY: 1500,
    SUCCESS_TIMEOUT: 5000,
    ANIMATION_DELAY: 300,
    INTERSECTION_THRESHOLD: 0.4,
    MAX_REVIEW_LENGTH: 250,
  };

  const SELECTORS = {
    nav: ".rd-navbar",
    navLinks: ".rd-navbar .nav-link",
    mobileMenuToggle: ".rd-mobile-menu-btn",
    appointmentForm: "#appointment-form",
    blob: "#blob",
    sections: "main section[id]",
    timeSlots: ".time-slot",
    submitBtn: "#submit-btn",
    successMessage: "#success-message",
    glassForm: ".glass-form",
    errorMessages: ".error-message",
  };

  const utils = {
    throttle(func, limit) {
      let inThrottle;
      return (...args) => {
        if (!inThrottle) {
          func(...args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    },

    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
  };

  const App = {
    elements: {},
    state: {
      selectedTime: "",
      isSubmitting: false,
    },
    observers: new Set(),

    init() {
      this.initAOS();
      this.cacheElements();
      this.bindEvents();
      this.initIntersectionObserver();
      this.initAppointmentForm();
      this.initFormAnimations();
    },

    initAOS() {
      if (typeof AOS !== "undefined") {
        AOS.init({
          duration: 800,
          easing: "ease-in-out",
          once: true,
          mirror: false,
        });
      }
    },

    cacheElements() {
      const cache = {};
      const multipleSelectors = [
        "navLinks",
        "sections",
        "timeSlots",
        "errorMessages",
      ];

      Object.entries(SELECTORS).forEach(([key, selector]) => {
        cache[key] = multipleSelectors.includes(key)
          ? document.querySelectorAll(selector)
          : document.querySelector(selector);
      });

      this.elements = cache;
    },

    bindEvents() {
      this.bindBlobMovement();
      this.initMobileMenuSystem();
      this.bindSmoothScroll();
    },

    bindBlobMovement() {
      if (!this.elements.blob) return;

      const moveBlob = utils.throttle((event) => {
        this.elements.blob.animate(
          {
            left: `${event.clientX}px`,
            top: `${event.clientY}px`,
          },
          {
            duration: 3000,
            fill: "forwards",
          }
        );
      }, CONSTANTS.THROTTLE_MS);

      window.addEventListener("pointermove", moveBlob, { passive: true });
    },

    initMobileMenuSystem() {
      const nav = document.querySelector(".rd-navbar");
      if (!nav) return;

      const navLinks = document.querySelectorAll(
        ".rd-navbar .nav-links a, .rd-navbar .nav-links .book-now-btn"
      );
      const mobileMenu = document.createElement("nav");
      mobileMenu.className = "mobile-menu";
      mobileMenu.setAttribute("aria-label", "Mobile Navigation");
      mobileMenu.setAttribute("tabindex", "-1");

      const closeBtn = document.createElement("button");
      closeBtn.className = "mobile-menu-close";
      closeBtn.setAttribute("aria-label", "Close menu");
      closeBtn.innerHTML = "&times;";

      const items = document.createElement("div");
      items.className = "mobile-menu-items";
      navLinks.forEach((link) => {
        const clone = link.cloneNode(true);
        clone.tabIndex = 0;
        items.appendChild(clone);
      });

      mobileMenu.appendChild(closeBtn);
      mobileMenu.appendChild(items);

      const overlay = document.createElement("div");
      overlay.className = "mobile-menu-overlay";
      overlay.tabIndex = -1;

      nav.parentNode.insertBefore(mobileMenu, nav.nextSibling);
      nav.parentNode.insertBefore(overlay, mobileMenu.nextSibling);

      this.elements.mobileMenu = mobileMenu;
      this.elements.mobileMenuOverlay = overlay;
      this.elements.mobileMenuClose = closeBtn;
      this.elements.mobileMenuItems = items;

      const hamburger = document.getElementById("mobile-menu-toggle");
      if (hamburger) {
        hamburger.addEventListener("click", (e) => {
          e.preventDefault();
          this.openMobileMenu();
        });
      }

      closeBtn.addEventListener("click", () => this.closeMobileMenu());
      overlay.addEventListener("click", () => this.closeMobileMenu());

      document.addEventListener("mousedown", (e) => {
        if (
          this.isMobileMenuOpen() &&
          !mobileMenu.contains(e.target) &&
          !hamburger.contains(e.target)
        ) {
          this.closeMobileMenu();
        }
      });

      this._mobileMenuKeyHandler = (e) => {
        if (!this.isMobileMenuOpen()) return;
        if (e.key === "Escape") {
          e.preventDefault();
          this.closeMobileMenu();
        } else if (e.key === "Tab") {
          const focusable = Array.from(
            mobileMenu.querySelectorAll("a, button:not([disabled])")
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };
      document.addEventListener("keydown", this._mobileMenuKeyHandler);

      items.addEventListener("click", (e) => {
        if (
          e.target.tagName === "A" ||
          e.target.classList.contains("book-now-btn")
        ) {
          this.closeMobileMenu();
        }
      });
    },

    openMobileMenu() {
      if (!this.elements.mobileMenu) return;
      this.elements.mobileMenu.classList.add("open");
      this.elements.mobileMenuOverlay.classList.add("active");
      document.body.classList.add("menu-open");
      const hamburger = document.getElementById("mobile-menu-toggle");
      if (hamburger) {
        hamburger.setAttribute("aria-expanded", "true");
      }
      setTimeout(() => {
        const firstLink =
          this.elements.mobileMenuItems.querySelector("a, button");
        if (firstLink) firstLink.focus();
      }, 10);
    },

    closeMobileMenu() {
      if (!this.elements.mobileMenu) return;
      this.elements.mobileMenu.classList.remove("open");
      this.elements.mobileMenuOverlay.classList.remove("active");
      document.body.classList.remove("menu-open");
      const hamburger = document.getElementById("mobile-menu-toggle");
      if (hamburger) {
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.focus();
      }
    },

    isMobileMenuOpen() {
      return (
        this.elements.mobileMenu &&
        this.elements.mobileMenu.classList.contains("open")
      );
    },

    bindSmoothScroll() {
      document.addEventListener("click", (e) => {
        const anchor = e.target.closest('a[href^="#"]');
        if (!anchor) return;

        e.preventDefault();
        const targetId = anchor.getAttribute("href");
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    },

    initAppointmentForm() {
      if (!this.elements.appointmentForm) return;

      this.setupDateInput();
      this.setupTimeSlots();
      this.setupFormValidation();
      this.setupFormSubmission();
    },

    setupDateInput() {
      const dateInput = this.elements.appointmentForm.querySelector("#date");
      if (dateInput) {
        dateInput.min = new Date().toISOString().split("T")[0];
      }
    },

    setupTimeSlots() {
      if (!this.elements.timeSlots) return;

      this.elements.appointmentForm.addEventListener("click", (e) => {
        const slot = e.target.closest(".time-slot");
        if (!slot) return;

        e.preventDefault();

        this.elements.timeSlots.forEach((s) => s.classList.remove("selected"));
        slot.classList.add("selected");
        this.state.selectedTime = slot.dataset.time;
        this.hideError("time-error");
      });
    },

    setupFormValidation() {
      const validators = {
        name: (value) => value.trim().length > 0,
        phone: (value) => /^[\+]?[\d\s\-\(\)]{10,}$/.test(value.trim()),
        date: (value) => !!value,
      };

      Object.entries(validators).forEach(([field, validator]) => {
        const input = document.getElementById(field);
        if (!input) return;

        const eventType = field === "date" ? "change" : "input";
        input.addEventListener(eventType, () => {
          if (validator(input.value)) {
            this.hideError(`${field}-error`);
          }
        });
      });
    },

    setupFormSubmission() {
      this.elements.appointmentForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (this.state.isSubmitting || !this.validateForm()) return;

        this.state.isSubmitting = true;

        try {
          await this.handleFormSubmission();
        } finally {
          this.state.isSubmitting = false;
        }
      });
    },

    async handleFormSubmission() {
      const formData = this.getFormData();
      const submitBtn = this.elements.submitBtn;
      const originalText = submitBtn.innerHTML;

      submitBtn.innerHTML = '<div class="loading"></div> Sending...';
      submitBtn.disabled = true;

      try {
        await utils.delay(CONSTANTS.FORM_DELAY);

        const message = this.formatWhatsAppMessage(formData);
        const whatsappURL = `https://wa.me/${
          CONSTANTS.WHATSAPP_NUMBER
        }?text=${encodeURIComponent(message)}`;

        this.showSuccessMessage();
        window.open(whatsappURL, "_blank");
        this.resetForm();
      } catch (error) {
        console.error("Form submission error:", error);
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    },

    getFormData() {
      return {
        name: document.getElementById("name")?.value.trim() || "",
        phone: document.getElementById("phone")?.value.trim() || "",
        date: document.getElementById("date")?.value || "",
        time: this.state.selectedTime,
      };
    },

    formatWhatsAppMessage({ name, phone, date, time }) {
      const formattedDate = utils.formatDate(date);
      return `🏥 *Appointment Request*\n\n👤 *Name:* ${name}\n📱 *Phone:* ${phone}\n📅 *Date:* ${formattedDate}\n🕒 *Time:* ${time}\n\nPlease confirm my appointment. Thank you!`;
    },

    validateForm() {
      const formData = this.getFormData();
      let isValid = true;

      this.elements.errorMessages?.forEach(
        (error) => (error.style.display = "none")
      );

      const validations = [
        { condition: !formData.name, error: "name-error" },
        {
          condition:
            !formData.phone || !/^[\+]?[\d\s\-\(\)]{10,}$/.test(formData.phone),
          error: "phone-error",
        },
        { condition: !formData.date, error: "date-error" },
        { condition: !formData.time, error: "time-error" },
      ];

      validations.forEach(({ condition, error }) => {
        if (condition) {
          this.showError(error);
          isValid = false;
        }
      });

      return isValid;
    },

    showError(errorId) {
      const errorElement = document.getElementById(errorId);
      if (errorElement) errorElement.style.display = "block";
    },

    hideError(errorId) {
      const errorElement = document.getElementById(errorId);
      if (errorElement) errorElement.style.display = "none";
    },

    showSuccessMessage() {
      if (!this.elements.successMessage) return;

      this.elements.successMessage.style.display = "block";
      setTimeout(() => {
        this.elements.successMessage.style.display = "none";
      }, CONSTANTS.SUCCESS_TIMEOUT);
    },

    resetForm() {
      this.elements.appointmentForm.reset();
      this.elements.timeSlots?.forEach((slot) =>
        slot.classList.remove("selected")
      );
      this.state.selectedTime = "";
    },

    initFormAnimations() {
      const animateForm = () => {
        const glassForm = this.elements.glassForm;
        if (!glassForm) return;

        glassForm.style.cssText = "opacity: 0; transform: translateY(30px);";

        setTimeout(() => {
          glassForm.style.cssText = `
            opacity: 1; 
            transform: translateY(0); 
            transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          `;
        }, CONSTANTS.ANIMATION_DELAY);
      };

      if (document.readyState === "complete") {
        animateForm();
      } else {
        window.addEventListener("load", animateForm, { once: true });
      }
    },

    initIntersectionObserver() {
      if (!this.elements.sections?.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.isIntersecting &&
              entry.intersectionRatio > CONSTANTS.INTERSECTION_THRESHOLD
            ) {
              const id = entry.target.id;
              const navLink = document.querySelector(
                `.rd-navbar .nav-links a[href="#${id}"]`
              );

              this.elements.navLinks?.forEach((link) =>
                link.classList.remove("active")
              );
              navLink?.classList.add("active");
            }
          });
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: CONSTANTS.INTERSECTION_THRESHOLD,
        }
      );

      this.elements.sections.forEach((section) => observer.observe(section));
      this.observers.add(observer);
    },

    destroy() {
      this.observers.forEach((observer) => observer.disconnect());
      this.observers.clear();
    },
  };

  function initialize() {
    App.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  window.addEventListener("beforeunload", () => {
    App.destroy?.();
  });

  const testimonials = [
    {
      name: "Komalpreet Kaur",
      stars: 5,
      review:
        "I had an amazing experience at Rain Dental Clinic! I got implants done by Dr. Anjali, and she was incredibly professional, thorough, and kind throughout the entire process. She took the time to explain every step...",
    },
    {
      name: "Bhakti Dhuri",
      stars: 5,
      review:
        "Had a great experience at Rain Dental clinic. The staff was friendly, and Dr. Anjali was professional and thorough. She explained everything clearly and made me feel comfortable.",
    },
    {
      name: "Mira Rajput",
      stars: 5,
      review:
        "I recently visited this clinic and I couldn't be more satisfied. From the moment I walked in, I was greeted warmly by the staff who were professional and efficient in handling my appointment.",
    },
    {
      name: "Juweriya Imran",
      stars: 5,
      review:
        "Rain Dental by Dr. Anjali is a game-changer! From painless treatments to smile makeovers, her expertise in implants and smile designing is exceptional. The clinic is modern and hygienic.",
    },
    {
      name: "Akshatha Patil",
      stars: 5,
      review:
        "Halfway through my treatment at Rain dental clinic for implants, bridges and crowns—excellent service. Now finished, I'm really happy with the result. Highly recommended!",
    },
    {
      name: "Harshita Raj",
      stars: 5,
      review:
        "I had a wonderful experience. The dentist and staff were kind, professional, and made me feel at ease. The treatment was painless and clearly explained. Highly recommend!",
    },
    {
      name: "Sukhnoor Kaur",
      stars: 5,
      review:
        "Extremely comfortable experience. Staff is very welcoming, polite and helpful. Dr. Anjali made me feel at ease and was very professional throughout. Highly recommend!",
    },
    {
      name: "Vaishnavi Kubal",
      stars: 5,
      review:
        "Had a wonderful experience at Rain Dental clinic. I got my smile designing done with Dr Anjali—she's really the best! Would highly recommend Rain Dental clinic.",
    },
    {
      name: "Simran Kapoor",
      stars: 5,
      review:
        "I had a great experience!! Dr. Anjali did my smile designing and I love the results. The staff was super friendly and made me feel comfortable.",
    },
    {
      name: "Avinash Jha",
      stars: 5,
      review:
        "I would like to thank Dr. Anjali for taking care of all the dental problems my family faced. She is polite, professional, and a one-stop solution for dental needs.",
    },
    {
      name: "Aditi Banerjee",
      stars: 5,
      review:
        "Dr. Anjali is very good at her job. She listens patiently and provides efficient solutions. I've recommended her to all my friends and family.",
    },
    {
      name: "Apurva Jha",
      stars: 5,
      review:
        "Got my root canal done and my sister's smile designing also was done by Dr Anjali. It was a nice experience.",
    },
    {
      name: "Shreya Singh",
      stars: 5,
      review:
        "The staff was friendly and attentive, and the clinic was clean and well-organized. The doctor listened and explained everything clearly. Highly recommended.",
    },
    {
      name: "Riya Deb",
      stars: 5,
      review:
        "Excellent staff, professional and painless treatment. Thank you Dr. Anjali for my new smile.",
    },
    {
      name: "Sanjana Sudhakar",
      stars: 5,
      review:
        "Amazing experience! I'm still surprised I had no pain getting my wisdom tooth out. Staff are friendly and accommodating!",
    },
  ];

  const track = document.getElementById("testimonialCarouselTrack");
  const dots = document.getElementById("testimonialCarouselDots");
  const prevBtn = document.querySelector(
    ".testimonial-dots-wrapper .testimonial-nav-prev"
  );
  const nextBtn = document.querySelector(
    ".testimonial-dots-wrapper .testimonial-nav-next"
  );
  let current = 0;
  let autoScroll = null;
  let isTouching = false;
  let startX = 0;
  let deltaX = 0;
  const slideCount = testimonials.length;
  const isMobile = () => window.innerWidth < 768;
  const DOTS_MAX = 5;

  function renderCard(idx) {
    const t = testimonials[idx];
    return `<li class="testimonial-card" tabindex="0" aria-label="Testimonial from ${
      t.name
    }">
      <div class="testimonial-stars">${'<svg class="testimonial-star" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(
        t.stars
      )}</div>
      <blockquote>${t.review}</blockquote>
      <cite>${t.name}</cite>
    </li>`;
  }

  function render() {
    if (!track) return;
    track.innerHTML = renderCard(current);
    renderDots();
    updateButtons();
    track.style.transform = `translate3d(0,0,0)`;
  }

  function renderDots() {
    if (!dots) return;
    let html = "";
    let start = 0;
    let end = slideCount;
    if (slideCount > DOTS_MAX) {
      if (current < Math.floor(DOTS_MAX / 2)) {
        start = 0;
        end = DOTS_MAX;
      } else if (current > slideCount - Math.ceil(DOTS_MAX / 2)) {
        start = slideCount - DOTS_MAX;
        end = slideCount;
      } else {
        start = current - Math.floor(DOTS_MAX / 2);
        end = start + DOTS_MAX;
      }
    }
    for (let i = start; i < end; i++) {
      html += `<button class="testimonial-dot${
        i === current ? " active" : ""
      }" aria-label="Go to testimonial ${
        i + 1
      }" tabindex="0" data-idx="${i}"></button>`;
    }
    dots.innerHTML = html;
    dots.querySelectorAll(".testimonial-dot").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        goTo(parseInt(dot.dataset.idx));
      });
      dot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goTo(parseInt(dot.dataset.idx));
        }
      });
    });
    if (slideCount > DOTS_MAX) {
      const activeDot = dots.querySelector(".active");
      const testimonialSection =
        document.getElementById("testimonials") ||
        document.querySelector(".testimonial-section");
      if (activeDot && testimonialSection) {
        const rect = testimonialSection.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) {
          activeDot.scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: "smooth",
          });
        }
      }
    }
  }

  function animateTo(idx, direction = 1) {
    if (!track) return;
    const oldCard = track.querySelector(".testimonial-card");
    if (oldCard) {
      oldCard.classList.add(direction > 0 ? "anim-out-left" : "anim-out-right");
      setTimeout(() => {
        track.innerHTML = renderCard(idx);
        const newCard = track.querySelector(".testimonial-card");
        newCard.classList.add(direction > 0 ? "anim-in-right" : "anim-in-left");
        void newCard.offsetWidth;
        newCard.classList.remove(
          direction > 0 ? "anim-in-right" : "anim-in-left"
        );
        setTimeout(() => {
          newCard.classList.remove("anim-in-right", "anim-in-left");
        }, 350);
        renderDots();
        updateButtons();
      }, 300);
    } else {
      track.innerHTML = renderCard(idx);
      renderDots();
      updateButtons();
    }
    track.style.transform = `translate3d(0,0,0)`;
  }

  function goTo(idx) {
    const direction = idx > current ? 1 : -1;
    current = idx;
    animateTo(current, direction);
    restartAutoScroll();
  }

  function prev() {
    const nextIdx = (current - 1 + slideCount) % slideCount;
    animateTo(nextIdx, -1);
    current = nextIdx;
    restartAutoScroll();
  }

  function next() {
    const nextIdx = (current + 1) % slideCount;
    animateTo(nextIdx, 1);
    current = nextIdx;
    restartAutoScroll();
  }

  function updateButtons() {
    if (!prevBtn || !nextBtn) return;
    prevBtn.disabled = slideCount <= 1;
    nextBtn.disabled = slideCount <= 1;
    prevBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/></svg>`;
    nextBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor"/></svg>`;
  }

  function restartAutoScroll() {
    if (autoScroll) clearInterval(autoScroll);
    if (!isMobile()) {
      autoScroll = setInterval(next, 5000);
    }
  }

  function stopAutoScroll() {
    if (autoScroll) clearInterval(autoScroll);
    autoScroll = null;
  }

  if (track) {
    track.addEventListener(
      "touchstart",
      (e) => {
        if (isMobile()) {
          isTouching = true;
          startX = e.touches[0].clientX;
          stopAutoScroll();
        }
      },
      { passive: true }
    );
    track.addEventListener(
      "touchmove",
      (e) => {
        if (isTouching) {
          deltaX = e.touches[0].clientX - startX;
        }
      },
      { passive: true }
    );
    track.addEventListener(
      "touchend",
      (e) => {
        if (isTouching) {
          if (deltaX > 50) prev();
          else if (deltaX < -50) next();
          isTouching = false;
          deltaX = 0;
          restartAutoScroll();
        }
      },
      { passive: true }
    );
  }

  if (track) {
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    });
  }

  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);

  window.addEventListener("resize", () => {
    render();
    restartAutoScroll();
  });

  render();
  restartAutoScroll();

  window.addEventListener("beforeunload", stopAutoScroll);

  // --- Testimonial Carousel Modern Upgrade ---
  // 1. Add a progress bar element to the DOM if not present
  const progressBarId = "testimonialCarouselProgress";
  let progressBar = document.getElementById(progressBarId);
  if (!progressBar) {
    progressBar = document.createElement("div");
    progressBar.id = progressBarId;
    progressBar.setAttribute("aria-hidden", "true");
    progressBar.style.position = "absolute";
    progressBar.style.left = "0";
    progressBar.style.right = "0";
    progressBar.style.bottom = "0";
    progressBar.style.height = "4px";
    progressBar.style.background = "rgba(255,255,255,0.12)";
    progressBar.innerHTML =
      '<div class="testimonial-progress-bar-inner"></div>';
    const wrapper = document.querySelector(".testimonial-carousel-wrapper");
    if (wrapper) wrapper.appendChild(progressBar);
  }
  const progressInner = progressBar.querySelector(
    ".testimonial-progress-bar-inner"
  );

  // --- Carousel State ---
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDeltaX = 0;
  let dragDeltaY = 0;
  let dragLastX = 0;
  let dragStartTime = 0;
  let dragVelocity = 0;
  let dragDirection = 0;
  let autoScrollTimeout = null;
  let autoScrollPaused = false;
  const AUTO_SCROLL_INTERVAL = 5000;
  const AUTO_SCROLL_RESUME_DELAY = 2000;

  // --- Helper: Animate Progress Bar ---
  function startProgressBar() {
    if (!progressInner) return;
    progressInner.style.transition = "none";
    progressInner.style.width = "0%";
    setTimeout(() => {
      progressInner.style.transition = `width ${AUTO_SCROLL_INTERVAL}ms linear`;
      progressInner.style.width = "100%";
    }, 20);
  }
  function resetProgressBar() {
    if (!progressInner) return;
    progressInner.style.transition = "none";
    progressInner.style.width = "0%";
  }

  // --- Touch/Mouse Drag Handlers ---
  function onDragStart(e) {
    if (e.type === "touchstart") {
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
    } else {
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("mouseup", onDragEnd);
    }
    isDragging = true;
    dragDeltaX = 0;
    dragDeltaY = 0;
    dragLastX = dragStartX;
    dragStartTime = Date.now();
    dragVelocity = 0;
    dragDirection = 0;
    stopAutoScroll();
    resetProgressBar();
  }
  function onDragMove(e) {
    if (!isDragging) return;
    let x, y;
    if (e.type === "touchmove") {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    dragDeltaX = x - dragStartX;
    dragDeltaY = y - dragStartY;
    dragDirection = Math.abs(dragDeltaX) > Math.abs(dragDeltaY) ? 1 : 0;
    // Only preventDefault if horizontal swipe
    if (dragDirection && Math.abs(dragDeltaX) > 10) {
      e.preventDefault?.();
    }
    // Move slide visually
    if (track) {
      track.style.transition = "none";
      track.style.transform = `translate3d(${dragDeltaX}px,0,0)`;
    }
    dragVelocity = x - dragLastX;
    dragLastX = x;
  }
  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    // Touch angle detection: only swipe if horizontal angle < 30deg
    const angle = Math.abs(
      (Math.atan2(dragDeltaY, dragDeltaX) * 180) / Math.PI
    );
    let shouldSwipe = dragDirection && Math.abs(dragDeltaX) > 40 && angle < 30;
    let momentum = Math.abs(dragVelocity) > 10;
    if (shouldSwipe || momentum) {
      if (dragDeltaX < 0) next();
      else if (dragDeltaX > 0) prev();
    } else {
      // Snap back
      if (track) {
        track.style.transition = "transform 0.4s cubic-bezier(0.4,0,0.2,1)";
        track.style.transform = "translate3d(0,0,0)";
      }
    }
    dragDeltaX = 0;
    dragDeltaY = 0;
    dragVelocity = 0;
    dragDirection = 0;
    if (e.type === "mouseup") {
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup", onDragEnd);
    }
    setTimeout(() => {
      autoScrollPaused = false;
      restartAutoScroll();
      startProgressBar();
    }, AUTO_SCROLL_RESUME_DELAY);
  }

  // --- Auto-Scroll with Pause/Resume ---
  function restartAutoScroll() {
    if (autoScroll) clearInterval(autoScroll);
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
    if (!autoScrollPaused) {
      autoScroll = setInterval(() => {
        next();
        startProgressBar();
      }, AUTO_SCROLL_INTERVAL);
      startProgressBar();
    }
  }
  function stopAutoScroll() {
    if (autoScroll) clearInterval(autoScroll);
    autoScroll = null;
    resetProgressBar();
  }
  function pauseAutoScroll() {
    autoScrollPaused = true;
    stopAutoScroll();
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
  }
  function resumeAutoScroll() {
    autoScrollPaused = false;
    restartAutoScroll();
  }

  // --- Event Listeners ---
  if (track) {
    // Touch events
    track.addEventListener("touchstart", onDragStart, { passive: false });
    track.addEventListener("touchmove", onDragMove, { passive: false });
    track.addEventListener("touchend", onDragEnd, { passive: true });
    // Mouse events
    track.addEventListener("mousedown", onDragStart);
    // Pause/resume on hover/touch
    track.addEventListener("mouseenter", pauseAutoScroll);
    track.addEventListener("mouseleave", () => {
      autoScrollTimeout = setTimeout(
        resumeAutoScroll,
        AUTO_SCROLL_RESUME_DELAY
      );
    });
    track.addEventListener("touchstart", pauseAutoScroll, { passive: false });
    track.addEventListener(
      "touchend",
      () => {
        autoScrollTimeout = setTimeout(
          resumeAutoScroll,
          AUTO_SCROLL_RESUME_DELAY
        );
      },
      { passive: true }
    );
  }

  // --- Accessibility: Keyboard Navigation ---
  if (track) {
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    });
  }
  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);

  window.addEventListener("resize", () => {
    render();
    restartAutoScroll();
  });

  render();
  restartAutoScroll();
  window.addEventListener("beforeunload", stopAutoScroll);

  // --- Infinite Carousel Upgrade ---
  // 1. Clone first and last slides for seamless infinite effect
  function setupInfiniteCarousel() {
    if (!track) return;
    // Remove all children
    while (track.firstChild) track.removeChild(track.firstChild);
    // Clone last, all, first
    const slides = testimonials.map((_, idx) => renderCard(idx));
    const first = slides[0];
    const last = slides[slides.length - 1];
    track.insertAdjacentHTML("beforeend", last); // clone last at start
    slides.forEach((html) => track.insertAdjacentHTML("beforeend", html));
    track.insertAdjacentHTML("beforeend", first); // clone first at end
    // Set initial position
    track.style.transition = "none";
    track.style.transform = `translate3d(-100%,0,0)`;
  }

  let infiniteCurrent = 1; // index in the DOM (1 = first real slide)
  function goToInfinite(idx, animate = true) {
    if (!track) return;
    infiniteCurrent = idx;
    if (animate) {
      track.style.transition = "transform 0.45s cubic-bezier(0.4,0,0.2,1)";
    } else {
      track.style.transition = "none";
    }
    track.style.transform = `translate3d(${-100 * infiniteCurrent}%,0,0)`;
    // After transition, if at clone, jump to real
    setTimeout(
      () => {
        if (infiniteCurrent === 0) {
          track.style.transition = "none";
          infiniteCurrent = slideCount;
          track.style.transform = `translate3d(${-100 * infiniteCurrent}%,0,0)`;
        } else if (infiniteCurrent === slideCount + 1) {
          track.style.transition = "none";
          infiniteCurrent = 1;
          track.style.transform = `translate3d(${-100 * infiniteCurrent}%,0,0)`;
        }
        renderDotsInfinite();
        updateButtons();
      },
      animate ? 460 : 0
    );
  }
  function nextInfinite() {
    goToInfinite(infiniteCurrent + 1, true);
    restartAutoScroll();
  }
  function prevInfinite() {
    goToInfinite(infiniteCurrent - 1, true);
    restartAutoScroll();
  }
  function renderDotsInfinite() {
    if (!dots) return;
    let html = "";
    let start = 0;
    let end = slideCount;
    if (slideCount > DOTS_MAX) {
      if (infiniteCurrent - 1 < Math.floor(DOTS_MAX / 2)) {
        start = 0;
        end = DOTS_MAX;
      } else if (infiniteCurrent - 1 > slideCount - Math.ceil(DOTS_MAX / 2)) {
        start = slideCount - DOTS_MAX;
        end = slideCount;
      } else {
        start = infiniteCurrent - 1 - Math.floor(DOTS_MAX / 2);
        end = start + DOTS_MAX;
      }
    }
    for (let i = start; i < end; i++) {
      html += `<button class="testimonial-dot${
        i === infiniteCurrent - 1 ? " active" : ""
      }" aria-label="Go to testimonial ${
        i + 1
      }" tabindex="0" data-idx="${i}"></button>`;
    }
    dots.innerHTML = html;
    dots.querySelectorAll(".testimonial-dot").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        goToInfinite(parseInt(dot.dataset.idx) + 1, true);
      });
      dot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToInfinite(parseInt(dot.dataset.idx) + 1, true);
        }
      });
    });
  }
  // --- Touch/Mouse Drag for Infinite Carousel ---
  let infiniteDragStartX = 0;
  let infiniteDragStartY = 0;
  let infiniteDragDeltaX = 0;
  let infiniteDragDeltaY = 0;
  let infiniteDragging = false;
  let infiniteDragLastX = 0;
  let infiniteDragVelocity = 0;
  let infiniteDragDirection = 0;
  function onInfiniteDragStart(e) {
    if (e.type === "touchstart") {
      infiniteDragStartX = e.touches[0].clientX;
      infiniteDragStartY = e.touches[0].clientY;
    } else {
      infiniteDragStartX = e.clientX;
      infiniteDragStartY = e.clientY;
      document.addEventListener("mousemove", onInfiniteDragMove);
      document.addEventListener("mouseup", onInfiniteDragEnd);
    }
    infiniteDragging = true;
    infiniteDragDeltaX = 0;
    infiniteDragDeltaY = 0;
    infiniteDragLastX = infiniteDragStartX;
    infiniteDragVelocity = 0;
    infiniteDragDirection = 0;
    stopAutoScroll();
    resetProgressBar();
    if (track) track.classList.add("dragging");
  }
  function onInfiniteDragMove(e) {
    if (!infiniteDragging) return;
    let x, y;
    if (e.type === "touchmove") {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    infiniteDragDeltaX = x - infiniteDragStartX;
    infiniteDragDeltaY = y - infiniteDragStartY;
    infiniteDragDirection =
      Math.abs(infiniteDragDeltaX) > Math.abs(infiniteDragDeltaY) ? 1 : 0;
    // Only preventDefault if horizontal swipe and angle < 30deg
    const angle = Math.abs(
      (Math.atan2(infiniteDragDeltaY, infiniteDragDeltaX) * 180) / Math.PI
    );
    if (
      infiniteDragDirection &&
      Math.abs(infiniteDragDeltaX) > 10 &&
      angle < 30
    ) {
      e.preventDefault?.();
    }
    // Move slide visually
    if (track) {
      track.style.transition = "none";
      track.style.transform = `translate3d(${
        -100 * infiniteCurrent + (infiniteDragDeltaX / track.offsetWidth) * 100
      }%,0,0)`;
    }
    infiniteDragVelocity = x - infiniteDragLastX;
    infiniteDragLastX = x;
  }
  function onInfiniteDragEnd(e) {
    if (!infiniteDragging) return;
    infiniteDragging = false;
    if (track) track.classList.remove("dragging");
    // Touch angle detection: only swipe if horizontal angle < 30deg
    const angle = Math.abs(
      (Math.atan2(infiniteDragDeltaY, infiniteDragDeltaX) * 180) / Math.PI
    );
    let shouldSwipe =
      infiniteDragDirection && Math.abs(infiniteDragDeltaX) > 40 && angle < 30;
    let momentum = Math.abs(infiniteDragVelocity) > 10;
    if (shouldSwipe || momentum) {
      if (infiniteDragDeltaX < 0) nextInfinite();
      else if (infiniteDragDeltaX > 0) prevInfinite();
    } else {
      // Snap back
      if (track) {
        track.style.transition = "transform 0.4s cubic-bezier(0.4,0,0.2,1)";
        track.style.transform = `translate3d(${-100 * infiniteCurrent}%,0,0)`;
      }
    }
    infiniteDragDeltaX = 0;
    infiniteDragDeltaY = 0;
    infiniteDragVelocity = 0;
    infiniteDragDirection = 0;
    if (e.type === "mouseup") {
      document.removeEventListener("mousemove", onInfiniteDragMove);
      document.removeEventListener("mouseup", onInfiniteDragEnd);
    }
    setTimeout(() => {
      autoScrollPaused = false;
      restartAutoScroll();
      startProgressBar();
    }, AUTO_SCROLL_RESUME_DELAY);
  }
  // --- Replace old carousel logic with infinite version ---
  function initInfiniteCarousel() {
    setupInfiniteCarousel();
    goToInfinite(1, false);
    // Touch events
    track.addEventListener("touchstart", onInfiniteDragStart, {
      passive: false,
    });
    track.addEventListener("touchmove", onInfiniteDragMove, { passive: false });
    track.addEventListener("touchend", onInfiniteDragEnd, { passive: true });
    // Mouse events
    track.addEventListener("mousedown", onInfiniteDragStart);
    // Pause/resume on hover/touch
    track.addEventListener("mouseenter", pauseAutoScroll);
    track.addEventListener("mouseleave", () => {
      autoScrollTimeout = setTimeout(
        resumeAutoScroll,
        AUTO_SCROLL_RESUME_DELAY
      );
    });
    track.addEventListener("touchstart", pauseAutoScroll, { passive: false });
    track.addEventListener(
      "touchend",
      () => {
        autoScrollTimeout = setTimeout(
          resumeAutoScroll,
          AUTO_SCROLL_RESUME_DELAY
        );
      },
      { passive: true }
    );
    // Keyboard navigation
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") prevInfinite();
      if (e.key === "ArrowRight") nextInfinite();
    });
    if (prevBtn) prevBtn.addEventListener("click", prevInfinite);
    if (nextBtn) nextBtn.addEventListener("click", nextInfinite);
    window.addEventListener("resize", () => {
      setupInfiniteCarousel();
      goToInfinite(infiniteCurrent, false);
      restartAutoScroll();
    });
    renderDotsInfinite();
    restartAutoScroll = function () {
      if (autoScroll) clearInterval(autoScroll);
      if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
      if (!autoScrollPaused) {
        autoScroll = setInterval(() => {
          nextInfinite();
          startProgressBar();
        }, AUTO_SCROLL_INTERVAL);
        startProgressBar();
      }
    };
    stopAutoScroll = function () {
      if (autoScroll) clearInterval(autoScroll);
      autoScroll = null;
      resetProgressBar();
    };
    render = function () {}; // disable old render
  }
  // --- Initialize infinite carousel on DOMContentLoaded ---
  if (track) {
    initInfiniteCarousel();
  }
})();
