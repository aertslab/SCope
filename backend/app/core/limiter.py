"""Shared SlowAPI rate limiter.

Importing from a single module ensures every ``@limiter.limit(...)`` decorator
shares the same in-memory store with the limiter registered on ``app.state``.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
