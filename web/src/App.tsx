import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.js';
import { RutaProtegida } from './auth/RutaProtegida.js';
import { Layout } from './componentes/Layout.js';
import { DashboardPage } from './paginas/DashboardPage.js';
import { LoginPage } from './paginas/LoginPage.js';
import { TicketCrearPage } from './paginas/TicketCrearPage.js';
import { TicketDetallePage } from './paginas/TicketDetallePage.js';
import { TicketsListaPage } from './paginas/TicketsListaPage.js';
import { UsuariosPage } from './paginas/UsuariosPage.js';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/tickets"
            element={
              <RutaProtegida>
                <Layout>
                  <TicketsListaPage />
                </Layout>
              </RutaProtegida>
            }
          />
          {/* Antes de /tickets/:id para que "nuevo" no se interprete como un id. */}
          <Route
            path="/tickets/nuevo"
            element={
              <RutaProtegida>
                <Layout>
                  <TicketCrearPage />
                </Layout>
              </RutaProtegida>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RutaProtegida>
                <Layout>
                  <TicketDetallePage />
                </Layout>
              </RutaProtegida>
            }
          />

          <Route
            path="/dashboard"
            element={
              <RutaProtegida rolesPermitidos={['administrador', 'supervisor']}>
                <Layout>
                  <DashboardPage />
                </Layout>
              </RutaProtegida>
            }
          />

          <Route
            path="/usuarios"
            element={
              <RutaProtegida rolesPermitidos={['administrador']}>
                <Layout>
                  <UsuariosPage />
                </Layout>
              </RutaProtegida>
            }
          />

          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
