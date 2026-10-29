import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      {intro && <p className="lead">{intro}</p>}
      {children}
    </section>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

export function EmptyDomain() {
  return <p className="banner" role="status">Le catalogue musical est indisponible. Réessaie après le chargement de l’application.</p>;
}

export function NotFound() {
  return (
    <Page title="Page introuvable">
      <p>Cette page n’existe pas ou cette gamme n’est pas prise en charge.</p>
      <Link className="primary" to="/">Retour à l’accueil</Link>
    </Page>
  );
}
