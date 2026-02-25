let generatedOtp = null;
let countdown;
let imageToDeleteId = null;
let countdownInterval;

/* =====================================================
    🌍 COUNTRY LIST
===================================================== */
const countryCodes = [
  { name: "India", code: "+91" }, { name: "Afghanistan", code: "+93" },
  { name: "Australia", code: "+61" }, { name: "Austria", code: "+43" },
  { name: "Bangladesh", code: "+880" }, { name: "Belgium", code: "+32" },
  { name: "Brazil", code: "+55" }, { name: "Canada", code: "+1" },
  { name: "China", code: "+86" }, { name: "Denmark", code: "+45" },
  { name: "Egypt", code: "+20" }, { name: "France", code: "+33" },
  { name: "Germany", code: "+49" }, { name: "Hong Kong", code: "+852" },
  { name: "Indonesia", code: "+62" }, { name: "Ireland", code: "+353" },
  { name: "Italy", code: "+39" }, { name: "Japan", code: "+81" },
  { name: "Malaysia", code: "+60" }, { name: "Nepal", code: "+977" },
  { name: "Netherlands", code: "+31" }, { name: "New Zealand", code: "+64" },
  { name: "Russia", code: "+7" }, { name: "Saudi Arabia", code: "+966" },
  { name: "Singapore", code: "+65" }, { name: "South Africa", code: "+27" },
  { name: "Sri Lanka", code: "+94" }, { name: "Thailand", code: "+66" },
  { name: "UAE", code: "+971" }, { name: "UK", code: "+44" },
  { name: "USA", code: "+1" }
];

/* =====================================================
    🌌 GLOBAL STATE
===================================================== */
let activeCharacter = null;
const themes = ['theme-cyberpunk', 'theme-sahara', 'theme-ocean', 'theme-forest'];

/* =====================================================
    🚀 INIT & MATRIX CURSOR
===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const regSelect = document.getElementById('regCountryCode');
  if (regSelect) {
    countryCodes.forEach(c => {
      regSelect.innerHTML += `<option value="${c.code}">${c.code} (${c.name})</option>`;
    });
  }

  if (window.location.pathname.includes('dashboard.html')) {
    if (!sessionStorage.getItem('loggedIn')) return window.location.href = 'index.html';
    
    const name = sessionStorage.getItem('userName') || 'Artist';
    if (document.getElementById('userNameDisplay')) userNameDisplay.innerText = name;
    
    renderGallery();
    renderSidebar();
    initMatrix(); // Start the matrix rain
  }

  // Matrix Cursor Tracking
  document.addEventListener('mousemove', e => {
    document.documentElement.style.setProperty('--cursor-x', e.clientX + 'px');
    document.documentElement.style.setProperty('--cursor-y', e.clientY + 'px');
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') generateImage();
  });
});


/* =====================================================
    🎨 THEME & UI UTILITIES
===================================================== */
function toggleRandomTheme() {
  const currentTheme = document.body.className.split(' ').find(c => c.startsWith('theme-'));
  const otherThemes = themes.filter(t => t !== currentTheme);
  const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)];

  if (currentTheme) document.body.classList.remove(currentTheme);
  document.body.classList.add(randomTheme);
  showToast(`Theme: ${randomTheme.replace('theme-', '')}`);
}

function showToast(msg, type = "success") {
  // Creating a non-blocking UI toast instead of browser alert
  const container = document.getElementById('toast-container');
  if(!container) return alert(msg);
  
  const toast = document.createElement('div');
  toast.className = `p-4 rounded-xl text-white font-bold shadow-2xl animate-in fade-in slide-in-from-right-10 duration-300 ${type === 'success' ? 'bg-blue-600' : 'bg-red-600'}`;
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function expandPrompt() {
  const input = document.getElementById('promptInput');
  if (!input.value) return showToast("Type a base idea first!", "error");
  input.value += ", hyper-realistic, 4k cinematic lighting, octane render, masterpiece";
}

/* =====================================================
    🔐 AUTHENTICATION
===================================================== */

/**
 * Starts the signup process by sending an OTP to the user's email.
 * Replaces the old LocalStorage-based handleSignup.
 */
async function handleSignup(e) {
  e.preventDefault();
  const user = document.getElementById('regUser').value.trim();
  const email = document.getElementById('regEmail').value.trim();

  // 1. Basic validation
  if (!user || !email) return showToast("Username and Email required", "error");

  // 2. Generate OTP for cloud verification
generatedOtp = Math.floor(10000 + Math.random() * 90000).toString();

  // 3. UI logic to show OTP section
  document.getElementById('otpSection').classList.remove('hidden');
  document.getElementById('sendOtpBtn').classList.add('hidden');
  startOtpTimer();

  // 4. Send request to your Node.js server to trigger the email
  try {
    const response = await fetch('https://vision-draft.onrender.com/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, otp: generatedOtp })
    });
    
    if (response.ok) {
        showToast("Verification email sent!", "success");
    }
  } catch (err) {
    showToast("Server offline - check console for OTP", "error");
    console.log("Dev OTP:", generatedOtp);
  }
}

