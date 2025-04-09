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

var mission_list = ['S1', 'S2', 'S3', 'S5'];
//var mission_list = ['S2', 'S3' ];
var mission_product_families = {
    'S1': {
        "EW_RAW__0S": 'L0 RAW', "IW_RAW__0S": 'L0 RAW',
        "RF_RAW__0S": 'L0 RAW', "S1_RAW__0S": 'L0 RAW',
                   "S2_RAW__0S": 'L0 RAW', "S3_RAW__0S": 'L0 RAW',
                   "S4_RAW__0S": 'L0 RAW', "S5_RAW__0S": 'L0 RAW',
                   "S6_RAW__0S": 'L0 RAW', "WV_RAW__0S": 'L0 RAW',
        "EW_GRDM_1S": 'L1 GRD', "IW_GRDH_1S": 'L1 GRD',
                    "S1_GRDH_1S": 'L1 GRD', "S2_GRDH_1S": 'L1 GRD',
                    "S3_GRDH_1S": 'L1 GRD', "S4_GRDH_1S": 'L1 GRD',
                    "S5_GRDH_1S": 'L1 GRD', "S6_GRDH_1S": 'L1 GRD',
        "EW_SLC__1S": 'L1 SLC', "IW_SLC__1S": 'L1 SLC',
                   "S1_SLC__1S": 'L1 SLC', "S2_SLC__1S": 'L1 SLC',
                    "S3_SLC__1S": 'L1 SLC', "S4_SLC__1S": 'L1 SLC',
                    "S5_SLC__1S": 'L1 SLC', "S6_SLC__1S": 'L1 SLC',
                    "WV_SLC__1S": 'L1 SLC',
         // ETAD products
         'EW_ETA__AX': 'L1 ETAD', 'IW_ETA__AX': 'L1 ETAD',
                    'S1_ETA__AX': 'L1 ETAD', 'S2_ETA__AX': 'L1 ETAD',
                    'S3_ETA__AX': 'L1 ETAD', 'S4_ETA__AX': 'L1 ETAD',
                    'S5_ETA__AX': 'L1 ETAD', 'S6_ETA__AX': 'L1 ETAD',
        //'L1 GRDM': [],
        "EW_OCN__2S": 'L2 OCN', "IW_OCN__2S": 'L2 OCN',
                    "S1_OCN__2S": 'L2 OCN', "S2_OCN__2S": 'L2 OCN',
                    "S3_OCN__2S": 'L2 OCN', "S4_OCN__2S": 'L2 OCN',
                    "S5_OCN__2S": 'L2 OCN', "S6_OCN__2S": 'L2 OCN',
                    "WV_OCN__2S": 'L2 OCN'
    },
    'S2': {
        "MSI_L1C___": 'L1C', "MSI_L1C_DS": 'L1C',
        "MSI_L1C_TC": 'L1C', "MSI_L1C_TL": 'L1C',
        "MSI_L2A___": 'L2A', "MSI_L2A_DS": 'L2A',
        "MSI_L2A_TC": 'L2A', "MSI_L2A_TL": 'L2A'
    },
    'S3': {
        "OL_1_ERR___": 'OLCI',
        "OL_1_EFR___": 'OLCI',
        // TODO OL 1 RAC SPC to be confirmed
        "OL_1_RAC___": 'OLCI',
        "OL_1_SPC___": 'OLCI',
        //"MW_1_MWR___",
        "SL_1_RBT___": 'SLSTR',
        "SL_2_FRP___": 'SLSTR',
        "SL_2_LST___": "SLSTR",
        "OL_2_LFR___": 'OLCI',
        "OL_2_LRR___": 'OLCI',
        //"OL_2_WFR___": 'OLCI',
        //"OL_2_WRR___": 'OLCI',
        "SR_1_SRA___": 'SRAL',
        "SR_1_SRA_A_": 'SRAL',
        "SR_1_SRA_BS": 'SRAL',
        "SR_2_LAN___": 'SRAL',
        "SR_2_LAN_HY": 'SRAL',
        "SR_2_LAN_LI": 'SRAL',
        "SR_2_LAN_SI": 'SRAL',
        "SY_2_V10___": "SYN",
        "SY_2_VG1___": "SYN",
        "SY_2_AOD___": 'SYN',
        "SY_2_SYN___": 'SYN',
        "SY_2_VGK___": 'SYN',
        "SY_2_VGP___": 'SYN'
    },
    'S3-OLCI': {
        "OL_1_ERR___": 'L1 ERR',
        "OL_1_EFR___": 'L1 EFR',
        "OL_2_LFR___": 'L2 LAND FR',
        "OL_2_LRR___": 'L2 LAND RR'
        //"OL_2_WFR___": 'L2 WATER',
        //"OL_2_WRR___": 'L2 WATER',
    },
    'S3-SLSTR': {
        "SL_1_RBT___": 'L1 RBT',
        "SL_2_FRP___": 'L2 FRP',
        "SL_2_LST___": "L2 LST"
    },
    'S3-SRAL': {
        "SR_1_SRA___": 'L1 ',
        "SR_1_SRA_A_": 'L1 A',
        "SR_1_SRA_BS": 'L1 BS',
        "SR_2_LAN___": 'L2 LAND',
        "SR_2_LAN_HY": 'L2 HYDRO',
        "SR_2_LAN_LI": 'L2 LAND ICE',
        "SR_2_LAN_SI": 'L2 SEA ICE',
    },
    'S3-SYN': {
        "SY_2_V10___": "VGP",
        "SY_2_VG1___": "VGP",
        "SY_2_AOD___": 'AOD',
        "SY_2_SYN___": 'SYN',
        "SY_2_VGK___": 'VGK',
        "SY_2_VGP___": 'VGP'
},
    'S5': {
        "OFFL_L1B_RA_BD1": 'L1B RA Bands', "OFFL_L1B_RA_BD2": 'L1B RA Bands',
                        "OFFL_L1B_RA_BD3": 'L1B RA Bands', "OFFL_L1B_RA_BD4": 'L1B RA Bands',
                        "OFFL_L1B_RA_BD5": 'L1B RA Bands', "OFFL_L1B_RA_BD6": 'L1B RA Bands',
                        "OFFL_L1B_RA_BD7": 'L1B RA Bands', "OFFL_L1B_RA_BD8": 'L1B RA Bands',
        "OFFL_L1B_IR_SIR": 'LiB IR', "OFFL_L1B_IR_UVN": 'LiB IR',
        "NRTI_L2__AER_AI": 'L2 AER AI', "OFFL_L2__AER_AI": 'L2 AER AI',
        // TODO L2 O3 TCL to be confirmed
        "NRTI_L2__O3_TCL": "L2 O3 TCL",
        "OFFL_L2__O3_TCL": "L2 O3 TCL",
        "NRTI_L2__AER_LH": 'L2 AER LH', "OFFL_L2__AER_LH": 'L2 AER LH',
        "NRTI_L2__CH4___": 'L2 CH4',"OFFL_L2__CH4___": 'L2 CH4',
        "NRTI_L2__CLOUD_": 'L2 CLOUD', "OFFL_L2__CLOUD_": 'L2 CLOUD',
        "OFFL_L2__CO____": 'L2 CO', "NRTI_L2__CO____": 'L2 CO',
        "NRTI_L2__HCHO__": 'L2 HCHO', "OFFL_L2__HCHO__": 'L2 HCHO',
        "NRTI_L2__NO2___": 'L2 NO2', "OFFL_L2__NO2___": 'L2 NO2',
        "NRTI_L2__O3____": 'L2 O3',"OFFL_L2__O3____": 'L2 O3',
        "NRTI_L2__O3__PR": 'L2 O3 PR', "OFFL_L2__O3__PR": 'L2 O3 PR',
        "NRTI_L2__SO2___": 'L2 SO2', "OFFL_L2__SO2___": 'L2 SO2',
        "OFFL_L2__NP_BD3": 'L2 NP Bands',
         "OFFL_L2__NP_BD6": 'L2 NP Bands', "OFFL_L2__NP_BD7": 'L2 NP Bands'
        // 'CTMFCT': []
    }
};

