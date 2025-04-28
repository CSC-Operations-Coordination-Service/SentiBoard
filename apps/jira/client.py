# -*- encoding: utf-8 -*-
"""
Copernicus Operations Dashboard

Copyright (C) ${startYear}-${currentYear} ${Telespazio}
All rights reserved.

This document discloses subject matter in which TPZ has
proprietary rights. Recipient of the document shall not duplicate, use or
disclose in whole or in part, information contained herein except for or on
behalf of TPZ to fulfill the purpose for which the document was
delivered to him.
"""

from jira import JIRA

from apps.cache.cache import ConfigCache


class JiraClient:

    def __init__(self, jira_host=None, jira_user=None, jira_password=None):
        self.__client = None
        if jira_host is None and jira_user is None and jira_password is None:
            jira_config = ConfigCache.load_object("cams_issues_config")
            self.init(
                jira_config["jira_host"],
                jira_config["jira_user"],
                jira_config["jira_password"],
            )
        else:
            self.init(jira_host, jira_user, jira_password)
        return

    def init(self, jira_host, jira_user, jira_password):
        jira_server = {"server": jira_host, "verify": False}
        self.__client = JIRA(options=jira_server, basic_auth=(jira_user, jira_password))
        return

    def get_connection(self):
        return self.__client

    def get_issue(self, issue):
        return self.__client.issue(issue)

    def search(self, jql, start_at=0, max_results=50):
        res = self.__client.search_issues(jql, startAt=start_at, maxResults=max_results)
        return res

    def search_all(self, jql):
        total = []
        all_value = 1
        start_at = 0
        while start_at < all_value:
            res = self.__client.search_issues(jql, startAt=start_at, maxResults=10000)
            if res is None or len(res) == 0:
                return total
            all_value = res.total
            start_at += res.maxResults
            total += res.iterable

        return total

    def search_issue_by_project(self, project, start_at=0, max_results=50):
        res = self.search(
            "project=" + project, start_at=start_at, max_results=max_results
        )
        return res
