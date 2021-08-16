import pytest

from scopeserver.result import Result, ok, err, raise_


def test_ok():
    check = ok(1)
    assert check.is_ok() == True
    assert check.is_err() == False


def test_err():
    check = err("test")
    assert check.is_err() == True
    assert check.is_ok() == False


def test_from_optional_ok():
    check = Result.from_optional(1, "None").with_default(0)
    assert check == 1


def test_from_optional_err():
    check = Result.from_optional(None, "None").with_default(0)
    assert check == 0


def test_map_ok():
    check = ok(1).map(lambda x: x + 1).with_default(0)
    assert check == 2


def test_map_err():
    check = err(1).map(lambda x: x + 1).with_default(0)
    assert check == 0


def test_and_then_ok():
    check = ok(1).and_then(lambda x: ok(x + 1)).with_default(0)
    assert check == 2


def test_and_then_err():
    check = err(1).and_then(lambda x: ok(x + 1)).with_default(0)
    assert check == 0


def test_or_else_ok():
    check = ok(1).or_else(lambda x: ok("error")).with_default("no error")
    assert check == 1


def test_or_else_err():
    check = err("help").or_else(lambda x: ok("error")).with_default("no error")
    assert check == "error"


def test_to_optional_ok():
    check = ok(1).to_optional()
    assert check == 1


def test_to_optional_err():
    check = err(1).to_optional()
    assert check is None


def test_match_ok():
    check = ok("Hello").match(on_success=lambda t: f"Success: {t}", on_error=lambda e: f"Error: {e}")
    assert check == "Success: Hello"


def test_match_err():
    check = err("Hello").match(on_success=lambda t: f"Success: {t}", on_error=lambda e: f"Error: {e}")
    assert check == "Error: Hello"


def test_match_raise():
    with pytest.raises(ValueError):
        err(5).match(lambda x: x, lambda e: raise_(ValueError("Got an error")))