class MissionStats {
    constructor(stat_type) {
        this.reset();
        this.stat_id = stat_type;
        // from product family - product type table
        // build reverse table: product type - product family
    }
    get_prod_type_label(mission, level, product_type) {
        // TODO: Make existence check
        if (!(product_type in mission_product_families[mission])) {
            return product_type;
        }
        return mission_product_families[mission][product_type];
    }
    addStatistic(mission, level, productType, value, createNotConfigured) {
        if (typeof createNotConfigured === 'undefined' || createNotConfigured === null) {
            createNotConfigured = true;
        }
        var lev_stats = this.statisticsData[mission].by_level;
        if (!(level in lev_stats)) {
            this.statisticsData[mission].by_level[level]=0;
        }

        lev_stats[level] += value;
        var prod_type_label = this.get_prod_type_label(mission, level, productType);
        var prod_stats = this.statisticsData[mission].by_prod_type;
        // If createNotConfigred, and get_prod_type_label returned productType, (the product Type is not configured)
        // create anyway the entyr
        // otherwise create an entry only if configured and not already existing
        if (!(prod_type_label in prod_stats) ) {
            if (createNotConfigured || prod_type_label !== productType) {
                this.statisticsData[mission].by_prod_type[prod_type_label]=0;
            }
        }
        if (prod_type_label in prod_stats) {
            this.statisticsData[mission].total += value;
            prod_stats[prod_type_label] += value;
        }
    }

