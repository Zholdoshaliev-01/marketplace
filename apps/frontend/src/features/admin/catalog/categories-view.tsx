'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, createAdminCategory, deleteAdminCategory, getAdminCategories, updateAdminCategory, type Category } from '@/lib/api';
import { friendlyError } from '@/lib/messages';

type CategoryOption = Category & { depth: number };

function flatten(items: Category[], depth = 0): CategoryOption[] {
  return items.flatMap(item => [{ ...item, depth }, ...flatten(item.children, depth + 1)]);
}

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? friendlyError(reason) : fallback;
}

export function AdminCategoriesView() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const options = useMemo(() => flatten(items ?? []), [items]);

  const load = useCallback(async () => {
    try { setItems((await getAdminCategories()).items); setError(''); }
    catch (reason) { setError(errorText(reason, 'Не удалось загрузить категории.')); }
  }, []);
  useEffect(() => {
    getAdminCategories().then(data => { setItems(data.items); setError(''); }).catch(reason => setError(errorText(reason, 'Не удалось загрузить категории.')));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const slug = String(data.get('slug') ?? '').trim();
    const parentId = String(data.get('parent_id') ?? '').trim();
    if (!name || !slug) { setError('Укажите название и slug категории.'); return; }
    setPending('create'); setError('');
    try { await createAdminCategory({ name, slug, parent_id: parentId || null }); form.reset(); await load(); }
    catch (reason) { setError(errorText(reason, 'Не удалось создать категорию.')); }
    finally { setPending(''); }
  }

  async function save(category: Category, form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(category.id); setError('');
    try {
      await updateAdminCategory(category.id, { name: String(data.get('name') ?? '').trim(), slug: String(data.get('slug') ?? '').trim() });
      await load();
    } catch (reason) { setError(errorText(reason, 'Не удалось обновить категорию.')); }
    finally { setPending(''); }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Удалить категорию «${category.name}»? Категорию с товарами удалить нельзя.`)) return;
    setPending(category.id); setError('');
    try { await deleteAdminCategory(category.id); await load(); }
    catch (reason) { setError(errorText(reason, 'Не удалось удалить категорию.')); }
    finally { setPending(''); }
  }

  return <div>
    <div className="workspace-page-heading"><div><p className="eyebrow">Структура каталога</p><h1>Категории</h1><p>Создавайте разделы каталога и поддерживайте понятную навигацию.</p></div></div>
    <form className="admin-create-panel" onSubmit={create}>
      <div><h2>Новая категория</h2><p>Slug используется как технический адрес: латиница, цифры и дефис.</p></div>
      <label>Название *<input name="name" placeholder="Например, Замороженные продукты" /></label>
      <label>Slug *<input name="slug" placeholder="frozen-products" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
      <label>Родитель<select name="parent_id"><option value="">Корневая категория</option>{options.map(item => <option value={item.id} key={item.id}>{'— '.repeat(item.depth)}{item.name}</option>)}</select></label>
      <button className="primary-button" disabled={pending === 'create'}>{pending === 'create' ? 'Создаём...' : 'Создать'}</button>
    </form>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {!items ? <div className="state-box">Загружаем категории...</div> : options.length === 0 ? <div className="empty-state"><h2>Категорий пока нет</h2></div> : <div className="admin-management-list">
      {options.map(category => <form className="admin-management-row" key={category.id} onSubmit={event => { event.preventDefault(); void save(category, event.currentTarget); }}>
        <span className="admin-tree-depth" style={{ paddingLeft: `${category.depth * 18}px` }}>{category.depth ? '↳' : '•'}</span>
        <label>Название<input name="name" defaultValue={category.name} /></label>
        <label>Slug<input name="slug" defaultValue={category.slug} /></label>
        <div className="admin-row-actions"><button className="secondary-button" disabled={pending === category.id}>Сохранить</button><button type="button" className="danger-button" disabled={pending === category.id} onClick={() => void remove(category)}>Удалить</button></div>
      </form>)}
    </div>}
  </div>;
}
