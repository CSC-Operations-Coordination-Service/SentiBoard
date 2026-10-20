"""Minimal chat session management - session_id only."""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class ChatSessionState:
    """Manages conversation session ID within Flask session.

    Stores only:
    - session_id (from chatbot API, persists across messages)
    - model_name (for UI display)
    - thread_id (opaque, from API)

    NOTE: No message history or artifact cache. History is client-side only
    for redrawing; backend only needs message + session_id on POST /chat.
    """

    SESSION_KEY = "chatbot_state"

    def __init__(self, session_dict: Dict[str, Any]):
        """Initialize with Flask session dict."""
        self.session = session_dict
        self._ensure_state()

    def _ensure_state(self):
        """Initialize minimal state dict if not present."""
        if self.SESSION_KEY not in self.session:
            self.session[self.SESSION_KEY] = {
                "session_id": None,
                "thread_id": None,
                "model_name": None,
            }

    def start_conversation(self, model_name: str, session_id: str, thread_id: str):
        """Record conversation start from first API response."""
        state = self.session[self.SESSION_KEY]
        state["session_id"] = session_id
        state["thread_id"] = thread_id
        state["model_name"] = model_name
        self.session.modified = True
        logger.debug(f"Started conversation: session_id={session_id}")

    def get_session_id(self) -> Optional[str]:
        """Get current chatbot session ID."""
        state = self.session[self.SESSION_KEY]
        return state.get("session_id")

    def get_model_name(self) -> Optional[str]:
        """Get LLM model name from last response."""
        state = self.session[self.SESSION_KEY]
        return state.get("model_name")

    def clear(self):
        """Clear conversation state (start new conversation)."""
        if self.SESSION_KEY in self.session:
            del self.session[self.SESSION_KEY]
            self.session.modified = True
            logger.debug("Cleared chat session state")
        self._ensure_state()
