type Props = {
  title: string;
};

export function PlaceholderPage({ title }: Props) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>Раздел готов для поэкранного переноса AngularJS-контроллера и шаблона.</p>
    </section>
  );
}
