'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Heart,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronsUpDown,
  ArrowRightLeft,
  ScrollText,
  Shield,
} from 'lucide-react';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { NotificationBell } from '@/components/cms/NotificationBell';

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCMSStore, type CMSPage } from '@/store/useCMSStore';
import { hasPlatformPermissionSync as hasPlatformPermission, type PlatformAction } from '@/lib/permissions';

type NavItem = { key: CMSPage; label: string; icon: React.ElementType; tooltip: string; permission: PlatformAction };

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tooltip: 'Dashboard', permission: 'platform:weddings:read' },
  { key: 'weddings', label: 'Wedding Accounts', icon: Heart, tooltip: 'Wedding Accounts', permission: 'platform:weddings:read' },
  { key: 'templates', label: 'Content Templates', icon: FileText, tooltip: 'Content Templates', permission: 'platform:templates:manage' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, tooltip: 'Analytics', permission: 'platform:analytics:read' },
  { key: 'settings', label: 'Settings', icon: Settings, tooltip: 'Settings', permission: 'platform:settings:read' },
  { key: 'users', label: 'Team', icon: Users, tooltip: 'Team', permission: 'platform:users:manage' },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield, tooltip: 'Roles & Permissions', permission: 'platform:users:manage' },
  { key: 'audit', label: 'Audit Log', icon: ScrollText, tooltip: 'Audit Log', permission: 'platform:audit:read' },
];

const PAGE_TITLES: Record<CMSPage, string> = {
  dashboard: 'Dashboard',
  weddings: 'Wedding Accounts',
  users: 'Team',
  roles: 'Roles & Permissions',
  templates: 'Content Templates',
  'template-editor': 'Edit Template',
  analytics: 'Analytics',
  settings: 'Settings',
  audit: 'Audit Log',
};

function CMSLogo() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div className="flex items-center justify-center py-3 px-2">
      <img
        src="/dreamweavers-logo.png"
        alt="Dreamweavers"
        className={`brightness-0 invert transition-all duration-200 ${isCollapsed ? 'h-[13px] w-auto' : 'h-[15px] w-auto'}`}
      />
    </div>
  );
}

function SidebarNav() {
  const { currentPage, setPage } = useCMSStore();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { data: session } = useSession();
  const userRole = session?.user?.role || '';

  // Filter nav items by the user's platform permissions
  const visibleItems = NAV_ITEMS.filter((item) => hasPlatformPermission(userRole, item.permission));

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="text-paper-cream/30">
          {isCollapsed ? '···' : 'Navigation'}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.key;

              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    tooltip={item.tooltip}
                    isActive={isActive}
                    onClick={() => setPage(item.key)}
                    className={`
                      relative rounded-md text-paper-cream/60 hover:bg-paper-cream/8 hover:text-paper-cream
                      data-[active=true]:bg-cinematic-gold/12 data-[active=true]:text-cinematic-gold
                      data-[active=true]:border-l-2 data-[active=true]:border-cinematic-gold
                      data-[active=true]:font-medium
                      transition-colors duration-150
                    `}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}

function SidebarUserFooter() {
  const { data: session } = useSession();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AD';

  if (isCollapsed) {
    return (
      <SidebarFooter className="mt-auto">
        <div className="flex flex-col items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8 border border-paper-cream/15">
            <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? 'User'} />
            <AvatarFallback className="bg-paper-cream/10 text-xs text-paper-cream/70">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => signOut()}
            className="rounded-md p-1.5 text-paper-cream/40 hover:bg-paper-cream/8 hover:text-red-400 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    );
  }

  return (
    <SidebarFooter className="mt-auto">
      <Separator className="bg-paper-cream/8 mx-2" />
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar className="h-9 w-9 border border-paper-cream/15">
          <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? 'User'} />
          <AvatarFallback className="bg-paper-cream/10 text-xs text-paper-cream/70">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="truncate text-sm font-medium text-paper-cream">
            {user?.name ?? 'Admin User'}
          </span>
          <span className="truncate text-xs text-paper-cream/40">
            {user?.email ?? 'admin@dreamweavers.com'}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-md p-1.5 text-paper-cream/40 hover:bg-paper-cream/8 hover:text-red-400 transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </SidebarFooter>
  );
}

function CMSHeader() {
  const { currentPage } = useCMSStore();
  const { data: session } = useSession();

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AD';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-champagne-silk/30 bg-paper-cream px-4 md:px-6">
      <SidebarTrigger className="-ml-1 text-charcoal-ink/60 hover:text-charcoal-ink" />
      <Separator orientation="vertical" className="mr-2 h-4 !bg-champagne-silk/30" />
      <h1
        className="text-lg font-semibold text-charcoal-ink"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {PAGE_TITLES[currentPage]}
      </h1>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell variant="master" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-0.5 pr-3 hover:bg-champagne-silk/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinematic-gold/40 focus-visible:ring-offset-2">
              <Avatar className="h-8 w-8 border border-champagne-silk/30">
                <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? 'User'} />
                <AvatarFallback className="bg-champagne-silk/20 text-xs font-medium text-charcoal-ink">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-charcoal-ink/70">
                {user?.name ?? 'Admin User'}
              </span>
              <ChevronsUpDown className="hidden sm:block size-3.5 text-charcoal-ink/30" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name ?? 'Admin User'}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.email ?? 'admin@dreamweavers.com'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Badge variant="secondary" className="bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold/20 text-[11px] font-medium">
                Admin
              </Badge>
              <span className="text-xs text-muted-foreground">Dreamweavers PTL</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                useAuthModalStore.getState().openModal();
                signOut({ redirect: false });
              }}
              className="cursor-pointer"
            >
              <ArrowRightLeft className="mr-2 size-4" />
              Switch Account
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/?view=cms' })}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function MasterCMSLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        className="border-r border-paper-cream/8 bg-charcoal-ink text-paper-cream"
      >
        <SidebarHeader className="border-b border-paper-cream/8">
          <CMSLogo />
        </SidebarHeader>
        <SidebarNav />
        <SidebarUserFooter />
      </Sidebar>
      <SidebarInset className="bg-paper-cream">
        <CMSHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}