    getStatistics(mission) {
        return this.statisticsData[mission];
    }
    getTotalStatistic() {
        var allMissionsTotal = 0;
        console.log("Computing total for "+this.stat_id);
        var total_list = Object.values(this.statisticsData).map(function(missionStat) {
                                                    return missionStat.total;
                                                    });
        console.log("Total " + this.stat_id + " mission values: ", total_list)
        allMissionsTotal = total_list.reduce(function(sum, value) {
              return sum + value;
        }, 0);
        console.log("Total "+ this.stat_id + " is "+allMissionsTotal);
        return allMissionsTotal;
    }
    reset() {
        this.statisticsData = {};
        var that = this;
        mission_list.forEach(function(mission) {
            that.statisticsData[mission] = {
                total: 0,
                by_level: {},
                by_prod_type: {}
                };
        });
        ['OLCI', 'SLSTR', 'SRAL', 'SYN'].forEach(function(sensor) {
            var sensorMission = 'S3-'+sensor;
            that.statisticsData[sensorMission] = {
                total: 0,
                by_level: {},
                by_prod_type: {}
                };
        });
        }

}

class PublicData {
    constructor(){
        // TODO: make configuration static?? TBC
        this.mission_list = mission_list;

        // Published data per Platform/satellite.
        // they shall be grouped by mission at display time
        this.published_data = {
            'VOL': new MissionStats('Volume'),
            'NUM': new MissionStats('Count')
        };
        this.published_last24h = {};
        this.published_last24h_time = {};
                // Set Charts
        this.pieCharts = new Map();

        // By default, show data from current quarter
        var time_period_sel = document.getElementById('time-period-select');
        if (time_period_sel) {
            console.info('Programmatically set the time period to the last quarter')
            time_period_sel.value = 'last-quarter';
            this.period_type = time_period_sel.value;
        }
    }

