/*
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} 
All rights reserved.

This document discloses subject matter in which SERCO has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of SERCO to fulfill the purpose for which the document was
delivered to him.
*/

class Home {

    constructor() {
        window.addEventListener("resize", this.handleResponsiveSliderLayout.bind(this));
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

        // Load the events from local db
        console.info('Loading events...');
        asyncAjaxCall('/api/events/anomalies/last-24h', 'GET', {}, this.succesLoadAnomalies, this.errorLoadAnomalies);

        // Load data takes and calculate the hours of sensing
        //console.info('Retrieving the hours of sensing...');
        /*this.displaySensingTimeMinutes();*/

        // Retrieve the number and size of the published products
        // console.info('Retrieving the volume and number of published products...');
        /*this.displayPublishedProductsVolumeCount();*/

        // Load the custom message from the JSON file
        console.info('Loading custom message...');
        // This is a custom message that can be used to display important information
        // in the Home page, such as anomalies or important updates.
        // The message is loaded from a JSON file, which can be edited by the user.
        // The JSON file should be located in the static/data folder, and should have the following
        // structure:
        // {
        //   "active": true, // If true, the message will be displayed
        //   "type": "warning", // The type of the message (info, warning, danger)
        //   "text": "Your message here", // The message text
        //   "link": "/path/to/your/link" // Optional link to more information
        // }
        // If the "active" field is set to false, the message will not be displayed
        // If the "link" field is not present, the link will not be displayed
        // If the "type" field is not present, the default type will be "info"
        // If the "text" field is not present, the default text will be "No message"

        $.getJSON("/api/news-images", function (imageList) {
            //console.log("News images loaded:", imageList);
            $.getJSON("/static/assets/json/custom-message.json", function (messages) {
                if (!Array.isArray(messages)) {
                    messages = [messages];
                }

                const adminLinkHtml = `
                <div class="text-right mb-2">
                    <a href="/admin/message" style="color: #ffc107; font-weight: 500; text-decoration: underline;">
                        Add a new news item
                    </a>
                </div>`;

                function getBorderColor(type) {
                    switch (type) {
                        case 'success': return '#28a745';
                        case 'info': return '#17a2b8';
                        case 'warning': return '#ffc107';
                        case 'danger': return '#dc3545';
                        default: return '#006B7C';
                    }
                }

                function getIcon(type) {
                    switch (type) {
                        case 'success': return 'fa-check-circle';
                        case 'info': return 'fa-info-circle';
                        case 'warning': return 'fa-exclamation-circle';
                        case 'danger': return 'fa-exclamation-triangle';
                        default: return 'fa-bullhorn';
                    }
                }

                /*function getRandomImageUrl() {
                    if (!imageList.length) {
                        return '/static/assets/img/default-news.jpg';
                    }
                    const randomImage = imageList[Math.floor(Math.random() * imageList.length)];
                    return `/static/assets/img/news/${randomImage}`;
                }*/

                const allActiveMessages  = messages.filter(msg => msg.active);
                const displayedMessages = allActiveMessages.slice(0, 6);
                const pageSize = 3;
                let currentPage = 0;
                const totalPages = Math.ceil(displayedMessages.length / pageSize);
                const colClass = displayedMessages.length >= 3 ? 'col-md-6 col-lg-4' : displayedMessages.length === 2 ? 'col-md-6' : 'col-12';

                function renderPage(page) {
                    const startIndex = page * pageSize;
                    const group = displayedMessages.slice(startIndex, startIndex + pageSize);
                    let newsHtml = '<div class="row">';

                    group.forEach((msg, j) => {
                        //const imgUrl = getRandomImageUrl();
                        const iconClass = getIcon(msg.type);
                        const borderColor = getBorderColor(msg.type);
                        const delay = (j * 0.2 + 0.2).toFixed(1);

                        newsHtml += `
                        <div class="${colClass} mb-4">
                            <div class="news-card h-100 d-flex align-items-center p-3 rounded shadow animate__animated animate__fadeInUp"
                                style="background-color: #00252E; color: white; animation-delay: ${delay}s;">
                                <div class="news-card-icon flex-shrink-0" style="font-size: 2.5rem; color: ${borderColor}; margin-right: 1rem;">
                                    <i class="fa ${iconClass}"></i>
                                </div>
                                <div class="news-card-content" style="font-size: 1.1rem;">
                                    <div>${msg.text}</div>
                                    ${msg.link ? `<div class="mt-2"><a href="${msg.link}" class="alert-link" style="color: #ffc107; text-decoration: underline;">Read more</a></div>` : ''}
                                </div>
                            </div>
                        </div>`;
                    });

                    newsHtml += '</div>';

                    // Pagination Controls
                    let paginationControls = '';
                    if (totalPages > 1) {
                        paginationControls += `
                        <div class="d-flex justify-content-center align-items-center mt-3 gap-3">
                            <button class="btn btn-link p-0" id="prevPage" ${page === 0 ? 'disabled' : ''} style="font-size: 2rem; color: white;">
                                <i class="fa fa-chevron-left"></i>
                            </button>
                            <span class="text-white mx-2" style="font-weight: 500;">${page + 1} / ${totalPages}</span>
                            <button class="btn btn-link p-0" id="nextPage" ${page >= totalPages - 1 ? 'disabled' : ''} style="font-size: 2rem; color: white;">
                                <i class="fa fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="text-center mt-3">
                            <a href="/news-list.html" class="btn btn-outline-light btn"  style="border-color: #ffc107; color: #212529 !important; font-weight: 500; background-color: #FFC107 !important;">
                                View all news
                            </a>
                        </div>`;
                    }

                    const newsSectionHtml = `
                    <div style="background-color: #00252E; padding: 2rem;">
                        <h2 class="text-white text-center mb-4" style="font-weight: 600;">NEWS</h2>
                        <div class="container">
                            ${adminLinkHtml}
                            ${newsHtml}
                            ${paginationControls}
                        </div>
                    </div>`;

                    $('#custom-banner-placeholder').html(newsSectionHtml);

                    $('#prevPage').on('click', () => {
                        if (currentPage > 0) {
                            currentPage--;
                            renderPage(currentPage);
                        }
                    });

                    $('#nextPage').on('click', () => {
                        if (currentPage < totalPages - 1) {
                            currentPage++;
                            renderPage(currentPage);
                        }
                    });
                }

                if (displayedMessages.length === 0) {
                    $('#custom-banner-placeholder').empty();
                } else {
                    renderPage(currentPage);
                }
            });
        });



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
        this.initSlider();

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

        // Mobile: stack slides vertically
        if (window.innerWidth <= 768) {
            if (!document.querySelector(".mobile-slide")) {
                const mobileSlide = document.createElement("div");
                mobileSlide.classList.add("mobile-slide");

                const leftSlides = [...leftSlide.children];
                const rightSlides = [...rightSlide.children].reverse(); // match original top-bottom order

                for (let i = 0; i < leftSlides.length; i++) {
                    mobileSlide.appendChild(rightSlides[i].cloneNode(true));
                    mobileSlide.appendChild(leftSlides[i].cloneNode(true));
                }

                sliderContainer.innerHTML = "";
                sliderContainer.appendChild(mobileSlide);
            }
        } else {
            // Restore original slider layout
            if (!document.querySelector(".left-slide") && !document.querySelector(".right-slide")) {
                location.reload(); // simple reload fallback to reset DOM (or implement dynamic rebuild)
            }
        }
    }

