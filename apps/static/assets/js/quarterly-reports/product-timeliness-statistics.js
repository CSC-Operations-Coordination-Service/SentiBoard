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

class ProductTimelinessStatistics {
    /**
     * For each mission, list the timeliness types (as specified
     *   in cts-products index ) 
     * @type type
     */
    // TODO Make class, with mission timeliness types get method
    static timelinessByMission = {
        'S1': ['NRT', 'NTC'],
        'S2': ['NTC'],
        'S3': ['NRT', 'NTC', 'STC'],
        'S5': ['NRT', 'NTC']
    };

    static chartGrouping = {
        "NRT": {timeliness: 'NRT', missions: [{mission: 'S1'}, {mission: 'S5'}]},
        "NRT-S3": {timeliness: 'NRT', missions: [{mission: 'S3'}]},
        "STC-S3-SRAL": {timeliness: 'STC', missions: [{mission: 'S3', sensors: ['SRAL']}]},
        "STC-S3-SYN": {timeliness: 'STC', missions: [{mission: 'S3', sensors: ['SYN']}]},
        "NTC": {timeliness: 'NTC', missions: [{mission: 'S1'}, {mission: 'S2'},  {mission: 'S5', levels: ['L1']}]},
        "NTC-S5-L2": {timeliness: 'NTC', missions: [{mission: 'S5', levels: ['L2']}]},
        "NTC-S3": {timeliness: 'NTC', missions: [{mission: 'S3', sensors: ['OLCI', 'SLSTR', 'SYN']}]},
        "NTC-S3-SRAL": {timeliness: 'NTC', missions: [{mission: 'S3', sensors: ['SRAL']}]}
    };
    /*
     * tooltipLabels and tooltipLabelsRows are used as configuration
     * to build the tooltip string 
     * tooltipLabels: the description label to be assigned to each 
     * statistics value. The properties have the same name as the corresponding
     * stastics properties.
     * e.g.: minimum value is presented as: Min: <minimum value>
     * 
     * tooltipLableRows confiugres how the values are grouped, and in 
     * which order, in the tooltip, on separate rows
     * each array lists the statistics properties to be grouped on one row
     * 
     */
    static tooltipLabels = {
        min: "Min",
        max: "Max",
        whiskerMin: "Whisker Min",
        whiskerMax: "Whisker Max",
        mean: "Mean",
        median: "median",
        q1: "25% quantile",
        q3: "75% quantile"
    };
    static tooltipLabelRows = [
        ["min", "max"],
        ["mean"],
        ["median", "q1", "q3"],
        ["whiskerMin", "whiskerMax"]
    ];
    
    getStatisticsLabels(statData) {
        // Buid a list of strings, each string representing a row in a label
        // each row is the composition of a label for the list of properties as specified
        // in tootlipLabelRows
        // each item in tooltipLabel Rows is a list of properties of the statitics object
        // the labels are the composition of the label for the specified property, as 
        // configured in tooltipLabels, and the value from statDATA
        return ProductTimelinessStatistics.tooltipLabelRows.map((propertyList)=> {
            var rowLabels = propertyList.map((propName) => {
                return `${ProductTimelinessStatistics.tooltipLabels[propName]}: ${format_dayhours(statData[propName]).toUpperCase()}`;
            });
            return rowLabels.join(", ");
        });
    }
    // Move date handling to MIXIN (periodSelection)
    /**
     * 
     * @returns {ProductTimeliness}
     */
    constructor(){

        // Set Charts
        this.boxplotCharts = new Map();
    }

    init() {
        // import {BoxPlotController} from '@sgratzl/chartjs-chart-boxplot';
        // BoxPlotController.register();
        // TODO: put in function, possibly common to all pages 
        // Retrieve the user profile. In case of "ecuser" role, allow
        // the visualization of events up to the beginning of the previous quarter
        ajaxCall('/api/auth/quarter-authorized', 'GET', {}, this.quarterAuthorizedProcess, this.errorLoadAuthorized);

        //  Register event callback for Time period select
        var time_period_sel = document.getElementById('time-period-select');
        time_period_sel.addEventListener('change', this.on_timeperiod_change.bind(this));

        // Retrieve the timeliness of each type for each mission
        this.loadTimelinessStatistics(time_period_sel.value);
        return;
    }

