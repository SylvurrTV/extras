// Dynamic gradient color generator based on background image
window.addEventListener("load", () => {
    const img = new Image();
    img.src = "images/background.png";
    img.crossOrigin = "Anonymous";

    img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        // sample a few points to estimate dominant colors
        const sampleColors = [];
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * img.width;
            const y = Math.random() * img.height;
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            sampleColors.push(`rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, 0.6)`);
        }

        const hero = document.querySelector(".hero");
        if (hero && sampleColors.length >= 2) {
            hero.style.background = `linear-gradient(270deg, ${sampleColors.join(", ")})`;
            hero.style.backgroundSize = "800% 800%";
            hero.style.animation = "gradientShift 15s ease infinite";
        }
    };
});

const PUBLIC_KEY   = 'QnYfEWY17CMN2jitT';
const SERVICE_ID = 'service_fo2bfuv';
const TEMPLATE_ID = 'template_eowb0b3';

emailjs.init(PUBLIC_KEY);

window.onReCaptchaSuccess = function (token) {
    const form = document.getElementById("contact-form");
    const submitBtn = form.querySelector("button[type='submit']");

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form, PUBLIC_KEY)
    .then(() => {
        form.reset();
        grecaptcha.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
    })
    .catch((err) => {
        console.error("EmailJS error:", err);
        alert("There was an error sending your message.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
    });
};

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contact-form");
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        // Check required fields
        if (!form.checkValidity()) {
            form.reportValidity();
                          return;
        }

        const consent = document.getElementById("gdpr-consent");
        if (consent && !consent.checked) {
            alert("Please confirm that you consent to data processing before sending.");
            return;
        }

        grecaptcha.execute();
    });
});

