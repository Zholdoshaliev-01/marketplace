'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, MapPin, Minus, PackageCheck, Plus, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, ProductCard, ProductDetail, get, post } from '@/lib/api';
import { friendlyError } from '@/lib/messages';
import { marketLabels, money } from '@/lib/format';
import { isUsableProductImage } from '@/lib/images';
import { ProductPlaceholder } from '@/components/motion-ui';
import { ProductCardView } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<ProductCard[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    get<ProductDetail>(`/products/${productId}`, { signal: controller.signal })
      .then((data) => {
        setProduct(data);
        setQuantity(data.minimum_order_quantity);
        setError('');
        void get<{ items: ProductCard[] }>(`/products?category_id=${data.category.id}&page_size=5`, { signal: controller.signal })
          .then((result) => setRelated(result.items.filter((item) => item.id !== productId).slice(0, 4)))
          .catch(() => {});
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError('Товар не найден.');
      });
    return () => controller.abort();
  }, [productId]);

  const images = useMemo(() => {
    if (!product) return [];
    const candidates = [product.primary_image_url, ...[...product.images].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url)];
    return [...new Set(candidates.filter(isUsableProductImage))];
  }, [product]);

  if (!product) return <div className="state-box">{error || 'Загружаем товар...'}</div>;

  const add = async () => {
    setAdding(true);
    setError('');
    try {
      await post('/cart/items', { product_id: product.id, quantity });
      setAdded(true);
      window.setTimeout(() => setAdded(false), 3000);
    } catch (reason) {
      setError(friendlyError(reason as ApiError));
    } finally {
      setAdding(false);
    }
  };

  return <div className="product-page">
    <nav className="product-breadcrumbs" aria-label="Хлебные крошки">
      <Link href="/catalog"><ArrowLeft size={15}/> Каталог</Link><ChevronRight size={14}/><Link href={`/catalog?category_id=${product.category.id}`}>{product.category.name}</Link><ChevronRight size={14}/><span>{product.name}</span>
    </nav>

    <section className="product-showcase">
      <div className="product-gallery">
        {images.length > 1 && <div className="product-thumbnails" aria-label="Фотографии товара">{images.map((image, index) => <button className={activeImage === index ? 'active' : ''} aria-label={`Показать фото ${index + 1}`} key={image} onClick={() => setActiveImage(index)}><Image src={image} alt="" width={100} height={100} unoptimized/></button>)}</div>}
        <div className="product-main-image">
          {images[activeImage] ? <Image src={images[activeImage]} alt={product.name} width={900} height={900} priority unoptimized/> : <ProductPlaceholder category={product.category.name} sku={product.sku}/>}
          <span className="product-market-badge">{marketLabels[product.supplier.market]}</span>
        </div>
      </div>

      <div className="product-overview">
        <div className="product-category-line"><span>{product.category.name}</span><span className="verified-chip"><ShieldCheck size={14}/> Проверенный товар</span></div>
        <h1>{product.name}</h1>
        <p className="product-detail-sku">Артикул: <b>{product.sku}</b></p>
        <div className="product-divider"/>
        <div className="product-overview-facts">
          <div><span>Единица продажи</span><b>{product.unit}</b></div>
          <div><span>Минимальный заказ</span><b>{product.minimum_order_quantity} {product.unit}</b></div>
          <div><span>Доступно сейчас</span><b className={product.stock_quantity > 0 ? 'available' : 'unavailable'}>{product.stock_quantity > 0 ? `${product.stock_quantity} ${product.unit}` : 'Нет в наличии'}</b></div>
        </div>
        <Link className="product-supplier-mini" href={`/catalog?supplier_id=${product.supplier.id}`}><span className="supplier-mini-icon"><Store size={20}/></span><span><small>Поставщик</small><b>{product.supplier.name}</b><em><MapPin size={13}/>{marketLabels[product.supplier.market]}{product.supplier.pavilion ? ` · ${product.supplier.pavilion}` : ''}</em></span><ChevronRight size={18}/></Link>
      </div>

      <aside className="product-buy-card">
        <p className="buy-card-label">Оптовая цена</p>
        <p className="buy-card-price">{money(product.price)} <small>/ {product.unit}</small></p>
        <p className={`buy-card-stock ${product.stock_quantity > 0 ? 'available' : 'unavailable'}`}><span><Check size={14}/></span>{product.stock_quantity > 0 ? `В наличии · ${product.stock_quantity} ${product.unit}` : 'Нет в наличии'}</p>
        <div className="buy-card-separator"/>
        {user?.role === 'ADMIN' || user?.role === 'SUPPLIER' ? <div className="inspection-note"><ShieldCheck size={18}/><span><b>Режим просмотра</b><small>Покупка доступна только аккаунту магазина.</small></span></div> : <>
          <div className="buy-card-quantity"><span><b>Количество</b><small>Минимум {product.minimum_order_quantity} {product.unit}</small></span><div className="quantity"><button aria-label="Уменьшить" disabled={adding} onClick={() => setQuantity(Math.max(product.minimum_order_quantity, quantity - 1))}><Minus size={17}/></button><b>{quantity}</b><button aria-label="Увеличить" disabled={adding} onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}><Plus size={17}/></button></div></div>
          <div className="buy-card-total"><span>Сумма</span><b>{money(Number(product.price) * quantity)}</b></div>
          {user ? <button className="primary-button product-add-button" disabled={!product.stock_quantity || adding} onClick={add}><ShoppingBag size={19}/>{!product.stock_quantity ? 'Нет в наличии' : adding ? 'Добавляем...' : 'Добавить в корзину'}</button> : <Link href={`/login?next=${encodeURIComponent(`/catalog/${product.id}`)}`} className="primary-button product-add-button">Войти для покупки</Link>}
        </>}
        <div className="buy-card-benefits"><span><PackageCheck/> Условия заказа видны заранее</span><span><ShieldCheck/> Остаток проверяется при оформлении</span></div>
      </aside>
    </section>

    {error && <div className="inline-error product-message" role="alert">{error}</div>}
    {added && <div className="success-note product-message" role="status"><span><Check/> Товар добавлен в корзину</span><button onClick={() => router.push('/cart')}>Открыть корзину <ChevronRight size={15}/></button></div>}

    <section className="product-about">
      <div className="product-description-card"><p className="eyebrow">О товаре</p><h2>Описание</h2><p>{product.description || 'Оптовый товар от поставщика Market KG. Актуальные цена, минимальный заказ и доступный остаток указаны выше.'}</p></div>
      <div className="product-delivery-card"><p className="eyebrow">Покупка</p><h2>Как оформить заказ</h2><ol><li><span>1</span>Выберите нужное количество</li><li><span>2</span>Добавьте товар в корзину</li><li><span>3</span>Укажите адрес и способ оплаты</li></ol></div>
    </section>

    {related.length > 0 && <section className="product-related"><div className="market-section-heading"><div><p className="market-eyebrow">ПОХОЖИЕ ТОВАРЫ</p><h2>Вам может подойти</h2></div><Link href={`/catalog?category_id=${product.category.id}`} className="market-text-link">Вся категория <ChevronRight size={16}/></Link></div><div className="product-grid">{related.map((item) => <ProductCardView product={item} key={item.id}/>)}</div></section>}
  </div>;
}
