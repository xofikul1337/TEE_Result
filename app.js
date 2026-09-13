import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  get,
  getDatabase,
  ref,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, resultSource } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

const form = document.querySelector("#result-form");
const rollInput = document.querySelector("#roll");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const resultPanel = document.querySelector("#result-panel");
const searchAgain = document.querySelector("#search-again");
const statusIcon = document.querySelector("#status-icon");
const statusKicker = document.querySelector("#status-kicker");
const statusTitle = document.querySelector("#status-title");
const statusMessage = document.querySelector("#status-message");
const confettiCanvas = document.querySelector("#confetti-canvas");
let stopConfetti = null;

const bengaliDigits = "০১২৩৪৫৬৭৮৯";

function normalizeIdentifier(value) {
  return value
    .trim()
    .replace(/[০-৯]/g, (digit) => String(bengaliDigits.indexOf(digit)))
    .replace(/\s+/g, "")
    .toUpperCase();
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  rollInput.disabled = isLoading;
}

const statusViews = {
  SELECTED: {
    key: "selected",
    icon: "✓",
    kicker: "Congratulations",
    title: "আপনি নির্বাচিত হয়েছেন",
    message: "এসএসসি–২০২৬ জিপিএ-৫ সংবর্ধনায় আপনাকে স্বাগতম। পরবর্তী নির্দেশনার জন্য আমাদের অফিসিয়াল ঘোষণা অনুসরণ করুন।",
  },
  "NOT SELECTED": {
    key: "not-selected",
    icon: "×",
    kicker: "Result published",
    title: "আপনি নির্বাচিত হননি",
    message: "রেজিস্ট্রেশন করার জন্য আপনাকে আন্তরিক ধন্যবাদ।",
  },
  CANCELLED: {
    key: "cancelled",
    icon: "×",
    kicker: "Registration status",
    title: "আপনার নির্বাচন বাতিল হয়েছে",
    message: "বিস্তারিত জানতে আমাদের অফিসিয়াল পেজে যোগাযোগ করুন।",
  },
  CANCEL: {
    key: "cancelled",
    icon: "×",
    kicker: "Registration status",
    title: "আপনার নির্বাচন বাতিল হয়েছে",
    message: "বিস্তারিত জানতে আমাদের অফিসিয়াল পেজে যোগাযোগ করুন।",
  },
  PENDING: {
    key: "pending",
    icon: "…",
    kicker: "Under review",
    title: "ফলাফল অপেক্ষমাণ",
    message: "আপনার তথ্য যাচাই করা হচ্ছে। ফলাফল প্রকাশের পর আবার চেষ্টা করুন।",
  },
  WAITING: {
    key: "pending",
    icon: "…",
    kicker: "Waiting",
    title: "আপনি অপেক্ষমাণ তালিকায় আছেন",
    message: "পরবর্তী আপডেটের জন্য Technic Easy Education-এর অফিসিয়াল ঘোষণা অনুসরণ করুন।",
  },
};

function showResult(student) {
  const status = student?.status;
  const normalizedStatus = String(status || "NOT SELECTED").trim().toUpperCase();
  const view = statusViews[normalizedStatus] || statusViews["NOT SELECTED"];
  const studentName = String(student?.name || "").trim();

  resultPanel.dataset.status = view.key;
  statusIcon.textContent = view.icon;
  statusKicker.textContent = view.kicker;
  if (view.key === "selected" && studentName) {
    statusTitle.textContent = `অভিনন্দন, ${studentName}!`;
    statusMessage.textContent = `${view.title}। ${view.message}`;
  } else {
    statusTitle.textContent = view.title;
    statusMessage.textContent = view.message;
  }
  form.hidden = true;
  resultPanel.hidden = false;

  if (view.key === "selected") launchConfetti();
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  stopConfetti?.();

  const context = confettiCanvas.getContext("2d");
  const colors = ["#f51f47", "#ffbd3e", "#ffffff", "#ff6b35", "#b517df"];
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    confettiCanvas.width = Math.round(innerWidth * pixelRatio);
    confettiCanvas.height = Math.round(innerHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };
  resize();

  const particles = Array.from({ length: Math.min(150, Math.round(innerWidth / 4)) }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6),
    y: -20 - Math.random() * innerHeight * 0.35,
    width: 5 + Math.random() * 7,
    height: 8 + Math.random() * 10,
    color: colors[Math.floor(Math.random() * colors.length)],
    velocityX: -2.2 + Math.random() * 4.4,
    velocityY: 2.8 + Math.random() * 4.5,
    rotation: Math.random() * Math.PI,
    rotationSpeed: -0.14 + Math.random() * 0.28,
  }));

  let frame;
  let cancelled = false;
  const startedAt = performance.now();

  const draw = (now) => {
    context.clearRect(0, 0, innerWidth, innerHeight);
    particles.forEach((particle) => {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.velocityY += 0.025;
      particle.rotation += particle.rotationSpeed;
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
      context.restore();
    });

    if (!cancelled && now - startedAt < 4200 && particles.some((particle) => particle.y < innerHeight + 30)) {
      frame = requestAnimationFrame(draw);
    } else {
      context.clearRect(0, 0, innerWidth, innerHeight);
    }
  };

  window.addEventListener("resize", resize, { once: true });
  frame = requestAnimationFrame(draw);
  stopConfetti = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    context.clearRect(0, 0, innerWidth, innerHeight);
  };
}

async function getStudentByIdentifier(identifier) {
  const safeIdentifier = encodeURIComponent(identifier);
  const snapshot = await get(
    ref(database, `${resultSource.publicPath}/${safeIdentifier}`),
  );

  if (!snapshot.exists()) return null;

  const publicResult = snapshot.val();
  return {
    status: publicResult?.status ?? null,
    name: publicResult?.name ?? "",
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const identifier = normalizeIdentifier(rollInput.value);

  formMessage.textContent = "";
  rollInput.removeAttribute("aria-invalid");

  if (!/^\d{4,12}$/.test(identifier) && !/^TEE\d{2}-\d{4}$/.test(identifier)) {
    rollInput.setAttribute("aria-invalid", "true");
    formMessage.textContent = "সঠিক রোল নম্বর বা রেজিস্ট্রেশন আইডি লিখুন।";
    rollInput.focus();
    return;
  }

  setLoading(true);
  try {
    const student = await getStudentByIdentifier(identifier);
    showResult(student || { status: "NOT SELECTED", name: "" });
  } catch (error) {
    console.error("Realtime Database lookup failed", error);
    formMessage.textContent = "এই মুহূর্তে ফলাফল দেখা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।";
  } finally {
    setLoading(false);
  }
});

rollInput.addEventListener("input", () => {
  rollInput.value = rollInput.value.replace(/[^a-zA-Z0-9০-৯\s-]/g, "");
  formMessage.textContent = "";
  rollInput.removeAttribute("aria-invalid");
});

searchAgain.addEventListener("click", () => {
  stopConfetti?.();
  resultPanel.hidden = true;
  form.hidden = false;
  rollInput.value = "";
  rollInput.focus();
});
