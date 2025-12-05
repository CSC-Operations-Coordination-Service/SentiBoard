/*
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${SERCO}
All rights reserved.

This document discloses subject matter in which SERCO has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of SERCO to fulfill the purpose for which the document was
delivered to him.
*/

class Home {

    constructor() {
        // Bind the method correctly for both load and resize
        const boundSlider = this.handleResponsiveSliderLayout.bind(this);
        window.addEventListener("load", boundSlider);
        window.addEventListener("resize", boundSlider);
    }


    init() {

        // Hide scrollbars in Home Page
        $('body,html').css('overflow-x', 'hidden');

        // Hide the time period selector combobox
        $('#time-period-select-container').hide();

        // Hide copyright footer
        $('#footer-copyright').hide();
        //$('#copernicus-logo-footer').hide();
        $('#copernicus-logo-footer').css('visibility', 'hidden');

        // Shows logos in the Nav header
        $('#copernicus-logo-header').show();
        $('#ec-logo-header').show();

        // Load the custom message from the JSON file
        console.info('Loading custom message...');

        //this.fetchInstantMessages();
        if (window.SSR_INSTANT_MESSAGES) {
            this.renderInstantMessageCards(
                window.SSR_INSTANT_MESSAGES,
                window.SSR_TOTAL_MESSAGES
            );
        }

        // Remove Home video controls
        $('#home-video').hover(function toggleControls() {
            if (this.hasAttribute("controls")) {
                this.removeAttribute("controls")
            } else {
                this.setAttribute("controls", "controls")
            }
        })

        // Play video only after page loading
        window.onload = function () {
            $('#home-video').get(0).play();
        }
        this.handleResponsiveSliderLayout();
        //this.initSlider();
        return;
    }

    succesLoadAnomalies(response) {

        // Format the response from the query
        var rows = format_response(response);
        console.info('Events loaded. Num of events: ' + rows.length);

        // Define the events
        var now = new Date();
        var count = 0;
        var details = [];
        const allowedCategories = ['Platform', 'Acquisition', 'Production', 'Manoeuvre', 'Calibration'];
        for (var i = 0; i < rows.length; ++i) {
            var element = rows[i];

            // Until a full parsing of news is implemented, the start time is based
            // on the publication date, and the end time is set as 1 hour later
            var start_time = moment(element['start'], 'DD/MM/YYYY HH:mm:ss').toDate();
            var end_time = moment(element['end'], 'DD/MM/YYYY HH:mm:ss').toDate();

            // Append the anomaly in the list of items to be displayed if:
            // 1. The anomaly occurred within 48h from now
            // 2. There is at least one impacted datatake
            if ((now.getTime() - start_time.getTime() <= 48 * 60 * 60 * 1000) &&
                home.datatakesImpacted(element)) {

                var category = element["category"];
                if (!allowedCategories.includes(category)) {
                    continue;
                }
                // Increment count
                count++;

                // Save the event details
                // Create a new event to add in the Timeline
                // Modify the end date, based on the issue type
                var title;
                var item = element["impactedSatellite"];
                if (category == 'Platform') {
                    title = 'Satellite issue, affecting ' + item + ' data.';
                } else if (category == 'Acquisition') {
                    title = 'Acquisition issue, affecting ' + item + ' data.';
                    end_time.setTime(start_time.getTime() + 15 * 60 * 1000);
                } else if (category == 'Production') {
                    title = 'Production issue, affecting ' + item + ' data.';
                    end_time.setTime(start_time.getTime() + 120 * 60 * 1000);
                } else if (category == 'Manoeuvre') {
                    title = 'Manoeuvre issue, affecting ' + item + ' data.';
                    end_time.setTime(start_time.getTime() + 120 * 60 * 1000);
                } else if (category == 'Calibration') {
                    title = 'Calibration issue, affecting ' + item + ' data.';
                    end_time.setTime(start_time.getTime() + 120 * 60 * 1000);
                }

                // Add link to timeline session
                title += ' <a href="/events.html?showDayEvents=' + element['publicationDate'].substring(0, 10) + '">Read More</a>';

                // Append event details in the details panel
                console.info('Appending event: ' + title);
                details.push({
                    'time': start_time,
                    'content': title
                });

                // Limit the events count to 3 occurrences
                if (count == 2) break;
            }
        }

        // If no events is present, display a pleasant statement
        if (details.length == 0) {
            console.info('No recent event collected');
            $('#real-time-event-list-lg, #real-time-event-list-sm').append(
                '<li class="feed-item feed-item-success">' +
                '<i class="flaticon-success feed-item-icon"></i>' +
                '<h4 style="color: white; position: relative; top: -27px" class="text">Nominal operations</h4>' +
                '</li>'
            );
            return
        }

        // Otherwise, display the collected events
        $('#real-time-event-list-lg, #real-time-event-list-sm').html('');
        for (var i = 0; i < details.length; ++i) {
            var time_ago = (now.getTime() - details[i].time.getTime()) / (3600000);
            var time_measures = ' hour(s) ago';
            if (time_ago > 24) {
                let hours = time_ago - 24;
                time_ago = '1 day, ' + Math.round(hours);
            } else if (time_ago > 1) {
                time_ago = Math.round(time_ago);
            } else {
                time_ago = (now.getTime() - details[i].time.getTime()) / (60000);
                time_measures = ' minute(s) ago';
            }
            $('#real-time-event-list-lg, #real-time-event-list-sm').append(
                '<li class="feed-item feed-item-warning" style="color: white">' +
                '<i class="flaticon-alarm-1 feed-item-icon"></i>' +
                '<time class="date">' + time_ago + time_measures + '</time>' +
                '<div class="text" style="word-wrap: break-word; max-width: 250px">' + details[i].content + '</div>' +
                '</li>'
            );
        }

        return;
    }

