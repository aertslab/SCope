# -*- coding: utf-8 -*-
"""
A `Result` is used to indicate that a computation may fail
*with details* of the failure. This is closely realated to
`Optional` which is used to indicate the absence of a value.
A `Result` "wraps" one of **2** possibilities:

	`ok`
	     means the computation succeeded, or
	`err`
	     means the computation failed.

There are 3 ways to construct a Result:
	1. The `ok()` builder function to indicate success,

	2. The `err()` builder function to indicate failure,

	3. The `Result.from_optional()` method to build a result from an `Optional`

When using a `Result` you do not have to perform explicit error checking. Instead
you should interact with a result using the provided methods. You should _never_
access the wrapped values directly.
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
    This is a useful way to handle errors.
    """

    def __init__(self, value: Optional[T] = None, error: Optional[E] = None) -> None:
        self._value: Optional[T] = value
        self._error: Optional[E] = error

    def is_ok(self) -> bool:
        """
        Check if the computation succeeded.

        >>> ok(1).is_ok()
        True

        >>> err(1).is_ok()
        False
        """
        return self._value is not None

    def is_err(self) -> bool:
        """
        Check if the computation failed.

        >>> err(1).is_err()
        True

        >>> ok(1).is_err()
        False
        """
        return self._value is None

    def map(self, transform: Callable[[T], U]) -> Result[U, E]:
        """
        Apply a function to a `Result`. If the result is `ok`, it will
        be converted, otherwise the `err` will propogate.

        `map` gives you access to the value that `Result` wraps. If
        it's `ok` then your function will operate on the value
        "inside". Otherwise, your function does not execute.

        
        >>> ok(10).map(lambda x: x * x).with_default(0)
        100

        >>> err(-1).map(lambda x: x * x).with_default(0)
        0
        """
        if self._value is not None:
            return Result(value=transform(self._value))

        return Result(error=self._error)

    def and_then(self, transform: Callable[[T], Result[U, E]]) -> Result[U, E]:
        """
        Compose, or chain together a sequence of computations that may fail.
        If the result of a previous computation is `ok` then the value will
        be passed to your function, otherwise the `err` will be propogated
        and your function will not be executed.

        You can read this as "do this, *and then* do something else". The
        number of "chained" functions is not limited.

        >>> ok(1).and_then(lambda x: ok(x * 2)).with_default(0)
        2

        >>> ok(5).and_then(lambda x: ok(x + 25)).and_then(lambda x: ok(x // 2)).with_default(0)
        15

        >>> err(1).and_then(lambda x: ok(x * 5)).with_default(0)
        0
        """
        if self._value is not None:
            return transform(self._value)

        return Result(error=self._error)

    def or_else(self, transform: Callable[[E], Result[T, E]]) -> Result[T, E]:
        """
        Gives you an alternative which is executed if an operation fails.
        You can read it like, "do this, *or else*, do something else" or,
        "do this and if it fails, do something else instead."

        >>> ok(9).or_else(lambda _: ok(6)).with_default(0)
        9

        >>> err("something happened").or_else(lambda _: ok(6)).with_default(0)
        6
        """
        if self._error is not None:
            return transform(self._error)

        return Result(value=self._value)

    def with_default(self, default: T) -> T:
        """
        Extract a value. If `self` is `ok` the value is returned,
        otherwise `default` is returned.

        If the result is a success (ok):
        >>> ok(99).with_default(0)
        99

        Otherwise, if the result is a failure, return the provided
        default:
        >>> err("failed").with_default(0)
        0
        """
        if self._value is not None:
            return self._value

        return default

    def to_optional(self) -> Optional[T]:
        """
        Convert to a simpler `Optional` if the `err` value is not needed.
        If this `Result` is `ok`, `to_optional` unwraps the value,
        otherwise returns `None`.

        >>> ok(10).to_optional()
        10

        >>> err("wat!?").to_optional() == None
        True
        """
        if self._value is not None:
            return self._value

        return None

    @staticmethod
    def from_optional(value: Optional[T], error: E) -> Result[T, E]:
        """
        Convert an `Optional` to a `Result`. If the `Optional` is `None`
        returns `err(error)`, otherwise returns `ok(value)`.

        >>> Result.from_optional(5, "error").with_default(0)
        5

        >>> Result.from_optional(None, "error").with_default(0)
        0
        """
        if value is None:
            return Result(error=error)

        return Result(value=value)


# pylint: disable=invalid-name
def ok(val: T) -> Result[T, E]:
    """ Construct a successful `Result` containing `val`. """
    return Result(value=val)


# pylint: enable=invalid-name


def err(error: E) -> Result[T, E]:
    """ Construct a failing `Result` containing `error`. """
    return Result(error=error)