function logout() {
    // 1. Clear session data
    sessionStorage.clear();
    
    // 2. Explicitly remove the last active user name
    localStorage.removeItem('visiondraft_currentUser');
    
    // 3. Send them back to the start
    window.location.href = 'index.html';
}

function toggleAuth(type) {
  document.getElementById('loginSection').classList.toggle('hidden', type === 'signup');
  document.getElementById('signupSection').classList.toggle('hidden', type === 'login');
}

/* =====================================================
    🔁 PASSWORD RECOVERY
===================================================== */
async function handleRecoverySend() {
    const email = document.getElementById('recoveryEmail').value.trim();
    const resendBtn = document.getElementById('resendBtn');

    if (!email) return showToast("Enter your email", "error");

    // 1. UI Freeze to prevent spam
    resendBtn.disabled = true;
    resendBtn.innerText = "RESETTING...";

    // Generate a temporary password
    const newPass = Math.random().toString(36).slice(-8);

    try {
        // 2. Tell the cloud server to update MongoDB and send the email
        const res = await fetch('https://vision-draft.onrender.com/api/recover-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPass })
        });

        if (res.ok) {
            // Success: Switch to the timer view
            document.getElementById('recoveryInputStep').classList.add('hidden');
            document.getElementById('recoveryTimerStep').classList.remove('hidden');
            startRecoveryTimer(); 
            showToast("Temporary password sent to email!", "success");
        } else {
            const errorData = await res.json();
            showToast(errorData.error || "Email not found in cloud", "error");
            resendBtn.disabled = false;
            resendBtn.innerText = "SEND PASSWORD";
        }
    } catch (err) {
        showToast("Server error. Check your connection.", "error");
        resendBtn.disabled = false;
        resendBtn.innerText = "SEND PASSWORD";
    }
}

function startRecoveryTimer() {
  let seconds = 30;
  const circle = document.getElementById('countdownCircle');
  const resendBtn = document.getElementById('resendBtn');
  resendBtn.disabled = true;

  const timer = setInterval(() => {
    seconds--;
    if (circle) circle.innerText = seconds;
    if (seconds <= 0) {
      clearInterval(timer);
      resendBtn.disabled = false;
      resendBtn.style.opacity = "1";
    }
  }, 1000);
}

function toggleRecovery(show) {
  document.getElementById('forgotSection').classList.toggle('hidden', !show);
}

