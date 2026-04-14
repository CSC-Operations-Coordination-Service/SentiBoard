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

class Users {

    // Move date handling to MIXIN (periodSelection)
    constructor() {

        // Hide time period selector
        $('#time-period-select').hide();

        // Map containing serialized users accessed from "username" field
        this.users = {};

        // Map containing serialized roles accessed from "role name" field
        this.roles = [];

        this.usersTable = null;

    }

    init(initialUsers, initialRoles) {
        this.usersTable = $('#basic-datatables-users').DataTable();

        if (initialRoles) {
            initialRoles.forEach(role => {
                this.roles.push(role.name);
            });
        }
        if (initialUsers) {
            this.loadUsers(initialUsers);
        }
    }

    loadUsers(response) {
        let rows = (typeof format_response === "function") ? format_response(response) : response;

        console.info('Users successfully retrieved');
        console.info("Number of records: " + rows.length);

        var tableData = [];
        this.users = {};

        rows.forEach(user => {
            this.users[user.username] = user;

            let actionButtons = `
                <button type="button" class="btn-link" onclick="users.editUserDetails('${user.username}')">
                    <i class="icon-pencil"></i>
                </button>`;

            if (user.username !== 'admin') {
                actionButtons += `
                <button type="button" class="btn-link" onclick="users.deleteUser('${user.username}')">
                    <i class="icon-trash"></i>
                </button>`;
            }

            tableData.push([
                user.username,
                user.email,
                user.role,
                actionButtons
            ]);
        });

        this.usersTable.clear().rows.add(tableData).draw();
    }

    editUserDetails(username) {
        let user = this.users[username];
        if (user) {
            this.buildUserDetailsPanel(user);
        }
    }

    buildUserDetailsPanel(user) {
        const container = $('#user-details');
        container.html('');

        let roleOptions = this.roles.map(role => {
            let selected = (user.role === role) ? 'selected' : '';
            return `<option value="${role}" ${selected}>${role}</option>`;
        }).join('');

        container.append(`
        <div class="form-group" id="username-div">
            <label for="username">Username *</label>
            <input type="text" class="form-control" id="username" value="${user.username}" placeholder="Enter username" required onkeyup="users.validateUserDetails()">
        </div>

        <div class="form-group" id="user-email-div">
            <label for="user-email">Email *</label>
            <input type="text" class="form-control" id="user-email" value="${user.email}" placeholder="Enter e-mail" required onkeyup="users.validateUserDetails()">
        </div>

        <div class="form-group">
            <label for="user-role-select">Role</label>
            <select class="form-control" id="user-role-select">
                ${roleOptions}
            </select>
        </div>

        <div class="form-group" id="user-password-div">
            <label for="user-password">Password</label>
            <input type="password" class="form-control" id="user-password" placeholder="Leave blank to keep current" onkeyup="users.validateUserDetails()">
        </div>

        <div class="form-group">
            <button id="save-user-details-btn" class="btn btn-primary pull-right" onclick="users.updateUserDetails('${user.id}')">Update</button>
        </div>
    `);

        this.validateUserDetails();
    }

    updateUserDetails(id) {
        this.submitSSRForm({
            'action': 'update',
            'id': id,
            'username': $('#username').val(),
            'email': $('#user-email').val(),
            'role': $('#user-role-select').val(),
            'password': $('#user-password').val()
        });
    }

    successUpdateUser() {
        // Redirect to the same page with a 'success' parameter in the URL
        window.location.href = "/users.html?msg=updated";
    }

    addUser() {
        if (!this.validateNewUserDetails()) return;

        this.submitSSRForm({
            'action': 'add',
            'username': $('#new-username').val(),
            'email': $('#new-user-email').val(),
            'role': $('#new-user-role').val(),
            'password': $('#new-user-password').val()
        });
    }

    deleteUser(username) {
        if (confirm(`Are you sure you want to delete ${username}?`)) {
            this.submitSSRForm({
                'action': 'delete',
                'username': username
            });
        }
    }

    submitSSRForm(data) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/users.html';

        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const hiddenField = document.createElement('input');
                hiddenField.type = 'hidden';
                hiddenField.name = key;
                hiddenField.value = data[key];
                form.appendChild(hiddenField);
            }
        }

        document.body.appendChild(form);
        form.submit();
    }

    successAddUser() {
        // Same for adding a user
        window.location.href = "/users.html?msg=added";
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

    validateUserDetails() {
        const username = $('#username').val();
        const email = $('#user-email').val();

        // Check if fields are empty
        const isUsernameValid = !!username;
        const isEmailValid = !!email;

        // Toggle Error classes
        $('#username-div').toggleClass('has-error', !isUsernameValid);
        $('#user-email-div').toggleClass('has-error', !isEmailValid);

        // Handle Help Text
        $('#username-div-help, #user-email-div-help').remove();
        if (!isUsernameValid) {
            $('#username-div').append('<small id="username-div-help" class="form-text text-muted">username cannot be null</small>');
        }
        if (!isEmailValid) {
            $('#user-email-div').append('<small id="user-email-div-help" class="form-text text-muted">enter a valid email address</small>');
        }

        // Disable/Enable button
        $("#save-user-details-btn").prop("disabled", !(isUsernameValid && isEmailValid));
    }

    successDeleteUser() {
        window.location.href = "/users.html?msg=deleted";
    }
}

let users = new Users();