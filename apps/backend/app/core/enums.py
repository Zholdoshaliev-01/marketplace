from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SUPPLIER = "SUPPLIER"
    SHOP = "SHOP"


class Market(str, Enum):
    DORDOI = "DORDOI"
    KARA_SUU = "KARA_SUU"


class OrderStatus(str, Enum):
    NEW = "NEW"
    CONFIRMED = "CONFIRMED"
    COLLECTING = "COLLECTING"
    READY_FOR_DELIVERY = "READY_FOR_DELIVERY"
    IN_DELIVERY = "IN_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class PaymentType(str, Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    INSTALLMENT_REQUEST = "INSTALLMENT_REQUEST"
