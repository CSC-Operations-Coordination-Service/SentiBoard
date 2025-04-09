/*
Configuration Tool

The Configuration Tool is a software program produced for the European Space
Agency.

The purpose of this tool is to keep under configuration control the changes
in the Ground Segment components of the Copernicus Programme, in the
framework of the Coordination Desk Programme, managed by Telespazio S.p.A.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
You should have received a copy of the GNU General Public License along with
this program. If not, see <http://www.gnu.org/licenses/>.
*/

class ProcessorsViewer {

    constructor() {

        // Acknowledge the instantiation of calendar widget
        console.info('Instantiating timeline widget...');

        // Define the processor releases timeline
        this.timeline = null;

        // Define the mapping between the CSS class of the event and the mission
        this.cssClassMap = {
            'S1': 's1',
            'S2': 's2',
            'S3': 's3',
            'S5P': 's5p'
        };

        // Define the mission identifiers
        this.missions = ['S1', 'S2', 'S3', 'S5P'];

        // Define the available missions
        this.missionNamesMap = {
            'S1': 'Sentinel-1',
            'S2': 'Sentinel-2',
            'S3': 'Sentinel-3',
            'S5P': 'Sentinel-5P'
        };

        // Define the processors on the basis of the selected mission
        this.IPFsMap = {
            'S1': ['S1_L0', 'S1_L1L2', 'S1_ERRMAT', 'S1_SETAP', 'S1_AMALFI'],
            'S2': ['S2_L0', 'S2_L1', 'S2_L2', 'S2_EUP'],
            'S3': ['S3_PUG', 'S3_L0', 'S3_OL1', 'S3_OL1_RAC', 'S3_OL1_SPC', 'S3_OL2',
                   'S3_SL1', 'S3_SL2', 'S3_SL2_LST', 'S3_SL2_FRP',
                   'S3_SR1', 'S3_SR2', 'S3_SM2_HY', 'S3_SM2_LI', 'S3_SM2_SI', 'S3_MW1',
                   'S3_SY2', 'S3_SY2_AOD', 'S3_SY2_VGS', 'S3_SY2_VGP'],
            'S5P': ['S5P_L1B',
                    'S5P_L2O3_NRT', 'S5P_L2O3_OFFL', 'S5P_L2O3_TCL', 'S5P_L2O3_PR',
                    'S5P_L2_NO2', 'S5P_L2_SO2', 'S5P_L2_CO', 'S5P_L2_CH4', 'S5P_L2_HCHO',
                    'S5P_L2_CLOUD', 'S5P_L2AER_AI', 'S5P_L2AER_LH', 'S5P_L2SUOMI_CLOUD']
        };

        // Set the main class members
        this.processorsReleases = [];
        this.loadedEvents = new vis.DataSet();
        this.filteredEvents = new vis.DataSet();
        this.detailsMap = {};

    }

    init() {

        this.initProcessorsTimeline();

        this.initMissionSelector();

        this.loadProcessorsReleases();

    }

    initProcessorsTimeline() {

        // Set the time range of the Timeline
        var minDate = new Date('2014-08-01');
        var maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 7);

        // Initialize the timeline options
        var options = {
                stack: false,
                min: minDate,
                max: maxDate,
                zoomMin: 1000 * 60 * 60, // one week in milliseconds
                editable: false,
                margin: {
                item: 10, // minimal margin between items
                axis: 5 // minimal margin between items and the axis
            },
            orientation: 'top'
        };

