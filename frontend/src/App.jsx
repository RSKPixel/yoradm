import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppLayout } from './components/AppLayout'
import { FormMessageProvider } from './components/form/FormMessage'
import { SettingsProvider } from './components/settings/SettingsContext'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { OpenSettingsRoute } from './pages/OpenSettingsRoute'
import { DeliveryChallanPage } from './pages/DeliveryChallanPage'
import { OridDhallProductionPage } from './pages/OridDhallProductionPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { AdminRoute, ProtectedRoute } from './routes/guards'

export default function App() {
  return (
    <FormMessageProvider>
      <AuthProvider>
        <BrowserRouter>
          <SettingsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />

                  <Route element={<AdminRoute />}>
                    <Route path="tally/accounts" element={<PlaceholderPage title="Accounts" />} />
                    <Route path="tally/inventory" element={<PlaceholderPage title="Inventory" />} />
                    <Route path="tally/sales" element={<PlaceholderPage title="Sales" />} />
                    <Route path="tally/purchases" element={<PlaceholderPage title="Purchase" />} />
                  </Route>
                  <Route path="transactions/delivery-challan" element={<DeliveryChallanPage />} />
                  <Route
                    path="transactions/orid-dhall-production"
                    element={<OridDhallProductionPage />}
                  />
                  <Route path="transactions/brokerage" element={<PlaceholderPage title="Brokerage" />} />
                  <Route
                    path="transactions/fixed-asset-register"
                    element={<PlaceholderPage title="Fixed Asset Register" />}
                  />

                  <Route
                    path="reports/receivables-analysis"
                    element={<PlaceholderPage title="Receivables Analysis" />}
                  />

                  <Route path="settings" element={<OpenSettingsRoute />} />
                  <Route path="company" element={<OpenSettingsRoute tab="company" />} />
                  <Route path="users" element={<OpenSettingsRoute tab="users" />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </BrowserRouter>
      </AuthProvider>
    </FormMessageProvider>
  )
}
