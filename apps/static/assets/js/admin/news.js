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

class News {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        // News table
        try {
            this.newsTable = $('#basic-datatables-news').DataTable({
                "language": {
                  "emptyTable": "Retrieving news..."
                },
                columnDefs: [{
                        targets: -1,
                        data: null,
                        render: function (data, type, row) {
                            if (type === 'display') {
                                return '<button type="button" class="btn-link" data-toggle="modal" data-target="#editNewsModal" '+
                                    'onclick="news.editNewsDetails(\'' + data[4] + '\')"><i class="icon-pencil"></i></button>';
                            } else {
                                return data;
                            }
                        }
                    }]
                });
        } catch(err) {
            console.info('Initializing news class - skipping table creation...')
        }

        // Array containing serialized anomaly categories
        this.categories = [
            'Acquisition',
            'Platform',
            'Production',
            'Manoeuvre',
            'Calibration',
            'Data access',
            'Archive'];

        // Array containing serialized impacted satellites
        this.impactedSatellites = [
            'Copernicus Sentinel-1A',
            'Copernicus Sentinel-2A',
            'Copernicus Sentinel-2B',
            'Copernicus Sentinel-3A',
            'Copernicus Sentinel-3B',
            'Copernicus Sentinel-5p',];

        // Map containing serialized anomalies accessed from "key" field
        this.newsList = {};
    }

    init() {
        $('#esa-logo-header').hide();
        // Retrieve the anomalies from local MYSQL DB
        asyncAjaxCall('/api/events/news/previous-quarter', 'GET', {}, news.successLoadNews.bind(this),
            news.errorLoadNews.bind(this));

        return;
    }

    successLoadNews(response) {

        // Acknowledge the successful retrieval of news
        var rows = format_response(response);
        console.info('News successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        var data = new Array();
        for (var i = 0 ; i < rows.length ; ++i){

            // Auxiliary variables
            // Use the link as the unique key identifier (human readable)
            var newsItem = rows[i];
            var key = newsItem['link'];

            // Save a local copy of the news
            news.newsList[key] = newsItem;

            // Push the element row, with the collected information
            // row is a datatable row, related to a single user
            // News status record:
            // Title, occurrenceDate, category, impactedSatellite, link
            data.push([newsItem['title'], newsItem['occurrenceDate'], newsItem['category'],
                newsItem['impactedSatellite'], newsItem['link']]);
        }

        // Refresh news table and return
        news.newsTable.clear().rows.add(data).draw();
        return;
    }

    errorLoadNews(response){
        console.error(response)
        return;
    }

    editNewsDetails(key) {
        let newsItem = news.newsList[key];
        news.buildNewsDetailsPanel(newsItem);
    }

    buildNewsDetailsPanel(newsItem) {

        // Build widgets
        // Title
        $('#news-details').html('');
        $('#news-details').append(
            '<div class="form-group" id="news-title-div" style="width: 430px">' +
                '<label for="news-title">News title</label>' +
                '<input type="text" disabled style="color: #6c757d" class="form-control" id="news-title" placeholder="news title">' +
            '</div>');
        $('#news-title').val(newsItem['title']);

        // Link
        $('#news-details').append(
            '<div class="form-group" id="news-link-div" style="width: 430px">' +
                '<label for="news-link">Link</label>' +
                '<input type="text" disabled style="color: #6c757d" class="form-control" id="news-link" placeholder="news link">' +
            '</div>');
        $('#news-link').val(newsItem['link']);

        // Category select
        $('#news-details').append(
            '<div class="form-group">' +
                '<label for="news-category-select">Category</label>' +
                '<select class="form-control" id="news-category-select" placeholder="category"></select>' +
            '</div>');
        let selectedCategory = null
        news.categories.forEach(function(category) {
            if (newsItem['category'] === category) selectedCategory = category;
            let selected = newsItem['category'] === category ? ' selected ' : '';
            $('#news-category-select').append('<option value="' + category + '"' + selected + '>' + category + '</option>');
        });

        // Impacted satellite select
        $('#news-details').append(
            '<div class="form-group">' +
                '<label for="news-impacted-satellite-select">Impacted Satellite</label>' +
                '<select class="form-control" id="news-impacted-satellite-select" placeholder="impacted satellite"></select>' +
            '</div>');
        news.impactedSatellites.forEach(function(satellite) {
            let selected = newsItem['impactedSatellite'] === satellite ? ' selected ' : '';
            $('#news-impacted-satellite-select').append('<option value="' + satellite + '"' + selected + '>' + satellite + '</option>');
        });

        // Occurrence date
        $('#news-details').append(
            '<div class="form-group" id="news-occurrence-date-div" style="width: 430px">' +
                '<label for="news-occurrence-date">Occurrence date</label>' +
                '<input type="text" class="form-control" id="news-occurrence-date" placeholder="dd/MM/yyyy HH:mm:ss.SSSSSS">' +
            '</div>');
        $('#news-occurrence-date').val(newsItem['occurrenceDate']);

        // Data takes
        $('#news-details').append(
            '<div class="form-group" id="news-environment-div" style="width: 430px">' +
                '<label for="news-environment">Datatakes</label>' +
                '<input type="text" class="form-control" id="news-environment" placeholder="datatakes">' +
            '</div>');
        $('#news-environment').val(newsItem['environment']);
    }

    updateNews() {

        // Retrieve modified news details
        let link = $('#news-link').val();
        let title = $('#news-title').val();
        let category = $('#news-category-select').val();
        let impactedSatellite = $('#news-impacted-satellite-select').val();
        let environment = $('#news-environment').val();
        let occurrenceDate = $('#news-occurrence-date').val();

        // Invoke user's details update
        let newsItem = news.newsList[link];
        newsItem['link'] = link;
        newsItem['title'] = title;
        newsItem['category'] = category;
        newsItem['impactedSatellite'] = impactedSatellite;
        newsItem['environment'] = environment;
        newsItem['occurrenceDate'] = occurrenceDate;
        ajaxCall('/api/events/news/update', 'POST', newsItem, this.successUpdateNews.bind(this), this.errorUpdateNews.bind(this));
    }

    successUpdateNews() {

        // Close edit anomaly modal window
        $('#editNewsModal').modal('hide');

        // Clean news details panel
        $('#news-link').val('');
        $('#news-category-select').val('');
        $('#news-impacted-satellite-select').val('');
        $('#news-link').val('');
        $('#news-environment').val('');
        $('#news-occurrence-date').val('');

        // Refresh anomalies table
        asyncAjaxCall('/api/events/news/previous-quarter', 'GET', {}, news.successLoadNews, news.errorLoadNews);
    }

    errorUpdateNews() {
        console.error(response)
        return;
    }
}

let news = new News();