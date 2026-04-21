import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import GestaoEmpresasPage from './telas/GestaoEmpresasPage';
import DadosMercadoPage from './telas/DadosMercadoPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <main className="dcf-page">
        <header className="top-header">
          <div className="brand">Decision DCF - Plataforma de Valuation</div>
          <div className="brand right">2026</div>
        </header>

        <div className="title-strip">Modelo FCD</div>

        <nav className="app-nav" aria-label="Navegacao principal">
          <NavLink
            to="/gestao-empresas"
            className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
          >
            Gestão de Empresas
          </NavLink>
          <NavLink
            to="/dados-mercado"
            className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
          >
            Dados de Mercado
          </NavLink>
        </nav>

        <section className="screen-wrap">
          <Routes>
            <Route path="/" element={<Navigate to="/gestao-empresas" replace />} />
            <Route path="/gestao-empresas" element={<GestaoEmpresasPage />} />
            <Route path="/dados-mercado" element={<DadosMercadoPage />} />
            <Route path="*" element={<Navigate to="/gestao-empresas" replace />} />
          </Routes>
        </section>
      </main>
    </BrowserRouter>
  );
}

export default App;
