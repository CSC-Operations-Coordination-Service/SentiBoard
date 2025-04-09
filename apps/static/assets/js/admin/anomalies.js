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
            'Copernicus Sentinel-1B',
            'Copernicus Sentinel-1C',
            'Copernicus Sentinel-1D',
            'Copernicus Sentinel-2A',
            'Copernicus Sentinel-2B',
            'Copernicus Sentinel-2C',
            'Copernicus Sentinel-2D',
            'Copernicus Sentinel-3A',
            'Copernicus Sentinel-3B',
            'Copernicus Sentinel-3C',
            'Copernicus Sentinel-3D',
            'Copernicus Sentinel-5p'];

        // Map containing serialized impacted items given the category
        this.impactedItems = {
            'Acquisition': ['Svalbard', 'Matera', 'Maspalomas', 'Inuvik', 'Neustrelitz', 'EDRS'],
            'Platform': ['OCP', 'PDHT', 'SAR', 'OLCI', 'SLSTR', 'SRAL', 'MWR', 'TROPOMI', 'MMFU', 'MSI', 'DORIS'],
            'Production': ['S1 Production Service', 'S2 Production Service', 'S3 Production Service', 'S5 Production Service'],
            'Data access': ['CDSE', 'Open Access Hub', 'Scientific Hub'],
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

    addAnomaly() {
        anomalies.buildAnomalyDetailsPanel(null);
    }

    editAnomalyDetails(key) {
        let anomaly = anomalies.anomalies[key];
        anomalies.buildAnomalyDetailsPanel(anomaly);
    }

    buildAnomalyDetailsPanel(anomaly) {

        // Build widgets
        $('#anomaly-details').html('');

        // ID
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-id-div">' +
                '<input type="text" disabled style="color: #6c757d" class="form-control" id="anomaly-id" hidden>' +
            '</div>');

        // Key
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-key-div">' +
                '<label for="anomaly-key">Anomaly key</label>' +
                '<input type="text" class="form-control" id="anomaly-key" style="width: 200px">' +
            '</div>');

        // Title
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-title-div">' +
                '<label for="anomaly-key">Anomaly title</label>' +
                '<input type="text" class="form-control" id="anomaly-title" style="width: 200px">' +
            '</div>');

        // Category select
        $('#anomaly-details').append(
            '<div class="form-group" style="padding-left: 30px">' +
                '<label for="anomaly-category-select">Category</label>' +
                '<select class="form-control" id="anomaly-category-select" placeholder="category" style="width: 200px"></select>' +
            '</div>');
        anomalies.categories.forEach(function(category) {
            $('#anomaly-category-select').append('<option value="' + category + '">' + category + '</option>');
        });
        $('#anomaly-category-select').on('change', function (e) {
            var category = this.value;
            anomalies.updateAnomalyDetailsPanelSelectedItems(category, anomaly);
        });

        // Impacted item select
        $('#anomaly-details').append(
            '<div class="form-group">' +
                '<label for="anomaly-impacted-item-select">Impacted Item</label>' +
                '<select class="form-control" id="anomaly-impacted-item-select" placeholder="impacted item" style="width: 200px"></select>' +
            '</div>');
        var category = $('#anomaly-category-select').val();
        anomalies.updateAnomalyDetailsPanelSelectedItems(category, anomaly);

        // Impacted satellite select
        $('#anomaly-details').append(
            '<div class="form-group" style="padding-left: 30px">' +
                '<label for="anomaly-impacted-satellite-select">Impacted Satellite</label>' +
                '<select class="form-control" id="anomaly-impacted-satellite-select" placeholder="impacted satellite" style="width: 200px"></select>' +
            '</div>');
        anomalies.impactedSatellites.forEach(function(satellite) {
            $('#anomaly-impacted-satellite-select').append('<option value="' + satellite + '">' + satellite + '</option>');
        });

        // Occurrence date
        $('#anomaly-details').append(
            '<div class="form-group">' +
                '<label for="anomaly-occurrence-date">Occurrence date</label>' +
                '<input class="form-control" type="text" id="anomaly-occurrence-date" style="width: 200px"></input>' +
            '</div>');

        // Data takes
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-environment-div" style="padding-left: 30px; width: 470px">' +
                '<label for="anomaly-environment">Datatakes</label>' +
                '<input type="text" class="form-control" id="anomaly-environment" placeholder="datatakes">' +
            '</div>');

        // News title
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-news-title-div" style="padding-left: 30px; width: 470px">' +
                '<label for="anomaly-news-title">News title</label>' +
                '<input type="text" class="form-control" id="anomaly-news-title" placeholder="related news title">' +
            '</div>');

        // News link
        $('#anomaly-details').append(
            '<div class="form-group" id="anomaly-news-link-div" style="padding-left: 30px; width: 470px">' +
                '<label for="anomaly-news-link">News link</label>' +
                '<input type="text" class="form-control" id="anomaly-news-link" placeholder="related news link">' +
            '</div>');

        // If an anomaly is defined, populate editing fields
        if (anomaly) {
            $('#anomaly-id').val(anomaly['id']);
            $('#anomaly-key').val(anomaly['key']);
            $('#anomaly-key').attr('disabled', 'disabled');
            $('#anomaly-key').css('color', '#383838');
            $('#anomaly-title').val(anomaly['title']);
            $('#anomaly-title').attr('disabled', 'disabled');
            $('#anomaly-title').css('color', '#383838');
            $('#anomaly-category-select').val(anomaly['category']);
            $('#anomaly-impacted-item-select').empty();
            anomalies.impactedItems[anomaly['category']].forEach(function(item) {
                $('#anomaly-impacted-item-select').append('<option value="' + item + '">' + item + '</option>');
            });
            $('#anomaly-impacted-item-select').val(anomaly['impactedItem']);
            $('#anomaly-impacted-satellite-select').val(anomaly['impactedSatellite']);
            $('#anomaly-occurrence-date').val(anomaly['publicationDate']);
            $('#anomaly-occurrence-date').attr('disabled', 'disabled');
            $('#anomaly-occurrence-date').css('color', '#383838');
            $('#anomaly-environment').val(anomaly['environment']);
            $('#anomaly-news-title').val(anomaly['newsTitle']);
            $('#anomaly-news-link').val(anomaly['newsLink']);
        }
    }

    updateAnomalyDetailsPanelSelectedItems(selectedCategory, anomaly) {
        $('#anomaly-impacted-item-select').children().remove();
        anomalies.impactedItems[selectedCategory].forEach(function(item) {
            $('#anomaly-impacted-item-select').append('<option value="' + item + '">' + item + '</option>');
        });

        // if an anomaly is defined, set the proper impacted item
        if (anomaly) {
            $('#anomaly-impacted-item-select').val(anomaly['impactedItem']);
        }
    }

    saveAnomaly() {

        // Retrieve modified anomaly's details
        let key = $('#anomaly-key').val();
        let title = $('#anomaly-title').val();
        let occurrenceDate = $('#anomaly-occurrence-date').val();
        let category =  $('#anomaly-category-select').val();
        let impactedItem = $('#anomaly-impacted-item-select').val();
        let impactedSatellite = $('#anomaly-impacted-satellite-select').val();
        let environment = $('#anomaly-environment').val();
        let newsTitle = $('#anomaly-news-title').val();
        let newsLink = $('#anomaly-news-link').val();

        // Invoke user's details save or update
        let newAnomaly = false;
        let anomaly = anomalies.anomalies[key];
        if (anomaly == null) {
            newAnomaly = true;
            anomaly = {};
            anomaly['key'] = key;
            anomaly['title'] = title;
            anomaly['publicationDate'] = occurrenceDate;
        }
        anomaly['category'] = category;
        anomaly['impactedItem'] = impactedItem;
        anomaly['impactedSatellite'] = impactedSatellite;
        anomaly['environment'] = environment;
        anomaly['newsTitle'] = newsTitle;
        anomaly['newsLink'] = newsLink;

        if (newAnomaly) {
            ajaxCall('/api/events/anomalies/add', 'POST', anomaly, this.successSaveAnomaly.bind(this),
                this.errorSaveAnomaly.bind(this));
        } else {
            ajaxCall('/api/events/anomalies/update', 'PUT', anomaly, this.successSaveAnomaly.bind(this),
                this.errorSaveAnomaly.bind(this));
        }
    }

    successSaveAnomaly() {

        // Close edit anomaly modal window
        $('#editAnomalyModal').modal('hide');

        // Clean anomaly details panel
        $('#anomaly-id').val('');
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

    errorSaveAnomaly() {
        console.error(response)
        return;
    }

}

let anomalies = new Anomalies();