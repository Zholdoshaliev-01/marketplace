import pytest

from app.core.enums import OrderStatus
from app.orders.state_machine import can_transition


@pytest.mark.parametrize("current,target", [
    (OrderStatus.NEW, OrderStatus.CONFIRMED),
    (OrderStatus.NEW, OrderStatus.CANCELLED),
    (OrderStatus.CONFIRMED, OrderStatus.COLLECTING),
    (OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
    (OrderStatus.COLLECTING, OrderStatus.READY_FOR_DELIVERY),
    (OrderStatus.READY_FOR_DELIVERY, OrderStatus.IN_DELIVERY),
    (OrderStatus.IN_DELIVERY, OrderStatus.DELIVERED),
])
def test_allowed_transitions(current, target):
    assert can_transition(current, target)


@pytest.mark.parametrize("current,target", [
    (OrderStatus.NEW, OrderStatus.DELIVERED),
    (OrderStatus.DELIVERED, OrderStatus.NEW),
    (OrderStatus.CANCELLED, OrderStatus.CONFIRMED),
    (OrderStatus.COLLECTING, OrderStatus.CANCELLED),
])
def test_disallowed_and_terminal_transitions(current, target):
    assert not can_transition(current, target)
