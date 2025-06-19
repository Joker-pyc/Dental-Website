(function () {
  "use strict";

  const CONSTANTS = {
    WHATSAPP_NUMBER: "8669048892",
    THROTTLE_MS: 16,
    FORM_DELAY: 1500,
    SUCCESS_TIMEOUT: 5000,
    ANIMATION_DELAY: 300,
    INTERSECTION_THRESHOLD: 0.4,
    CAROUSEL_INTERVAL: 4000,
    SWIPE_THRESHOLD: 50,
    MAX_REVIEW_LENGTH: 250,
  };

  const SELECTORS = {
    nav: ".rd-navbar",
    navLinksContainer: ".rd-navbar .nav-links",
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

  // Utility functions
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

    getInitials: (name) =>
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase(),

    truncateText(text, maxLength = CONSTANTS.MAX_REVIEW_LENGTH) {
      if (text.length <= maxLength) return text;
      const truncated = text.slice(0, maxLength);
      const lastSpace = truncated.lastIndexOf(" ");
      return truncated.slice(0, lastSpace) + "...";
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
  };

  // Main App object
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
      // Cache all elements at once
      const cache = {};

      Object.entries(SELECTORS).forEach(([key, selector]) => {
        const isMultiple = [
          "navLinks",
          "sections",
          "timeSlots",
          "errorMessages",
        ].includes(key);
        cache[key] = isMultiple
          ? document.querySelectorAll(selector)
          : document.querySelector(selector);
      });

      this.elements = cache;
    },

    bindEvents() {
      this.bindBlobMovement();
      this.bindMobileMenu();
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

    bindMobileMenu() {
      this.elements.mobileMenuToggle?.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleMobileMenu();
      });
    },

    bindSmoothScroll() {
      // Use event delegation for better performance
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

        // Close mobile menu if open
        if (this.elements.navLinksContainer?.classList.contains("active")) {
          this.toggleMobileMenu();
        }
      });
    },

    toggleMobileMenu() {
      const isExpanded =
        this.elements.navLinksContainer.classList.toggle("active");
      const toggle = this.elements.mobileMenuToggle;

      toggle.setAttribute("aria-expanded", isExpanded);
      toggle.innerHTML = isExpanded
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-bars"></i>';
      document.body.classList.toggle("menu-open", isExpanded);
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

      // Use event delegation
      this.elements.appointmentForm.addEventListener("click", (e) => {
        const slot = e.target.closest(".time-slot");
        if (!slot) return;

        e.preventDefault();

        // Remove previous selection
        this.elements.timeSlots.forEach((s) => s.classList.remove("selected"));

        // Set new selection
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

      // Update button state
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

      // Hide all error messages first
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

    // Cleanup method for potential future use
    destroy() {
      this.observers.forEach((observer) => observer.disconnect());
      this.observers.clear();
    },
  };

  // Reviews Carousel Module
  const ReviewsCarousel = {
    data: [
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
    ],

    state: {
      currentSlide: 0,
      autoScrollInterval: null,
      slidesToShow: 3,
      isTransitioning: false,
    },

    elements: {},

    getSlidesToShow() {
      const width = window.innerWidth;
      if (width < 700) return 1;
      if (width < 1100) return 2;
      return 3;
    },

    init() {
      this.cacheElements();
      if (!this.elements.track) return;
      this.state.slidesToShow = this.getSlidesToShow();
      this.render();
      this.update();
      this.bindEvents();
      this.startAutoScroll();
      window.addEventListener(
        "resize",
        utils.throttle(() => {
          const newSlides = this.getSlidesToShow();
          if (newSlides !== this.state.slidesToShow) {
            this.state.slidesToShow = newSlides;
            this.render();
            this.update();
          }
        }, 100)
      );
    },

    cacheElements() {
      this.elements = {
        track: document.getElementById("carouselTrack"),
        dotsContainer: document.getElementById("carouselDots"),
        prevBtn: document.getElementById("carouselPrevBtn"),
        nextBtn: document.getElementById("carouselNextBtn"),
      };
    },

    render() {
      if (!this.elements.track || !this.elements.dotsContainer) return;
      // Render review cards
      this.elements.track.innerHTML = this.data
        .map(
          (review, idx) => `
        <div class="review-card" data-index="${idx}" tabindex="0">
          <div class="reviewer-info">
            <div class="reviewer-avatar">${utils.getInitials(review.name)}</div>
            <div class="reviewer-details">
              <h3>${review.name}</h3>
              <p class="reviewer-title">${review.title || ""}</p>
            </div>
          </div>
          <div class="rating">
            ${'<svg class="star" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(
              review.stars
            )}
          </div>
          <p class="review-text">${utils.truncateText(review.review)}</p>
        </div>
      `
        )
        .join("");
      // Render dots (one per group of slides)
      const totalDots = Math.ceil(this.data.length / this.state.slidesToShow);
      this.elements.dotsContainer.innerHTML = Array.from({ length: totalDots })
        .map(
          (_, idx) =>
            `<div class="dot${
              idx ===
              Math.floor(this.state.currentSlide / this.state.slidesToShow)
                ? " active"
                : ""
            }" 
              data-slide="${idx}" 
              aria-label="Go to slide ${idx + 1}" 
              tabindex="0"></div>`
        )
        .join("");
    },

    update() {
      if (!this.elements.track) return;
      const slideWidth = this.elements.track.children[0]?.offsetWidth || 340;
      const gap =
        parseInt(
          getComputedStyle(this.elements.track.children[0])?.marginRight || 0,
          10
        ) || 0;
      const offset = -this.state.currentSlide * (slideWidth + gap);
      this.elements.track.style.transform = `translateX(${offset}px)`;
      // Update dots
      const dots = this.elements.dotsContainer.querySelectorAll(".dot");
      const activeDot = Math.floor(
        this.state.currentSlide / this.state.slidesToShow
      );
      dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === activeDot);
      });
    },

    next() {
      if (this.state.isTransitioning) return;
      const maxSlide = this.data.length - this.state.slidesToShow;
      this.state.currentSlide += this.state.slidesToShow;
      if (this.state.currentSlide > maxSlide) this.state.currentSlide = 0;
      this.update();
    },

    prev() {
      if (this.state.isTransitioning) return;
      const maxSlide = this.data.length - this.state.slidesToShow;
      this.state.currentSlide -= this.state.slidesToShow;
      if (this.state.currentSlide < 0)
        this.state.currentSlide = maxSlide >= 0 ? maxSlide : 0;
      this.update();
    },

    goTo(dotIdx) {
      this.state.currentSlide = dotIdx * this.state.slidesToShow;
      this.update();
    },

    startAutoScroll() {
      this.pauseAutoScroll();
      this.state.autoScrollInterval = setInterval(() => this.next(), 5000);
    },

    pauseAutoScroll() {
      if (this.state.autoScrollInterval) {
        clearInterval(this.state.autoScrollInterval);
        this.state.autoScrollInterval = null;
      }
    },

    bindEvents() {
      this.elements.prevBtn?.addEventListener("click", () => {
        this.prev();
        this.startAutoScroll();
      });
      this.elements.nextBtn?.addEventListener("click", () => {
        this.next();
        this.startAutoScroll();
      });
      this.bindDotEvents();
      if (this.elements.track) {
        this.elements.track.addEventListener("mouseenter", () =>
          this.pauseAutoScroll()
        );
        this.elements.track.addEventListener("mouseleave", () =>
          this.startAutoScroll()
        );
        this.bindTouchEvents();
      }
    },

    bindDotEvents() {
      const dots = this.elements.dotsContainer.querySelectorAll(".dot");
      dots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
          this.goTo(idx);
          this.startAutoScroll();
        });
        dot.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.goTo(idx);
            this.startAutoScroll();
          }
        });
      });
    },

    bindTouchEvents() {
      let startX = 0;
      this.elements.track.addEventListener(
        "touchstart",
        (e) => {
          startX = e.touches[0].clientX;
          this.pauseAutoScroll();
        },
        { passive: true }
      );
      this.elements.track.addEventListener(
        "touchend",
        (e) => {
          const endX = e.changedTouches[0].clientX;
          const diff = startX - endX;
          if (Math.abs(diff) > 50) {
            if (diff > 0) this.next();
            else this.prev();
          }
          this.startAutoScroll();
        },
        { passive: true }
      );
    },
  };

  // Initialize everything when DOM is ready
  function initialize() {
    App.init();
    ReviewsCarousel.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Cleanup on page unload (optional, for SPA scenarios)
  window.addEventListener("beforeunload", () => {
    App.destroy?.();
    ReviewsCarousel.pauseAutoScroll();
  });
})();