    errorLoadAnomalies(response) {
        return;
    }

    datatakesImpacted(anomaly) {

        console.info('Checking datatake impact for anomaly: ' + anomaly["category"]);

        // Analyze the impact on production, anc choose the proper colour. If all products associated to
        // data takes where restored, display the anomaly in green; otherwise, use default orange color.
        var threshold = 90;
        var datatakes_completeness = format_response(anomaly['datatakes_completeness']);
        var completeness = 0;
        var allRecovered = true;
        for (var index = 0; index < datatakes_completeness.length; ++index) {
            try {
                for (const [key, value] of Object.entries(JSON.parse(datatakes_completeness[index].replaceAll('\'', '\"')))) {
                    var objValues = Object.values(value);
                    completeness = (objValues[1] + objValues[2] + objValues[3]) / 3;
                }
                if (completeness < threshold) {
                    allRecovered = false;
                    break;
                }
            } catch (ex) {
                console.warn('An error occurred, while parsing the product level count string');
                console.warn("Error ", ex);
                console.warn(anomaly);
            }
        }
        return !allRecovered;
    }

    /*displaySensingTimeMinutes() {
        datatakes.calcSensingTime24H();
        (async () => {
            while (datatakes.sensingTime24H == 0)
                await new Promise(resolve => setTimeout(resolve, 250));
            console.info('Minutes of sensing: ' + datatakes.sensingTime24H * 60);
            $('#sensing-time-minutes').html(Math.round(datatakes.sensingTime24H * 60));
        })();
    }*/

