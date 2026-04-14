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

class Roles {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        // Data take table
        /*  try {
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
          } catch (err) {
              console.info('Initializing roles class - skipping table creation...')
          }
  
          // Map containing serialized roles accessed from "role name" field
          this.roles = [];*/

    }


    validateRole() {

        // Retrieve new role's name
        let rolename = $('#role-name').val();
        let btn = $("#role-add-btn");

        // Validate role name
        if (!rolename) {
            $('#role-name-div').addClass('has-error');
            btn.prop("disabled", true);
            $('#role-name-div-help').remove();
            $('#role-name-div').append('<small id="role-name-div-help" class="form-text text-muted">role name cannot be null</small>')
            $("#role-add-btn").prop("disabled", true);
            return;
        } else {
            $('#role-name-div').removeClass('has-error');
            btn.prop("disabled", false);
            $('#role-name-div-help').remove();
            $("#role-add-btn").prop("disabled", false);
        }
    }

    /*deleteRole(role) { // Parameter is 'role'
        if (confirm(`Are you sure you want to delete ${role}?`)) { // Use 'role' here
            let data = { 'name': role }; // And here
            ajaxCall('/api/auth/role', 'DELETE', data, () => {
                location.reload();
            }, (err) => { console.error(err); });
        }
    }*/
}

let roles = new Roles();