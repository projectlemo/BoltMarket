"""ASGI entrypoint for hosts that import a module-level ``app`` (Vercel, see ``[tool.vercel]`` in
pyproject.toml). Uvicorn and the Docker image use ``app.main:app``, which builds the same app."""
from app import main as _main

app = _main.app