    // TODO: Put in base class for Period dependente pages
    //   
    quarterAuthorizedProcess(response) {
        if (response['authorized'] === true) {
            var time_period_sel = document.getElementById('time-period-select');
            if (time_period_sel.options.length === 4) {
                time_period_sel.append(new Option(getPreviousQuarterRange(), 'prev-quarter'));
            }

            // Programmatically select the previous quarter as the default time range
            console.info('Programmatically set the time period to previous quarter');
            time_period_sel.value = 'prev-quarter';
        }
    }

    errorLoadAuthorized(response) {
        console.error(response);
        return;
    }

    on_timeperiod_change() {
        var time_period_sel = document.getElementById('time-period-select');
        console.log("Time period changed to "+ time_period_sel.value);
        this.loadTimelinessStatistics(time_period_sel.value);
    }

    loadTimelinessStatistics(period_type) {
        var timeliness_api_name = 'reports/cds-timeliness-statistics';
        console.log("Loading statistics for period "+period_type);
        // Clear previous data, if any
        // TODO; put Waiting Spinner
        this.clearAllChartBoxplots();
        // Acknowledge the invocation of rest APIs
        console.info("Starting retrieval of Timeliness statistics...");
           // Add class Busy to charts
           // 
        // /api/cds-product-timeliness/last-<period_id>
        var urlParamString = getApiTimePeriodId(period_type);

        var that = this;
        var ajaxTimelinessPromises = 
             asyncAjaxCall('/api/' + timeliness_api_name + '/'+urlParamString, 
                                'GET', {},
                                that.successLoadTimeliness.bind(that),
                                that.errorLoadDownlink);
        // Execute asynchrounous AJAX call
         ajaxTimelinessPromises.then(function() {
             console.log("Received all results!");
           var dialog = document.getElementById('window');
           if (dialog !== null) {
                dialog.show();
                document.getElementById('exit').onclick = function() {
                    console.log("Clikc");
                    dialog.close();
                };
            }
         });
        return;
    }