/* =====================================================
    🎨 AI IMAGE GENERATION
===================================================== */
async function generateImage() {
    const input = document.getElementById('promptInput');
    const btnText = document.getElementById('btnText');
    let prompt = input.value.trim();
    if (!prompt) return showToast("Enter a prompt first!", "error");

    const API_KEY = 'sk_ZvxoUf2hSAlXsPxZb2j7EvG4BZyR50Mc'; 
    if (btnText) btnText.innerText = "RENDERING...";
    
    if (typeof toggleSkeleton === "function") toggleSkeleton(true);

    const size = document.getElementById('sizeSelect').value;
    const [w, h] = size.split('x');
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=flux&width=${w}&height=${h}&seed=${seed}&nologo=true&key=${API_KEY}`;

    const img = new Image();
    
    img.onload = async () => {
        const user = localStorage.getItem('visiondraft_currentUser');

        // 1. SAVE TO MONGODB
        try {
            await fetch('https://vision-draft.onrender.com/api/save-art', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: user, 
                    prompt: prompt, 
                    url: url, 
                    size: size 
                })
            });
        } catch (err) {
            console.error("Cloud Save Failed:", err);
            showToast("Saved locally only (Server offline)", "warning");
        }
        
        // 2. Refresh UI
        if (typeof toggleSkeleton === "function") toggleSkeleton(false);
        renderGallery();
        renderSidebar();
        
        if (btnText) btnText.innerText = "GENERATE";
        input.value = '';
        showToast("Image Rendered & Saved!", "success");
    };

    img.onerror = () => {
        showToast("AI Render Failed", "error");
        if (btnText) btnText.innerText = "GENERATE";
        if (typeof toggleSkeleton === "function") toggleSkeleton(false);
    };

    img.src = url;
}

/* =====================================================
    🖼 GALLERY & DOWNLOAD
===================================================== */
// 1. Storage Keys (MUST BE AT THE TOP)
const getHistKey = () => {
    // Force a fresh check of the current session
    const user = sessionStorage.getItem('userName') || 
                 localStorage.getItem('visiondraft_currentUser') || 
                 'anonymous_guest';
    
    return `vd_v1_hist_${user.toLowerCase()}`; 
}; // This function ensures that each user's history is stored separately, preventing data overlap and ensuring a personalized experience.



async function downloadImg(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + ".png";
    link.click();
  } catch (e) { showToast("Download error", "error"); }
}

// Updated renderSidebar
async function renderSidebar() {
    const sb = document.getElementById('chatSidebar');
    if (!sb) return;
    
    const user = localStorage.getItem('visiondraft_currentUser');
    
    try {
        const response = await fetch(`https://vision-draft.onrender.com/api/history/${user}`);
        const history = await response.json();
        
        sb.innerHTML = history.map(h => `
            <div class="p-3 text-[11px] cursor-pointer hover:bg-white/5 rounded-xl transition truncate text-slate-400"
                 onclick="focusImage('${h._id}', '${h.prompt.replace(/'/g, "\\'")}')">
              ${h.prompt}
            </div>
        `).join('');
    } catch (err) {
        console.error("Sidebar Sync Error:", err);
    }
}

/* =====================================================
    ⚙️ MODAL SETTINGS UI
===================================================== */
function toggleProfileMenu(e) {
  e.stopPropagation();
  document.getElementById('profileDropdown').classList.toggle('hidden');
}

window.addEventListener('click', () => {
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.classList.add('hidden');
});

function openSettings(type) {
  document.getElementById('settingsModal').classList.remove('hidden');
  document.getElementById('changePassUI').classList.toggle('hidden', type !== 'password');
  document.getElementById('deleteAccUI').classList.toggle('hidden', type !== 'delete');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

async function submitChangePass() {
    const current = document.getElementById('currentPass').value;
    const newP = document.getElementById('newPass').value;
    const confirmP = document.getElementById('confirmNewPass').value;
    const user = localStorage.getItem('visiondraft_currentUser');

    if (newP !== confirmP) return showToast("Passwords don't match", "error");

    try {
        const response = await fetch('https://vision-draft.onrender.com/api/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: user, 
                currentPassword: current, 
                newPassword: newP 
            })
        });

        const result = await response.json();
        if (result.success) {
            showToast("Cloud Password Updated!", "success");
            closeSettings();
        } else {
            showToast(result.message, "error");
        }
    } catch (err) {
        showToast("Connection failed", "error");
    }
}

