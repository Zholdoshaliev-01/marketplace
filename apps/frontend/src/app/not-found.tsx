import Link from 'next/link';
export default function NotFound(){return <div className="empty-state"><p className="eyebrow">404</p><h1>Страница не найдена</h1><Link href="/" className="primary-button">На главную</Link></div>}
