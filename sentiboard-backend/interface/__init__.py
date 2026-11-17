"""HTTP interface of the hand-written read routes (the generated CRUD routers live in
`routers/`, which their generator owns)."""

from interface.routes import router

__all__ = ["router"]
