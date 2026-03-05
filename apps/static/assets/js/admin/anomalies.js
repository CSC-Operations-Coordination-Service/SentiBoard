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

class Anomalies {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        this.anomaliesTable = null;
        this.anomalies = {};

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
            'Calibration': ['Platform']
        }
    }

    init(serverData) {

        $('#esa-logo-header').hide();

        if (serverData) {
            this.anomalies = serverData;
        }

        // Simply initialize the datatable on the existing HTML
        this.anomaliesTable = $('#basic-datatables-anomalies').DataTable({
            "pageLength": 10,
        });
    }

    addAnomaly() {
        this.buildAnomalyDetailsPanel(null);
        $('#editAnomalyModal').modal('show');
    }

    editAnomalyDetails(key) {
        const anomaly = anomalies.anomalies[key];
        this.buildAnomalyDetailsPanel(anomaly);
        $('#editAnomalyModal').modal('show');
    }

    buildAnomalyDetailsPanel(anomaly) {
        const container = $('#anomaly-details');
        container.empty();

        const isNew = !anomaly;

        container.append(`
            <input type="hidden" id="anomaly-id" name="id" value="${anomaly ? (anomaly.id || '') : ''}">
            <input type="hidden" name="is_new" value="${isNew}">

            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="anomaly-key">Anomaly key</label>
                        <input type="text" class="form-control" id="anomaly-key" name="key" readonly style="background: #3e3f45; color: #fff;">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="anomaly-title">Anomaly title</label>
                        <input type="text" class="form-control" id="anomaly-title" name="title" readonly style="background: #3e3f45; color: #fff;">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="anomaly-category-select">Category</label>
                        <select class="form-control" id="anomaly-category-select" name="category"></select>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="anomaly-impacted-item-select">Impacted Item</label>
                        <select class="form-control" id="anomaly-impacted-item-select" name="impactedItem"></select>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="anomaly-impacted-satellite-select">Impacted Satellite</label>
                        <select class="form-control" id="anomaly-impacted-satellite-select" name="impactedSatellite"></select>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="anomaly-occurrence-date">Occurrence date</label>
                        <input class="form-control" type="text" id="anomaly-occurrence-date" name="publicationDate" readonly style="background: #3e3f45; color: #fff;">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <div class="form-group">
                        <label for="anomaly-environment">Datatakes</label>
                        <input type="text" class="form-control" id="anomaly-environment" name="environment" placeholder="datatakes">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <div class="form-group">
                        <label for="anomaly-news-title">News title</label>
                        <input type="text" class="form-control" id="anomaly-news-title" name="newsTitle" placeholder="related news title">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <div class="form-group">
                        <label for="anomaly-news-link">News link</label>
                        <input type="text" class="form-control" id="anomaly-news-link" name="newsLink" placeholder="related news link">
                    </div>
                </div>
            </div>
        `);

        // Dropdown Population
        this.categories.forEach(cat => $('#anomaly-category-select').append(new Option(cat, cat)));
        this.impactedSatellites.forEach(sat => $('#anomaly-impacted-satellite-select').append(new Option(sat, sat)));

        $('#anomaly-category-select').on('change', (e) => this.updateImpactedItemsDropdown(e.target.value));
        if (isNew) {
            $('#anomaly-key, #anomaly-title, #anomaly-occurrence-date').val('');
            $('#anomaly-key, #anomaly-title, #anomaly-occurrence-date')
                .prop('readonly', false)
                .css({
                    'background': '#fff',
                    'color': '#000'
                }
                );
            this.updateImpactedItemsDropdown(this.categories[0]);
        } else {
            $('#anomaly-id').val(anomaly.id || '');
            $('#anomaly-key').val(anomaly.key);
            $('#anomaly-title').val(anomaly.title);
            $('#anomaly-category-select').val(anomaly.category);
            this.updateImpactedItemsDropdown(anomaly.category, anomaly.impactedItem);
            $('#anomaly-impacted-satellite-select').val(anomaly.impactedSatellite);
            $('#anomaly-occurrence-date').val(anomaly.publicationDate);
            $('#anomaly-environment').val(anomaly.environment);
            $('#anomaly-news-title').val(anomaly.newsTitle);
            $('#anomaly-news-link').val(anomaly.newsLink);
        }

    }

    updateImpactedItemsDropdown(category, selectedItem = null) {
        const itemSelect = $('#anomaly-impacted-item-select');
        itemSelect.empty();
        itemSelect.append(new Option("-- Select Item --", ""));
        if (this.impactedItems[category]) {
            this.impactedItems[category].forEach(item => itemSelect.append(new Option(item, item)));
        }
        if (selectedItem) { itemSelect.val(selectedItem); }
        else {
            itemSelect.val("");
        }
    }

    updateAnomalyDetailsPanelSelectedItems(selectedCategory, anomaly) {
        $('#anomaly-impacted-item-select').children().remove();
        anomalies.impactedItems[selectedCategory].forEach(function (item) {
            $('#anomaly-impacted-item-select').append('<option value="' + item + '">' + item + '</option>');
        });

        // if an anomaly is defined, set the proper impacted item
        if (anomaly) {
            $('#anomaly-impacted-item-select').val(anomaly['impactedItem']);
        }
    }


}

let anomalies = new Anomalies();