        // Build the timeline
        if (!procViewer.timeline) {
            let container = document.getElementById('processors-timeline');
            procViewer.timeline = new vis.Timeline(container, null, options);
        }
    }

    initMissionSelector() {

        // Reset the dropdown menu and set options
        $('#processors-viewer-missions').find('option').remove().end();
        procViewer.missions.forEach(mission => {
            $('#processors-viewer-missions').append($('<option>', {
                value: mission,
                text : procViewer.missionNamesMap[mission]
            }));
        });

        // On Mission selection change, update the displayed groups
        $('#processors-viewer-missions').on('change', function (e) {

            // Retrieve the selected mission
            var optionSelected = $("option:selected", this);
            var valueSelected = this.value;

            // Reset the displayed events, corresponding to the processors releases
            procViewer.setTimelineEvents(valueSelected);

        });
    }

    loadProcessorsReleases() {
        procViewer.successLoadConfiguration($.ajax({
            url: 'https://configuration.copernicus.eu/rest/api/baseline/processors-releases',
            async: false
        }));
    }

    successLoadConfiguration(response) {
        // Store the Interface Configuration as a class member
        console.info("Processors releases configuration loaded.");
        var graph = JSON.parse(format_response(response)[0].responseJSON.graph);
        if (graph['processors_releases']) {
            procViewer.processorsReleases = graph['processors_releases'];
        } else {
            procViewer.processorsReleases = [];
        }

        // Loop over the available processing baselines and create an array storing all the loaded events;
        // moreover, append the corresponding processor release details panel in the relevant map
        procViewer.loadedEvents = new vis.DataSet();
        for (var i = 0 ; i < procViewer.processorsReleases.length; i++) {
            var pr = procViewer.processorsReleases[i];
            var event = procViewer.buildEventInstance(pr);
            if (event) {
                procViewer.loadedEvents.add(event);
                var detailsPanel = procViewer.buildDetailsPanel(pr);
                procViewer.detailsMap[pr['id']] = detailsPanel;
            }
        }

        // Set the events associated to the processors release of the timeline
        // Check the presence of a selection query in the URL
        var queryString = window.location.search;
        var urlParams = new URLSearchParams(queryString);
        var searchFilter = urlParams.get('search');
        if (searchFilter &&
                (searchFilter === 'S1' || searchFilter === 'S2' || searchFilter === 'S3' || searchFilter === 'S5P')) {
            $("#processors-viewer-missions").val(searchFilter);
            procViewer.setTimelineEvents(searchFilter);
        } else {
            $("#processors-viewer-missions").val('S1');
            procViewer.setTimelineEvents('S1');
        }
    }

    setTimelineEvents(selectedMission) {

        // Update the timeline groups
        let ipfs = procViewer.IPFsMap[selectedMission];
        var count = 0;
        var grpArray = [];
        ipfs.forEach(ipf => {
            grpArray.push({ id: ipf, content: ipf.substring(ipf.indexOf('_') + 1, ipf.length)});
        });
        procViewer.groups = new vis.DataSet(grpArray);
        procViewer.timeline.setGroups(procViewer.groups);

        // Filter processors releases
        procViewer.filteredEvents = new vis.DataSet();
        for (var i = 0 ; i < procViewer.processorsReleases.length; i++) {
            var pr = procViewer.processorsReleases[i];
            if (pr['mission'] === selectedMission) {
                var event = procViewer.buildEventInstance(pr);
                if (event) procViewer.filteredEvents.add(event);
            }
        }
        procViewer.timeline.setItems(procViewer.filteredEvents);

        // Set the displayed time range within the last 18 months
        var beg_date = new Date();
        var beg_date_ms = beg_date.getTime() - 548 * 24 * 60 * 60 * 1000;
        var end_date = new Date();
        var end_date_ms = end_date.getTime() + 24 * 60 * 60 * 1000;
        procViewer.timeline.setWindow(beg_date_ms, end_date_ms);

        // Display the details panel on event click
        procViewer.timeline.on('click', function (properties) {
        if (properties.item) {
                $('#processor-release-details').html(procViewer.detailsMap[properties.item]);
            }
        });
    }

    errorLoadConfiguration(response) {
        console.error('Unable to retrieve the Processors releases');
        console.error(response);
        return;
    }

    buildEventInstance(procRelease) {

        // Build the event instance from the processor release
        // Set the event title
        var title = procRelease['processing_baseline'] ? procRelease['processing_baseline'] :
                procRelease['target_ipfs'].toString();

        // Set the group and the class name
        var mission = procRelease['mission'];
        var cssClass = procViewer.cssClassMap[mission];
        var category_id = null;
        if (procRelease['target_ipfs'] && procRelease['target_ipfs'].length > 0) {
            category_id = procRelease['target_ipfs'][0].split(':')[0];
        }
        if (!procRelease['id'] || !category_id) {
            console.warn("Incomplete record");
            console.warn(procRelease);
            return null;
        }

        // The start time is based on the processor TTO date, and the end time is set as 1 hour later
        var date_str = procRelease['validity_start_date'] ?
            procRelease['validity_start_date'] : procRelease['release_date'];
        var start_time = moment(date_str, 'DD/MM/YYYY').toDate();
        var end_time = moment(date_str, 'DD/MM/YYYY').add(1, 'hours').toDate();

        // Enable use of pictures
        // var picture = '<img src="/static/assets/img/maintenance.png" style="width: 36px; height: 36px;">';

        // Return the event instance
        return {
            id: procRelease['id'],
            title: title,
            group: category_id,
            start: start_time,
            end: end_time,
            className: cssClass,
            // content: picture,
            type: 'box'
        }
    }

    buildDetailsPanel(procRelease) {

        // Build content to be displayed in the details panel
        var title = procRelease['processing_baseline'] ? procRelease['processing_baseline'] :
                procRelease['target_ipfs'].toString();
        var category = procRelease['mission'];
        var item = procRelease["satellite_units"];

        // Until a full parsing of anomaly text is implemented, the start time is based
        // on the publication date, and the end time is set as 1 hour later
        var start_time = procRelease['validity_start_date'] ?
            moment(procRelease['validity_start_date'], 'DD/MM/YYYY').toDate() :
            moment(procRelease['release_date'], 'DD/MM/YYYY').toDate();

        // Every impacted datatake shall be linked to the Datatake table
        var detailsContent =
            '<div>' +
                '<p style="font-size: 14px">Processor Baseline ID:  ' +
                '<span style="font-weight: bold">' + title + '</span></p>' +
                '<p style="font-size: 14px">Operational since:  ' +
                '<span style="font-weight: bold">' + start_time + '</span></p>' +
                '<p></p>' +
                '<p style="font-size: 14px">Impacted satellite(s):  ' +
                '<span style="font-weight: bold">' + item + '</span></p>' +
                '<p></p>';

        // Append the list of modifications
        detailsContent +=
                '<p style="font-weight: bold; font-size: 14px">Release notes</p>' +
                procRelease['release_notes'];

        // Close the details panel
        detailsContent += '</div>'

        // Return the HTML displayed in the details panel
        return detailsContent;
    }

    filterReleases(filter) {

        // Clear the array hosting the filtered anomalies
        procViewer.filteredEvents = new vis.DataSet();

        // If the filter is not empty, loop over the processors, and display the
        // anomalies matching the filter
        procViewer.loadedEvents.forEach(function(event) {
            if (filter) {
                if (procViewer.detailsMap[event.id].toUpperCase().includes(filter.toUpperCase())) {
                    procViewer.filteredEvents.add(event);
                }
            } else {
                procViewer.filteredEvents.add(event);
            }
        });

        // Update the timeline widget
        procViewer.timeline.setItems(procViewer.filteredEvents);

    }
}

let procViewer = new ProcessorsViewer();