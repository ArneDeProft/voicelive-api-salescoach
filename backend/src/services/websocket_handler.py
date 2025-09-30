# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
# --------------------------------------------------------------------------------------------

"""WebSocket handling for voice proxy connections."""

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, Optional

import simple_websocket.ws  # pyright: ignore[reportMissingTypeStubs]
import websockets
from azure.identity import DefaultAzureCredential

from src.config import config
from src.services.managers import AgentManager

logger = logging.getLogger(__name__)

# WebSocket constants
AZURE_VOICE_API_VERSION = "2025-05-01-preview"
AZURE_COGNITIVE_SERVICES_DOMAIN = "cognitiveservices.azure.com"
VOICE_AGENT_ENDPOINT = "voice-agent/realtime"

# Session configuration constants
DEFAULT_MODALITIES = ["text", "audio"]
DEFAULT_TURN_DETECTION_TYPE = "azure_semantic_vad"
DEFAULT_NOISE_REDUCTION_TYPE = "azure_deep_noise_suppression"
DEFAULT_ECHO_CANCELLATION_TYPE = "server_echo_cancellation"
DEFAULT_AVATAR_CHARACTER = "lisa"
DEFAULT_AVATAR_STYLE = "casual-sitting"
DEFAULT_VOICE_NAME = "en-US-Ava:DragonHDLatestNeural"
DEFAULT_VOICE_TYPE = "azure-standard"

# Message types
SESSION_UPDATE_TYPE = "session.update"
PROXY_CONNECTED_TYPE = "proxy.connected"
ERROR_TYPE = "error"

# Log message truncation length
LOG_MESSAGE_MAX_LENGTH = 100


