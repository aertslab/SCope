import numpy as np
from hypothesis import given
from hypothesis.strategies import floats, integers, lists
from hypothesis.extra.numpy import arrays

from scopeserver.dataserver.utils import data


@given(arrays(np.float, shape=(1, 100), elements=floats(-1000, 1000)))
def test_vmax(values):
    expected_100 = np.amax(values)
    expected_99 = np.clip(np.percentile(values, 99), 0.01, expected_100)
    assert data.get_99_and_100_percentiles(values) == (expected_99, expected_100)


@given(lists(integers()))
def test_uniq(values):
    unique_values = data.uniq(values)
    assert set(values) == set(unique_values)
    assert len(set(values)) == len(unique_values)