async function submitDeleteAccount() {
    const userToDelete = document.getElementById('delUser').value.trim();
    const passToConfirm = document.getElementById('delPass').value;
    const currentUser = localStorage.getItem('visiondraft_currentUser');

    // 1. Basic UI Check
    if (userToDelete !== currentUser) {
        return showToast("Username does not match current session", "error");
    }

    showToast("Wiping cloud data...", "warning");

    try {
        // 2. Send request to backend with password for cloud verification
        const response = await fetch(`https://vision-draft.onrender.com/api/delete-account/${userToDelete}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: passToConfirm })
        });

        if (response.ok) {
            // 3. Clear all remaining local remnants
            localStorage.removeItem('visiondraft_currentUser');
            sessionStorage.clear();
            
            showToast("Account deleted from cloud successfully.", "success");

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            const error = await response.json();
            showToast(error.message || "Cloud wipe failed", "error");
        }
    } catch (err) {
        console.error("Delete Account Error:", err);
        showToast("Connection error to server", "error");
    }
}

async function downloadHistoryArchive() {
    const user = localStorage.getItem('visiondraft_currentUser');
    if (!user) return showToast("Session error. Please login.", "error");

    showToast("Preparing your cloud backup...", "success");

    try {
        // 1. Fetch data from MongoDB
        const response = await fetch(`https://vision-draft.onrender.com/api/history/${user}`);
        const historyData = await response.json();

        if (!historyData || historyData.length === 0) {
            return showToast("No art found in cloud to backup", "warning");
        }

        // 2. Initialize ZIP
        const zip = new JSZip();
        const folder = zip.folder("VisionDraft_Cloud_Backup");

        // 3. Add the JSON manifest
        folder.file("prompts_data.json", JSON.stringify(historyData, null, 2));

        // 4. Download and bundle each image
        for (let i = 0; i < historyData.length; i++) {
            const item = historyData[i];
            try {
                const imgRes = await fetch(item.url);
                const blob = await imgRes.blob();
                folder.file(`art_${i + 1}_${item._id}.png`, blob);
            } catch (err) {
                console.warn("Skipping failed image:", item.url);
            }
        }

        // 5. Generate ZIP and trigger browser download
        const content = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(content);
        
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${user}_VisionDraft_Backup.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link); // Cleanup
        
        showToast("Backup downloaded successfully!", "success");
    } catch (error) {
        console.error("Backup Error:", error);
        showToast("Backup failed. Is your server running?", "error");
    }
}

/* =====================================================
    💹 MATRIX ENGINE
===================================================== */
let canvas, ctx, fontSize, drops;
const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ{}[]<>/";

function initMatrix() {
  canvas = document.createElement('canvas');
  canvas.id = "matrix-canvas";
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  fontSize = 16;
  const columns = canvas.width / fontSize;
  drops = Array(Math.floor(columns)).fill(1);

  setInterval(drawMatrix, 35);
}

function drawMatrix() {
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--matrix-color').trim() || "#00ff41";
  
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = themeColor;
  ctx.font = fontSize + "px monospace";

  // Adding a subtle glow effect to the characters
  ctx.shadowBlur = 1;
  ctx.shadowColor = themeColor;

  for (let i = 0; i < drops.length; i++) {
    const text = characters.charAt(Math.floor(Math.random() * characters.length));
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);
    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}

function toggleSkeleton(show) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    if (show) {
        // Create a single skeleton element
        const skeleton = document.createElement('div');
        skeleton.id = "active-skeleton"; // Give it an ID so we can find it later
        skeleton.className = "skeleton-item animate-pulse bg-white/5 rounded-2xl aspect-square border border-white/5";
        
        // Add it to the top of the gallery without removing old images
        gallery.prepend(skeleton);
    } else {
        // Find and remove ONLY the skeleton by its ID
        const activeSkeleton = document.getElementById('active-skeleton');
        if (activeSkeleton) activeSkeleton.remove();
    }
}

// global login
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;

    try {
        const response = await fetch('https://vision-draft.onrender.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        const result = await response.json();

        if (result.success) {
            sessionStorage.setItem('loggedIn', 'true');
            sessionStorage.setItem('userName', user);
            localStorage.setItem('visiondraft_currentUser', user);

            // 🚀 FIXING THE ZOOM OVERLAY
            const overlay = document.getElementById('zoom-overlay');
            const zoomName = document.getElementById('zoomName');
            
            if (overlay && zoomName) {
                zoomName.innerText = user.toUpperCase();
                overlay.style.display = 'flex'; // Make it visible
                
                // Add the animation class dynamically
                zoomName.style.animation = "textZoom 1.5s forwards"; 
                
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1500);
            } else {
                window.location.href = "dashboard.html";
            }
        } else {
            showToast("Invalid Credentials", "error");
        }
    } catch (err) {
        showToast("Server Connection Error", "error");
    }
}


/* =====================================================
    🖼️ FULL SCREEN VIEWER LOGIC
===================================================== */


function renderGalleryImage(url) {
    const gallery = document.getElementById('gallery');
    const img = document.createElement('img');

    img.src = url;
    img.className = "rounded-xl cursor-pointer hover:scale-[1.02] transition-transform";
    
    // This is the bridge between the gallery and your viewer modal
    img.onclick = () => openImageViewer(url); 
    
    gallery.appendChild(img);
}



