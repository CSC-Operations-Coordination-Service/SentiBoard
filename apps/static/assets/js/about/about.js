
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

  renderFaqs(sections) {
    const faqAccordion = document.getElementById(this.containerId);
    if (!faqAccordion) {
      console.warn(`Element with ID ${this.containerId} not found.`);
      return;
    }

    faqAccordion.innerHTML = '';

    let globalIndex = 0;

    sections.forEach((section, sectionIdx) => {
      const sectionId = `sectionCollapse${sectionIdx}`;

      // Section header with collapsible toggle
      const sectionHtml = `
          <div class="card my-3">
            <div class="card-header section-header" id="sectionHeading${sectionIdx}">
              <h5 class="mb-0">
                <button class="btn btn-link section-title" type="button" data-toggle="collapse" data-target="#${sectionId}" aria-expanded="false" aria-controls="${sectionId}">
                <i class="${section.icon || 'fa fa-folder'} mr-2"></i>  
                ${section.section}
                </button>
              </h5>
            </div>
    
            <div id="${sectionId}" class="collapse" aria-labelledby="sectionHeading${sectionIdx}" data-parent="#${this.containerId}">
              <div class="card-body p-2">
                <div class="accordion" id="sectionAccordion${sectionIdx}">
                  ${section.items.map((faq, itemIdx) => {
        const questionId = `heading${globalIndex}`;
        const collapseId = `collapse${globalIndex}`;
        const show = globalIndex === 0 ? 'show' : '';
        const collapsed = globalIndex === 0 ? '' : 'collapsed';
        globalIndex++;

        return `
                      <div class="card mb-2">
                        <div class="card-header faq-card-header" id="${questionId}">
                          <h5 class="mb-0">
                            <button class="btn btn-link ${collapsed} btn-block text-left faq-title" 
                                    data-toggle="collapse" 
                                    data-target="#${collapseId}" 
                                    aria-expanded="${show ? 'true' : 'false'}" 
                                    aria-controls="${collapseId}">
                              ${faq.question}
                              <i class="fas fa-chevron-down float-right"></i>
                            </button>
                          </h5>
                        </div>
                        <div id="${collapseId}" class="collapse ${show}" aria-labelledby="${questionId}" data-parent="#sectionAccordion${sectionIdx}">
                          <div class="card-body">
                            ${faq.answer}
                          </div>
                        </div>
                      </div>
                    `;
      }).join('')}
                </div>
              </div>
            </div>
          </div>
        `;

      faqAccordion.innerHTML += sectionHtml;
    });
  }


}
