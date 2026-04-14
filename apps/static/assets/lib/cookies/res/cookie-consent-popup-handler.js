window.addEventListener("load", function () {
    // Inject custom CSS styles for hover effects
    const style = document.createElement("style");
    style.innerHTML = `
        .esa-custom-cookie-messsage {
            margin-bottom: 1em;
        }

        .cc-allow, .cc-deny {
            margin-right: 0.9em;
            border: none;
            padding: 0.5em 1em;
            border-radius: 4px;
            cursor: pointer;
        }

        .cc-allow:hover {
            color: #212529 !important;
            text-decoration: none !important;
            background-color: #FFC107 !important;
            box-shadow: 0 0 10px rgba(255, 193, 7, 0.7) !important;
        }

        .cc-deny:hover {
            color: #212529 !important;
            text-decoration: none !important;
            background-color: #FFC107 !important;
            box-shadow: 0 0 10px rgba(255, 193, 7, 0.7) !important;
        }
    `;
    document.head.appendChild(style);

    window.cookieconsent.initialise({
        layout: 'esa-custom',
        layouts: {
            'esa-custom': `<div class="esa-custom-cookie-messsage cc-message">{{message}}{{privacyPolicyLink}}{{message2}} </div> {{allow}} {{deny}}`,
        },
        "content": {
            "allow": "Accept all cookies",
            "deny": "No, thanks!",
            "message": "We use cookies which are essential for you to access our website and to provide you with our services and allow us to measure and improve the performance of our website. Please consult our ",
        },
        'elements': {
            "privacyPolicyLink": '<a href="/cookie-notice.html">Cookie Notice </a>',
            "message2": "for further information or to change your preferences."
        },
        "palette": {
            "popup": {
                "background": "#343a40 !important",
                "text": "#ffffff",
            },
            "button": {
                "background": "#FFC107",
                "text": "#212529 !important",
            }
        },
        "onPopupOpen": function () {
            const allowBtn = document.querySelector('.cc-allow');
            const denyBtn = document.querySelector('.cc-deny');
            const acceptLink = document.getElementById("cookie-accept");
            const refuseLink = document.getElementById("cookie-refuse");
            const statusDisplay = document.querySelector('.matomo-status');

            const updateStatus = (status) => {
                if (statusDisplay) statusDisplay.textContent = status;
            }

            // Optional: Set initial state from localStorage (if you store consent state)
            const consent = localStorage.getItem("cookie-consent");
            if (consent === "accepted") {
                if (acceptLink) acceptLink.classList.add("hide");
                if (refuseLink) refuseLink.classList.remove("hide");
                updateStatus("Opted in");
            } else if (consent === "refused") {
                if (refuseLink) refuseLink.classList.add("hide");
                if (acceptLink) acceptLink.classList.remove("hide");
                updateStatus("Opted out");
            }

            if (allowBtn) {
                allowBtn.addEventListener("click", function () {
                    if (window._paq) _paq.push(['rememberConsentGiven']);
                    localStorage.setItem("cookie-consent", "accepted");
                    if (acceptLink) acceptLink.classList.add("hide");
                    if (refuseLink) refuseLink.classList.remove("hide");
                    updateStatus("Opted in");
                }, {
                    once: true
                })
            }

            if (denyBtn) {
                denyBtn.addEventListener("click", function () {
                    if (window._paq) _paq.push(['forgetConsentGiven']);
                    localStorage.setItem("cookie-consent", "refused");
                    if (refuseLink) refuseLink.classList.add("hide");
                    if (acceptLink) acceptLink.classList.remove("hide");
                    updateStatus("Opted out");
                }, {
                    once: true
                })
            }
        }
    })
});
if (typeof window.cookieconsent !== "undefined") {
    window.cookieconsent.utils.isMobile = function () {
        return false
    };
}