    successLoadTimeliness(response){

        // Acknowledge the successful retrieval of downlink operations
        var json_resp = format_response(response);
        console.log("received response:", json_resp);
        var rows = json_resp[0].data;
        console.info('Timeliness Statistics successfully retrieved');
        console.info("Number of results: " + rows.length);
        console.log("Putting data into groups based on configuration: ", 
                    ProductTimelinessStatistics.chartGrouping);
        var statisticsGroups = {};
        Object.keys(ProductTimelinessStatistics.chartGrouping).forEach(function(groupId) {
            var groupParams = ProductTimelinessStatistics.chartGrouping[groupId];
            ////console.log("Creating Statsitics Group for id "+ groupId + "and  params ", groupParams);
            statisticsGroups[groupId] = {
                group_id : groupId,
                data_label: groupParams.timeliness,
                datasets: []
            };
        });

        var rowsMissionStatistics = [];
        // Parse response
        // Each result in response shall specify:
        // mission (just for check)
        // timeliness Type (one of NRT, NTC, STC, or tohers configured
        // and extra parameter for category: either level or product_group (to be used to compute the gauge id)
        // Convert restulst to objects to be passed to the Chart builder
        for (const record of rows) {
            // Auxiliary variables
            var timelinessType = record.timeliness;
            var mission = record.mission;
            var category = (record.level !== undefined)? record.level: (record.product_group !== undefined)? record.product_group: "";

            var threshold = record.threshold;
            var missionStatistics = {
                mission: mission,
                category: category,
                timeliness: threshold,
                timelinessType: timelinessType,
                statisticsData : {
                    count: record.statistics.timeliness_statistics.count,
                    min: record.statistics.timeliness_statistics.min,
                    max: record.statistics.timeliness_statistics.max,
                    q1: record.statistics.timeliness_outliers.values["25.0"],
                    q3: record.statistics.timeliness_outliers.values["75.0"],
                    median: record.statistics.timeliness_outliers.values["50.0"], // we are looking fro percentiles 50.0
                    mean: record.statistics.timeliness_statistics.avg
                    //whiskerMin: 1,
                    //whiskerMax: 10
                }
            };
            rowsMissionStatistics.push(missionStatistics);
        }
        console.log("Built list of Mission Statsitics: ", rowsMissionStatistics);
        
        // Assign ieach received MissionStatistics to a Chart Group, according to configuration
        // Browse rowsMission Stastiscs, assign each to group, based on parameters
        // For each group, filter out rows mission statistics with corresponding parameters
        Object.keys(statisticsGroups).forEach(function(groupId) {
            var groupParams = ProductTimelinessStatistics.chartGrouping[groupId];
            var groupParamsMissions = groupParams.missions.map(missionItem => missionItem.mission);
            var groupMissionsParameters = groupParams.missions.reduce(  (miss_param_obj, mission_cfg) => {
                                                                    const {mission, ...rest} = mission_cfg;
                                                                    miss_param_obj[mission] = rest;
                                                                    return miss_param_obj;
                                                                    },
                                                                {}  );
             console.log("Chart Group "+ groupId + "has missions: ", groupParamsMissions);
             console.log("And missions parameters: ", groupMissionsParameters);
            // console.log("Parameters for group "+groupId+":", groupParams);
            
            // TODO: separate filter funciton! in this way it can be tested! by defining different configuration and checking flter results of same input data
            statisticsGroups[groupId].datasets =  rowsMissionStatistics.filter(function(missionStat) {
                console.log("Checking against group " + groupId + "  mission Stat record ", missionStat);
                console.log("timeliness value Condition for belonging to group: ", missionStat.timelinessType === groupParams.timeliness);
                console.log("mission condition : ", groupParamsMissions.includes(missionStat.mission));
                console.log("mission Stat timeliness: "+ missionStat.timelinessType + ", chart group params timeliness: "+ groupParams.timeliness);
                console.log("mission Stat: "+ missionStat.mission + ", chart group params missions:", groupParamsMissions );
                var groupMissionConfig = groupMissionsParameters[missionStat.mission];

                // After matching Timeliness Type and Mission, check if extra paraemters match (namely: levels/sensors)
                var checkResult = (missionStat.timelinessType === groupParams.timeliness) && groupParamsMissions.includes(missionStat.mission );
                console.log("Mission is in group config: "+checkResult);

                if (checkResult && 'levels' in groupMissionConfig) {
                    console.log("Checking against extra parameter for expected params: ", groupMissionConfig);
                    checkResult = groupMissionConfig.levels.includes(missionStat.category);
                }
                if (checkResult && 'sensors' in groupMissionConfig) {
                    checkResult = groupMissionConfig.sensors.includes(missionStat.category);
                }
                return checkResult;
            });
            console.log("Group " + groupId + " Retrieved datasets:", statisticsGroups[groupId].datasets);
        });
        // 
        // Draw the Chart Groups
        var that = this;
        Object.values(statisticsGroups).forEach(function(statGroup) {
            var chartId = statGroup.group_id.toLowerCase() + "-boxplot-chart";
            that.drawBoxplot(chartId, statGroup);
        });
        

        return;
    }

    errorLoadDownlink(response){
        console.error(response);
        return;
    }

