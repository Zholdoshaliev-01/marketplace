from enum import Enum


class FulfillmentStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    COLLECTING = "COLLECTING"
    READY = "READY"
    CANCELLED = "CANCELLED"


ALLOWED_TRANSITIONS: dict[FulfillmentStatus, frozenset[FulfillmentStatus]] = {
    FulfillmentStatus.PENDING: frozenset({FulfillmentStatus.ACCEPTED, FulfillmentStatus.CANCELLED}),
    FulfillmentStatus.ACCEPTED: frozenset({FulfillmentStatus.COLLECTING, FulfillmentStatus.CANCELLED}),
    FulfillmentStatus.COLLECTING: frozenset({FulfillmentStatus.READY}),
}


def validate_fulfillment_transition(current: FulfillmentStatus, target: FulfillmentStatus) -> None:
    if target not in ALLOWED_TRANSITIONS.get(current, frozenset()):
        raise ValueError(f"Invalid fulfillment transition: {current.value} -> {target.value}")