async function renderGallery() {
    const g = document.getElementById('gallery');
    if (!g) return;

    const user = localStorage.getItem('visiondraft_currentUser');
    if (!user) return;

    try {
        // Fetch history from your MongoDB via the backend
        const response = await fetch(`https://vision-draft.onrender.com/api/history/${user}`);
        const history = await response.json();

        if (history.length === 0) {
            g.innerHTML = `<p class="text-slate-500 col-span-full text-center py-20 italic">No art in your cloud studio yet.</p>`;
            return;
        }

        g.innerHTML = history.map(h => {
            const safePrompt = h.prompt.replace(/'/g, "&apos;");
            return `
                <div id="item-${h._id}" 
                     onclick="openImageViewer('${h.url}')" 
                     class="gallery-item group relative bg-white/5 rounded-2xl overflow-hidden border border-white/10 cursor-pointer transition-all duration-500">
                    
                    <img src="${h.url}" class="w-full aspect-square object-cover bg-slate-800">
                    
                    <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 p-6 flex flex-col justify-end transition-all">
                        <p class="text-[10px] text-white line-clamp-2 mb-4">${safePrompt}</p>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="event.stopPropagation(); downloadImg('${h.url}', 'VisionDraft')" 
                                    class="bg-blue-600 py-2 text-[10px] font-bold rounded-lg text-white">
                                DOWNLOAD
                            </button>
                            <button onclick="event.stopPropagation(); deleteImg('${h._id}')" 
                                    class="bg-white/10 hover:bg-red-600 py-2 text-[10px] font-bold rounded-lg text-white">
                                DELETE
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error("Cloud Fetch Error:", err);
    }
}


// 1. Trigger the confirmation modal
function deleteImg(id) {
    imageToDeleteId = id; // Store the ID for the confirm button to use
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

// 2. The final deletion logic (Should be wired to your modal's confirm button)
async function confirmSingleDelete() {
    if (!imageToDeleteId) return;
    try {
        const response = await fetch(`https://vision-draft.onrender.com/api/delete-art/${imageToDeleteId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showToast("Art removed from cloud", "success");
            renderGallery(); // Refresh the grid
            renderSidebar(); // Refresh the list
        }
    } catch (err) {
        showToast("Connection error", "error");
    } finally {
        closeDeleteModal();
    }
}



/**
 * Opens the image viewer modal in full screen.
 * @param {string} url - The URL of the generated image.
 */
function openImageViewer(url) {
    const viewer = document.getElementById('imageViewer');
    const fullImg = document.getElementById('fullViewImage');
    
    if (viewer && fullImg) {
        fullImg.src = url; // Sets the source to the high-res image
        viewer.classList.remove('hidden'); // Removes 'hidden' class from HTML
        viewer.style.display = 'flex'; // Uses flex to center the image
        document.body.style.overflow = 'hidden'; // Disables scrolling on the dashboard
    }
}

/**
 * Closes the image viewer and re-enables page scrolling.
 */
function closeimageViewer() {
    const viewer = document.getElementById('imageViewer');
    if (viewer) {
        viewer.classList.add('hidden');
        viewer.style.display = 'none'; // Hides the element
        document.body.style.overflow = 'auto'; // Restores scrolling
    }
}

// 1. Close when user presses the 'Escape' key
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeimageViewer();
});

// 2. Close when clicking the dark area outside the image
const viewer = document.getElementById('imageViewer');
if (viewer) {
    viewer.addEventListener('click', function(e) {
        if (e.target === this) {
            closeimageViewer();
        }
    });
}

// lumina_users

// PASSWORD VISIBILITY TOGGLE

