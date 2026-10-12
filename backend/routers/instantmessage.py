
"""Generated CRUD router for Instantmessage.

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

from schemas.instantmessage import Instantmessage
from documents.instantmessage import Instantmessage as InstantmessageDocument

router = APIRouter(prefix="/instantmessage", tags=["instantmessage"])


@router.get("/", response_model=List[Instantmessage])
def list_instantmessage() -> List[Instantmessage]:
    """List all Instantmessage resources."""
    documents = list_documents(InstantmessageDocument)
    return [document_to_schema(document, Instantmessage) for document in documents]


@router.get("/{item_id}", response_model=Instantmessage)
def get_instantmessage(item_id: str) -> Instantmessage:
    """Get a single Instantmessage resource by id."""
    document = get_document(InstantmessageDocument, item_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Instantmessage not found")
    return document_to_schema(document, Instantmessage)


@router.post("/", response_model=Instantmessage, status_code=201)
def create_instantmessage(item: Instantmessage, response: Response) -> Instantmessage:
    """Create a new Instantmessage resource."""
    document = create_document(schema_to_document(item, InstantmessageDocument))
    response.headers["Location"] = f"/instantmessage/{document.meta.id}"
    return document_to_schema(document, Instantmessage)


@router.put("/{item_id}", response_model=Instantmessage)
def update_instantmessage(item_id: str, item: Instantmessage) -> Instantmessage:
    """Replace an existing Instantmessage resource."""
    document = update_document(
        InstantmessageDocument, item_id, schema_to_document(item, InstantmessageDocument)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Instantmessage not found")
    return document_to_schema(document, Instantmessage)


@router.delete("/{item_id}", status_code=204)
def delete_instantmessage(item_id: str) -> Response:
    """Delete a Instantmessage resource."""
    if not delete_document(InstantmessageDocument, item_id):
        raise HTTPException(status_code=404, detail="Instantmessage not found")
    return Response(status_code=204)
