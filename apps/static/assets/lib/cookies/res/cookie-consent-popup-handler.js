window.addEventListener("load", function() {
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
            "privacyPolicyLink": '<a href="https://sentinels.copernicus.eu/web/sentinel/cookie-notice">Cookie Notice </a>',
            "message2": "for further information or to change your preferences."
        },
        "palette": {
            "popup": {
                "background": "#003247",
                "text": "#ffffff",
            },
            "button": {
                "background": "#0098db",
                "text": "#ffffff",
            }
        },
        "onPopupOpen": function() {
            document.querySelector('.cc-allow').addEventListener("click", function() {
                _paq.push(['rememberConsentGiven'])
            }, {
                once: true
            })
            document.querySelector('.cc-deny').addEventListener("click", function() {
                _paq.push(['forgetConsentGiven'])
            }, {
                once: true
            })
        }
    })
});
if (typeof window.cookieconsent !== "undefined") {
    window.cookieconsent.utils.isMobile = function() {
        return false
    };
}