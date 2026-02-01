import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileText, Library, BookOpen, FileCode, Settings, LogOut, User, Shield, Menu, ChevronsLeft, ChevronsRight } from 'lucide-react';

const mainMenuItems = [
  { title: '项目列表', url: '/', icon: FileText },
  { title: '素材库', url: '/materials', icon: Library },
  { title: '参考文章库', url: '/references', icon: BookOpen },
];

const toolboxItems = [
  { title: 'AI 降重工具', url: '/ai-reducer', icon: FileCode },
  { title: '模板管理', url: '/templates', icon: FileCode },
  { title: '设置', url: '/settings', icon: Settings },
];

export function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full">
        <aside
          className={`border-r border-border bg-sidebar transition-all duration-300 ease-in-out shrink-0 ${
            isCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Logo 区域 */}
            <div className={`p-4 border-b border-border ${isCollapsed ? 'px-3' : 'px-6'}`}>
              {isCollapsed ? (
                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    CW
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">CoWrite</h1>
                  <p className="text-sm text-muted-foreground mt-1">写作辅助工具</p>
                </>
              )}
            </div>

            {/* 折叠按钮 */}
            <div className={`p-2 border-b border-border ${isCollapsed ? 'px-2' : 'px-4'}`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className={`w-full ${isCollapsed ? 'px-2' : 'justify-start'}`}
              >
                {isCollapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronsLeft className="h-4 w-4 mr-2" />
                    <span>收起侧边栏</span>
                  </>
                )}
              </Button>
            </div>

            {/* 菜单内容 */}
            <div className="flex-1 overflow-y-auto py-4">
              {/* 主菜单 */}
              <div className={`mb-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
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

                    return isCollapsed ? (
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

                    return isCollapsed ? (
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
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to="/admin"
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
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b border-border bg-background shrink-0">
            <div className="flex h-16 items-center px-6 gap-4">
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    {profile?.username || user?.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="h-4 w-4 mr-2" />
                      设置
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {<Outlet />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
