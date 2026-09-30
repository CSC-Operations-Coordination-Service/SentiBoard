"""Chat session management for conversational state."""

import logging
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class SessionArtifactCache:
    """Session-scoped artifact cache (per API contract §3).

    Stores fetched artifact data to avoid redundant API calls within
    a conversation session. Keyed by data_id.
    """

    def __init__(self, session_id: str, ttl_minutes: int = 60):
        """Initialize artifact cache.

        Args:
            session_id: Conversation session ID (for logging)
            ttl_minutes: Time-to-live for cached artifacts
        """
        self.session_id = session_id
        self.ttl = timedelta(minutes=ttl_minutes)
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._timestamps: Dict[str, datetime] = {}

    def get(self, data_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached artifact, checking expiry."""
        if data_id not in self._cache:
            return None

        timestamp = self._timestamps.get(data_id)
        if timestamp and datetime.utcnow() > timestamp + self.ttl:
            # Expired
            del self._cache[data_id]
            del self._timestamps[data_id]
            logger.debug(f"Artifact cache expired: {data_id}")
            return None

        logger.debug(f"Artifact cache hit: {data_id}")
        return self._cache[data_id]

    def set(self, data_id: str, artifact_data: Dict[str, Any]):
        """Store artifact in cache."""
        self._cache[data_id] = artifact_data
        self._timestamps[data_id] = datetime.utcnow()
        logger.debug(f"Cached artifact: {data_id}")

    def clear(self):
        """Clear all cached artifacts."""
        self._cache.clear()
        self._timestamps.clear()
        logger.debug(f"Cleared artifact cache for {self.session_id}")


class ChatSessionState:
    """Manages conversation state within a Flask session.

    Stores:
    - session_id (from chatbot API)
    - message history (for UI display + re-sending to API)
    - artifact cache (fetched data for markers)
    """

    # Flask session key for storing chat state
    SESSION_KEY = "chatbot_state"

    def __init__(self, session_dict: Dict[str, Any]):
        """Wrap Flask session dict for chat operations.

        Args:
            session_dict: Flask session dict (from flask.session)
        """
        self.session = session_dict
        self._ensure_state()

    def _ensure_state(self):
        """Initialize state dict if not present."""
        if self.SESSION_KEY not in self.session:
            self.session[self.SESSION_KEY] = {
                "session_id": None,  # Chatbot API session ID
                "thread_id": None,
                "model_name": None,
                "messages": [],  # Full history (for re-send if needed)
            }

    def start_conversation(self, model_name: str, session_id: str, thread_id: str):
        """Record conversation start from first API response."""
        state = self.session[self.SESSION_KEY]
        state["session_id"] = session_id
        state["thread_id"] = thread_id
        state["model_name"] = model_name
        self.session.modified = True
        logger.debug(f"Started conversation: session_id={session_id}")

    def add_user_message(self, message: str):
        """Add user message to history."""
        state = self.session[self.SESSION_KEY]
        state["messages"].append({
            "role": "user",
            "content": message,
            "timestamp": datetime.utcnow().isoformat()
        })
        self.session.modified = True

    def add_assistant_message(self, response: str):
        """Add assistant response to history (with raw markers included)."""
        state = self.session[self.SESSION_KEY]
        state["messages"].append({
            "role": "assistant",
            "content": response,  # Full response including marker tags
            "timestamp": datetime.utcnow().isoformat()
        })
        self.session.modified = True

    def get_session_id(self) -> Optional[str]:
        """Get current chatbot session ID."""
        state = self.session[self.SESSION_KEY]
        return state.get("session_id")

    def get_messages(self) -> list:
        """Get full message history."""
        state = self.session[self.SESSION_KEY]
        return state.get("messages", [])

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
