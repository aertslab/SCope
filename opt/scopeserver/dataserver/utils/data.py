"""
General purpose utility functions for working with data.
"""

from typing import Tuple

import numpy as np


def get_99_and_100_percentiles(values: np.ndarray) -> Tuple[np.float, np.float]:
    """
    Compute the 99th and 100th (maximum value) of an array of values
    and clamp the 99th percentil value between [0.01, max(values)]
    """
    _100_percentile = np.amax(values)
    _99_percentile = np.percentile(values, 99)
    return (np.clip(_99_percentile, 0.01, _100_percentile), _100_percentile)