    // =========     Pie CHart Management  ==========
    /**
    Summary. Computes Identifier for a Pie Chart canvas
    Description. Composes identifier based on parameters
    @param {string} mission | any string; at the moment the following ones
        are expected: S1, S2, S3, S5p
    @param {string} category | one of "DWL", "PUB" (downloaded products,
                    published products)
    @param {string} datatype | one of VOL, NUM: identifies the type of statitstics to
                    be displayed; it is used to build the chart id
    @returns {string} the computed identifier for the corresponding
                    pie chart canvas
    */
    boxplotChartId(mission, category, datatype) {
    // Datatype one of: nrt/ntc/stc (Timeliness type)
      var chartId = mission.toLowerCase()+"-" + datatype.toLowerCase() ;
      if (category !== "") {
          chartId += "-" + category.toLowerCase() ;
      }
      chartId += "-boxplot-chart";
      return chartId;
    }
    // TODO: A method to clear ALL Charts: 
    // get class chart-container and clear canvas element child
    clearAllChartBoxplots() {
        for (const gChart of this.boxplotCharts.values()) {
            gChart.destroy();
        }
        for (const gId of this.boxplotCharts.keys()) {
            $('.card', document.getElementById(gId)).eq(0).html(
                '<div class="spinner">' +
                    '<div class="bounce1"></div>' +
                    '<div class="bounce2"></div>' +
                    '<div class="bounce3"></div>' +
                '</div>');
        }
    }

    /**
     * 
     * @param {string} pieId | the id of the lement containing the canvas div
     * @param {number} timeThreshold | the number of hours reprsenting the time Threshold for
     *  the data represented 
     * @param {Object} data | a two element object containing:
     *      on_time: the number of products published according to the timliness 
     *      constraint; 
     *      total_count: the total number of generated products (published or not)
     * @returns N/A
     */
    drawBoxplot(pieId, statisticsGroupData) {
        console.log("Drawing BoxPlot with ID "+pieId);
        console.log("Data to be put on chart: ", statisticsGroupData);

        var chartCanvas = document.getElementById(pieId);
        if (chartCanvas !== null) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        } else {
            console.error("Boxplot Chart with id "+pieId + " not present on page");
            return;
        }
        // Remove class from parent .card-body
        //$('#'+pieId).closest('.card-body').removeClass('busy');

        var numDatasets = statisticsGroupData.datasets.length;
        var datasetsColors = get_colors(numDatasets);
        var statDatasets = [];
        var coef = 1.5;
        statisticsGroupData.datasets.forEach ( (statisticsItemData, index) =>  {
            console.log("Extracting data for dataset ", statisticsItemData);
            var itemLabel = statisticsItemData.mission;
            if (statisticsItemData.category !== undefined && statisticsItemData.category !== "") {
                // Add level or sensor or other mission subgroup specification
                itemLabel = itemLabel + "-" + statisticsItemData.category;
            }
            var statData = statisticsItemData.statisticsData;
            const iqr = statData.q3 - statData.q1;
            // since top left is max
            const coefValid = typeof coef === 'number' && coef > 0;
            var whiskerMin = coefValid ? Math.max(statData.min, statData.q1 - coef * iqr) : statData.min;
            var whiskerMax = coefValid ? Math.min(statData.max, statData.q3 + coef * iqr) : statData.max;
            statData.whiskerMin = whiskerMin;
            statData.whiskerMax = whiskerMax;

            statDatasets.push({
                    type: 'boxplot', 
                    backgroundColor: datasetsColors[index],
                    medianColor: 'blue',
                    outlierColor: datasetsColors[index],
                    borderColor: datasetsColors[index],
                    borderWidth: 1,
                    maxBarThickness: 70,
                    label: itemLabel,
                    data: [statisticsItemData.statisticsData]
                });
        });

        var max_w = Math.max(...statisticsGroupData.datasets.map(({statisticsData}) => statisticsData.whiskerMax));
        var min_w = Math.min(...statisticsGroupData.datasets.map(({statisticsData}) => statisticsData.whiskerMin));

        var boxStatisticsData = {
                        datasets: statDatasets,
                        labels: [statisticsGroupData.data_label]
                };

