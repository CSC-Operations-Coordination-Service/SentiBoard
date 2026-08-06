"""Minimal MAAS model package exports for generated documents."""

from __future__ import annotations

from typing import TYPE_CHECKING

__all__ = ["MAASDocument", "MAASRawDocument", "ZuluDate"]

if TYPE_CHECKING:
    from maas_model.document import MAASDocument, MAASRawDocument
    from maas_model.zulu_date import ZuluDate


def __getattr__(name: str):
    if name in {"MAASDocument", "MAASRawDocument"}:
        from maas_model.document import MAASDocument, MAASRawDocument

        return {
            "MAASDocument": MAASDocument,
            "MAASRawDocument": MAASRawDocument,
        }[name]

    if name == "ZuluDate":
        from maas_model.zulu_date import ZuluDate

        return ZuluDate

    raise AttributeError(f"module 'maas_model' has no attribute {name!r}")