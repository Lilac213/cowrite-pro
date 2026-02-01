import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { FileText, Library, BookOpen, Wand2, FileCode, Settings, Menu, ChevronLeft, Shield } from 'lucide-react';

const mainMenuItems = [
  { title: '项目列表', url: '/', icon: FileText },
  { title: '素材库', url: '/materials', icon: Library },
  { title: '参考文章库', url: '/references', icon: BookOpen },
];

const toolboxItems = [
  { title: 'AI 降重工具', url: '/ai-reducer', icon: Wand2 },
  { title: '模板管理', url: '/templates', icon: FileCode },
  { title: '设置', url: '/settings', icon: Settings },
];

function SidebarContent({ 
  isCollapsed, 
  onToggle, 
  location, 
  profile, 
  isMobile = false,
  onNavigate 
}: { 
  isCollapsed: boolean; 
  onToggle?: () => void; 
  location: any; 
  profile: any;
  isMobile?: boolean;
  onNavigate?: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo 区域 */}
      <div className={`border-b border-border ${isCollapsed ? 'p-3' : 'p-6'}`}>
        {isCollapsed ? (
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              CW
            </div>
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">CoWrite</h1>
              <p className="text-sm text-muted-foreground mt-1">写作辅助工具</p>
            </div>
            {!isMobile && onToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="shrink-0 ml-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 菜单内容 */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col">
        {/* 主菜单 */}
        <div className={`${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <div className="px-2 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                主菜单
              </h3>
            </div>
          )}
          <nav className="space-y-1">
            {mainMenuItems.map((item) => {
              const isActive = location.pathname === item.url;
              const menuButton = (
                <Link
                  to={item.url}
                  onClick={handleClick}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              );

              return isCollapsed && !isMobile ? (
                <Tooltip key={item.title}>
                  <TooltipTrigger asChild>{menuButton}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.title}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.title}>{menuButton}</div>
              );
            })}
          </nav>
        </div>

        {/* 间隔 */}
        <div className="flex-1 min-h-[40px]" />

        {/* 工具箱 */}
        <div className={`${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <div className="px-2 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                工具箱
              </h3>
            </div>
          )}
          <nav className="space-y-1">
            {toolboxItems.map((item) => {
              const isActive = location.pathname === item.url;
              const menuButton = (
                <Link
                  to={item.url}
                  onClick={handleClick}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              );

              return isCollapsed && !isMobile ? (
                <Tooltip key={item.title}>
                  <TooltipTrigger asChild>{menuButton}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.title}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.title}>{menuButton}</div>
              );
            })}
            {profile?.role === 'admin' && (
              <>
                {isCollapsed && !isMobile ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to="/admin"
                        onClick={handleClick}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors justify-center ${
                          location.pathname === '/admin'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`}
                      >
                        <Shield className="h-4 w-4 shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>管理面板</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    to="/admin"
                    onClick={handleClick}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      location.pathname === '/admin'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>管理面板</span>
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 从 localStorage 读取折叠状态
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true');
    }
  }, []);

  // 保存折叠状态到 localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full">
        {/* PC 端侧边栏 */}
        <aside
          className={`hidden md:block border-r border-border bg-sidebar transition-all duration-300 ease-in-out shrink-0 ${
            isCollapsed ? 'w-[56px]' : 'w-[220px]'
          }`}
        >
          <SidebarContent
            isCollapsed={isCollapsed}
            onToggle={toggleSidebar}
            location={location}
            profile={profile}
          />
        </aside>

        {/* 移动端侧边栏 */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[50vw] p-0 bg-sidebar md:hidden">
            <SidebarContent
              isCollapsed={false}
              location={location}
              profile={profile}
              isMobile={true}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          {/* 移动端顶部菜单按钮 */}
          <div className="md:hidden border-b border-border bg-background">
            <div className="flex h-14 items-center px-4">
              <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <main className="flex-1 overflow-auto">
            {<Outlet />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
