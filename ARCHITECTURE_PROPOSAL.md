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

### **Backend**:
  - Fast API
    - Application REST API
    - Use of Pydantic models for request & response validation
    - Generated schmeas and common CRUD router behaviour are produced from MAAS JSON index templates using `fastapigen`
  - MAAS Model/`fastapigen`
    - Provides common model generation foundation
    - Use `*_template.json` files as source definition for index mappings
    - `ModelClassMeta` interprets the MAAS/OpenSearch template metadata
    - `pygen` generates the OpenSearch/MAAS model
    - `fastapigen` generates the corresponding Pydantic schema and FastAPI CRUD router
  - Opensearch/SFEOS (stac-fastapi-elasticsearch-opensearch)
    - Provides persistence and indexing for the application's data
    - MAAS/OpenSearch index templates define strructure of indexed resources
    - Generated MAAS models provide the mapping between Python objects and OpenSearch documents
    - SFEOS (stac-fastapi-elasticsearch-opensearch) can provide the relevant OpenSearch integration where applicable


### **Frontend**: 
  - Next.js


### **Other**
  - Docker
  - Docker Compose
  - Keycloak
  

### System Diagram


## Key Design Decisions

  ### 1. Template-driven Models
  MAAS/OpenSearch JSON templates are treated as the source definition for resource mappings. This avoids independently defining the same resource structure in OpenSearch, MAAS models and FastAPI/Pydantic schemas.

  The existing `pygen` generator produces the MAAS/OpenSearch model from the template, while `fastapigen` produces the corresponding FastAPI/Pydantic components.

  ### 2. Generated code & application code separation
  Generated schemas and routers will be placed in dedicated generated packages. Application-specific behaviour can then be implemented separately and extended from the generated base where required.

  ### 3. Shared generation logic
  `fastapigen` will reside in the `maas-model` repository and act as the common generator for FastAPI applications requiring MAAS/OpenSearch resources. Individual backends can use the generator against their own collection of templates.

  ### 4. Generic CRUD behaviour
  Common REST CRUD operations will be generated for resources where the default behaviour is sufficient. Application-specific endpoints or business logic can be implemented independently of the generated CRUD layer.


## Migration Strategy

  ### Phase 1 - Generator Foundation
  - Establish `maas-model` as source of shared model/generator functionality
  - Define MAAS JSON templates for required resources.
  - Generate MAAS/OpenSearch models using `pygen`.
  - Implement `fastapigen` to generate Pydantic schemas.
  - Add tests for generated schema behaviour.

  ### Phase 2 - Generic FastAPI generation
  - Generate CRUD routers from MAAS templates.
  - Generate resource-specific routers.
  - Generate the top-level router aggregating generated resources.
  - Integrate generated routers into the FastAPI application.

  ### Phase 3 - Sentiboard Integration
  - Replace manually defined resource schemas/routes where appropriate.
  - Extend generated models/routers for Sentiboard-specific requirements.
  - Integrate the generated models with the OpenSearch/SFEOS persistence layer.

## Risks & Trade-offs

  ### Generated Code Complexity
  Increasing the scope of `fastapigen` could make generated code difficult to understand or customise. The generator should therefore focus on common, repeatable behaviour while allowing application-specific extensions.

  ### Generated vs Custom Behaviour
  Generic CRUD operations may not be sufficient for resources with complex business rules. Such resources may require custom routers or services rather than relying exclusively on generated behaviour

  ### Generator Coupling
  `fastapigen` introduces a dependency between the MAAS model definition and FastAPI. Changes to the template format or `ModelClassMeta` may therefore require corresponding changes to the generator.