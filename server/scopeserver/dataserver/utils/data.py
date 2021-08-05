"""
General purpose utility functions for working with data.
"""

from typing import Tuple, Iterable, List, TypeVar

import numpy as np


Inner = TypeVar("Inner")


def get_99_and_100_percentiles(values: np.ndarray) -> Tuple[np.ndarray, np.number]:
    """
    Compute the 99th and 100th (maximum value) of an array of values
    and clamp the 99th percentil value between [0.01, max(values)]
    """
    _100_percentile = np.amax(values)
    _99_percentile = np.percentile(values, 99)
    return (np.clip(_99_percentile, 0.01, _100_percentile), _100_percentile)


def uniq(data: Iterable[Inner]) -> List[Inner]:
    """
    Extract unique values from a container while preserving
    the order.
    """

    seen = set()
    result = []

    for val in data:
        if val not in seen:
            seen.add(val)
            result.append(val)

    return result
