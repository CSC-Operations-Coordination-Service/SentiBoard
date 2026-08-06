# Architecture Proposal

## Executive Summary
This document outlines and describes the refactoring of the [Sentiboard](https://operations.dashboard.copernicus.eu/index) application's architectural elements. The reasoning for this change is to refactor the application to a more microservice-based approach, to focus on operability and high availability.


## Context & Problem Statement

### Current Architecture
Currently, Sentiboard's architecture is composed of 3 distinctive elements: the main application (divided into frontend and backend) and a Redis Cache. 

* **Backend:** A lightweight Flask server handling two core responsibilities:
  * **Elastic Data Ingestor:** Retrieves raw data from the database.
  * **Cache Manager:** Aggregates data and saves it to the Redis cache.
* **Frontend:** Server-Side Rendered (SSR) HTML pages reliant on legacy client-side libraries:
  * **JQuery:** Handles UI interactivity and asynchronous requests.
  * **Bootstrap:** Manages grid layouts and basic styling.

### Problem Statement & Architectural Limitations
While the current architecture successfully served the initial phase of the application, it introduces critical bottlenecks that prevent **operability, high availability, and future scalability**:

1. **Lack of Fault Isolation (Tight Coupling):** Because the *Elastic Data Ingestor* and *Cache Manager* share the same Flask process and container resources, a resource spike or failure in data ingestion directly crashes the caching mechanism, breaking high availability.
2. **Maintenance & Scaling Overhead:** The coupling of front-end views and back-end logic limits deployment flexibility. We cannot scale the data-heavy backend independently of the web-facing frontend components.
3. **Frontend Evolution Bottleneck:** Managing complex, data-dense UI states with jQuery requires manual DOM updates. As Sentiboard evolves to require more real-time, interactive components, jQuery scales poorly, leading to brittle code and slower feature delivery compared to modern, component-driven frameworks.
4. **Synchronous Limitations:** Standard Flask configurations struggle with highly asynchronous, concurrent I/O operations (like heavy database ingestion paired with real-time API polling), capping the application's performance ceiling.
5. **Monolithic UI Rendering (Flask SSR):** The current reliance on Flask Server-Side Rendering forces the backend to manage UI presentation logic. This prevents a clear separation of concerns, increases server-side CPU overhead for page generation, and replaces reusable, modern component structures with hard-to-maintain HTML templates.


## Proposed Architecture

* **Backend**:
  * Fast API
  * Opensearch/SFEOS (stac-fastapi-elasticsearch-opensearch)


* **Frontend**: 
  * Next.js


* **Other**
  * Docker
  * Docker Compose
  * Keycloak
  

### System Diagram

## Key Design Decisions

## Migration Strategy

## Risks & Trade-offs