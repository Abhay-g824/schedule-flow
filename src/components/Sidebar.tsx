import { NavLink } from "react-router-dom";
import { CalendarDays, CalendarCheck, CalendarRange, Calendar, LayoutDashboard, CheckCircle2, Moon, Sun, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Today", url: "/today", icon: CalendarCheck },
  { title: "This Week", url: "/week", icon: CalendarDays },
  { title: "This Month", url: "/month", icon: CalendarRange },
  { title: "Calendar", url: "/calendar", icon: Calendar },
];


interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isMobile: boolean;
}

export const Sidebar = ({ isOpen, onToggle, isMobile }: SidebarProps) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-card border-r border-border/50 flex flex-col transition-all duration-300 ease-in-out z-40",
          isMobile
            ? (isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full")
            : (isOpen ? "w-64" : "w-20")
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className={cn("flex items-center justify-between p-4 border-b border-border/50", !isOpen && !isMobile && "justify-center")}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-primary flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className={cn(
                "font-display font-semibold text-lg text-foreground transition-opacity duration-300 whitespace-nowrap",
                (isOpen && !isMobile) || (isMobile && isOpen) ? "opacity-100" : "opacity-0 w-0 hidden"
              )}>
                SERA AI
              </span>
            </div>
            {/* Desktop Toggle or Mobile Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className={cn("h-8 w-8 shrink-0", !isOpen && !isMobile && "hidden")}
            >
              {isMobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          {/* Desktop Expand Button when collapsed */}
          {!isOpen && !isMobile && (
            <div className="flex justify-center p-2 border-b border-border/50">
              <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navigationItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                    (!isOpen && !isMobile) && "justify-center px-2"
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span
                  className={cn(
                    "transition-all duration-300 whitespace-nowrap",
                    (isOpen && !isMobile) || (isMobile && isOpen) ? "opacity-100 translate-x-0" : "opacity-0 w-0 translate-x-[-10px] hidden"
                  )}
                >
                  {item.title}
                </span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border/50 space-y-2">
            {/* User Profile */}
            <NavLink
              to="/profile"
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors group",
                (!isOpen && !isMobile) && "justify-center"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "text-xs text-muted-foreground group-hover:text-foreground truncate transition-all duration-300",
                  (isOpen && !isMobile) || (isMobile && isOpen) ? "opacity-100 max-w-[120px]" : "opacity-0 w-0 hidden"
                )}
              >
                {user?.email?.split("@")[0] || "User"}
              </span>
            </NavLink>

            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className={cn(
                "w-full",
                (!isOpen && !isMobile) && "w-auto mx-auto aspect-square p-2"
              )}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>


            {/* Logout */}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className={cn(
                "w-full",
                (!isOpen && !isMobile) && "w-auto px-2 aspect-square"
              )}
            >
              <span className={cn(
                "transition-all duration-300",
                (isOpen && !isMobile) || (isMobile && isOpen) ? "opacity-100" : "opacity-0 w-0 hidden"
              )}>
                Log out
              </span>
              {(!isOpen && !isMobile) && <span className="text-xs">Out</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
};



