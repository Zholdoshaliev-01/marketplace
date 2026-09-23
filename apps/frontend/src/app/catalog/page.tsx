'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Category, ProductCard, Supplier, get } from '@/lib/api';
import { ProductCardView } from '@/components/ui';

type SelectOption = { value: string; label: string };

function CatalogSelect({ label, value, options, onChange, compact = false }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  const navigate = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      window.requestAnimationFrame(() => {
        const items = root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
        const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
        items?.[selectedIndex]?.focus();
      });
      return;
    }
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowUp' ? Math.max(0, current - 1) : Math.min(items.length - 1, current + 1);
    items[next]?.focus();
  };

  return <div className={`catalog-select ${compact ? 'compact' : ''} ${open ? 'is-open' : ''}`} ref={root} onKeyDown={navigate}>
    <select className="sr-only" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
    <button type="button" className="catalog-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selected.label}</span><ChevronDown size={17}/></button>
    <AnimatePresence>{open && <motion.div className="catalog-select-menu" role="listbox" aria-label={label} initial={{ opacity: 0, y: -6, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: .985 }} transition={{ duration: .16 }}>
      {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <Check size={16}/>}</button>)}
    </motion.div>}</AnimatePresence>
  </div>;
}

function CatalogContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total_items: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(params.get('search') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(params.toString());
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const query = params.toString();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));
    get<{ items: ProductCard[]; pagination: typeof pagination }>(`/products?${debouncedQuery}`, { signal: controller.signal })
      .then((data) => { setProducts(data.items); setPagination(data.pagination); setError(''); })
      .catch((reason) => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setError('Не удалось загрузить каталог.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => { queueMicrotask(() => setSearchValue(params.get('search') ?? '')); }, [params]);

  useEffect(() => {
    Promise.all([get<{ items: Category[] }>('/categories'), get<{ items: Supplier[] }>('/suppliers?page_size=100')])
      .then(([categoryData, supplierData]) => { setCategories(categoryData.items); setSuppliers(supplierData.items); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = filterTrigger.current;
    const closeButton = document.querySelector<HTMLButtonElement>('.filter-modal .filter-close');
    document.body.style.overflow = 'hidden';
    closeButton?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFiltersOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      trigger?.focus();
    };
  }, [filtersOpen]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.push(`${pathname}?${next}`);
  };

  const filterPanel = <aside className="filters" aria-label="Фильтры каталога">
    <div className="filter-title"><b>Фильтры</b><button className="filter-close" aria-label={filtersOpen ? 'Закрыть фильтры' : 'Сбросить фильтры'} onClick={() => filtersOpen ? setFiltersOpen(false) : router.push('/catalog')}><X size={18} /></button></div>
    <label>Поиск<input value={searchValue} onChange={(event) => { setSearchValue(event.target.value); setParam('search', event.target.value); }} placeholder="Название или SKU" /></label>
    <div className="filter-field"><span>Категория</span><CatalogSelect label="Категория" value={params.get('category_id') ?? ''} onChange={(value) => setParam('category_id', value)} options={[{ value: '', label: 'Все категории' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} /></div>
    <div className="filter-field"><span>Поставщик</span><CatalogSelect label="Поставщик" value={params.get('supplier_id') ?? ''} onChange={(value) => setParam('supplier_id', value)} options={[{ value: '', label: 'Все поставщики' }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]} /></div>
    <div className="filter-field"><span>Рынок</span><CatalogSelect label="Рынок" value={params.get('market') ?? ''} onChange={(value) => setParam('market', value)} options={[{ value: '', label: 'Оба рынка' }, { value: 'DORDOI', label: 'Дордой' }, { value: 'KARA_SUU', label: 'Кара-Суу' }]} /></div>
    <div className="two-fields"><label>От<input type="number" min="0" value={params.get('min_price') ?? ''} onChange={(event) => setParam('min_price', event.target.value)} /></label><label>До<input type="number" min="0" value={params.get('max_price') ?? ''} onChange={(event) => setParam('max_price', event.target.value)} /></label></div>
    <label className="check-row"><input type="checkbox" checked={params.get('in_stock') === 'true'} onChange={(event) => setParam('in_stock', event.target.checked ? 'true' : '')} /> Только в наличии</label>
    <div className="filter-actions"><button className="secondary-button" onClick={() => router.push('/catalog')}>Сбросить</button><button className="primary-button" onClick={() => setFiltersOpen(false)}>Показать товары</button></div>
  </aside>;

  return <div>
    <div className="page-heading"><div><p className="eyebrow">Каталог</p><h1>Оптовые товары</h1><p className="muted">Дордой и Кара-Суу · {pagination.total_items} позиций</p></div><button ref={filterTrigger} className="filter-button" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen}><SlidersHorizontal size={17} /> Фильтры</button></div>
    <div className="catalog-layout">
      <div className="desktop-filters">{filterPanel}</div>
      <AnimatePresence>{filtersOpen && <div className="filter-modal"><motion.button aria-label="Закрыть фильтры" className="filter-backdrop" onClick={() => setFiltersOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div role="dialog" aria-modal="true" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}>{filterPanel}</motion.div></div>}</AnimatePresence>
      <section className="catalog-results">
        <div className="sort-row"><span aria-live="polite">{loading ? 'Загрузка...' : `${pagination.total_items} товаров`}</span><CatalogSelect compact label="Сортировка" value={params.get('sort') ?? 'newest'} onChange={(value) => setParam('sort', value)} options={[{ value: 'newest', label: 'Сначала новые' }, { value: 'price_asc', label: 'Сначала дешевле' }, { value: 'price_desc', label: 'Сначала дороже' }, { value: 'name_asc', label: 'По названию' }]} /></div>
        {error ? <div className="state-box"><h3>{error}</h3><button className="secondary-button" onClick={() => router.refresh()}>Повторить</button></div>
          : loading ? <div className="product-grid skeleton-grid" aria-label="Загружаем товары"><span className="sr-only">Загружаем товары...</span>{Array.from({ length: 8 }, (_, index) => <div className="product-skeleton" key={index}><span /><i /><i /></div>)}</div>
          : products.length === 0 ? <div className="state-box"><SlidersHorizontal /><h3>По вашему запросу товары не найдены.</h3><button className="secondary-button" onClick={() => router.push('/catalog')}>Сбросить фильтры</button></div>
          : <><div className="product-grid">{products.map((product) => <ProductCardView key={product.id} product={product} />)}</div>{pagination.total_pages > 1 && <div className="pagination"><button disabled={pagination.page <= 1} onClick={() => setParam('page', String(pagination.page - 1))}>Назад</button><span>{pagination.page} / {pagination.total_pages}</span><button disabled={pagination.page >= pagination.total_pages} onClick={() => setParam('page', String(pagination.page + 1))}>Далее</button></div>}</>}
      </section>
    </div>
  </div>;
}

export default function Catalog() {
  return <Suspense fallback={<div className="state-box">Загружаем каталог...</div>}><CatalogContent /></Suspense>;
}
