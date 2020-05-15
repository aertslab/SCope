from scopeserver.dataserver.utils.cell_color_by_features import CellColorByFeatures
from hypothesis import given
from hypothesis.strategies import integers
from hypothesis.extra.numpy import arrays

from scopeserver.dataserver.utils.constant import LOWER_LIMIT_RGB, UPPER_LIMIT_RGB
import numpy as np


def test_normalise_vals():
    vals = np.array([0, 2, 1, 4, 5, 0, 7, 8, 9, 10])
    v_max = 8
    v_min = 2.1
    np.testing.assert_equal(
        CellColorByFeatures.normalise_vals(vals, v_max, v_min), np.array([0, 1, 1, 73, 111, 0, 187, 225, 225, 225])
    )


def test_normalise_vals_low_vmax():
    vals = np.array([0, 2, 1, 4, 5, 0, 7, 8, 9, 10])
    v_max = 0.5
    v_min = 0
    np.testing.assert_equal(
        CellColorByFeatures.normalise_vals(vals, v_max, v_min), np.array([0, 225, 225, 225, 225, 0, 225, 225, 225, 225])
    )


@given(arrays(np.intc, shape=integers(1, 50), elements=integers(-1000, 1000)), integers(0, 1000), integers(0, 1000))
def test_normalise_vals2(vals, v_min, v_max):
    normalised = CellColorByFeatures.normalise_vals(vals, v_max, v_min)
    assert np.amin(normalised) >= LOWER_LIMIT_RGB
    assert np.amax(normalised) <= UPPER_LIMIT_RGB