class VoiceProxyHandler:
    """Handles WebSocket proxy connections between client and Azure Voice API."""

    def __init__(self, agent_manager: AgentManager):
        """
        Initialize the voice proxy handler.

        Args:
            agent_manager: Agent manager instance
        """
        self.agent_manager = agent_manager
        self.credential = DefaultAzureCredential()

    async def handle_connection(self, client_ws: simple_websocket.ws.Server) -> None:
        """
        Handle a WebSocket connection from a client.

        Args:
            client_ws: The client WebSocket connection
        """

        azure_ws = None
        # get agent id from env or config if available, else put to None
        # this will use the default agent if no specific agent id is provided by the client
        predefined_agent_id = config.get("agent_id")
        current_agent_id = None

        if predefined_agent_id:
            current_agent_id = predefined_agent_id
            logger.info("Using predefined agent ID from config: %s", predefined_agent_id)

            # For predefined agents, we need to ensure the agent manager has the configuration
            # Create a dummy scenario to trigger agent configuration if needed
            dummy_scenario: Dict[str, Any] = {
                "messages": [{"content": "You are a helpful assistant."}],
                "model": config.get("model_deployment_name", "gpt-4o"),
                "modelParameters": {"temperature": 0.7, "max_tokens": 2000}
            }
            # This will configure the predefined agent if not already configured
            self.agent_manager.create_or_get_agent("predefined", dummy_scenario)
        else:
            current_agent_id = await self._get_agent_id_from_client(client_ws)

        try:
            azure_ws = await self._connect_to_azure(current_agent_id)
            if not azure_ws:
                await self._send_error(client_ws, "Failed to connect to Azure Voice API")
                return

            await self._send_message(
                client_ws,
                {"type": "proxy.connected", "message": "Connected to Azure Voice API"},
            )

            await self._handle_message_forwarding(client_ws, azure_ws)

        except Exception as e:
            logger.error("Proxy error: %s", e)
            await self._send_error(client_ws, str(e))

        finally:
            if azure_ws:
                await azure_ws.close()

    async def _get_agent_id_from_client(self, client_ws: simple_websocket.ws.Server) -> Optional[str]:
        """Get agent ID from initial client message."""
        try:
            # Set a reasonable timeout for receiving the first message
            timeout_seconds = 10.0

            logger.info("Waiting for initial message from client...")

            first_message: str | None = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    client_ws.receive,  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                ),
                timeout=timeout_seconds
            )

            if first_message:
                logger.info("Received first message from client: %s", first_message[:200])  # Log first 200 chars
                try:
                    msg = json.loads(first_message)
                    logger.info("Parsed message type: %s", msg.get("type"))

                    if msg.get("type") == "session.update":
                        agent_id = msg.get("session", {}).get("agent_id")
                        if agent_id:
                            logger.info("Extracted agent ID from client message: %s", agent_id)
                            return agent_id
                        else:
                            logger.info("session.update message received but no agent_id found")
                    else:
                        logger.info("First message is not session.update type: %s", msg.get("type"))
                        # This might be a different type of message, we should handle it in forwarding

                except json.JSONDecodeError as json_err:
                    logger.error("Failed to parse JSON from first message: %s", json_err)

            else:
                logger.warning("First message was None or empty")

        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for agent ID from client (waited %s seconds), proceeding without specific agent", 10)
        except Exception as e:
            logger.error("Error getting agent ID: %s", e)

        # Return None to indicate no specific agent ID was provided
        logger.info("No specific agent ID provided, will use default or configured agent")
        return None

    async def _connect_to_azure(self, agent_id: Optional[str]) -> Optional[websockets.WebSocketClientProtocol]:
        """Connect to Azure Voice API with appropriate configuration."""
        azure_ws = None
        try:
            # Validate required configuration
            required_configs = {
                "azure_ai_resource_name": config.get("azure_ai_resource_name"),
            }

            missing_configs = [key for key, value in required_configs.items() if not value]
            if missing_configs:
                logger.error("Missing required configuration: %s", ", ".join(missing_configs))
                return None

            agent_config = self.agent_manager.get_agent(agent_id) if agent_id else None

            # Determine authentication method based on agent type
            is_azure_agent = agent_config and agent_config.get("is_azure_agent", False)

            if is_azure_agent:
                # For Azure AI Agents, use Azure AD token authentication
                project_name = config.get("azure_ai_project_name")
                if not project_name:
                    logger.error("AZURE_AI_PROJECT_NAME is required for Azure AI agents but not configured")
                    return None

                # Get Azure AD token with the correct scope for AI services
                try:
                    token = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.credential.get_token("https://ai.azure.com/.default").token
                    )
                    headers = {"Authorization": f"Bearer {token}"}
                    logger.info("Using Azure AD token authentication for Azure AI agent with ml.azure.com scope")
                except Exception as token_error:
                    logger.error("Failed to get Azure AD token: %s", token_error)
                    # Fallback to cognitive services scope
                    try:
                        token = await asyncio.get_event_loop().run_in_executor(
                            None,
                            lambda: self.credential.get_token("https://cognitiveservices.azure.com/.default").token
                        )
                        headers = {"Authorization": f"Bearer {token}"}
                        logger.info("Using Azure AD token authentication with cognitiveservices.azure.com scope (fallback)")
                    except Exception as fallback_error:
                        logger.error("Failed to get Azure AD token with fallback scope: %s", fallback_error)
                        return None
            else:
                # For regular OpenAI models, use API key authentication
                api_key = config.get("azure_openai_api_key")
                if not api_key:
                    logger.error("AZURE_OPENAI_API_KEY is required for non-agent mode but not configured")
                    return None
                headers = {"api-key": api_key}
                logger.info("Using API key authentication for OpenAI model")

            azure_url = self._build_azure_url(agent_id, agent_config)
            logger.info("Connecting to Azure URL: %s", azure_url.split('?')[0])  # Log URL without query params for security
            logger.debug("Full Azure URL (sanitized): %s", azure_url.replace(config.get("project_endpoint", ""), "[PROJECT_ENDPOINT]"))

            # Log authentication details
            if is_azure_agent:
                logger.info("Agent configuration: is_azure_agent=%s, agent_id=%s, project_name=%s",
                           is_azure_agent, agent_id, config.get("azure_ai_project_name"))

            azure_ws = await websockets.connect(azure_url, additional_headers=headers)
            logger.info("Connected to Azure Voice API with agent: %s", agent_id or "default")

            await self._send_initial_config(azure_ws, agent_config)

            return azure_ws

        except websockets.exceptions.InvalidStatusCode as status_error:
            logger.error("WebSocket connection failed with status code: %s", status_error.status_code)
            logger.error("Response headers: %s", getattr(status_error, 'response_headers', 'N/A'))
            return None
        except websockets.exceptions.WebSocketException as ws_error:
            logger.error("WebSocket connection failed: %s", ws_error)
            return None
        except Exception as e:
            logger.error("Failed to connect to Azure: %s", e)
            logger.error("Exception type: %s", type(e).__name__)
            if azure_ws:
                try:
                    await azure_ws.close()
                except Exception as close_error:
                    logger.debug("Error closing Azure WebSocket: %s", close_error)
            return None

    def _build_azure_url(self, agent_id: Optional[str], agent_config: Optional[Dict[str, Any]]) -> str:
        """Build the Azure WebSocket URL."""
        base_url = self._build_base_azure_url()

        if agent_config:
            return self._build_agent_specific_url(base_url, agent_id, agent_config)
        if config["agent_id"]:
            return f"{base_url}&agent-id={config['agent_id']}"
        model_name = config["model_deployment_name"]
        return f"{base_url}&model={model_name}"

    def _build_base_azure_url(self) -> str:
        """Build the base Azure WebSocket URL."""
        resource_name = config["azure_ai_resource_name"]

        client_request_id = uuid.uuid4()

        return (
            f"wss://{resource_name}.{AZURE_COGNITIVE_SERVICES_DOMAIN}/"
            f"{VOICE_AGENT_ENDPOINT}?api-version={AZURE_VOICE_API_VERSION}"
            f"&x-ms-client-request-id={client_request_id}"
        )

    def _build_agent_specific_url(self, base_url: str, agent_id: Optional[str], agent_config: Dict[str, Any]) -> str:
        """Build URL for specific agent configuration."""
        project_name = config.get("azure_ai_project_name")
        if agent_config.get("is_azure_agent"):
            # For Azure AI agents, include both agent-id, project name, and connection string
            project_endpoint = config.get("project_endpoint", "")
            url = f"{base_url}&agent-id={agent_id}&agent-project-name={project_name}"
            if project_endpoint:
                url += f"&connection-string={project_endpoint}"
            return url
        model_name = agent_config.get("model", config["model_deployment_name"])
        return f"{base_url}&model={model_name}"

    async def _send_initial_config(
        self,
        azure_ws: websockets.WebSocketClientProtocol,
        agent_config: Optional[Dict[str, Any]],
    ) -> None:
        """Send initial configuration to Azure."""
        config_message = self._build_session_config()

        if agent_config and not agent_config.get("is_azure_agent"):
            self._add_local_agent_config(config_message, agent_config)

        await azure_ws.send(json.dumps(config_message))

    def _build_session_config(self) -> Dict[str, Any]:
        """Build the base session configuration."""
        return {
            "type": SESSION_UPDATE_TYPE,
            "session": {
                "modalities": DEFAULT_MODALITIES,
                "turn_detection": {"type": DEFAULT_TURN_DETECTION_TYPE},
                "input_audio_noise_reduction": {"type": DEFAULT_NOISE_REDUCTION_TYPE},
                "input_audio_echo_cancellation": {"type": DEFAULT_ECHO_CANCELLATION_TYPE},
                "avatar": {
                    "character": DEFAULT_AVATAR_CHARACTER,
                    "style": DEFAULT_AVATAR_STYLE,
                },
                "voice": {
                    "name": config["azure_voice_name"],
                    "type": config["azure_voice_type"],
                },
            },
        }

    def _add_local_agent_config(self, config_message: Dict[str, Any], agent_config: Dict[str, Any]) -> None:
        """Add local agent configuration to session config."""
        session = config_message["session"]
        session["model"] = agent_config.get("model", config["model_deployment_name"])
        session["instructions"] = agent_config["instructions"]
        session["temperature"] = agent_config["temperature"]
        session["max_response_output_tokens"] = agent_config["max_tokens"]

    async def _handle_message_forwarding(
        self,
        client_ws: simple_websocket.ws.Server,
        azure_ws: websockets.WebSocketClientProtocol,
    ) -> None:
        """Handle bidirectional message forwarding."""
        tasks = [
            asyncio.create_task(self._forward_client_to_azure(client_ws, azure_ws)),
            asyncio.create_task(self._forward_azure_to_client(azure_ws, client_ws)),
        ]

        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

        for task in pending:
            task.cancel()

    async def _forward_client_to_azure(
        self,
        client_ws: simple_websocket.ws.Server,
        azure_ws: websockets.WebSocketClientProtocol,
    ) -> None:
        """Forward messages from client to Azure."""
        try:
            while True:
                message: Optional[Any] = await asyncio.get_event_loop().run_in_executor(
                    None,
                    client_ws.receive,  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                )
                if message is None:
                    break

                # Strip agent_id from session.update messages before forwarding to Azure
                # agent_id is only used in the URL, not as a session parameter
                try:
                    msg_data = json.loads(message)
                    if msg_data.get("type") == "session.update" and "session" in msg_data:
                        if "agent_id" in msg_data["session"]:
                            logger.debug("Stripping agent_id from session.update message before forwarding to Azure")
                            del msg_data["session"]["agent_id"]
                            message = json.dumps(msg_data)
                except (json.JSONDecodeError, KeyError):
                    # If it's not JSON or doesn't have the expected structure, forward as-is
                    pass

                logger.debug("Client->Azure: %s", message[:LOG_MESSAGE_MAX_LENGTH])
                await azure_ws.send(message)
        except Exception:
            logger.debug("Client connection closed during forwarding")

    async def _forward_azure_to_client(
        self,
        azure_ws: websockets.WebSocketClientProtocol,
        client_ws: simple_websocket.ws.Server,
    ) -> None:
        """Forward messages from Azure to client."""
        last_session_updated_hash: Optional[int] = None

        try:
            async for message in azure_ws:
                # Parse and log WebRTC-related messages
                try:
                    msg_data = json.loads(message)
                    msg_type = msg_data.get("type", "")

                    # Deduplicate session.updated messages with identical content
                    # This prevents duplicate WebRTC setup calls that cause peer connection churn
                    if msg_type == "session.updated":
                        # Create a hash of the session content to detect duplicates
                        session_content = json.dumps(msg_data.get("session", {}), sort_keys=True)
                        session_hash = hash(session_content)

                        if session_hash == last_session_updated_hash:
                            logger.debug("Skipping duplicate session.updated message (hash: %s)", session_hash)
                            continue

                        last_session_updated_hash = session_hash
                        logger.info("Session updated with avatar config: %s",
                                json.dumps(msg_data.get("session", {}).get("avatar", {})))

                    # Log important WebRTC and session messages
                    if any(keyword in msg_type for keyword in ["session", "avatar", "sdp", "ice"]):
                        logger.info("WebRTC/Session message: %s", msg_type)

                    logger.debug("Azure->Client: %s", message[:LOG_MESSAGE_MAX_LENGTH])
                except json.JSONDecodeError:
                    logger.debug("Azure->Client (binary): %d bytes", len(message))

                await asyncio.get_event_loop().run_in_executor(
                    None,
                    client_ws.send,  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                    message,
                )
        except Exception:
            logger.debug("Client connection closed during forwarding")

    async def _send_message(self, ws: simple_websocket.ws.Server, message: Dict[str, str | Dict[str, str]]) -> None:
        """Send a JSON message to a WebSocket."""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                ws.send,  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                json.dumps(message),
            )
        except Exception:
            pass

    async def _send_error(self, ws: simple_websocket.ws.Server, error_message: str) -> None:
        """Send an error message to a WebSocket."""
        await self._send_message(ws, {"type": "error", "error": {"message": error_message}})
