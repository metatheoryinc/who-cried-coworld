"""Run `coworld` with hosted-LLM uploads sent the current way.

Softmax now rejects USE_BEDROCK as a policy secret ("reserved for Coworld runtime configuration") and enables the
hosted LLM sidecar from non-secret policy env: COWORLD_LLM_ENABLED=true and COWORLD_LLM_MODEL=<slug> (what the
documented `--use-llm --llm-model` store; https://softmax.com/docs/coworld/build-a-player/hosted-llm). The coworld
CLI released so far (0.1.55) still sends `--use-bedrock --bedrock-model` as secrets. This wrapper runs the CLI
unchanged except for the final policy-completion request, where it moves those two values into `env`.

    uv run --project /Users/jt/projects/coworld python tools/coworld-llm-upload.py upload-policy IMAGE \
        --name NAME --run node --run build/llm-player.mjs --use-bedrock --bedrock-model SLUG

Delete this once a released CLI has --use-llm.
"""

import sys
from typing import Any

from coworld import upload
from coworld.cli import app


def complete_docker_image_policy(
    self: upload.CoworldUploadClient,
    *,
    name: str,
    container_image_id: str,
    run: list[str] | None,
    secret_env: dict[str, str] | None,
    tags: dict[str, str] | None = None,
) -> upload.PolicyVersionResponse:
    secret = dict(secret_env or {})
    env: dict[str, str] = {}
    if secret.pop("USE_BEDROCK", None) == "true":
        env["COWORLD_LLM_ENABLED"] = "true"
    model = secret.pop("BEDROCK_MODEL", None)
    if model:
        env["COWORLD_LLM_MODEL"] = model

    policy_secret_env_id: str | None = None
    if secret:
        response = self._http_client.post(
            "/stats/policy-secret-envs",
            headers=self._headers(),
            json={"policy_secret_env": secret},
            timeout=120.0,
        )
        upload._raise_for_status(response)
        policy_secret_env_id = response.json()["id"]

    payload: dict[str, Any] = {"name": name, "container_image_id": container_image_id}
    if run:
        payload["run"] = run
    if env:
        payload["env"] = env
    if policy_secret_env_id is not None:
        payload["policy_secret_env_id"] = policy_secret_env_id
    if tags:
        payload["tags"] = tags
    response = self._http_client.post(
        "/stats/policies/docker-img/complete", headers=self._headers(), json=payload, timeout=120.0
    )
    upload._raise_for_status(response)
    return upload.PolicyVersionResponse.model_validate(response.json())


upload.CoworldUploadClient.complete_docker_image_policy = complete_docker_image_policy

if __name__ == "__main__":
    sys.argv[0] = "coworld"
    app()
