"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import api from "@/lib/api";
import BackButton from "@/components/shared/BackButton";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const passwordRequirements = [
    "Хамгийн багадаа 8 тэмдэгт",
    "Том үсэг агуулсан",
    "Жижиг үсэг агуулсан",
    "Тоо агуулсан",
    "Тусгай тэмдэгт агуулсан (@$!%*?&)",
  ];

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);

    return (
      minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Алдаа",
        description: "Бүх талбарыг бөглөнө үү",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Алдаа",
        description: "Шинэ нууц үг таарахгүй байна",
        variant: "destructive",
      });
      return;
    }

    if (!validatePassword(newPassword)) {
      toast({
        title: "Алдаа",
        description: "Нууц үг шаардлагыг хангахгүй байна",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      toast({
        title: "Амжилттай",
        description: "Нууц үг амжилттай солигдлоо",
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Алдаа",
        description:
          error.response?.data?.message || "Нууц үг солихоор алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <BackButton />
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-primary" />
              <CardTitle>Нууц үг солих</CardTitle>
            </div>
            <CardDescription>
              Таны данс руу нэвтрэх нууц үгийг солих. Шинэ нууц үг нь аюулгүй
              байх ёстой.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Одоогийн нууц үг *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="pl-10 pr-10"
                    placeholder="Одоогийн нууц үг"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Шинэ нууц үг *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pl-10 pr-10"
                    placeholder="Шинэ нууц үг"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Нууц үг давтах *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-10 pr-10"
                    placeholder="Нууц үг давтах"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium mb-2">
                    Нууц үгийн шаардлага:
                  </p>
                  <ul className="space-y-1">
                    {passwordRequirements.map((req, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-center gap-2"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? "Түр хүлээнэ үү..." : "Нууц үг солих"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Цэвэрлэх
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
