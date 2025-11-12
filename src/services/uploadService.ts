// src/services/uploadService.ts
import { supabase } from "./supabase";

export async function uploadProfileImage(uri: string, userId: string) {
  if (!uri) throw new Error("No URI provided");

  // Read file into blob (Expo / RN)
  const response = await fetch(uri);
  const blob = await response.blob();

  // Build path
  const path = `${userId}/${Date.now()}.jpg`;

  // Upload
  const { error: uploadError } = await supabase.storage
    .from("profile-images")
    .upload(path, blob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Failed to get public URL");

  return data.publicUrl;
}