    /* displayPublishedProductsVolumeCount() {
         publicdata.get_published_count_size_last_24h();
         (async () => {
             while (!publicdata.published_last24h['NUM'])
                 await new Promise(resolve => setTimeout(resolve, 250));
             console.info('Number of published products: ' + publicdata.published_last24h['NUM']);
             $('#published-products-count').html(new Intl.NumberFormat().format(publicdata.published_last24h['NUM']));
         })();
         (async () => {
             while (!publicdata.published_last24h['VOL'])
                 await new Promise(resolve => setTimeout(resolve, 250));
             var vol = publicdata.published_last24h['VOL'] / (1024 * 1024 * 1024 * 1024);
             console.info('Volume of published products: ' + vol);
             $('#published-products-volume').html(new Intl.NumberFormat().format(vol.toFixed(2)));
         })();
     }*/
    //AD vertical slider
    handleResponsiveSliderLayout() {
        const leftSlide = document.querySelector(".left-slide");
        const rightSlide = document.querySelector(".right-slide");
        const sliderContainer = document.querySelector(".slider-container");
        if (!leftSlide || !rightSlide || !sliderContainer) return;

        const actionButtons = sliderContainer.querySelector(".action-buttons");

        if (window.innerWidth <= 768) {
            // Remove existing mobile slider
            const existingMobile = sliderContainer.querySelector(".mobile-slider");
            if (existingMobile) existingMobile.remove();

            leftSlide.style.display = "none";
            rightSlide.style.display = "none";
            if (actionButtons) actionButtons.style.display = "none";

            const mobileContainer = document.createElement("div");
            mobileContainer.classList.add("mobile-slider");

            const leftCards = Array.from(leftSlide.children);
            const rightCards = Array.from(rightSlide.children);

            leftCards.forEach((leftCard, i) => {
                const mobileSlide = document.createElement("div");
                mobileSlide.classList.add("mobile-slide");

                // Clone text content only
                const textClone = leftCard.cloneNode(true);

                // Clone <img> if exists in right card
                const rightImg = rightCards[i]?.querySelector('img');
                if (rightImg) {
                    const imgClone = rightImg.cloneNode(true);
                    mobileSlide.appendChild(imgClone);
                }

                mobileSlide.appendChild(textClone);
                mobileContainer.appendChild(mobileSlide);
            });

            sliderContainer.appendChild(mobileContainer);

        } else {
            // Remove mobile slider if exists
            const mobileSlider = sliderContainer.querySelector(".mobile-slider");
            if (mobileSlider) mobileSlider.remove();

            // Restore desktop slider
            leftSlide.style.display = "";
            rightSlide.style.display = "";
            if (actionButtons) actionButtons.style.display = "";

            // Reset positions
            leftSlide.style.transform = '';
            rightSlide.style.transform = '';
            const slidesLength = rightSlide.children.length;
            leftSlide.style.top = `-${(slidesLength - 1) * 80}vh`;

            // Re-init slider animation
            this.initSlider();
        }
    }


    initSlider() {
        const sliderContainer = document.querySelector(".slider-container");
        const slideRight = document.querySelector(".right-slide");
        const slideLeft = document.querySelector(".left-slide");
        const upButton = document.querySelector(".up-button");
        const downButton = document.querySelector(".down-button");

        if (!sliderContainer || !slideRight || !slideLeft || !upButton || !downButton) return;

        const slidesLength = slideRight.querySelectorAll("div").length;
        let activeSlideIndex = 0;

        slideLeft.style.top = `-${(slidesLength - 1) * 80}vh`;

        const changeSlide = (direction) => {
            if (direction === "up") {
                activeSlideIndex++;
                if (activeSlideIndex > slidesLength - 1) activeSlideIndex = 0;
            } else {
                activeSlideIndex--;
                if (activeSlideIndex < 0) activeSlideIndex = slidesLength - 1;
            }
            const height = sliderContainer.clientHeight;
            slideRight.style.transform = `translateY(-${activeSlideIndex * height}px)`;
            slideLeft.style.transform = `translateY(${activeSlideIndex * height}px)`;
        };

        upButton.addEventListener("click", () => changeSlide("up"));
        downButton.addEventListener("click", () => changeSlide("down"));
    }


    /*messages*/
    formatDate(dateString) {
        if (!dateString) return 'No date provided';

        const date = new Date(dateString);
        if (isNaN(date)) return 'Invalid date';

        return date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }


    /*fetchInstantMessages() {
        $.getJSON('/api/instant-messages/all', (data) => {
            const firstThree = data.messages.slice(0, 3);
            this.renderInstantMessageCards(firstThree, data.messages.length);
        }).fail((xhr) => {
            console.error("Failed to load instant messages:", xhr.responseText);
            $('#custom-banner-placeholder').html('<div class="bg-dark text-white text-center p-4 rounded">Failed to load instant messages.</div>');
        });
    }*/

