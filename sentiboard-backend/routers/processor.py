
"""Generated CRUD router for Processor.

Persists via maas_model.document_repository generic OpenSearch CRUD
built on MAASDocument's existing API and converts between this schema and its
sibling MAASDocument via maas_model.schema_adapter.

"""

from typing import List

from fastapi import APIRouter, HTTPException, Query, Response

from maas_model.document_repository import (
    create_document,
    delete_document,
    get_document,
    list_documents,
    update_document,
)
from maas_model.schema_adapter import document_to_schema, schema_to_document

from schemas.processor import Processor
from documents.processor import Processor as ProcessorDocument

router = APIRouter(prefix="/processor", tags=["processor"])


@router.get("/", response_model=List[Processor])
def list_processor(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[Processor]:
    """List all Processor resources."""
    documents = list_documents(ProcessorDocument, offset=offset, size=limit)
    return [document_to_schema(document, Processor) for document in documents]


@router.get("/{item_id}", response_model=Processor)
def get_processor(item_id: str) -> Processor:
    """Get a single Processor resource by id."""
    document = get_document(ProcessorDocument, item_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Processor not found")
    return document_to_schema(document, Processor)


@router.post("/", response_model=Processor, status_code=201)
def create_processor(item: Processor, response: Response) -> Processor:
    """Create a new Processor resource."""
    document = create_document(schema_to_document(item, ProcessorDocument))
    response.headers["Location"] = f"/processor/{document.meta.id}"
    return document_to_schema(document, Processor)


@router.put("/{item_id}", response_model=Processor)
def update_processor(item_id: str, item: Processor) -> Processor:
    """Replace an existing Processor resource."""
    document = update_document(
        ProcessorDocument, item_id, schema_to_document(item, ProcessorDocument)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Processor not found")
    return document_to_schema(document, Processor)


@router.delete("/{item_id}", status_code=204)
def delete_processor(item_id: str) -> Response:
    """Delete a Processor resource."""
    if not delete_document(ProcessorDocument, item_id):
        raise HTTPException(status_code=404, detail="Processor not found")
    return Response(status_code=204)