function togglePasswordVisibility(inputId, iconElement) {
    const input = document.getElementById(inputId);
    const icon = iconElement.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

/* =====================================================
    🧹 CUSTOM CLEAR HISTORY LOGIC (No Browser Popups)
===================================================== */
/* =====================================================
    🧹 CLOUD HISTORY MANAGEMENT
===================================================== */

/**
 * Opens the confirmation modal
 */
function clearAllHistory() {
    const modal = document.getElementById('clearConfirmModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

/**
 * Closes the confirmation modal
 */
function closeClearModal() {
    const modal = document.getElementById('clearConfirmModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

/**
 * Communicates with the backend to wipe MongoDB records for the current user
 */
async function confirmClearHistory() {
    // 1. Get the current user identity
    const user = localStorage.getItem('visiondraft_currentUser');
    
    if (!user) {
        showToast("Session error. Please login again.", "error");
        return;
    }

    try {
        // 2. Request the backend to clear the specific user's collection
        const response = await fetch(`https://vision-draft.onrender.com/api/clear-history/${user}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // 3. Refresh UI directly from the database to ensure it's empty
            await renderGallery();
            await renderSidebar();
            
            // 4. Close the modal and show confirmation
            closeClearModal(); 
            showToast("Cloud history wiped clean!", "success");
        } else {
            // Handle server-side errors (e.g., 404 or 500)
            showToast("Server refused to clear history.", "error");
        }
    } catch (err) {
        console.error("Cloud Clear Error:", err);
        showToast("Could not connect to the cloud server.", "error");
    }
}
/* =====================================================
    email and phone validation using validator.js library
===================================================== */
// const validator = require('validator');

function validateRegistration(email, phone) {
    // Check if email is a valid format
    if (!validator.isEmail(email)) {
        return { valid: false, message: "Please enter a valid email address." };
    }

    // Check if phone is a valid mobile number (India locale 'en-IN')
    if (!validator.isMobilePhone(phone, 'en-IN')) {
        return { valid: false, message: "Please enter a valid 10-digit phone number." };
    }

    return { valid: true };
}
function isValidEmail(email) {
    // Standard email pattern check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    // Validates Indian mobile numbers (starts with 6-9, total 10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
}




function startResendTimer() {
    let timeLeft = 30; // 30 seconds
    const sendBtn = document.getElementById('sendOtpBtn');
    
    if (!sendBtn) return;

    clearInterval(countdownInterval); // Clear any old timers
    sendBtn.disabled = true; // Lock the button

    countdownInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            sendBtn.disabled = false; // 1. Make it clickable again
            sendBtn.innerText = "RESEND OTP"; // 2. Change text to Resend
            
            // 3. Ensure clicking it now calls the signup function again
            sendBtn.onclick = (e) => handleInitialSignup(e); 
        } else {
            sendBtn.innerText = `Resend in ${timeLeft}`;
            timeLeft--;
        }
    }, 1000);
}


/* =====================================================
    🔐 FOOLPROOF REGISTRATION FLOW
===================================================== */

// Phase 1: Send OTP
async function handleInitialSignup(e) {
    if (e) e.preventDefault();
    
    const email = document.getElementById('regEmail').value.trim();
    const user = document.getElementById('regUser').value.trim();
    const sendBtn = document.getElementById('sendOtpBtn');

    if (!email || !user) return showToast("Enter Username and Email", "error");

    sendBtn.disabled = true;
    sendBtn.innerText = "SENDING...";

    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        const response = await fetch('https://vision-draft.onrender.com/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, otp: generatedOtp })
        });
        
        // --- LOGIC CHANGE START ---
        if (response.ok) {
            showToast("OTP sent to your email!", "success");
            
            const otpSection = document.getElementById('otpSection');
            if (otpSection) otpSection.classList.remove('hidden');
            
            // Safety wrapper to prevent any timer errors from triggering the catch block
            // try {
            //     if (typeof startResendTimer === "function") {
            //         startResendTimer();
            //     }
            // } catch (timerErr) {
            //     console.warn("Timer failed but email was sent:", timerErr);
            // }
            
            return; // EXIT HERE. Do not let it reach any error code.
        } 
        
        // If we reach here, response was NOT ok
        showToast("Server rejected request. Try again.", "error");

    } catch (err) {
        // This catch block will now ONLY show a toast if the FETCH itself fails (e.g. No Internet)
        console.error("Network/System Error:", err);
        showToast("Connection failed. Check your internet.", "error");
    } finally {
        // Always reset button state if it didn't succeed
        if (sendBtn.innerText === "SENDING...") {
            sendBtn.disabled = false;
            sendBtn.innerText = "RETRY SENDING";
        }
    }
}

// Phase 2: Verify OTP
function verifyAndRegister(e) {
    if (e) e.preventDefault();
    const enteredOtp = document.getElementById('otpInput').value.trim();
    const passField = document.getElementById('regPass');
    const checkmark = document.getElementById('emailSuccessCheck');
    const emailInput = document.getElementById('regEmail');

    if (enteredOtp === generatedOtp) {
        showToast("Email Verified!", "success");

        // UI Success States
        if (checkmark) {
            checkmark.classList.remove('opacity-0', 'scale-50');
            checkmark.classList.add('opacity-100', 'scale-110');
            emailInput.style.borderColor = "#10b981";
        }

        // Unlock Password Field
        passField.disabled = false;
        passField.classList.remove('opacity-50', 'cursor-not-allowed');
        passField.placeholder = "Create your password";
        passField.focus();

        // Switch Button to "Finalize"
        document.getElementById('otpSection').classList.add('hidden');
        const mainBtn = document.getElementById('sendOtpBtn');
        mainBtn.classList.remove('hidden');
        mainBtn.disabled = false;
        mainBtn.innerText = "FINALIZE REGISTRATION";
        mainBtn.style.backgroundColor = "#10b981";
        
        // Update click handler to next phase
        mainBtn.onclick = finalizeAccountCreation;
    } else {
        showToast("Invalid OTP", "error");
    }
}

// Phase 3: Save to MongoDB
async function finalizeAccountCreation(e) {
    if (e) e.preventDefault();
    const user = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;

    if (pass.length < 4) return showToast("Password too short!", "error");

    try {
        const response = await fetch('https://vision-draft.onrender.com/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass })
        });

        if (response.ok) {
            showToast("Account Created!", "success");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast("User/Email already exists", "error");
        }
    } catch (err) {
        showToast("Cloud connection error", "error");
    }
}


// user's inital
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = localStorage.getItem('visiondraft_currentUser');

    if (currentUser) {
        // Target the sidebar initial specifically
        const sidebarInitial = document.getElementById('sidebarInitial');
        
        if (sidebarInitial) {
            // charAt(0) gets the first letter, toUpperCase() makes it 'S' instead of 's'
            sidebarInitial.innerText = currentUser.charAt(0).toUpperCase();
        }

        // Also update the name text next to it
        const sidebarName = document.getElementById('displayUsername');
        if (sidebarName) {
            sidebarName.innerText = currentUser.toLowerCase();
        }
    }
});

// highlight image
function focusImage(id, prompt) {
    // 1. Fill the input box as before
    const input = document.getElementById('promptInput');
    if (input) input.value = prompt + " ";

    // 2. Find the gallery element
    const targetItem = document.getElementById(`item-${id}`);
    
    if (targetItem) {
        // 3. Smooth scroll to the image
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 4. Get current theme color for the highlight
        const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--matrix-color').trim() || "#3b82f6";

        // 5. Apply highlight (Border and Shadow)
        targetItem.style.borderColor = themeColor;
        targetItem.style.boxShadow = `0 0 20px ${themeColor}`;
        targetItem.style.transform = "scale(1.05)";

        // 6. Remove highlight after 1 second
        setTimeout(() => {
            targetItem.style.borderColor = "rgba(255,255,255,0.1)";
            targetItem.style.boxShadow = "none";
            targetItem.style.transform = "scale(1)";
            
            // 7. Trigger full screen view
            const imgElement = targetItem.querySelector('img');
            if (imgElement) openImageViewer(imgElement.src);
        }, 1000);
    } else {
        showToast("Image container not found", "error");
    }
}


/**
 * The final deletion logic triggered by the Modal's RED button
 */
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = async () => {
        if (imageToDeleteId) {
            try {
                // 1. Send the command to MongoDB
                const response = await fetch(`https://vision-draft.onrender.com/api/delete-art/${imageToDeleteId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // 2. CRITICAL: Re-run these to refresh the screen
                    await renderGallery(); 
                    await renderSidebar();
                    
                    showToast("Image removed from cloud", "success");
                } else {
                    showToast("Server error: Could not delete", "error");
                }
            } catch (err) {
                console.error("Delete failed:", err);
                showToast("Connection lost", "error");
            }
            
            closeDeleteModal(); // Close the popup
        }
    };
}

/**
 * Triggered by the "CANCEL" button or after a successful delete.
 */
function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    imageToDeleteId = null; // Clear the "clipboard"
}
