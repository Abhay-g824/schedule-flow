import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TasksProvider } from "@/hooks/useTasks";
import { TemplatesProvider } from "@/hooks/useTemplates";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import CalendarViewPage from "./pages/CalendarView";
import FilteredTasksPage from "./pages/FilteredTasksPage";
import NotFound from "./pages/NotFound";
import DayTasksPage from "./pages/DayTasksPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <TemplatesProvider>
            <TasksProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Authenticated Routes wrapped in Layout */}
                  <Route element={<RequireAuth><Layout /></RequireAuth>}>
                    <Route path="/" element={<Index />} />
                    <Route path="/today" element={<FilteredTasksPage filter="today" />} />
                    <Route path="/week" element={<FilteredTasksPage filter="week" />} />
                    <Route path="/month" element={<FilteredTasksPage filter="month" />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/task/:date" element={<DayTasksPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                  </Route>

                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TasksProvider>
          </TemplatesProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
