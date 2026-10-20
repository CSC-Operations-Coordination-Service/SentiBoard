"""Chatbot API client with mock mode support."""

import json
import os
import time
import logging
from typing import Optional, Dict, Any
from uuid import uuid4
import httpx

logger = logging.getLogger(__name__)

# Mock mode enabled via environment variable
MOCK_MODE = os.getenv("CHATBOT_MOCK", "0") == "1"
MOCK_DELAY = 2.5  # Simulate ~2-3s API latency


class ChatbotAPIClient:
    """Client for calling Chatbot Backend API, with mock mode fallback."""

    def __init__(self, api_url: Optional[str] = None):
        """Initialize client with optional API URL."""
        self.api_url = api_url
        self.mock_mode = MOCK_MODE
        self._load_mock_fixtures()

    def _load_mock_fixtures(self):
        """Load mock response fixtures from test/fixtures/chatbot/."""
        if not self.mock_mode:
            return

        base_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "test", "fixtures", "chatbot"
        )

        # Load mock chat responses
        responses_path = os.path.join(base_path, "mock_responses.json")
        self.mock_responses = {}
        if os.path.exists(responses_path):
            with open(responses_path, "r") as f:
                self.mock_responses = json.load(f)
            logger.info("[MOCK] Loaded mock responses")

        # Load artifact fixtures
        self.mock_artifacts = {}
        artifact_files = [
            ("artifact_fcd5ed14590f47e592dffc2227f6c66e", "event_calendar_full.json"),
            ("artifact_tab001", "tabular_completeness.json"),
            ("artifact_temp001", "temporal_plot_completeness.json"),
            ("artifact_hist001", "count_histogram_events.json"),
        ]
        for artifact_id, filename in artifact_files:
            path = os.path.join(base_path, filename)
            if os.path.exists(path):
                with open(path, "r") as f:
                    self.mock_artifacts[artifact_id] = json.load(f)
        logger.info(f"[MOCK] Loaded {len(self.mock_artifacts)} artifact fixtures")

    def chat(self, message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Send message to chatbot API.

        Args:
            message: User message
            session_id: Optional session ID to continue conversation

        Returns:
            Response dict with keys: response, model_name, session_id, thread_id

        Raises:
            httpx.HTTPError: If API call fails (in real mode)
            ValueError: If response is malformed
        """
        if self.mock_mode:
            return self._mock_chat(message, session_id)

        if not self.api_url:
            raise ValueError("CHATBOT_API_URL not configured")

        payload = {"message": message}
        if session_id:
            payload["session_id"] = session_id

        try:
            with httpx.Client(timeout=360.0) as client:
                response = client.post(f"{self.api_url}/chat", json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError("Session expired (404)") from e
            raise
        except httpx.RequestError as e:
            logger.error(f"Chatbot API request failed: {e}")
            raise

    def _mock_chat(
        self, message: str, session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate mock chat response."""
        time.sleep(MOCK_DELAY)  # Simulate latency

        # Route to appropriate response based on keywords
        msg_lower = message.lower()
        response_key = "default"

        if "anomal" in msg_lower:
            response_key = "anomal"
        elif "completeness" in msg_lower or "complete" in msg_lower:
            response_key = "completeness"
        elif "formula" in msg_lower or "math" in msg_lower:
            response_key = "formula"
        elif "broken" in msg_lower or "malformed" in msg_lower:
            response_key = "broken"

        response_data = self.mock_responses.get(response_key, self.mock_responses["default"])

        # Generate or reuse session ID
        new_session_id = session_id or str(uuid4())

        return {
            "response": response_data["response"],
            "model_name": response_data["model_name"],
            "session_id": new_session_id,
            "thread_id": new_session_id,
        }

    def fetch_artifact(
        self, data_id: str, session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch artifact data.

        Args:
            data_id: Artifact ID from marker
            session_id: Session ID (for validation)

        Returns:
            Artifact data dict, or None if not found/404

        Raises:
            httpx.HTTPError: If API call fails (in real mode)
        """
        if self.mock_mode:
            return self._mock_fetch_artifact(data_id, session_id)

        if not self.api_url:
            raise ValueError("CHATBOT_API_URL not configured")

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(
                    f"{self.api_url}/chat/data/{data_id}",
                    params={"session_id": session_id},
                )
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                return response.json()
        except httpx.RequestError as e:
            logger.error(f"Artifact fetch failed for {data_id}: {e}")
            raise

    def _mock_fetch_artifact(
        self, data_id: str, session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Generate mock artifact fetch response."""
        time.sleep(1.0)  # Simulate ~1s latency for artifact

        # Return 404 for specific test ID
        if data_id == "artifact_NOTFOUND":
            return None

        return self.mock_artifacts.get(data_id)