    initSlider() {
        if (window.innerWidth <= 768) {
            const leftSlide = document.querySelector('.left-slide');
            const rightSlide = document.querySelector('.right-slide');

            if (!leftSlide || !rightSlide) return;

            const textCards = leftSlide.children;
            const imageCards = rightSlide.children;

            const mobileContainer = document.createElement('div');
            mobileContainer.className = 'mobile-slider';

            for (let i = 0; i < textCards.length; i++) {
                const slideWrapper = document.createElement('div');
                slideWrapper.className = 'mobile-slide';

                const imgClone = imageCards[i].cloneNode(true);
                const textClone = textCards[i].cloneNode(true);

                slideWrapper.appendChild(imgClone);
                slideWrapper.appendChild(textClone);
                mobileContainer.appendChild(slideWrapper);
            }
            // Insert mobileContainer before the leftSlide (or wherever makes sense)
            const parent = document.querySelector('#vertical-slider .container');
            parent.insertBefore(mobileContainer, leftSlide);

            // Hide the original slider on mobile
            leftSlide.style.display = 'none';
            rightSlide.style.display = 'none';
            document.querySelector('.action-buttons').style.display = 'none';
        }

        const sliderContainer = document.querySelector(".slider-container");
        const slideRight = document.querySelector(".right-slide");
        const slideLeft = document.querySelector(".left-slide");
        const upButton = document.querySelector(".up-button");
        const downButton = document.querySelector(".down-button");

        if (!sliderContainer || !slideRight || !slideLeft || !upButton || !downButton) {
            console.warn("Slider elements not found. Skipping slider initialization.");
            return;
        }

        const slidesLength = slideRight.querySelectorAll("div").length;
        let activeSlideIndex = 0;

        slideLeft.style.top = `-${(slidesLength - 1) * 80}vh`;

        const changeSlide = (direction) => {
            if (direction === "up") {
                activeSlideIndex++;
                if (activeSlideIndex > slidesLength - 1) {
                    activeSlideIndex = 0;
                }
            } else if (direction === "down") {
                activeSlideIndex--;
                if (activeSlideIndex < 0) {
                    activeSlideIndex = slidesLength - 1;
                }
            }

            const height = sliderContainer.clientHeight;

            slideRight.style.transform = `translateY(-${activeSlideIndex * height}px)`;
            slideLeft.style.transform = `translateY(${activeSlideIndex * height}px)`;
        };

        upButton.addEventListener("click", () => changeSlide("up"));
        downButton.addEventListener("click", () => changeSlide("down"));
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
