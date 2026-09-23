export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-kicker" />
      <span className="route-loading-title" />
      <div className="route-loading-grid">
        {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
      </div>
      <span className="sr-only">Загружаем страницу...</span>
    </div>
  );
}
