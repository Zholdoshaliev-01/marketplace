'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, createAdminSupplier, deactivateAdminSupplier, getAdminSuppliers, updateAdminSupplier, type AdminSupplier, type Market } from '@/lib/api';
import { friendlyError } from '@/lib/messages';

function errorText(reason: unknown, fallback: string) { return reason instanceof ApiError ? friendlyError(reason) : fallback; }

export function AdminSuppliersView() {
  const [items, setItems] = useState<AdminSupplier[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    return (items ?? []).filter(item => !query || item.name.toLocaleLowerCase('ru').includes(query) || item.phone.includes(query));
  }, [items, search]);

  const load = useCallback(async () => {
    try { setItems(await getAdminSuppliers()); setError(''); }
    catch (reason) { setError(errorText(reason, 'Не удалось загрузить поставщиков.')); }
  }, []);
  useEffect(() => {
    getAdminSuppliers().then(data => { setItems(data); setError(''); }).catch(reason => setError(errorText(reason, 'Не удалось загрузить поставщиков.')));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    if (!name || !phone) { setError('Укажите название и телефон поставщика.'); return; }
    setPending('create'); setError('');
    try {
      await createAdminSupplier({ name, phone, market: String(data.get('market')) as Market, pavilion: String(data.get('pavilion') ?? '').trim() || null, description: String(data.get('description') ?? '').trim() || null });
      form.reset(); await load();
    } catch (reason) { setError(errorText(reason, 'Не удалось создать поставщика.')); }
    finally { setPending(''); }
  }

  async function save(item: AdminSupplier, form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(item.id); setError('');
    try {
      const updated = await updateAdminSupplier(item.id, {
        name: String(data.get('name') ?? '').trim(), phone: String(data.get('phone') ?? '').trim(), market: String(data.get('market')) as Market,
        pavilion: String(data.get('pavilion') ?? '').trim() || null, description: String(data.get('description') ?? '').trim() || null,
      });
      setItems(current => current?.map(value => value.id === updated.id ? updated : value) ?? []);
    } catch (reason) { setError(errorText(reason, 'Не удалось сохранить поставщика.')); }
    finally { setPending(''); }
  }

  async function toggle(item: AdminSupplier) {
    if (item.is_active && !window.confirm(`Отключить поставщика «${item.name}»? Его товары исчезнут из публичного каталога.`)) return;
    setPending(item.id); setError('');
    try {
      if (item.is_active) await deactivateAdminSupplier(item.id); else await updateAdminSupplier(item.id, { is_active: true });
      await load();
    } catch (reason) { setError(errorText(reason, 'Не удалось изменить статус поставщика.')); }
    finally { setPending(''); }
  }

  return <div>
    <div className="workspace-page-heading"><div><p className="eyebrow">Партнёры</p><h1>Поставщики</h1><p>Профили, рынки, павильоны и доступность поставщиков.</p></div></div>
    <form className="admin-create-panel" onSubmit={create}>
      <div><h2>Новый поставщик</h2><p>Поставщик без владельца управляется администратором. Demo-аккаунты уже связаны с владельцами.</p></div>
      <label>Название *<input name="name" /></label><label>Телефон *<input name="phone" /></label>
      <label>Рынок<select name="market"><option value="DORDOI">Дордой</option><option value="KARA_SUU">Кара-Суу</option></select></label>
      <label>Павильон<input name="pavilion" /></label><label className="span-two">Описание<textarea name="description" rows={2} /></label>
      <button className="primary-button" disabled={pending === 'create'}>{pending === 'create' ? 'Создаём...' : 'Добавить поставщика'}</button>
    </form>
    <div className="admin-toolbar"><label>Поиск<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название или телефон" /></label><span>{visible.length} поставщиков</span></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {!items ? <div className="state-box">Загружаем поставщиков...</div> : <div className="admin-management-list">
      {visible.map(item => <article className="admin-management-card" key={item.id}>
        <div className="admin-card-heading"><div><span className={item.is_active ? 'availability active' : 'availability inactive'}>{item.is_active ? 'Активен' : 'Отключён'}</span><h2>{item.name}</h2><p>{item.owner_user_id ? 'Связан с аккаунтом поставщика' : 'Управляется администратором'}</p></div><button className={item.is_active ? 'danger-button' : 'secondary-button'} disabled={pending === item.id} onClick={() => void toggle(item)}>{item.is_active ? 'Отключить' : 'Включить'}</button></div>
        <form className="admin-edit-grid" onSubmit={event => { event.preventDefault(); void save(item, event.currentTarget); }}>
          <label>Название<input name="name" defaultValue={item.name} /></label><label>Телефон<input name="phone" defaultValue={item.phone} /></label>
          <label>Рынок<select name="market" defaultValue={item.market}><option value="DORDOI">Дордой</option><option value="KARA_SUU">Кара-Суу</option></select></label><label>Павильон<input name="pavilion" defaultValue={item.pavilion ?? ''} /></label>
          <label className="span-two">Описание<textarea name="description" rows={2} defaultValue={item.description ?? ''} /></label><button className="primary-button" disabled={pending === item.id}>Сохранить</button>
        </form>
      </article>)}
    </div>}
  </div>;
}
