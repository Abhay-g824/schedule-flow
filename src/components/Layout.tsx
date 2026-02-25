
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";

export const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Check screen size
    useEffect(() => {
        const checkSize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        checkSize();
        window.addEventListener("resize", checkSize);
        return () => window.removeEventListener("resize", checkSize);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Toggle Button - Only visible on mobile when sidebar is closed */}
            {isMobile && !sidebarOpen && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="fixed top-4 left-4 z-50"
                    onClick={toggleSidebar}
                >
                    <Menu className="h-5 w-5" />
                </Button>
            )}

            <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} isMobile={isMobile} />

            <main
                className={cn(
                    "transition-all duration-300 min-h-screen",
                    isMobile ? "ml-0" : (sidebarOpen ? "ml-64" : "ml-20")
                )}
            >
                <Outlet />
            </main>
        </div>
    );
};
