import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TasksProvider } from "@/hooks/useTasks";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import FilteredTasksPage from "./pages/FilteredTasksPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TasksProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/today" element={<FilteredTasksPage filter="today" />} />
            <Route path="/week" element={<FilteredTasksPage filter="week" />} />
            <Route path="/month" element={<FilteredTasksPage filter="month" />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TasksProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
