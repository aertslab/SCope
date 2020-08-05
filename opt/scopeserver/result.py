# -*- coding: utf-8 -*-
"""
Generic error handling: represents 2 possibilities `ok`, or `err`.
`ok` means the computation succeeded,
`err` means the computation failed.

There are 3 ways to construct a Result:
  1. The `ok()` builder function to indicate success,
  2. The `err()` builder function to indicate failure,
  3. The `Result.from_optional()` method to build a result from an Optional
"""

from __future__ import annotations
from typing import Generic, Optional, TypeVar, Callable

# pylint: disable=invalid-name
T = TypeVar("T")
E = TypeVar("E")
U = TypeVar("U")
# pylint: enable=invalid-name


class Result(Generic[T, E]):
    """
    The result of a computation that may fail.
    This is a useful way to manage errors.
    """

    def __init__(self, value: Optional[T] = None, error: Optional[E] = None) -> None:
        self._value: Optional[T] = value
        self._error: Optional[E] = error

    def is_ok(self) -> bool:
        " Check is the computation succeeded. "
        return self._value is not None

    def is_err(self) -> bool:
        " Check if the computation failed. "
        return self._value is None

    def map(self, transform: Callable[[T], U]) -> Result[U, E]:
        """
        Apply a function to a `Result`. If the result is `ok`, it will
        be converted, otherwise the `err` will propogate.
        """
        if self._value is not None:
            return Result(value=transform(self._value))

        return Result(error=self._error)

    def and_then(self, transform: Callable[[T], Result[U, E]]) -> Result[U, E]:
        """
        Chain together a sequence of computations that may fail.
        If `self` is `ok` then the contained value will be passed to `op`,
        otherwise the `err` will be propogated.
        """
        if self._value is not None:
            return transform(self._value)

        return Result(error=self._error)

    def or_else(self, transform: Callable[[E], Result[T, E]]) -> Result[T, E]:
        """
        Handle an `err`. If `self` is an `err` then the error value is
        passed to `op`, otherwise `ok` is propogated.
        """
        if self._error is not None:
            return transform(self._error)

        return Result(value=self._value)

    def with_default(self, default: T) -> T:
        """
        Extract a value. If `self` is `ok` the value is returned,
        otherwise `default` is returned.
        """
        if self._value is not None:
            return self._value

        return default

    def to_optional(self) -> Optional[T]:
        """
        Convert to a simpler `Optional` if the `err` value is not needed.
        If `self` is `ok` returns the value, otherwise returns `None`.
        """
        if self._value is not None:
            return self._value

        return None

    @staticmethod
    def from_optional(value: Optional[T], error: E) -> Result[T, E]:
        """
        Convert an `Optional` to a `Result`. If the `Optional` is `None`
        returns `err(error)`, otherwise returns `ok(value)`.
        """
        if value is None:
            return Result(error=error)

        return Result(value=value)


# pylint: disable=invalid-name
def ok(val: T) -> Result[T, E]:
    " Construct a successful `Result` containing `val`. "
    return Result(value=val)


# pylint: enable=invalid-name


def err(error: E) -> Result[T, E]:
    " Construct a failing `Result` containing `error`. "
    return Result(error=error)
