/*
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
*/

class Anomalies {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        // Anomalies table
        try {
            this.anomaliesTable = $('#basic-datatables-anomalies').DataTable({
                "language": {
                  "emptyTable": "Retrieving anomalies..."
                },
                columnDefs: [{
                        targets: -1,
                        data: null,
                        render: function (data, type, row) {
                            if (type === 'display') {

                                // Add action buttons
                                let actions = '<button type="button" class="btn-link" data-toggle="modal" data-target="#editAnomalyModal" '+
                                    'onclick="anomalies.editAnomalyDetails(\'' + data[0] + '\')"><i class="icon-pencil"></i></button>';

                                // if the anomaly is binded to a news on Sentinel Online, display a "link" icon
                                if (anomalies.anomalies[data[0]]['newsLink']) {
                                    actions += '<button type="button" class="btn-link">' +
                                        '<a href="' + anomalies.anomalies[data[0]]['newsLink'] + '"><i class="icon-link"></i></button></a>';
                                }
                                return actions;
                            } else {
                                return data;
                            }
                        }
                    }]
                });
        } catch(err) {
            console.info('Initializing anomalies class - skipping table creation...')
        }

        // Array containing serialized anomaly categories
        this.categories = [
            'Acquisition',
            'Platform',
            'Production',
            'Data access',
            'Archive',
            'Manoeuvre',
            'Calibration'];

        // Array containing serialized impacted satellites
        this.impactedSatellites = [
            'Copernicus Sentinel-1A',
            'Copernicus Sentinel-2A',
            'Copernicus Sentinel-2B',
            'Copernicus Sentinel-3A',
            'Copernicus Sentinel-3B',
            'Copernicus Sentinel-5p'];

        // Map containing serialized impacted items given the category
        this.impactedItems = {
            'Acquisition': ['Svalbard', 'Matera', 'Maspalomas', 'Inuvik', 'Neustrelitz', 'EDRS'],
            'Platform': ['OCP', 'PDHT', 'SAR', 'OLCI', 'SLSTR', 'SRAL', 'MWR', 'TROPOMI', 'MMFU', 'MSI', 'DORIS'],
            'Production': ['S1 Production Service', 'S2 Production Service', 'S3 Production Service', 'S5 Production Service'],
            'Data access': ['Open Access Hub', 'Scientific Hub'],
            'Archive': ['LTA-1', 'LTA-2', 'LTA-3', 'LTA-4'],
            'Manoeuvre': ['Platform'],
            'Calibration': ['Platform']}

