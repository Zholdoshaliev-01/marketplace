from app.core.enums import OrderStatus

ALLOWED_TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    OrderStatus.NEW: frozenset({OrderStatus.CONFIRMED, OrderStatus.CANCELLED}),
    OrderStatus.CONFIRMED: frozenset({OrderStatus.COLLECTING, OrderStatus.CANCELLED}),
    OrderStatus.COLLECTING: frozenset({OrderStatus.READY_FOR_DELIVERY}),
    OrderStatus.READY_FOR_DELIVERY: frozenset({OrderStatus.IN_DELIVERY}),
    OrderStatus.IN_DELIVERY: frozenset({OrderStatus.DELIVERED}),
}


def can_transition(current: OrderStatus, target: OrderStatus) -> bool:
    return target in ALLOWED_TRANSITIONS.get(current, frozenset())
