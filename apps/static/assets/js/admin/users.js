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

class Users {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        // Data take table
        try {
            this.usersTable = $('#basic-datatables-users').DataTable({
                "language": {
                  "emptyTable": "Retrieving users..."
                },
                columnDefs: [{
                        targets: -1,
                        data: null,
                        render: function (data, type, row) {
                            if (type === 'display' &&

                                    // Allow deletion only of roles different from "admin"
                                    (data[0].toString() === 'admin')) {

                                return '<button type="button" class="btn-link" onclick="users.editUserDetails(\'' + data[0] + '\')"><i class="icon-pencil"></i></button>';

                            } else if (type === 'display' &&

                                    // Allow deletion only of roles different from "admin"
                                    (data[0].toString() !== 'admin')) {

                                return '<button type="button" class="btn-link" onclick="users.editUserDetails(\'' + data[0] + '\')"><i class="icon-pencil"></i></button>' +
                                       '<button type="button" class="btn-link" onclick="users.deleteUser(\'' + data[0] + '\')"><i class="icon-trash"></i></button>';

                            } else {
                                return data;
                            }
                        }
                    }]
                });
        } catch(err) {
            console.info('Initializing users class - skipping table creation...')
        }

        // Map containing serialized users accessed from "username" field
        this.users = {};

