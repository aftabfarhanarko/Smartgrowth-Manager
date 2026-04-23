"use client";

import { useCallback, useState } from "react";

export default function useImgbbUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const uploadImage = useCallback(async (file) => {
    if (!file) throw new Error("Please select an image");

    const apiKey = "4ba7f7ac04e8b97db1e85e7a46c609d7";
    if (!apiKey) {
      throw new Error("Missing NEXT_PUBLIC_IMGBB_API_KEY in environment");
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok || !json?.success || !json?.data?.url) {
        throw new Error(json?.error?.message || "Failed to upload image");
      }

      return json.data.url;
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Image upload failed";
      setError(message);
      throw uploadError;
    } finally {
      setUploading(false);
    }
  }, []);

  return {
    uploadImage,
    uploading,
    error,
    clearError,
  };
}
