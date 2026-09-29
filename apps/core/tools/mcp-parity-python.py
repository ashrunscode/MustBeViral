"""Official Python MCP SDK client used by the governed staging parity harness."""

from __future__ import annotations

import json
import os
import sys
from typing import Any

import anyio
import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


def required_environment(name: str) -> str:
    value = os.environ.get(name)
    if value is None or not value:
        raise RuntimeError(f"{name} is required")
    return value


def json_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", by_alias=True, exclude_none=True)
    return value


def safe_message(error: Exception, token: str | None) -> str:
    message = str(error)
    if token:
        message = message.replace(token, "<redacted>")
    return message[:1000]


async def run() -> None:
    endpoint = required_environment("MBV_MCP_ENDPOINT")
    action = json.loads(required_environment("MBV_MCP_ACTION"))
    token = os.environ.get("MBV_MCP_ACCESS_TOKEN")
    headers = {} if not token else {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(headers=headers) as http_client:
        async with streamable_http_client(
            endpoint,
            http_client=http_client,
            terminate_on_close=False,
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                if action.get("kind") == "list":
                    result = await session.list_tools()
                elif action.get("kind") == "call":
                    result = await session.call_tool(
                        action["tool"],
                        arguments=action.get("arguments", {}),
                    )
                else:
                    raise RuntimeError("Unsupported MCP parity action")
                print(json.dumps({"result": json_value(result)}, separators=(",", ":")))


def main() -> int:
    token = os.environ.get("MBV_MCP_ACCESS_TOKEN")
    try:
        anyio.run(run)
        return 0
    except Exception as error:  # noqa: BLE001 - client failures are captured as evidence
        print(
            json.dumps(
                {
                    "client_error": {
                        "type": type(error).__name__,
                        "message": safe_message(error, token),
                    }
                },
                separators=(",", ":"),
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
