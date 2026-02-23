"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "./ui/sheet";
import {
  Menu,
  Settings,
  LogOut,
  Palette,
  Check,
  Home,
  Wrench,
  Users,
  Building2,
  Shield,
  Newspaper,
  User as UserIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { themes } from "@/lib/themes";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  const pathname = usePathname();
  const router = useRouter();

  const { user, loading, logout } = useAuth();
  const appName = "DaHUB";

  // Admin хуудас дээр байгаа эсэх
  const isAdminPage = pathname.startsWith("/admin");

  // Admin хуудасны menu
  const adminLinks = [
    { href: "/admin", label: "Нүүр", icon: Home },
    { href: "/admin/users", label: "Хэрэглэгч", icon: Users },
    { href: "/admin/departments", label: "Хэлтэс", icon: Building2 },
    { href: "/admin/news", label: "Мэдээ", icon: Newspaper },
    { href: "/admin/tools", label: "Хэрэгсэл", icon: Wrench },
  ];

  // Үндсэн menu - энгийн хэрэглэгч: Нүүр, Хэлтэс, Мэдээ, Хэрэгсэл
  // Admin: + Хэрэглэгч
  const regularLinks = [
    { href: "/", label: "Нүүр", icon: Home, public: true },
    { href: "/departments", label: "Хэлтэс", icon: Building2, public: true },
    { href: "/news", label: "Мэдээ", icon: Newspaper, public: true },
    { href: "/tools", label: "Хэрэгсэл", icon: Wrench, public: true },
  ];

  // Admin эрхтэй бол админ хуудас руу очих товч нэмэх
  if (mounted && user?.isAdmin === true && !isAdminPage && !loading) {
    regularLinks.push({
      href: "/admin",
      label: "Админ",
      icon: Shield,
      public: false,
    });
  }

  const mainLinks = isAdminPage ? adminLinks : regularLinks;

  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    try {
      const isAdmin = user?.isAdmin;
      logout();
      toast({ title: "Амжилттай гарлаа." });
      router.push(isAdmin ? "/admin/login" : "/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Гарахад алдаа гарлаа.", variant: "destructive" });
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  return (
    <header className="sticky top-0 left-0 w-full z-50 min-h-[60px] md:min-h-[72px]">
      <div className="relative">
        <div className="mx-3 md:mx-4 mt-3 md:mt-4 grid grid-cols-[1fr_auto_1fr] items-center p-2 px-4 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
          <div className="flex justify-self-start items-center gap-2">
            {!isAdminPage && (
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="pr-0">
                  <SheetHeader>
                    <SheetTitle>
                      <SheetClose asChild>
                        <Link
                          href={isAdminPage ? "/admin" : "/"}
                          className="flex items-center space-x-2 text-left pl-4"
                        >
                          <Image
                            src="/golomt.jpg"
                            alt="Golomt"
                            width={32}
                            height={32}
                            className="rounded-md"
                          />
                          <span className="font-bold text-2xl">
                            {isAdminPage ? "Админ самбар" : appName}
                          </span>
                        </Link>
                      </SheetClose>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col space-y-2 mt-6 pl-4">
                    {mainLinks.map((link) => {
                      const isActive = isAdminPage
                        ? link.href === "/admin"
                          ? pathname === "/admin"
                          : pathname.startsWith(link.href)
                        : (pathname.startsWith(link.href) &&
                            link.href !== "/") ||
                          pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-lg transition-colors hover:text-primary",
                            isActive
                              ? "bg-muted text-primary font-semibold"
                              : "text-muted-foreground",
                          )}
                        >
                          <link.icon className="h-5 w-5" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            )}

            {!isAdminPage && (
              <nav className="hidden md:flex items-center gap-4">
                {mainLinks.map((link) => {
                  const isActive =
                    (pathname.startsWith(link.href) && link.href !== "/") ||
                    pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "text-sm font-medium transition-colors hover:text-primary",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="justify-self-center">
            <Link
              href={isAdminPage ? "/admin" : "/"}
              className="font-bold text-2xl tracking-tighter text-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <Image
                src="/golomt.jpg"
                alt="Golomt"
                width={32}
                height={32}
                className="rounded-md"
              />
              {isAdminPage ? "Админ самбар" : appName}
            </Link>
          </div>

          <div className="justify-self-end flex items-center gap-2">
            {mounted && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Тохиргоо</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="mr-2 h-4 w-4" />
                      <span>Загвар</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="p-2 min-w-[180px]">
                      <div className="grid gap-1">
                        {themes.map((themeOption) => (
                          <DropdownMenuItem
                            key={themeOption.name}
                            onClick={() => handleThemeChange(themeOption.name)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                              theme === themeOption.name
                                ? "bg-primary/15 border border-primary/30"
                                : "hover:bg-white/5",
                            )}
                          >
                            <div
                              className="w-4 h-4 rounded-full ring-2 ring-white/20 shadow-lg"
                              style={{
                                backgroundColor: `hsl(${themeOption.primary})`,
                                boxShadow: `0 0 12px hsl(${themeOption.primary} / 0.5)`,
                              }}
                            />
                            <span className="flex-1 font-medium">
                              {themeOption.name.charAt(0).toUpperCase() +
                                themeOption.name.slice(1).replace("-", " ")}
                            </span>
                            {theme === themeOption.name && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Профайл тохиргоо</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Гарах</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
