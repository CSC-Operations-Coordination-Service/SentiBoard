
"""Generated CRUD router for News.

Persists via maas_model.document_repository generic OpenSearch CRUD
built on MAASDocument's existing API and converts between this schema and its
sibling MAASDocument via maas_model.schema_adapter.

"""

from typing import List

from fastapi import APIRouter, HTTPException, Response

from maas_model.document_repository import (
    create_document,
    delete_document,
    get_document,
    list_documents,
    update_document,
)
from maas_model.schema_adapter import document_to_schema, schema_to_document

from schemas.news import News
from documents.news import News as NewsDocument

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/", response_model=List[News])
def list_news() -> List[News]:
    """List all News resources."""
    documents = list_documents(NewsDocument)
    return [document_to_schema(document, News) for document in documents]


@router.get("/{item_id}", response_model=News)
def get_news(item_id: str) -> News:
    """Get a single News resource by id."""
    document = get_document(NewsDocument, item_id)
    if document is None:
        raise HTTPException(status_code=404, detail="News not found")
    return document_to_schema(document, News)


@router.post("/", response_model=News, status_code=201)
def create_news(item: News, response: Response) -> News:
    """Create a new News resource."""
    document = create_document(schema_to_document(item, NewsDocument))
    response.headers["Location"] = f"/news/{document.meta.id}"
    return document_to_schema(document, News)


@router.put("/{item_id}", response_model=News)
def update_news(item_id: str, item: News) -> News:
    """Replace an existing News resource."""
    document = update_document(
        NewsDocument, item_id, schema_to_document(item, NewsDocument)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="News not found")
    return document_to_schema(document, News)


@router.delete("/{item_id}", status_code=204)
def delete_news(item_id: str) -> Response:
    """Delete a News resource."""
    if not delete_document(NewsDocument, item_id):
        raise HTTPException(status_code=404, detail="News not found")
    return Response(status_code=204)