        // Map containing serialized roles accessed from "role name" field
        this.roles = [];

    }

    init() {

        // Retrieve roles from local MYSQL DB
        ajaxCall('/api/auth/roles', 'GET', {}, this.loadRoles.bind(this), this.errorLoadRoles.bind(this));

        // Retrieve users from local MYSQL DB
        ajaxCall('/api/auth/users', 'GET', {}, this.loadUsers.bind(this), this.errorLoadUsers.bind(this));

        return;
    }

    loadRoles(response) {

        // Acknowledge the successful retrieval of users
        var rows = format_response(response);
        console.info('Roles successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        for (var i = 0 ; i < rows.length ; ++i){
            this.roles.push(rows[i]['name']);
        }

        // Populate the select in the modal window to add a new user
        users.roles.forEach(function(role) {
            $('#new-user-role').append('<option value="' + role + '">' + role + '</option>');
        });
    }

    errorLoadRoles(response){
        console.error(response)
        return;
    }

    loadUsers(response) {

        // Acknowledge the successful retrieval of users
        var rows = format_response(response);
        console.info('Users successfully retrieved');
        console.info("Number of records: " + rows.length);

        // Parse response
        var data = new Array();
        for (var i = 0 ; i < rows.length ; ++i){

            // Auxiliary variables
            var element = rows[i];
            var uuid = element['id'];
            var username = element['username'];
            var email = element['email'];
            var password = element['password'];
            var role = element['role'];
            var modify_date = moment(element['modifyDate'], 'yyyy-MM-DD HH:mm:ss.SSS').toDate();

            // Save a local copy of the user
            this.users[username] = element;

            // Push the element row, with the collected information
            // row is a datatable row, related to a single user
            // User status record:
            // username, email, role, modify date
            data.push([username, email, role]);
        }

        // Refresh users table and return
        this.usersTable.clear().rows.add(data).draw();
        return;
    }

    errorLoadUsers(response){
        console.error(response)
        return;
    }

    createUser(user) {

    }

    editUserDetails(username) {
        let user = users.users[username];
        users.buildUserDetailsPanel(user);
    }

    deleteUser(username) {
        let user = users.users[username];
        console.info(user);
    }

    buildUserDetailsPanel(user) {

        // Build widgets
        $('#user-details').html('');
        $('#user-details').append(
            '<div class="form-group" id="username-div">' +
                '<label for="username">Username *</label>' +
                '<input type="text" class="form-control" id="username" placeholder="Enter username" required onkeyup="users.validateUserDetails()">' +
            '</div>');
        $('#username').val(user['username']);
        $('#user-details').append(
            '<div class="form-group" id="user-email-div">' +
                '<label for="user-email">Email *</label>' +
                '<input type="text" class="form-control" id="user-email" placeholder="Enter e-mail" required onkeyup="users.validateUserDetails()">' +
            '</div>');
        $('#user-email').val(user['email']);
        $('#user-details').append(
            '<div class="form-group">' +
                '<label for="user-role-select">Role</label>' +
                '<select class="form-control" id="user-role-select" placeholder="User role"></select>' +
            '</div>');
        users.roles.forEach(function(role) {
            let selected = user['role'] === role ? ' selected ' : '';
            $('#user-role-select').append('<option value="' + role + '"' + selected + '>' + role + '</option>');
        });
        $('#user-details').append(
            '<div class="form-group" id="user-password-div">' +
                '<label for="user-password">Password</label>' +
                '<input type="password" class="form-control" id="user-password" placeholder="Password" onkeyup="users.validateUserDetails()">' +
            '</div>');
        $('#user-password').val(user['password']);
        $('#user-details').append(
            '<div class="form-group">' +
                '<button id="save-user-details-btn" class="btn btn-primary pull-right" onclick="users.updateUserDetails(\'' + user['id'] + '\')">Update</button>' +
            '</div>');

        // Invoke form validation
        users.validateUserDetails();
    }

    updateUserDetails(id) {

        // Retrieve new user's details
        let username = $('#username').val();
        let email =  $('#user-email').val();
        let role = $('#user-role-select').val();
        let password = $('#user-password').val();

        // Invoke user's details update
        let data = {'id': id, 'username': username, 'email': email, 'password': password, 'role': role}
        ajaxCall('/api/auth/user', 'POST', data, this.successUpdateUser.bind(this), this.errorUpdateUser.bind(this));
    }

    successUpdateUser() {

        // Clean user details panel
        $('#username').val('');
        $('#user-email').val('');
        $('#user-role-select').val('');
        $('#user-password').val('');

        // Reload users table
        ajaxCall('/api/auth/users', 'GET', {}, this.loadUsers.bind(this), this.errorLoadUsers.bind(this));
    }

    errorUpdateUser() {
        console.error(response)
        return;
    }

    validateUserDetails() {

        // Retrieve existing user's details
        let username = $('#username').val();
        let email =  $('#user-email').val();

        // Username
        if (!username) {
            $('#username-div').addClass('has-error');
            $('#username-div-help').remove();
            $('#username-div').append('<small id="username-div-help" class="form-text text-muted">username cannot be null</small>');
            $("#save-user-details-btn").prop("disabled", true);
            return ;
        } else {
            $('#username-div').removeClass('has-error');
            $('#username-div-help').remove();
            $("#save-user-details-btn").prop("disabled", false);
        }

        // Email
        if (!email) {
            $('#user-email-div').addClass('has-error');
            $('#user-email-div-help').remove();
            $('#user-email-div').append('<small id="user-email-div-help" class="form-text text-muted">enter a valid email address</small>');
            $("#save-user-details-btn").prop("disabled", true);
            return ;
        } else {
            $('#user-email-div').removeClass('has-error');
            $('#user-email-div-help').remove();
            $("#save-user-details-btn").prop("disabled", false);
        }
    }

    addUser() {

        // Return if input values are incomplete / missing
        if (!users.validateNewUserDetails()) {
            return ;
        }

        // Retrieve user parameters from new user form
        let username = $('#new-username').val();
        let email = $('#new-user-email').val();
        let role = $('#new-user-role').val();
        let password = $('#new-user-password').val();

        // Invoke new user creation
        let data = {'username': username, 'email': email, 'password': password, 'role': role}
        ajaxCall('/api/auth/user', 'POST', data, this.successAddUser.bind(this), this.errorAddUser.bind(this));
    }

    successAddUser(response) {

        // Close new user modal window
        $('#addUserModal').modal('hide');

        // Empty input fields
        $('#new-username').val('');
        $('#new-user-email').val('');
        $('#new-user-password').val('');

        // Reload the users table
        ajaxCall('/api/auth/users', 'GET', {}, this.loadUsers.bind(this), this.errorLoadUsers.bind(this));
    }

    errorAddUser(response) {
        console.error(response)
        return;
    }

    validateNewUserDetails() {

        // Retrieve new user's details
        let username = $('#new-username').val();
        let email = $('#new-user-email').val();
        let role = $('#new-user-role').val();
        let password = $('#new-user-password').val();

        // Username
        if (!username) {
            $('#new-username-div').addClass('has-error');
            $('#new-username-div-help').remove();
            $('#new-username-div').append('<small id="new-username-div-help" class="form-text text-muted">username cannot be null</small>');
            $("#new-user-btn").prop("disabled", true);
            return false;
        } else {
            $('#new-username-div').removeClass('has-error');
            $('#new-username-div-help').remove();
            $("#new-user-btn").prop("disabled", false);
        }

        // Email
        if (!email) {
            $('#new-user-email-div').addClass('has-error');
            $('#new-user-email-div-help').remove();
            $('#new-user-email-div').append('<small id="new-user-email-div-help" class="form-text text-muted">enter a valid email address</small>');
            $("#new-user-btn").prop("disabled", true);
            return false;
        } else {
            $('#new-user-email-div').removeClass('has-error');
            $('#new-user-email-div-help').remove();
            $("#new-user-btn").prop("disabled", false);
        }

        // Role
        if (!role) {
            $('#new-user-role-div').addClass('has-error');
            $('#new-user-role-div-help').remove();
            $('#new-user-role-div').append('<small id="new-user-role-div-help" class="form-text text-muted">role cannot be null</small>');
            $("#new-user-btn").prop("disabled", true);
            return false;
        } else {
            $('#new-user-role-div').removeClass('has-error');
            $('#new-user-role-div-help').remove();
            $("#new-user-btn").prop("disabled", false);
        }

        // Password
        if (!password) {
            $('#new-user-password-div').addClass('has-error');
            $('#new-user-password-div-help').remove();
            $('#new-user-password-div').append('<small id="new-user-role-div-help" class="form-text text-muted">password cannot be null</small>');
            $("#new-user-btn").prop("disabled", true);
            return false;
        } else {
            $('#new-user-password-div').removeClass('has-error');
            $('#new-user-password-div-help').remove();
            $("#new-user-btn").prop("disabled", false);
        }

        // Successful validation
        return true;
    }

    deleteUser(username) {

        // Delete the specified role from the local MYSQL DB
        let data = {'username': username};
        ajaxCall('/api/auth/user', 'DELETE', data, this.successDeleteUser.bind(this), this.errorDeleteUser.bind(this));
    }

    successDeleteUser(response) {

        // Reload the role table
        ajaxCall('/api/auth/users', 'GET', {}, this.loadUsers.bind(this), this.errorLoadUsers.bind(this));
    }

    errorDeleteUser(response) {
        console.error(response)
        return;
    }
}

let users = new Users();