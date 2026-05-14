"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Star,
  Globe,
} from "lucide-react";
import { usersApi } from "@/lib/api";
import api from "@/lib/api";
import axios from "axios";
import BackButton from "@/components/shared/BackButton";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
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
    t("passwordReq1"),
    t("passwordReq2"),
    t("passwordReq3"),
    t("passwordReq4"),
    t("passwordReq5"),
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
        title: t("error"),
        description: t("passwordFillAll"),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t("error"),
        description: t("passwordMismatch"),
        variant: "destructive",
      });
      return;
    }

    if (!validatePassword(newPassword)) {
      toast({
        title: t("error"),
        description: t("passwordInvalid"),
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

      toast({ title: t("success"), description: t("passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      let message = t("passwordChangeBtn");
      if (axios.isAxiosError(error)) message = error.response?.data?.message ?? message;
      toast({ title: t("error"), description: message, variant: "destructive" });
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

      toast({ title: t("success"), description: t("imageSuccess") });
      await refreshUser();
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error uploading profile image:", error);
      let errorMessage = t("imageError");
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 413) errorMessage = t("imageTooBig");
        else if (error.response?.data?.message) errorMessage = error.response.data.message;
      } else if (error instanceof Error && error.message.includes("too large")) {
        errorMessage = t("imageTooBig");
      }
      toast({ title: t("error"), description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;

    setIsUploadingImage(true);

    try {
      await usersApi.update(user.id, { profileImage: "" });

      toast({ title: t("success"), description: t("imageRemoved") });
      await refreshUser();
    } catch (error) {
      console.error("Error removing profile image:", error);
      toast({ title: t("error"), description: t("imageError"), variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl text-foreground">Нэвтрэх шаардлагатай</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
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
            <SettingsIcon className="w-8 h-8 text-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t("settingsTitle")}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-500" />
              {t("settingsSubtitle")}
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
            <Card className="bg-card/60 backdrop-blur-xl border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Camera className="w-5 h-5 text-purple-500" />
                  {t("profileImage")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t("profileImageDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="w-32 h-32 border-4 border-purple-500/30 shadow-lg shadow-purple-500/20">
                    <AvatarImage
                      src={imagePreview || user.profileImage}
                      alt={user.name}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-foreground text-3xl">
                      {user.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col items-center gap-2">
                    <p className="text-foreground font-semibold flex items-center gap-2">
                      {user.isAdmin && (
                        <Shield className="w-4 h-4 text-blue-500" />
                      )}
                      {user.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.userId}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {user.department}
                    </p>
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
                      {t("changeImage")}
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
                        className="w-full"
                        disabled={isUploadingImage}
                      >
                        {t("cancel")}
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
                        t("removeImage")
                      )}
                    </Button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground/70 space-y-1">
                  <p>• {t("imageHint1")}</p>
                  <p>• {t("imageHint2")}</p>
                  <p>• {t("imageHint3")}</p>
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
            <Card className="bg-card/60 backdrop-blur-xl border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <KeyRound className="w-5 h-5 text-blue-500" />
                  {t("changePassword")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t("changePasswordDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="currentPassword"
                      className="text-foreground/80"
                    >
                      {t("currentPassword")}
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pr-10"
                        placeholder={t("currentPasswordPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                    <Label htmlFor="newPassword" className="text-foreground/80">
                      {t("newPassword")}
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                        placeholder={t("newPasswordPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                    <Label
                      htmlFor="confirmPassword"
                      className="text-foreground/80"
                    >
                      {t("confirmPassword")}
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                        placeholder={t("confirmPasswordPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground/80 mb-2">
                      {t("passwordRequirements")}
                    </p>
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-xs text-muted-foreground">
                          {req}
                        </span>
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
                        {t("passwordChanging")}
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        {t("passwordChangeBtn")}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
          {/* Language Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2"
          >
            <Card className="bg-card/60 backdrop-blur-xl border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  {t("language")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t("languageDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLanguage("mn")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      language === "mn"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : "bg-muted/50 border-border text-muted-foreground hover:border-border/60"
                    }`}
                  >
                    🇲🇳 {t("mongolian")}
                  </button>
                  <button
                    onClick={() => setLanguage("en")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      language === "en"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : "bg-muted/50 border-border text-muted-foreground hover:border-border/60"
                    }`}
                  >
                    🇺🇸 {t("english")}
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
