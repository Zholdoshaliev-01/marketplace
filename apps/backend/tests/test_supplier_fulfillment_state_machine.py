import pytest

from app.supplier_fulfillments.state_machine import FulfillmentStatus, validate_fulfillment_transition


@pytest.mark.parametrize(("current", "target"), [
    (FulfillmentStatus.PENDING, FulfillmentStatus.ACCEPTED),
    (FulfillmentStatus.PENDING, FulfillmentStatus.CANCELLED),
    (FulfillmentStatus.ACCEPTED, FulfillmentStatus.COLLECTING),
    (FulfillmentStatus.ACCEPTED, FulfillmentStatus.CANCELLED),
    (FulfillmentStatus.COLLECTING, FulfillmentStatus.READY),
])
def test_valid_fulfillment_transitions(current, target):
    validate_fulfillment_transition(current, target)


@pytest.mark.parametrize("terminal", [FulfillmentStatus.READY, FulfillmentStatus.CANCELLED])
@pytest.mark.parametrize("target", list(FulfillmentStatus))
def test_terminal_fulfillment_statuses_reject_every_transition(terminal, target):
    with pytest.raises(ValueError):
        validate_fulfillment_transition(terminal, target)


@pytest.mark.parametrize(("current", "target"), [
    (FulfillmentStatus.PENDING, FulfillmentStatus.READY),
    (FulfillmentStatus.ACCEPTED, FulfillmentStatus.READY),
    (FulfillmentStatus.COLLECTING, FulfillmentStatus.ACCEPTED),
    (FulfillmentStatus.COLLECTING, FulfillmentStatus.CANCELLED),
])
def test_invalid_nonterminal_fulfillment_transitions(current, target):
    with pytest.raises(ValueError):
        validate_fulfillment_transition(current, target)
