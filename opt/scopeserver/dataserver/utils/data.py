"""
General purpose utility functions for working with data.
"""

from typing import Tuple, Iterable, List, TypeVar

import numpy as np


T = TypeVar("T")


def get_99_and_100_percentiles(values: np.ndarray) -> Tuple[np.float, np.float]:
    """
    Compute the 99th and 100th (maximum value) of an array of values
    and clamp the 99th percentil value between [0.01, max(values)]
    """
    _100_percentile = np.amax(values)
    _99_percentile = np.percentile(values, 99)
    return (np.clip(_99_percentile, 0.01, _100_percentile), _100_percentile)


def uniq(data: Iterable[T]) -> List[T]:
    """
    Extract unique values from a container while preserving
    the order.
    """

    seen = set()
    result = []

    for x in data:
        if x not in seen:
            seen.add(x)
            result.append(x)

    return result
