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

class Profiles {

    constructor() {

        // Conservatively, set guest user role
        this.role = 'guest';

        // Retrieve user information
        ajaxCall('/api/auth/user', 'GET', {}, this.successLoadUser.bind(this), this.errorLoadUser.bind(this));
    }

    init() {

    }

    successLoadUser(response) {

        // Get user role
        this.role = response['role'];
        if (this.role === 'ecuser' || this.role === 'esauser') {
            this.addECUserPaths();
        }
        if (this.role === 'admin') {
            this.addECUserPaths();
            this.addAdminPaths();
        }
    }

    errorLoadUser(response) {
        console.error(response);
        return ;
    }

    addECUserPaths() {
        let path = window.location.href;
        let activeSpaceSegment = path.toUpperCase().includes('SPACE-SEGMENT') ? ' active ' : '';
        let activeAcquisitionService = path.toUpperCase().includes('ACQUISITION-SEGMENT') ? ' active ' : '';
        let activeDataAccess = path.toUpperCase().includes('DATA-ACCESS') ? ' active ' : '';
        let activeDataArchive = path.toUpperCase().includes('DATA-ARCHIVE') ? ' active ' : '';
        let activeProductTimeliness = path.toUpperCase().includes('PRODUCT-TIMELINESS') ? ' active ' : '';
        let active = path.toUpperCase().includes('REPORTING') || path.toUpperCase().includes('TIMELINESS-STATISTICS') ? ' active ' : '';
        let show = path.toUpperCase().includes('REPORTING') || path.toUpperCase().includes('TIMELINESS-STATISTICS') ? ' show ' : '';
        $('#sidebar-tree-paths').append(
            '<li class="nav-item' + active + '">' +
                '<a data-toggle="collapse" href="#reporting">' +
                    '<i class="fas fa-chart-bar"></i>' +
                    '<p>Quarterly Reports</p>' +
                    '<span class="caret"></span>' +
                '</a>' +
                '<div class="collapse' + show + '" id="reporting">' +
                    '<ul class="nav nav-collapse">' +
                        '<li class="' + activeSpaceSegment + '">' +
                            '<a href="/space-segment.html">' +
                                '<span class="sub-item">Space Segment</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeAcquisitionService + '">' +
                            '<a href="/acquisition-service.html">' +
                                '<span class="sub-item">Acquisition Service</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeDataAccess + '">' +
                            '<a href="/data-access.html">' +
                                '<span class="sub-item">Data Access Service</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeDataArchive + '">' +
                            '<a href="/data-archive.html">' +
                                '<span class="sub-item">Data Archive Service</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeProductTimeliness + '">' +
                            '<a href="/product-timeliness.html">' +
                                '<span class="sub-item">Product Timeliness</span>' +
                            '</a>' +
                        '</li>' +

                    '</ul>' +
                '</div>' +
            '</li>');
    }

    addAdminPaths() {
        let path = window.location.href;
        let activeRoles = path.toUpperCase().includes('ROLES') ? ' active ' : '';
        let activeUsers = path.toUpperCase().includes('USERS') ? ' active ' : '';
        let activeNews = path.toUpperCase().includes('NEWS') ? ' active ' : '';
        let activeAnomalies = path.toUpperCase().includes('ANOMALIES') ? ' active ' : '';
        let activeAcqPlans = path.toUpperCase().includes('PLANS') ? ' active ' : '';
        let active = path.toUpperCase().includes('USERS') || path.toUpperCase().includes('ROLES')
                || path.toUpperCase().includes('NEWS') || path.toUpperCase().includes('ANOMALIES') ? ' active ' : '';
        let show = path.toUpperCase().includes('USERS') || path.toUpperCase().includes('ROLES')
                || path.toUpperCase().includes('NEWS') || path.toUpperCase().includes('ANOMALIES') ? ' show ' : '';
        $('#sidebar-tree-paths').append(
            '<li class="nav-item' + active + '">' +
                '<a data-toggle="collapse" href="#admin">' +
                    '<i class="fas fa-cogs"></i>' +
                    '<p>Administration</p>' +
                    '<span class="caret"></span>' +
                '</a>' +
                '<div class="collapse' + show + '" id="admin">' +
                    '<ul class="nav nav-collapse">' +
                        '<li class="' + activeRoles + '">' +
                            '<a href="/roles.html">' +
                                '<span class="sub-item">Roles</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeUsers + '">' +
                            '<a href="/users.html">' +
                                '<span class="sub-item">Users</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeNews + '">' +
                            '<a href="/news.html">' +
                                '<span class="sub-item">News</span>' +
                            '</a>' +
                        '</li>' +
                        '<li class="' + activeAnomalies + '">' +
                            '<a href="/anomalies.html">' +
                                '<span class="sub-item">Anomalies</span>' +
                            '</a>' +
                        '</li>' +
                    '</ul>' +
                '</div>' +
            '</li>');
    }

}

profiles = new Profiles();