    renderInstantMessageCards(instantMessages, totalMessages) {
        const allowedRoles = ['admin', 'esauser', 'ecuser'];
        const isPrivilegedUser = allowedRoles.includes(window.userRole);

        const adminLinkHtml = isPrivilegedUser ? `
        <div class="text-right mt-3">
            <a href="/admin/message?next=/index.html" style="color: #ffc107; font-weight: 500; text-decoration: none;">
                Add News
            </a>
        </div>` : '';

        if (!instantMessages.length) {
            const noNewsHtml = `
            <div class="bg-dark text-white text-center py-4">
                <h4 style="font-weight: 500;">News</h4>
                <p class="mb-2">There are no news at the moment.</p>
                ${adminLinkHtml}
            </div>`;
            $('#custom-banner-placeholder').html(noNewsHtml); // desktop
            $('#custom-banner-mobile').html(noNewsHtml); // mobile
            return;
        }

        // --- Desktop overlay ---
        let desktopHtml = `
        <div class="bg-dark p-3 rounded">
            <h4 class="card-title text-white text-center mb-3" style="font-weight: 500;">News</h4>`;

        instantMessages.forEach(item => {
            const icon = this.getIcon(item.messageType);
            const borderColor = this.getTypeColor(item.messageType);
            desktopHtml += `
                <div class="news-card p-2 rounded shadow mb-2" style="color: white;">
                <div class="d-flex align-items-start">
                    <i class="fas ${icon}" 
                    style="color: ${borderColor}; font-size: 1.2rem; margin-right: 8px; margin-top: 2px;"></i>
                    <div>
                    <div class="fw-bold">${item.title}</div>
                    <div class="text-muted small">${this.formatDate(item.publicationDate)}</div>
                    <div>${item.text || ''}</div>
                    ${item.link ? `<div><a href="${item.link}" target="_blank" style="color: #ffc107;">Read more</a></div>` : ''}
                    </div>
                </div>
                </div>`;
        });

        if (totalMessages > 3) {
            desktopHtml += `
            <div class="text-center mt-2">
                <a href="/newsList.html" class="btn btn-outline-light" style="border-color: #ffc107; font-weight: 500;  background-color: #FFC107 !important; color: #212529 !important;">View all news</a>
            </div>`;
        }

        desktopHtml += adminLinkHtml + '</div>';
        $('#custom-banner-placeholder').html(desktopHtml);


        // --- Mobile collapsible ---
        let mobileHtml = '';
        instantMessages.forEach(item => {
            mobileHtml += `
            <div class="news-card p-2 rounded shadow mb-2">
                <div class="fw-bold">${item.title}</div>
                <div class="text-muted small">${this.formatDate(item.publicationDate)}</div>
                <div>${item.text || ''}</div>
                ${item.link ? `<div><a href="${item.link}" target="_blank" style="color: #ffc107;">Read more</a></div>` : ''}
            </div>`;
        });

        if (totalMessages > 3) {
            mobileHtml += `
            <div class="text-center mt-2">
                <a href="/newsList.html" class="btn btn-outline-light" style="border-color: #ffc107; background-color: #FFC107; color: #212529 !important;">View all news</a>
            </div>`;
        }

        mobileHtml += adminLinkHtml;
        $('#custom-banner-mobile').html(mobileHtml);
    }

    getIcon(type) {
        switch ((type || '').toLowerCase()) {
            case 'success': return 'fa-check-circle';
            case 'info': return 'fa-info-circle';
            case 'warning': return 'fa-exclamation-circle';
            case 'danger': return 'fa-exclamation-triangle';
            default: return 'fa-bullhorn';
        }
    }

    getTypeColor(type) {
        switch ((type || '').toLowerCase()) {
            case 'success': return '#28a745';
            case 'info': return '#17a2b8';
            case 'warning': return '#ffc107';
            case 'danger': return '#dc3545';
            default: return '#006B7C';
        }
    }

}
// Smooth scroll for chevrons
// ============================
$('.chevron-down, .chevron-up').on('click', function (e) {
    e.preventDefault();
    const target = $($(this).attr('href'));
    if (target.length) {
        target[0].scrollIntoView({ behavior: 'smooth' });
    }
});

let home = new Home();