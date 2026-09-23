# Demo accounts

These accounts are created by `python -m scripts.seed` when `ENVIRONMENT` is `development` or `test`.

All four use the default password `MarketKG2026!` unless `SEED_DEMO_PASSWORD` is set before seeding.

| Role | Email | Phone |
| --- | --- | --- |
| Admin | `admin.demo@market.kg` | `+996700100003` |
| Shop | `shop.demo@market.kg` | `+996700100001` |
| Supplier | `supplier.demo@market.kg` | `+996700100002` |
| Supplier B | `supplier-b.demo@market.kg` | `+996700100004` |

The seed creates six `DEMO-*` products across two suppliers, a Bishkek delivery zone, and `DEMO-ORDER-001` for checking shop, supplier, and admin workflows. It removes only demo/legacy pilot data and leaves unrelated records untouched.
