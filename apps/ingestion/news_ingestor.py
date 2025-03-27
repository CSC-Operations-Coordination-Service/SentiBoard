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

from datetime import datetime

import apps.ingestion.news_scraper as scraper
import apps.models.news as news_model
from apps.models import categories as categories_model
from apps.models import impacted_satellite as impacted_satellite_model
import apps.utils.html_utils as html_utils
from apps.cache.cache import ConfigCache


# Class meant to ingest news from Collaborative Data Hub.
# Ingestion is done in 2 times: at first, the HTML of the events is saved;
# then, the text of the news is parsed and the content is processed.

class NewsIngestor:

    def __int__(self):
        return

    def get_news(self, pages=5):

        # Retrieve the published news from Sentinel Online
        news_list = []
        i = 0
        while i < pages:
            url = ConfigCache.load_object('news_config')['url'].replace('cur=0', 'cur=' + str(i))
            html_page = scraper.ScarperHtml(html_utils.get_html_page(url))
            elements_list = html_page.get_elements_by_class('div', 'journal-content-article')
            for news in elements_list:
                try:
                    html_page.ingestion_by_string(news.prettify())
                    title_news = html_page.get_element_by_class('h3', 'asset-title content').text.strip()
                    link_news = html_page.get_element_by_class('h3', 'asset-title content').contents[1].attrs[
                        'href'].strip()
                    text_news = html_page.get_element_by_class('div', 'asset-summary').text.strip()
                    publication_date_news = html_page.get_element_by_class('h4',
                                                                           'asset-title-date content').text.strip()
                    publication_date = datetime.strptime(publication_date_news, '%d %B %Y')

                    news_item = {'title': title_news, 'text': text_news, 'link': link_news,
                                 'publicationDate': publication_date, 'occurrenceDate': publication_date, 'category': '',
                                 'impactedSatellite': '', 'environment': '', 'datatakes_completeness': ''}
                    news_list.append(news_item)
                except:
                    pass
            i += 1

        # After having retrieved the news, parse the relevant text and set the proper categories
        # Keep only the news associated to maintenance activities, downtime, manoeuvres and calibrations
        final_news_list = []
        news_keywords = ['MANOEUVRE', 'MANEUVER', 'UNAVAILABILITY', 'INFRASTRUCTURE', 'DOWNTIME',
                         'MAINTENANCE', 'CALIBRATION', 'DEGRADED', 'DELAY']

        for news in news_list:
            if any(word in news['title'].upper() for word in news_keywords):
                categorized_news = news

                title_tokenized = news['title'].replace('[', ' ').replace(']', ' ').replace('(', ' ').replace(')', ' ') \
                    .replace('_', ' ').replace(':', ' ').replace('/', ' ').replace('*', ' ').split()
                text_tokenized = news['text'].replace('[', ' ').replace(']', ' ').replace('(', ' ').replace(')', ' ') \
                    .replace('_', ' ').replace(':', ' ').replace('/', ' ').replace('*', ' ').split()

                for token in title_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    impacted_satellite = impacted_satellite_model.get_impacted_satellite_by_synonymous(token)
                    if impacted_satellite is not None:
                        categorized_news['impactedSatellite'] = impacted_satellite.name
                        break

                if categorized_news['impactedSatellite'] is None or len(categorized_news['impactedSatellite']) == 0:
                    for token in text_tokenized:
                        token = str(token)
                        if self.not_consistent(token):
                            continue
                        impacted_satellite = impacted_satellite_model.get_impacted_satellite_by_synonymous(token)
                        if impacted_satellite is not None:
                            categorized_news['impactedSatellite'] = impacted_satellite.name
                            break

                for token in title_tokenized:
                    token = str(token)
                    if self.not_consistent(token):
                        continue
                    category = categories_model.get_category_by_synonymous(token)
                    if category is not None:
                        categorized_news['category'] = category.name
                        break

                if categorized_news['category'] is None or len(categorized_news['category']) == 0:
                    for token in text_tokenized:
                        token = str(token)
                        if self.not_consistent(token):
                            continue
                        category = categories_model.get_category_by_synonymous(token)
                        if category is not None:
                            categorized_news['category'] = category.name
                            break
                        else:
                            categorized_news['category'] = 'Production'

                final_news_list.append(categorized_news)
            else:
                continue

        return final_news_list

    def ingest_news(self):
        list_news = self.get_news()

        # Loop over all retrieved anomalies, and save or update them
        for news in list_news:
            news_model.update_news(title=news['title'], text=news['text'], link=news['link'],
                                   publication_date=news['publicationDate'], occurrence_date=news['occurrenceDate'],
                                   category=news['category'], impacted_satellite=news['impactedSatellite'],
                                   environment=news['environment'])

    def not_consistent(self, token):
        excluded_tokens = ['-', 'in', 'and', 'or', 'the', 'of', 'to', 'due', 'ok', 'i.e', 'i.e.', 'is']
        return token.isdigit() or len(token) == 1 or token in excluded_tokens