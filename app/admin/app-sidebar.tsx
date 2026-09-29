'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
    LayoutDashboard,
    Briefcase,
    ClipboardList,
    FileText,
    Users,
    Settings,
    LogOut,
    ChevronDown,
    ShieldCheck,
    Layers,
    UserCog,
    Sun,
    Moon,
    Monitor,
    CreditCard,
    ClipboardCheck,
} from 'lucide-react'

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'

type User = { name: string; email: string; image: string | null }

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Demands', href: '/admin/demands', icon: Layers },
  { label: 'Internships', href: '/admin/internships', icon: Briefcase },
  { label: 'Registrations', href: '/admin/registrations', icon: ClipboardList },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Exams', href: '/admin/exams', icon: FileText },
  { label: 'Exam Submissions', href: '/admin/exam-submissions', icon: ClipboardCheck },
  { label: 'Teams', href: '/admin/teams', icon: Users },
  { label: 'Users', href: '/admin/users', icon: UserCog },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

function getInitials(name?: string | null) {
    if (!name) return 'A'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AppSidebar({ user }: { user: User }) {
    const pathname = usePathname()
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)
    const [signingOut, setSigningOut] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    async function handleLogout() {
        try {
            setSigningOut(true)
            await authClient.signOut()
            router.replace('/login')
        } catch {
            setSigningOut(false)
        }
    }

    const themeLabel = !mounted
        ? 'Theme'
        : theme === 'light'
            ? 'Light'
            : theme === 'dark'
                ? 'Dark'
                : 'System'

    const ThemeIcon = !mounted
        ? Monitor
        : theme === 'light'
            ? Sun
            : theme === 'dark'
                ? Moon
                : Monitor

    return (
        <Sidebar collapsible="icon">
            {/* ---------- Header: Workspace switcher ---------- */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <SidebarMenuButton
                                        size="lg"
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                    />
                                }
                            >
                                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <ShieldCheck className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">ADMIN</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        Workspace
                                    </span>
                                </div>
                                <ChevronDown className="ml-auto" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                                align="start"
                                side="bottom"
                                sideOffset={4}
                            >
                                <DropdownMenuLabel className="text-muted-foreground text-xs">
                                    Workspaces
                                </DropdownMenuLabel>
                                <DropdownMenuGroup>
                                    <DropdownMenuItem className="gap-2 p-2">
                                        <div className="flex size-6 items-center justify-center rounded-md border">
                                            <ShieldCheck className="size-3.5 shrink-0" />
                                        </div>
                                        <span>Admin Panel</span>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* ---------- Content: Navigation ---------- */}
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Platform</SidebarGroupLabel>
                    <SidebarMenu>
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon
                            const isActive =
                                item.href === '/admin'
                                    ? pathname === '/admin'
                                    : pathname.startsWith(item.href)

                            return (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        render={<Link href={item.href} />}
                                        isActive={isActive}
                                        tooltip={item.label}
                                    >
                                        <Icon />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            {/* ---------- Footer: User dropdown ---------- */}
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                                <Avatar className="h-8 w-8 rounded-lg">
                                    {user.image && <AvatarImage src={user.image} alt={user.name} />}
                                    <AvatarFallback className="rounded-lg">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{user.name}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {user.email}
                                    </span>
                                </div>
                                <ChevronDown className="ml-auto size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                                side="bottom"
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuGroup>

                                    <DropdownMenuLabel className="p-0 font-normal">
                                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                            <Avatar className="h-8 w-8 rounded-lg">
                                                {user.image && (
                                                    <AvatarImage src={user.image} alt={user.name} />
                                                )}
                                                <AvatarFallback className="rounded-lg">
                                                    {getInitials(user.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">
                                                    {user.name}
                                                </span>
                                                <span className="text-muted-foreground truncate text-xs">
                                                    {user.email}
                                                </span>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuGroup>
                                        <DropdownMenuItem render={<Link href="/admin/settings" />}>
                                            <Settings />
                                            Settings
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>

                                    <DropdownMenuSeparator />

                                    {/* Theme switcher */}
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <ThemeIcon />
                                            <span>Theme</span>
                                            <span className="text-muted-foreground ml-auto text-xs">
                                                {themeLabel}
                                            </span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuItem
                                                onClick={() => setTheme('light')}
                                            >
                                                <Sun />
                                                Light
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setTheme('dark')}
                                            >
                                                <Moon />
                                                Dark
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setTheme('system')}
                                            >
                                                <Monitor />
                                                System
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={(e) => {
                                            e.preventDefault()
                                            handleLogout()
                                        }}
                                        disabled={signingOut}
                                    >
                                        <LogOut />
                                        {signingOut ? 'Signing out…' : 'Logout'}
                                    </DropdownMenuItem>

                                </DropdownMenuGroup>

                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}