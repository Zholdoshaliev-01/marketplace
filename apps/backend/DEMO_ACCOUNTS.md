# Demo accounts

These accounts are created by `python -m scripts.seed` when `ENVIRONMENT` is `development` or `test`.

All four use the default password `MarketKG2026!` unless `SEED_DEMO_PASSWORD` is set before seeding.

| Role | Email | Phone |
| --- | --- | --- |
| Admin | `admin.demo@market.kg` | `+996700100003` |
| Shop — Магазин У дома | `shop.demo@market.kg` | `+996700100001` |
| Shop — Береке Маркет | `shop-b.demo@market.kg` | `+996700100005` |
| Shop — Народный магазин | `shop-c.demo@market.kg` | `+996700100006` |
| Supplier — Алтын Дистрибьюшн | `supplier.demo@market.kg` | `+996700100002` |
| Supplier — Береке Хозтовары | `supplier-b.demo@market.kg` | `+996700100004` |
| Supplier — Нур Опт | `supplier-c.demo@market.kg` | `+996700100007` |

The seed creates twelve `DEMO-*` products across three suppliers, three shops, six categories, a Bishkek delivery zone, and a three-supplier `DEMO-ORDER-001` for checking shop, supplier, and admin workflows. It removes only demo/legacy pilot data and leaves unrelated records untouched.
