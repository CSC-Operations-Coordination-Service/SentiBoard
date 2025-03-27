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

class Roles {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        // Data take table
        try {
            this.rolesTable = $('#basic-datatables-roles').DataTable({
                "language": {
                  "emptyTable": "Retrieving roles..."
                },
                columnDefs: [{
                        targets: -1,
                        data: null,
                        render: function (data, type, row) {
                            if ((type === 'display') &&

                                    // Allow deletion only of roles different from "guest", "ecrole" and "admin"
                                    (data[0].toString() !== 'admin' && data[0].toString() !== 'guest' && data[0].toString() !== 'ecuser')) {

                                return '<button type="button" class="btn-link" onclick="roles.deleteRole(\'' + data[0] + '\')"><i class="icon-trash"></i></button>';

                            }
                            return '<p>This role cannot be deleted</p>';
                        }
                    }]
                });
        } catch(err) {
            console.info('Initializing roles class - skipping table creation...')
        }

        // Map containing serialized roles accessed from "role name" field
        this.roles = [];

    }

    init() {

        // Retrieve roles from local MYSQL DB
        ajaxCall('/api/auth/roles', 'GET', {}, this.successLoadRoles.bind(this), this.errorLoadRoles.bind(this));

        return;
    }

    successLoadRoles(response) {

        // Acknowledge the successful retrieval of roles
        var rows = format_response(response);
        console.info('Roles successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        var data = new Array();
        for (var i = 0 ; i < rows.length ; ++i) {
            let role = rows[i]['name'];
            let description = rows[i]['description'];
            data.push([role, description]);
        }

        // Refresh roles table and return
        this.rolesTable.clear().rows.add(data).draw();
        return;
    }

    errorLoadRoles(response){
        console.error(response)
        return;
    }

    validateRole() {

        // Retrieve new role's name
        let rolename = $('#role-name').val();

        // Validate role name
        if (!rolename) {
            $('#role-name-div').addClass('has-error');
            $('#role-name-div-help').remove();
            $('#role-name-div').append('<small id="role-name-div-help" class="form-text text-muted">role name cannot be null</small>')
            $("#role-add-btn").prop("disabled", true);
            return ;
        } else {
            $('#role-name-div').removeClass('has-error');
            $('#role-name-div-help').remove();
            $("#role-add-btn").prop("disabled", false);
        }
    }

    addRole(user) {

        // Retrieve the new role fields
        let name = $('#role-name').val();
        let description = $('#role-description').val();

        // Add the new role to the local MYSQL DB
        let data = {'name': name, 'description': description};
        ajaxCall('/api/auth/role', 'POST', data, this.successAddRole.bind(this), this.errorAddRole.bind(this));
    }

    successAddRole(response) {

        // Reload the role table
        ajaxCall('/api/auth/roles', 'GET', {}, this.successLoadRoles.bind(this), this.errorLoadRoles.bind(this));

        // Clear the editing form fields
        $('#role-name').val('');
        $('#role-description').val('');
        $("#role-add-btn").prop("disabled", true);
    }

    errorAddRole(response) {

    }

    deleteRole(role) {

        // Delete the specified role from the local MYSQL DB
        let data = {'name': role};
        ajaxCall('/api/auth/role', 'DELETE', data, this.successDeleteRole.bind(this), this.errorDeleteRole.bind(this));
    }

    successDeleteRole(response) {

        // Reload the role table
        ajaxCall('/api/auth/roles', 'GET', {}, this.successLoadRoles.bind(this), this.errorLoadRoles.bind(this));
    }

    errorDeleteRole(response) {
        console.error(response)
        return;
    }
}

let roles = new Roles();