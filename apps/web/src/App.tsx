import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { focusMainContent } from "./app-model";
import { NotFound } from "./components";
import { Daily, Exercises } from "./exercise-pages";
import { Home, Learn } from "./learning-pages";
import { ProgressPage, ProgressProvider } from "./progress";
import { Generator, ScaleDetail, ScaleList } from "./scale-pages";

export { ExerciseCard } from "./exercise-pages";
export { ProgressContext, ProgressPage } from "./progress";

function Layout() {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    try {
      return localStorage.getItem("notescale.theme") === "dark";
    } catch {
      return false;
    }
  });
  const [hasOfflineWarning, setHasOfflineWarning] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? "dark" : "light";
    try {
      localStorage.setItem("notescale.theme", isDarkTheme ? "dark" : "light");
    } catch { /* Progress storage already surfaces the non-blocking persistence warning. */ }
  }, [isDarkTheme]);
  useEffect(() => {
    const showOfflineWarning = () => setHasOfflineWarning(true);
    window.addEventListener("notescale-offline-error", showOfflineWarning);
    return () => window.removeEventListener("notescale-offline-error", showOfflineWarning);
  }, []);
  return (
    <>
      <button type="button" className="skip" onClick={() => focusMainContent(document)}>Aller au contenu</button>
      <header>
        <Link className="brand" to="/" aria-label="NoteScale, accueil">♪ NoteScale</Link>
        <button
          className="theme"
          onClick={() => setIsDarkTheme(!isDarkTheme)}
          aria-label={isDarkTheme ? "Activer le thème clair" : "Activer le thème sombre"}
        >
          {isDarkTheme ? "☀" : "☾"}
        </button>
      </header>
      {hasOfflineWarning && <p className="banner" role="status">Mode hors ligne non installé. Recharge la page en ligne pour réessayer.</p>}
      <nav className="tabs" aria-label="Navigation principale">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink key={to} end={to === '/'} to={to}>
            <span aria-hidden="true">{icon}</span>{label}
          </NavLink>
        ))}
      </nav>
      <main id="contenu" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/apprendre" element={<Learn />} />
          <Route path="/gammes" element={<ScaleList />} />
          <Route path="/gammes/:id" element={<ScaleDetail />} />
          <Route path="/generateur" element={<Generator />} />
          <Route path="/exercices" element={<Exercises />} />
          <Route path="/quotidien" element={<Daily />} />
          <Route path="/progression" element={<ProgressPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

const NAV_ITEMS = [
  { to: "/", icon: "⌂", label: "Accueil" },
  { to: "/apprendre", icon: "◎", label: "Apprendre" },
  { to: "/exercices", icon: "✎", label: "Exercices" },
  { to: "/progression", icon: "▥", label: "Progression" },
] as const;

export default function App() {
  return <ProgressProvider><Layout /></ProgressProvider>;
}
