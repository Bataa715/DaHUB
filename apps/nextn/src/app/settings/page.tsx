"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  User,
  Camera,
  Upload,
  Loader2,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
} from "lucide-react";
import { usersApi } from "@/lib/api";
import api from "@/lib/api";
import BackButton from "@/components/shared/BackButton";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const passwordRequirements = [
    "Хамгийн багадаа 8 тэмдэгт",
    "Том үсэг агуулсан (A-Z)",
    "Жижиг үсэг агуулсан (a-z)",
    "Тоо агуулсан (0-9)",
    "Тусгай тэмдэгт агуулсан (@$!%*?&#)",
  ];

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]/.test(
      password,
    );

    return (
      minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar
    );
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
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

    setIsChangingPassword(true);

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
          error.response?.data?.message || "Нууц үг солихдоо алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Алдаа",
        description: "Зургийн хэмжээ 5MB-аас бага байх ёстой",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Алдаа",
        description: "Зөвхөн зураг файл сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;

      // Compress image by resizing
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Max dimensions - smaller for better compression
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;

        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to base64 with higher compression
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
        setImagePreview(compressedBase64);
      };

      img.src = base64String;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!imagePreview || !user) return;

    setIsUploadingImage(true);

    try {
      await usersApi.update(user.id, { profileImage: imagePreview });

      toast({
        title: "Амжилттай",
        description: "Профайл зураг амжилттай солигдлоо",
      });

      // Refresh user context to update profile image
      await refreshUser();
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Error uploading profile image:", error);

      let errorMessage = "Зураг хадгалахад алдаа гарлаа";
      if (
        error.response?.status === 413 ||
        error.message?.includes("too large")
      ) {
        errorMessage = "Зураг хэт том байна. Жижиг зураг сонгоно уу.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Алдаа",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;

    setIsUploadingImage(true);

    try {
      await usersApi.update(user.id, { profileImage: "" });

      toast({
        title: "Амжилттай",
        description: "Профайл зураг устгагдлаа",
      });

      // Refresh user context to update profile image
      await refreshUser();
    } catch (error: any) {
      console.error("Error removing profile image:", error);
      toast({
        title: "Алдаа",
        description: "Зураг устгахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl text-white">Нэвтрэх шаардлагатай</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-600/10 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
            <SettingsIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Тохиргоо</h1>
            <p className="text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Профайл болон аюулгүй байдлын тохиргоо
            </p>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Image Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-700/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Camera className="w-5 h-5 text-purple-500" />
                  Профайл зураг
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Өөрийн профайл зургаа солих
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="w-32 h-32 border-4 border-purple-500/30 shadow-lg shadow-purple-500/20">
                    <AvatarImage
                      src={imagePreview || user.profileImage}
                      alt={user.name}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-3xl">
                      {user.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col items-center gap-2">
                    <p className="text-white font-semibold flex items-center gap-2">
                      {user.isAdmin && (
                        <Shield className="w-4 h-4 text-blue-500" />
                      )}
                      {user.name}
                    </p>
                    <p className="text-sm text-slate-400">{user.userId}</p>
                    <p className="text-xs text-slate-500">{user.department}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  {!imagePreview ? (
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      disabled={isUploadingImage}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Зураг сонгох
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={handleImageUpload}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                        disabled={isUploadingImage}
                      >
                        {isUploadingImage ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Хадгалах
                      </Button>
                      <Button
                        onClick={() => {
                          setImagePreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        variant="outline"
                        className="w-full border-slate-600 hover:bg-slate-800"
                        disabled={isUploadingImage}
                      >
                        Болих
                      </Button>
                    </div>
                  )}

                  {user.profileImage && !imagePreview && (
                    <Button
                      onClick={handleRemoveImage}
                      variant="destructive"
                      className="w-full"
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        "Зураг устгах"
                      )}
                    </Button>
                  )}
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>• Хамгийн ихдээ 5MB хэмжээтэй зураг</p>
                  <p>• Автоматаар 300x300 хэмжээтэй болгоно</p>
                  <p>• JPG, PNG, GIF форматтай байх</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Password Change Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-700/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <KeyRound className="w-5 h-5 text-blue-500" />
                  Нууц үг солих
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Аюулгүй байдлын тулд шинэ нууц үг үүсгэх
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-slate-300">
                      Одоогийн нууц үг
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white pr-10"
                        placeholder="Одоогийн нууц үгээ оруулна уу"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-slate-300">
                      Шинэ нууц үг
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white pr-10"
                        placeholder="Шинэ нууц үгээ оруулна уу"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-300">
                      Нууц үг баталгаажуулах
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white pr-10"
                        placeholder="Нууц үгээ дахин оруулна уу"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-slate-300 mb-2">
                      Нууц үгийн шаардлага:
                    </p>
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-xs text-slate-400">{req}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Солиж байна...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Нууц үг солих
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