        // Map containing serialized anomalies accessed from "key" field
        this.anomalies = {};
    }

    init() {

        // Retrieve the anomalies from local MYSQL DB
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {}, anomalies.successLoadAnomalies.bind(this),
            anomalies.errorLoadAnomalies.bind(this));

        return;
    }

    successLoadAnomalies(response) {

        // Acknowledge the successful retrieval of anomalies
        var rows = format_response(response);
        console.info('Anomalies successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        var data = new Array();
        for (var i = 0 ; i < rows.length ; ++i){

            // Auxiliary variables
            var anomaly = rows[i];
            var key = anomaly['key'];

            // Save a local copy of the anomaly
            anomalies.anomalies[key] = anomaly;

            // Push the element row, with the collected information
            // row is a datatable row, related to a single user
            // Anomaly status record:
            // key, title, publicationDate, category, impactedItem, impactedSatellite
            data.push([anomaly['key'], anomaly['title'], anomaly['publicationDate'], anomaly['category'],
                anomaly['impactedItem'], anomaly['impactedSatellite']]);
        }

        // Refresh users table and return
        anomalies.anomaliesTable.clear().rows.add(data).draw();
        return;
    }

    errorLoadAnomalies(response){
        console.error(response)
        return;
    }

    editAnomalyDetails(key) {
        let anomaly = anomalies.anomalies[key];
        anomalies.buildAnomalyDetailsPanel(anomaly);
    }

    buildAnomalyDetailsPanel(anomaly) {

        // Build widgets
        // Key
        $('#anomaly-details').html('');
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-key-div">' +
                '<label for="anomaly-key">Anomaly key</label>' +
                '<input type="text" disabled style="color: #6c757d" class="form-control" id="anomaly-key" placeholder="anomaly key">' +
            '</div>');
        $('#anomaly-key').val(anomaly['key']);

        // Category select
        $('#anomaly-details').append(
            '<div class="form-group">' +
                '<label for="anomaly-category-select">Category</label>' +
                '<select class="form-control" id="anomaly-category-select" placeholder="category"></select>' +
            '</div>');
        let selectedCategory = null
        anomalies.categories.forEach(function(category) {
            if (anomaly['category'] === category) selectedCategory = category;
            let selected = anomaly['category'] === category ? ' selected ' : '';
            $('#anomaly-category-select').append('<option value="' + category + '"' + selected + '>' + category + '</option>');
        });
        $('#anomaly-category-select').on('change', function (e) {
            var category = this.value;
            anomalies.updateAnomalyDetailsPanelSelectedItems(category, anomaly);
        });

        // Impacted item select
        $('#anomaly-details').append(
            '<div class="form-group">' +
                '<label for="anomaly-impacted-item-select">Impacted Item</label>' +
                '<select class="form-control" id="anomaly-impacted-item-select" placeholder="impacted item"></select>' +
            '</div>');
        anomalies.impactedItems[selectedCategory].forEach(function(item) {
            let selected = anomaly['impactedItem'] === item ? ' selected ' : '';
            $('#anomaly-impacted-item-select').append('<option value="' + item + '"' + selected + '>' + item + '</option>');
        });

        // Impacted satellite select
        $('#anomaly-details').append(
            '<div class="form-group">' +
                '<label for="anomaly-impacted-satellite-select">Impacted Satellite</label>' +
                '<select class="form-control" id="anomaly-impacted-satellite-select" placeholder="impacted satellite"></select>' +
            '</div>');
        anomalies.impactedSatellites.forEach(function(satellite) {
            let selected = anomaly['impactedSatellite'] === satellite ? ' selected ' : '';
            $('#anomaly-impacted-satellite-select').append('<option value="' + satellite + '"' + selected + '>' + satellite + '</option>');
        });

        // Data takes
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-environment-div" style="width: 430px">' +
                '<label for="anomaly-environment">Datatakes</label>' +
                '<input type="text" class="form-control" id="anomaly-environment" placeholder="datatakes">' +
            '</div>');
        $('#anomaly-environment').val(anomaly['environment']);

        // News title
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-news-title-div" style="width: 430px">' +
                '<label for="anomaly-news-title">News title</label>' +
                '<input type="text" class="form-control" id="anomaly-news-title" placeholder="related news title">' +
            '</div>');
        $('#anomaly-news-title').val(anomaly['newsTitle']);

        // News link
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-news-link-div" style="width: 430px">' +
                '<label for="anomaly-news-link">News link</label>' +
                '<input type="text" class="form-control" id="anomaly-news-link" placeholder="related news link">' +
            '</div>');
        $('#anomaly-news-link').val(anomaly['newsLink']);
    }

    updateAnomalyDetailsPanelSelectedItems(selectedCategory, anomaly) {
        $('#anomaly-impacted-item-select').children().remove();
        anomalies.impactedItems[selectedCategory].forEach(function(item) {
            let selected = anomaly['impactedItem'] === item ? ' selected ' : '';
            $('#anomaly-impacted-item-select').append('<option value="' + item + '"' + selected + '>' + item + '</option>');
        });
    }

    updateAnomaly() {

        // Retrieve modified anomaly's details
        let key = $('#anomaly-key').val();
        let category =  $('#anomaly-category-select').val();
        let impactedItem = $('#anomaly-impacted-item-select').val();
        let impactedSatellite = $('#anomaly-impacted-satellite-select').val();
        let environment = $('#anomaly-environment').val();
        let newsTitle = $('#anomaly-news-title').val();
        let newsLink = $('#anomaly-news-link').val();

        // Invoke user's details update
        let anomaly = anomalies.anomalies[key];
        anomaly['category'] = category;
        anomaly['impactedItem'] = impactedItem;
        anomaly['impactedSatellite'] = impactedSatellite;
        anomaly['environment'] = environment;
        anomaly['newsTitle'] = newsTitle;
        anomaly['newsLink'] = newsLink;
        ajaxCall('/api/events/anomalies/update', 'POST', anomaly, this.successUpdateAnomaly.bind(this),
            this.errorUpdateAnomaly.bind(this));
    }

    successUpdateAnomaly() {

        // Close edit anomaly modal window
        $('#editAnomalyModal').modal('hide');

        // Clean anomaly details panel
        $('#anomaly-key').val('');
        $('#anomaly-category-select').val('');
        $('#anomaly-impacted-item-select').val('');
        $('#anomaly-impacted-satellite-select').val('');
        $('#anomaly-environment').val('');
        $('#anomaly-news-title').val('');
        $('#anomaly-news-link').val('');

        // Refresh anomalies table
        asyncAjaxCall('/api/events/anomalies/previous-quarter', 'GET', {}, anomalies.successLoadAnomalies,
            anomalies.errorLoadAnomalies);
    }

    errorUpdateAnomaly() {
        console.error(response)
        return;
    }
}

let anomalies = new Anomalies();