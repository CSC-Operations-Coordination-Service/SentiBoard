
console.log("about.js loaded");

// about.js
class About {
    constructor(jsonPath, containerId) {
        this.jsonPath = jsonPath;
        this.containerId = containerId;
    }

    async load() {
        try {
            const response = await fetch(this.jsonPath);
            const faqs = await response.json();
            this.renderFaqs(faqs);
        } catch (error) {
            console.error('Error loading FAQs:', error);
        }
    }

    renderFaqs(faqs) {
        const faqAccordion = document.getElementById(this.containerId);
        if (!faqAccordion) {
            console.warn(`Element with ID ${this.containerId} not found.`);
            return;
        }

        faqAccordion.innerHTML = '';

        faqs.forEach((faq, index) => {
            const faqCard = `
          <div class="card">
            <div class="card-header" id="heading${index}">
              <h5 class="mb-0 d-flex justify-content-between align-items-center">
                <button class="btn btn-link ${index === 0 ? '' : 'collapsed'} btn-block text-left"
                        data-toggle="collapse"
                        data-target="#collapse${index}"
                        aria-expanded="${index === 0 ? 'true' : 'false'}"
                        aria-controls="collapse${index}">
                  ${faq.question}
                  <i class="fas fa-chevron-down float-right"></i>
                </button>
              </h5>
            </div>
            <div id="collapse${index}" class="collapse ${index === 0 ? 'show' : ''}"
                 aria-labelledby="heading${index}" data-parent="#${this.containerId}">
              <div class="card-body">
                ${faq.answer}
              </div>
            </div>
          </div>
        `;
            faqAccordion.innerHTML += faqCard;
        });
    }
}
