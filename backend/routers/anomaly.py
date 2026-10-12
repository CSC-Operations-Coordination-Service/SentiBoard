
"""Generated CRUD router for Anomaly.

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

from schemas.anomaly import Anomaly
from documents.anomaly import Anomaly as AnomalyDocument

router = APIRouter(prefix="/anomaly", tags=["anomaly"])


@router.get("/", response_model=List[Anomaly])
def list_anomaly() -> List[Anomaly]:
    """List all Anomaly resources."""
    documents = list_documents(AnomalyDocument)
    return [document_to_schema(document, Anomaly) for document in documents]


@router.get("/{item_id}", response_model=Anomaly)
def get_anomaly(item_id: str) -> Anomaly:
    """Get a single Anomaly resource by id."""
    document = get_document(AnomalyDocument, item_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return document_to_schema(document, Anomaly)


@router.post("/", response_model=Anomaly, status_code=201)
def create_anomaly(item: Anomaly, response: Response) -> Anomaly:
    """Create a new Anomaly resource."""
    document = create_document(schema_to_document(item, AnomalyDocument))
    response.headers["Location"] = f"/anomaly/{document.meta.id}"
    return document_to_schema(document, Anomaly)


@router.put("/{item_id}", response_model=Anomaly)
def update_anomaly(item_id: str, item: Anomaly) -> Anomaly:
    """Replace an existing Anomaly resource."""
    document = update_document(
        AnomalyDocument, item_id, schema_to_document(item, AnomalyDocument)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return document_to_schema(document, Anomaly)


@router.delete("/{item_id}", status_code=204)
def delete_anomaly(item_id: str) -> Response:
    """Delete a Anomaly resource."""
    if not delete_document(AnomalyDocument, item_id):
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return Response(status_code=204)
