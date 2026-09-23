'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Boxes, ClipboardCheck, MapPin, PackageCheck, PackageOpen, Search, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Category, ProductCard, Supplier, get } from '@/lib/api';
import { ProductCardView } from '@/components/ui';
import { ProductPlaceholder, Reveal, Stagger } from '@/components/motion-ui';
import { fadeUp } from '@/lib/motion';
import { useAuth } from '@/lib/auth';
import { isUsableProductImage } from '@/lib/images';
import { money } from '@/lib/format';

function CategoryCard({ category }: { category: Category }) {
  return <Link href={`/catalog?category_id=${category.id}`} className="market-category-card">
    <span className="category-visual"><PackageOpen size={25} /></span>
    <span className="category-card-copy"><b>{category.name}</b><small>Открыть категорию</small></span>
    <span className="round-arrow"><ArrowRight size={15} /></span>
  </Link>;
}

function HeroProduct({ product, className }: { product: ProductCard; className: string }) {
  return <Link href={`/catalog/${product.id}`} className={`hero-product-chip ${className}`}>
    <span className="hero-product-thumb">{isUsableProductImage(product.primary_image_url)
      ? <Image src={product.primary_image_url} alt="" width={180} height={120} unoptimized />
      : <ProductPlaceholder />}</span>
    <span><b>{product.name}</b><small>{money(product.price)} / {product.unit}</small></span>
    <ArrowRight size={15} />
  </Link>;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === 'ADMIN') router.replace('/admin');
    if (!loading && user?.role === 'SUPPLIER') router.replace('/supplier');
  }, [loading, router, user]);

  useEffect(() => {
    Promise.allSettled([
      get<{ items: Category[] }>('/categories'),
      get<{ items: ProductCard[] }>('/products?page_size=8&sort=newest'),
      get<{ items: Supplier[] }>('/suppliers?page_size=4'),
    ]).then(([categoryResult, productResult, supplierResult]) => {
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value.items);
      if (productResult.status === 'fulfilled') setProducts(productResult.value.items);
      if (supplierResult.status === 'fulfilled') setSuppliers(supplierResult.value.items);
      setLoaded(true);
    });
  }, []);

  if (loading || user?.role === 'ADMIN' || user?.role === 'SUPPLIER') return <div className="route-loading" role="status">Открываем рабочее пространство...</div>;

  return <div className="market-home">
    <section className="market-hero">
      <motion.div className="market-hero-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: .08 } } }}>
        <motion.p variants={fadeUp} className="market-eyebrow">ОПТОВЫЕ ТОВАРЫ ИЗ ДОРДОЯ И КАРА-СУУ</motion.p>
        <motion.h1 variants={fadeUp}>Ваш надёжный партнёр в <em>оптовых закупках</em></motion.h1>
        <motion.p variants={fadeUp} className="market-hero-description">Выбирайте товары поставщиков, оформляйте заказ онлайн и управляйте закупками в одном месте.</motion.p>
        <motion.div variants={fadeUp} className="market-hero-actions">
          <Link href="/catalog" className="market-button market-button-primary">Перейти в каталог <ArrowRight size={17} /></Link>
          <a href="#how-it-works" className="market-button market-button-secondary">Как это работает</a>
        </motion.div>
        <motion.div variants={fadeUp} className="market-benefit-row">
          <span><PackageCheck /><b>Условия до заказа</b><small>цена, MOQ и остаток</small></span>
          <span><MapPin /><b>Два рынка</b><small>Дордой и Кара-Суу</small></span>
          <span><ClipboardCheck /><b>Заказ онлайн</b><small>история в аккаунте</small></span>
        </motion.div>
      </motion.div>

      <motion.div className="market-hero-visual" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .55 }}>
        <Image className="market-photo" src="/images/market-hero.webp" alt="Оптовый рынок" fill priority sizes="(max-width: 900px) 100vw, 55vw" />
        <div className="market-photo-shade" />
        <div className="market-location-label"><MapPin size={15} /><span><b>Дордой · Кара-Суу</b><small>Оптовые рынки Кыргызстана</small></span></div>
        {products[0] && <HeroProduct product={products[0]} className="hero-product-chip-one" />}
        {products[1] && <HeroProduct product={products[1]} className="hero-product-chip-two" />}
      </motion.div>
    </section>

    {(!loaded || categories.length > 0) && <Reveal><section className="market-section market-section-categories" id="categories">
      <div className="market-section-heading"><div><h2>Популярные категории</h2></div><Link href="/catalog" className="market-text-link">Смотреть все <ArrowRight size={16} /></Link></div>
      <Stagger className="market-category-grid">{categories.slice(0, 8).map(category => <CategoryCard key={category.id} category={category} />)}</Stagger>
    </section></Reveal>}

    {(!loaded || products.length > 0) && <Reveal><section className="market-section" id="products">
      <div className="market-section-heading"><div><p className="market-eyebrow">НОВЫЕ ПОСТУПЛЕНИЯ</p><h2>Товары для вашего магазина</h2></div><Link href="/catalog" className="market-text-link">Весь каталог <ArrowRight size={16} /></Link></div>
      <Stagger className="product-grid market-product-grid">{products.map(product => <ProductCardView key={product.id} product={product} />)}</Stagger>
    </section></Reveal>}

    {(!loaded || suppliers.length > 0) && <Reveal><section className="market-section" id="suppliers">
      <div className="market-section-heading"><div><p className="market-eyebrow">ПОСТАВЩИКИ</p><h2>Поставщики рядом</h2></div></div>
      <div className="market-supplier-grid">{suppliers.slice(0, 4).map(supplier => <Link className="market-supplier-card" key={supplier.id} href={`/catalog?supplier_id=${supplier.id}`}><span className="supplier-map-mark"><MapPin size={20} /></span><span><b>{supplier.name}</b><small>{supplier.market === 'DORDOI' ? 'Дордой' : 'Кара-Суу'}{supplier.pavilion ? ` · ${supplier.pavilion}` : ''}</small></span><span className="supplier-arrow"><ArrowRight size={18} /></span></Link>)}</div>
    </section></Reveal>}

    <section className="market-section" id="how-it-works">
      <div className="market-section-heading"><div><p className="market-eyebrow">ПОЧЕМУ MARKET KG</p><h2>Всё нужное для оптовой закупки</h2></div></div>
      <div className="market-feature-grid">
        <div><span><Search /></span><b>Удобный каталог</b><small>Поиск и фильтры по актуальному ассортименту</small></div>
        <div><span><Boxes /></span><b>MOQ до покупки</b><small>Минимальный заказ виден в карточке товара</small></div>
        <div><span><PackageCheck /></span><b>Остатки товаров</b><small>Доступное количество показано до оформления</small></div>
        <div><span><ClipboardCheck /></span><b>История заказов</b><small>Статусы и состав закупок доступны в аккаунте</small></div>
      </div>
    </section>

    <section className="market-final-cta" id="about">
      <div><p className="market-eyebrow">MARKET KG ДЛЯ БИЗНЕСА</p><h2>Развивайте свой бизнес вместе с нами</h2><p>Собирайте оптовые закупки из ассортимента поставщиков Дордоя и Кара-Суу.</p><Link href={user ? '/catalog' : '/register'} className="market-button market-button-light">{user ? 'Перейти в каталог' : 'Зарегистрироваться'} <ArrowRight size={17} /></Link></div>
      <div className="market-route-visual" aria-hidden="true"><MapPin /><i /><ShoppingBag /><i /><MapPin /></div>
    </section>
  </div>;
}