    get_published_count_size_last_24h() {
        // If value not defined, or too old, retrieve it!
        // Retrieve value from instance variable
        if (!('VOL' in this.published_last24h) || !('NUM' in this.published_last24h)) {
            // Collect data  and update value
            this.loadLast24HStatistics();
        }
        return;
    }

    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length === 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }
        }
    }

    errorLoadAuthorized(response) {
        console.error(response);
    }

    init(){
        console.info("Initializing Publication Data");
        // publication-statistics-data-type-select
        // Bind selection events to the dropdown menu, permitting to switch between product count and volume
        // By default, show product count
        var pub_stat_data_type_sel = document.getElementById('publication-statistics-data-type-select');
        pub_stat_data_type_sel.value = 'count';
        ['#published-data-vol-row', '#published-data-vol-product-type-row', '#published-data-vol-s3-row'].forEach(function(divId) {
            $(divId).hide();
        });
        pub_stat_data_type_sel.addEventListener('change', this.on_datatype_change.bind(this));
        // time-period-select
        // By default, display data in the last quarter and register event callback for Time period select
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.value = 'last-quarter';
        this.period_type = time_period_sel.value;
        time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));
        ajaxCall('/api/auth/quarter-authorized', 'GET', {},
                this.quarterAuthorizedProcess,
                this.errorLoadAuthorized);

        console.info("Period selected: "+ time_period_sel.value);
        this.loadPeriodPublication();
    }

    setLastUpdatedLabel(lastUpdateTime) {
        var nowDateString = formatDateHour(lastUpdateTime);
        $("#pub-last-updated").text(nowDateString);
    }

    enableTimePeriodSel(enabled) {
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.disabled = !enabled;
    }
    // TODO SB Remove: Date Interval is no more used!
    updateDateInterval(period_type) {
        this.period_type = period_type;
        this.last_updated_date = new Date();
        var observationTimePeriod = new ObservationTimePeriod();
        var dates = observationTimePeriod.getIntervalDates(period_type);
        this.end_date = dates[1];
        this.start_date = dates[0];

        return;
    }
    clearAllPieCharts() {
        for (const pChart of this.pieCharts.values()) {
            pChart.destroy();
        }

    }
    clearVolumeBox(category, mission) {
        // TODO:  move outside function, make static
        var datatype_id = {
            'VOL': 'volume',
            'NUM': 'number'
        };

        ["VOL", "NUM"].forEach (function(datatype) {
            var elem_id = mission+'-'+category.toLowerCase() +'-'+datatype_id[datatype];
            var chart_title_id = elem_id + 'total';
            // $('.m-0', document.getElementById(elem_id))[0].textContent =  '--' ;
            $('.h1, .m-0', document.getElementById(elem_id)).eq(0).html(
                '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                 '</div>');
            });
    }
    /**
     * Build the API URLs for Size(Volume) and Count APIs,
     * depending on the currently selected period
     * @param {type} period_type
     * @returns {apiUrls}
     */
    getCountVolumeApiUrls(period_type) {
        var count_api_name = 'statistics/cds-product-publication-count';
        var size_api_name = 'statistics/cds-product-publication-volume';
        console.log("Retrieving API id for period type "+ period_type);
        var urlParamString = getApiTimePeriodId(period_type);
        console.log("Period for API URL: "+urlParamString);
        var apiUrls = {
            'VOL': '/api/'+size_api_name + '/' + urlParamString,
            'NUM': '/api/'+count_api_name + '/' + urlParamString
        };
        return apiUrls;
    }
    loadLast24HStatistics() {

        var period_type = 'day';
        console.info("Querying and loading publications for last 24Hour");
        this.published_data['NUM'].reset();
        this.published_data['VOL'].reset();
        var that = this;
        var apiUrls = this.getCountVolumeApiUrls(period_type);
        const ajaxPromises = [
              asyncAjaxCallParams(apiUrls.VOL,
                        'GET', {},
                        [that.published_data['VOL'], 'VOL'],
                        that.collectPublicationData.bind(that),
                        that.errorLoadPublication),
             asyncAjaxCallParams(apiUrls.NUM,
                        'GET', {},
                        [that.published_data['NUM'], 'NUM'],
                        that.collectPublicationData.bind(that),
                        that.errorLoadPublication)
        ];
        $.when(
                (async() => {
                    await Promise.all(ajaxPromises);
                    })()
                ).then(() => {
                    console.log("Statistics: Received both Count and Volume stats");
                                this.computePublishedTotalLast24H('NUM');
                                this.computePublishedTotalLast24H('VOL');
                            }
                        );
        }

    computePublishedTotalLast24H(datatype) {
        this.published_last24h[datatype] = this.published_data[datatype].getTotalStatistic();
        console.log("Last 24H Total for "+ datatype + " is "+this.published_last24h[datatype]);
        this.published_last24h_time[datatype] = Date.now();
    }

    loadPeriodPublication() {
        console.info("Querying and loading publications from "+this.start_date+" to "+this.end_date);

        //
        // Pie Charts are defined both for Missions and for Mission Sensors (S3)
        // Total statistics Boxes are defined only for missions
        this.mission_list.forEach(function(mission) {
                            this.clearVolumeBox('PUB', mission);
                            var _that = this;
                            if (mission === 'S3') {
                                 ['OLCI', 'SLSTR', 'SRAL', 'SYN'].forEach(function(sensor) {
                                            var sensorMission = mission+"-"+sensor;
                                            _that.clearVolumeBox('PUB', sensorMission);
                                });
                            }

                            }.bind(this));

        this.clearAllPieCharts();

        // Reset Published Data Statistics Tables
        this.published_data['VOL'].reset();
        this.published_data['NUM'].reset();

        // Activate Publications loading based on current Time Period Selection
        var that = this;

        //          ===================   Build API URLs
        // Define API name
        var apiUrls = this.getCountVolumeApiUrls(this.period_type);

        var ajaxPublishPromises = [
                asyncAjaxCallParams(apiUrls.NUM,
                        'GET', {},
                        [that.published_data['NUM'], 'NUM'],
                        that.successLoadPublication.bind(that), 
                        that.errorLoadPublication),
                asyncAjaxCallParams(apiUrls.VOL,
                        'GET', {},
                        [that.published_data['VOL'], 'VOL'],
                        that.successLoadPublication.bind(that), 
                        that.errorLoadPublication)
                ];
//            $.when(
//                (async() => {
//                    await Promise.all(ajaxPublishPromises);
//                    })()
//                ).then(() => {
//                                this.enableTimePeriodSel(true);
//                            }
//                        );

        // this.setLastUpdatedLabel(this.last_updated_date);
        return;
    }

    collectPublicationData(parameters, response) {
        var publish_data_table, data_type;
        [publish_data_table, data_type] = parameters;
        // var publish_data_table = this.published_data[data_type]
        var json_resp = format_response(response);
        console.log("received response:", json_resp);
        var rows = json_resp[0].data;
        // function is activated both on NUM/VOL success handling callbacks
        // update the End of period label just once!
        // Alternate: execute after callback completion, and specify only for one of the Async calls to REST server
        if (data_type === 'NUM') {
            // Update reference time label
            var endPeriodDate = moment(json_resp[0].interval.to, 'yyyy-MM-DDTHH:mm:ss').toDate();
            
            this.setLastUpdatedLabel(endPeriodDate);
        }
        var valueKey = data_type === 'NUM'?'count':'content_length_sum';
        console.info("Collecting "+ data_type + " Publications: "+rows.length + " records");
        console.log("Using key for value: "+valueKey);

        // For each record:
        // Populate statistics based on key parameters:
        //   Mission, Product Level,
        for(const record of rows){
            // console.log("Processing record: ", record);

            // Read a single row/record
            // Each record contains statistics for a single Product type
            // Extract the element to be used as source of data to be displayed

            var product_mission = record['mission'];
            var product_type= record['productType'];
            var product_level= record['productLevel'];
            var record_value = record[valueKey];
            // 3. Assign count statistics to Product level/type
            // TODO: add flag: add if not configured
            publish_data_table.addStatistic(product_mission, product_level, product_type, record_value);
            // ISentinel 3, assign statistics to S3 - Sensor
            if (product_mission === 'S3') {
                ['OLCI', 'SLSTR', 'SRAL', 'SYN'].forEach(function(sensor) {
                    var sensorMission = product_mission+"-"+sensor;
                    publish_data_table.addStatistic(sensorMission, product_level, product_type, record_value, false);
                    });
            }

        }
        return;
    }
    successLoadPublication( parameters, response) {
        var publish_data_table, data_type;
        [publish_data_table,  data_type ] = parameters;
        console.info("Displaying "+data_type+" statistics from "+this.start_date+" to "+this.end_date)
        this.collectPublicationData( parameters, response);

        var that = this;
        // Display data for each mission
        mission_list.forEach(function(_mission) {
            // Display function to receive only published data table
            // published data table to be put in class
            that.display_published_data(_mission,
                                        publish_data_table.getStatistics(_mission),
                                        data_type);
        });
        var mission = 'S3';
        ['OLCI', 'SLSTR', 'SRAL', 'SYN'].forEach(function(sensor) {
            var sensorMission = mission + '-'+sensor;
            //var box_elem_id = this.get_box_id(sensorMission,data_type]);
            //var chart_title_id = box_elem_id + '-total';
            console.debug("Display Total for "+sensorMission+", type of data "+data_type);
            that.display_chart_published_total(sensorMission, 
                publish_data_table.getStatistics(sensorMission),
                data_type);
            console.debug("Display Pie Chart for "+sensorMission +", type of dat:a "+data_type);
            that.display_published_data_chart(sensorMission,
                publish_data_table.getStatistics(sensorMission),
                data_type);
        });

        return;
    }

    get_box_id(mission, data_type) {
        var box_type = {'VOL': 'volume',
                        'NUM': 'number'};
        var box_elem_id = mission+'-pub-'+box_type[data_type];
        return box_elem_id;
    }
    display_chart_published_total(mission, mission_pub_data, data_type) {
        var box_elem_id = this.get_box_id(mission,data_type);
        var chart_title_id = box_elem_id + '-total';
        console.log("Updating Chart title "+ chart_title_id);
        // Build String to be displayed depending on box_type
        // mission size: sum of platform sizes
        // By level size: sum of plaftorm by level sizes
        var value_disp_str = data_type === 'VOL'? format_size(mission_pub_data.total): new Intl.NumberFormat().format(mission_pub_data.total);
        // Popuplate Total Size BOX
        var text = $('.card-title, .m-0', document.getElementById(chart_title_id))[0].textContent;
        text = text.split('[')[0];
        text += '[' + value_disp_str + ']';
        $('.card-title, .m-0', document.getElementById(chart_title_id))[0].textContent = text;
    }
    display_published_total(mission, mission_pub_data, data_type) {
        var box_elem_id = this.get_box_id(mission,data_type);
        console.log("Updating Box "+box_elem_id);
        var chart_title_id = box_elem_id + '-total';
        console.log("Updating Chart title "+ chart_title_id);
        // Build String to be displayed depending on box_type
        // mission size: sum of platform sizes
        // By level size: sum of plaftorm by level sizes
        var value_disp_str = data_type === 'VOL'? format_size(mission_pub_data.total): new Intl.NumberFormat().format(mission_pub_data.total);
        // Popuplate Total Size BOX
        $('.h1, .m-0', document.getElementById(box_elem_id))[0].textContent = value_disp_str;
        var text = $('.card-title, .m-0', document.getElementById(chart_title_id))[0].textContent;
        text = text.split('[')[0];
        text += '[' + value_disp_str + ']';
        $('.card-title, .m-0', document.getElementById(chart_title_id))[0].textContent = text;
    }
    // put together published data for all platforms of the mission
    // Then update the Box/Piechart with mission total data
    display_published_data(mission, mission_pub_data, data_type) {
        console.info("Processing mission "+mission);

        // ====== Published mission Size
        // Move Box to class; each instance has its Id, datatype
        // we just ask to display total
        // instead of retrieving ind and accessing DOM element each
        //  time we just access object via box objects table.
        console.info("Mission "+mission+" to be updated:"+mission_pub_data.total+ ' '+data_type);
        this.display_published_total(mission, mission_pub_data, data_type);
        // Populate Size Charts
        this.display_published_data_chart(mission, mission_pub_data, data_type);
        return;
    }

    display_published_data_chart(mission, mission_pub_data, data_type) {
    console.info("Building chart for mission "+mission);
    // Populate Chartes: By Products percentage
     // console.info("Published data for mission "+ mission+":", mission_pub_data);
    //var detail_field = 'by_level'
    var detail_field = 'by_prod_type';
    var detailed_data = mission_pub_data[detail_field];
     // Build a table: Product Type : num products
     // from published data statistics for this mission
    var chartId = this.pieChartId(mission, 'PUB', data_type);
    //console.debug("Mission data for mission "+mission+":", mission_pub_data);

    this.drawPieChart(chartId,
                      data_type,
                      mission_pub_data.total,
                      Object.fromEntries(Object.keys(detailed_data).map(key =>  [key, detailed_data[key]]))
                     );

    }

    errorLoadPublication(response){
        console.error(response);
        return;
    }

    // =========     Pie CHart Management  ==========
    /**
    Summary. Computes Identifier for a Pie Chart canvas
    Description. Composes identifier based on parameters
    @param: mission: any string; at the moment the following ones
        are expected: S1, S2, S3, S5p
    @param: category : one of "DWL", "PUB" (downloaded products,
                    published products)
    @param: datatype: one of VOL, NUM: identifies the type of statitstics to
                    be displayed; it is used to build the chart id
    @return: string: the computed identifier for the corresponding
                    pie chart canvas
    */
    pieChartId(mission, category, datatype) {
    // Datatype one of: vol/num
      var chartId = mission.toLowerCase()+"-"+datatype.toLowerCase() + "-pieChart"
      return chartId;
    }

    /**
    Summary. Draws a Pie Chart with data by product type
    Description. Draws a Pie Chart in the proper canvas,
        showing the percentage of number of products by product
        type, for a single mission
            TODO: separate computing data (counters and percentages per
                product type) and displaying data
    @param chartId: the Element ID of the DIV to contain the chart being creat
    @param data_type: VOL or NUM; if VOL, values are sizes; if displayed, they must
        be formatted using GB/TB/PB suffixes
    @param mission_total: the total value to be used if percentages are computed
        by application
    @param mission_product_data: A table in the form:
        {
            Product Category: value (either number of products or size of products)
        }

    @return: N/A
    */
    drawPieChart(chartId, data_type,
                mission_total, mission_product_data) {

        console.log("Displaying on Chart "+chartId+" stat with total "+ mission_total);
        var chartCanvas = document.getElementById(chartId);
        var chartContext = chartCanvas.getContext('2d');
        // Retrieve labels from mission_product_data
        var fraction_labels = Object.keys(mission_product_data);
        console.info("Loading Pie Chart " + chartId + "; products by level:" + fraction_labels.map(function(key) { return key+":"+mission_product_data[key]}));
        var num_fractions = fraction_labels.length;
        //
        // assign data based on mission_product_data
        //  values are converted to percentage by Chart component
        // TODO make sure that total is 100 (add 1 to biggest one if total 99,
        // remove one if total 101
        var data_values = Object.values(mission_product_data);
        var types_colors = get_colors(num_fractions);
        var total_displayed = mission_total;
        if (data_type === 'VOL') {
            total_displayed = format_size(mission_total);
        }
        var myPieChart = new Chart(chartContext, {
                type: 'pie',
                data: {
                    datasets: [{
                        data: data_values,
                        backgroundColor: types_colors,
                        hoverBackgroundColor: types_colors,
                        borderWidth: 0
                    }],
                    labels: fraction_labels
                },
                options : {
                    responsive: true,
                    maintainAspectRatio: false,
                    /*title: {
                        text: 'Total: '+total_displayed,
                        display: true,
                        align: "left",
                        },
                     */
                    legend: {
                        position : 'bottom',
                        labels : {
                            fontColor: 'rgb(154, 154, 154)',
                            color: types_colors,
                            fontSize: 11,
                            usePointStyle : true,
                            padding: 20
                        }
                    },
                    pieceLabel: {
                        // render: 'percentage',
                        render: function (args) {
                            return args.label +": "+ args.percentage+"%";
                         },
                        fontColor: 'white',
                        fontSize: 14,
                        position: 'outside'
                    },
                    showTooltips: true,
                    tooltips: {
                        mode: 'label',
                        callbacks: {
                            label: function(tooltipItem, data) {
                                var idx = tooltipItem.index;
                                var shownValue = data.datasets[0].data[idx];
                                if (data_type === 'VOL') {
                                    shownValue = format_size(shownValue);
                                }
                                return  data.labels[idx] +': '+ shownValue;
                                }
                            }
                            //labelTextColor: function (tooltipItem, chart) {
                            //    return chart.data.datasets[0].backgroundColor[tooltipItem.index];
                            //}
                        },
                    layout: {
                        padding: {
                            left: 20,
                            right: 20,
                            top: 20,
                            bottom: 20
                        }
                    }
                }
        });
                    // Save chart to allow clearing it
        this.pieCharts.set(chartId, myPieChart);
    }

    on_datatype_change() {
        var pub_stat_data_type_sel = document.getElementById('publication-statistics-data-type-select');
        var dataType = pub_stat_data_type_sel.value;
        console.log("Displayed data type changed to "+ dataType);
        if (dataType === "volume") {
            ['#published-data-num-row', '#published-data-num-product-type-row', '#published-data-num-s3-row'].forEach(function(divId) {
                $(divId).hide();
            });
            ['#published-data-vol-row', '#published-data-vol-product-type-row', '#published-data-vol-s3-row'].forEach(function(divId) {
                $(divId).show();
            });
        } else {
            ['#published-data-num-row', '#published-data-num-product-type-row', '#published-data-num-s3-row'].forEach(function(divId) {
                $(divId).show();
            });
            ['#published-data-vol-row', '#published-data-vol-product-type-row', '#published-data-vol-s3-row'].forEach(function(divId) {
                $(divId).hide();
            });
        }
    }

    on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select');
        console.log("Time period changed to "+ time_period_sel.value);
        this.period_type = time_period_sel.value;

        // this.updateDateInterval(time_period_sel.value);
        // Activate Page Loading on time period
        this.loadPeriodPublication();
    }

    showPublicationStatisticsOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing publication statistics online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Publication statistics';
        content.message = 'This view offers a summary of the number and the total volume of products published in the Data Hubs for each ' +
            'Copernicus Sentinel mission, within the selected time interval. The view provides also the details about the published products ' +
            'per product level or sensor type (i.e., for Copernicus Sentinel 3). Charts are interactive: by clicking on a label in the legend ' +
            'it is possible to modify the displayed results';
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return ;
    }

}

console.log("Instantiating Public Statistics");
let publicdata = new PublicData();