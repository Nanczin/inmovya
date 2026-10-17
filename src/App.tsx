import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { LeadsProvider } from "@/context/LeadsContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import { TaskNotificationPoller } from "./components/TaskNotificationPoller";
import { NewLeadNotifier } from "./components/NewLeadNotifier";
import { PrimeiroContatoRunner } from "./components/PrimeiroContatoRunner";
import { ConferenciaRunner } from "./components/ConferenciaRunner";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="inmovya-tema" disableTransitionOnChange>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationsProvider>
        <TooltipProvider>
          <LeadsProvider>
              <Toaster />
              <Sonner />
              <TaskNotificationPoller />
              <NewLeadNotifier />
              <PrimeiroContatoRunner />
              <ConferenciaRunner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/install" element={<Install />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
          </LeadsProvider>
        </TooltipProvider>
      </NotificationsProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;


