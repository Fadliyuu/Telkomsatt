"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadImage } from "@/lib/utils/cloudinary";
import toast from "react-hot-toast";

interface ImageUploadProps {
  value?: string[];
  images?: string[]; // Alternative prop name
  onChange?: (urls: string[]) => void;
  onImagesChange?: (urls: string[]) => void; // Alternative prop name
  maxImages?: number;
  folder?: string;
  label?: string;
  disabled?: boolean;
  compact?: boolean; // Compact mode for smaller UI
}

export default function ImageUpload({
  value,
  images,
  onChange,
  onImagesChange,
  maxImages = 5,
  folder = "inventaris-sparepart/guest",
  label = "Upload Foto",
  disabled = false,
  compact = false,
}: ImageUploadProps) {
  // Support both prop naming conventions
  const currentImages = images || value || [];
  const handleChange = onImagesChange || onChange || (() => {});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (currentImages.length + files.length > maxImages) {
      toast.error(`Maksimal ${maxImages} foto`);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map((file) => {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} bukan file gambar`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} terlalu besar (maks 5MB)`);
        }

        return uploadImage(file, folder);
      });

      const results = await Promise.all(uploadPromises);
      const newUrls = results.map((r) => r.url);
      
      handleChange([...currentImages, ...newUrls]);
      toast.success(`${newUrls.length} foto berhasil diunggah`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah foto";
      toast.error(message);
      console.error(error);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const newUrls = currentImages.filter((_, i) => i !== index);
    handleChange(newUrls);
  };

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-2"}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {currentImages.length > 0 && (
            <span className="ml-2 text-gray-500">
              ({currentImages.length}/{maxImages})
            </span>
          )}
        </label>
      )}

      {/* Upload Button */}
      {currentImages.length < maxImages && (
        <div
          onClick={handleClick}
          className={`
            relative border-2 border-dashed rounded-lg transition-colors cursor-pointer
            ${compact ? "p-3" : "p-6"}
            ${
              disabled || uploading
                ? "border-gray-300 bg-gray-50 cursor-not-allowed"
                : "border-gray-300 hover:border-orange-500 hover:bg-orange-50"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
          />

          <div className={`flex items-center justify-center ${compact ? "flex-row space-x-3" : "flex-col space-y-2"}`}>
            {uploading ? (
              <>
                <Loader2 className={`${compact ? "w-5 h-5" : "w-8 h-8"} text-orange-600 animate-spin`} />
                <p className={`${compact ? "text-xs" : "text-sm"} text-gray-600`}>Mengunggah...</p>
              </>
            ) : (
              <>
                <Upload className={`${compact ? "w-5 h-5" : "w-8 h-8"} text-gray-400`} />
                <div className={compact ? "" : "text-center"}>
                  <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-gray-700`}>
                    {compact ? "Klik untuk upload foto" : "Klik untuk upload foto"}
                  </p>
                  {!compact && (
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG, GIF maksimal 5MB
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Image Preview Grid */}
      {currentImages.length > 0 && (
        <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"}`}>
          {currentImages.map((url, index) => (
            <div
              key={index}
              className={`relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-100 ${compact ? "aspect-square" : "aspect-square"}`}
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  onClick={() => handleRemove(index)}
                  className={`absolute top-1 right-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 ${compact ? "p-1" : "p-1.5"}`}
                  type="button"
                >
                  <X className={compact ? "w-3 h-3" : "w-4 h-4"} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