        var that = this;
        var boxChart = new Chart(chartCanvas.getContext('2d'), {
                //type: 'boxplot',
                data: boxStatisticsData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        yAxes: {
                            max: max_w * 1.1,
                            min: min_w * 0.9,
                            ticks: {
                                callback: function(value, index, ticks) {
                                    // Convert to Day/Hour if > 25H
                                    var tickLabel = format_dayhours(value).toUpperCase();
                                    return tickLabel;
                                },
                            includeBounds: false
                            }
                        },
                        xAxes: {
                            offset: true
                        }
                    },
                    plugins: {
                      legend: {
                        onClick: function () {
                              // Otherwie call default onclick
                              Chart.defaults.plugins.legend.onClick.apply(this, arguments);
                              var myChart = this.chart;
                              var numDatasets = myChart.data.datasets.length;
                              
                            // extract the list of indices of the visible datasets
                              var nothiddenDatasetsIdx = [];
                              for (var indx=0; indx < numDatasets; indx++) {
                                        if (myChart.isDatasetVisible(indx)) {
                                      nothiddenDatasetsIdx.push(indx);
                                  }
                              };
                              // Compute again max Q3 on not hidden datasets
                              // filter visible datasets
                              var nothiddenDatasets = nothiddenDatasetsIdx.map(i => myChart.data.datasets[i]); 
                              // console.log("Not hidden datasets :", nothiddenDatasets);
                              // Do not change scale, if no dataset is visible
                              if (nothiddenDatasets.length > 0) {
                                    var max_nothidden_whisker = Math.max(...nothiddenDatasets.map(({data}) => data.hidden?0:data[0].whiskerMax));
                                    var min_nothidden_whisker = Math.min(...nothiddenDatasets.map(({data}) => data.hidden?0:data[0].whiskerMin));
                                    //  assign scales.yAxixs.max
                                    // myChart.options.scales.yAxes.max = max_nothidden_whisker * 1.1;
                                    myChart.options.scales.yAxes.max = max_nothidden_whisker * 1.1;
                                    myChart.options.scales.yAxes.min = min_nothidden_whisker * 0.9;
                                    myChart.update();
                                }
                          }                          
                      },
                      tooltip: {
                        callbacks: {
                            label: ({parsed}) =>  {
                                return that.getStatisticsLabels(parsed);
                            }
                        }
                      }
                    },
                    legends: {
                      position: 'top' 
                    },
                    boxplot: {
                        datasets: {
                            minStats: 'q1', // 'minWhiskers'
                            maxStats: 'q3',  // 'maxWhiskers'
                            coef: 0
                        }
                    },
                    layout: {
                        padding: {
                                left: 10,
                                right: 10,
                                top: 20,
                                bottom: 20
                        }
                    },
                    tooltips: {
                        mode: 'label'
                        }
                }
            });
            // Save chart to allow clearing it
            this.boxplotCharts.set(pieId, boxChart);
    }

    showTimelinessStatisticsOnlineHelp() {

        // Acknowledge the visualization of the online help
        console.info('Showing timeliness statistics online help message...');

        // Auxiliary variable declaration
        var from = 'top';
        var align = 'center';
        var state = 'info';
        var content = {};
        content.title = 'Timeliness Statistics';
        content.message = 'This view shows the statistics properties of the publication timeliness, for each Copernicus Sentinel Mission and ' +
            'timeliness type. Results are displayed in the form of the so-called "box-and-whiskers diagram". In descriptive statistics, ' +
            'this is a method for graphically demonstrating the locality, spread and skewness groups of a distribution of points. The bold line ' +
            'inside the box represents the median element; the box delimits the spread of the 50% of the distribution. The two lines ' +
            'extending from the box and usually called whiskers are indicating the variability outside the upper and lower quantiles. ' +
            'By default, results are referred to the previous completed quarter.'
        content.icon = 'flaticon-round';

        // Display notification message
        msgNotification(from, align, state, content);

        return ;
    }
}

let productTimelinessStatistics = new ProductTimelinessStatistics();