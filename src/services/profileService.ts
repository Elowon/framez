
import { supabase } from "./supabase";
import * as FileSystem from 'expo-file-system';

export async function uploadProfileImage(userId: string, fileUri: string) {
  try {
    const fileExt = fileUri.split(".").pop() || 'jpg';
    const fileName = `${userId}-avatar-${Date.now()}.${fileExt}`;
    
    console.log('Uploading profile image...', fileName);

    
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64'
    });

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, base64, { 
        upsert: true,
        contentType: `image/${fileExt}`
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("profile-images")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log('Profile image uploaded:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error("uploadProfileImage error:", err);
    return null;
  }
}

export async function uploadCoverImage(userId: string, fileUri: string) {
  try {
    const fileExt = fileUri.split(".").pop() || 'jpg';
    const fileName = `${userId}-cover-${Date.now()}.${fileExt}`;
    
    console.log('Uploading cover image...', fileName);

    
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64'
    });

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, base64, { 
        upsert: true,
        contentType: `image/${fileExt}`
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("profile-images")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log('Cover image uploaded:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error("uploadCoverImage error:", err);
    return null;
  }
}


export async function updateProfileWithImages(userId: string, imageUpdates: { avatar_url?: string | null; cover_url?: string | null }) {
  try {
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (imageUpdates.avatar_url !== undefined) {
      updates.avatar_url = imageUpdates.avatar_url;
    }
    if (imageUpdates.cover_url !== undefined) {
      updates.cover_url = imageUpdates.cover_url;
    }

    console.log('Updating profile images:', updates);

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
    
    console.log('Profile images updated successfully');
    return true;
  } catch (err) {
    console.error("updateProfileWithImages error:", err);
    throw err;
  }
}


export async function fetchUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code === 'PGRST116') {
      console.log('No profile found, creating new one...');
      
      const newProfile = {
        id: userId,
        username: `user_${userId.slice(0, 8)}`,
        name: "Your Name",
        full_name: "Your Name",
        bio: "Your bio",
        avatar_url: null,
        cover_url: null,
        dark_mode: false,
      };

      const { data: createdData, error: createError } = await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return newProfile;
      }

      console.log('New profile created successfully');
      return createdData;
    }

    if (error) {
      console.error('Error fetching profile:', error);
      return {
        id: userId,
        username: `user_${userId.slice(0, 8)}`,
        name: "Your Name",
        full_name: "Your Name",
        bio: "Your bio",
        avatar_url: null,
        cover_url: null,
        dark_mode: false,
      };
    }

    console.log('Profile fetched successfully');
    return data;
  } catch (err) {
    console.error("fetchUserProfile error:", err);
    return {
      id: userId,
      username: `user_${userId.slice(0, 8)}`,
      name: "Your Name",
      full_name: "Your Name",
      bio: "Your bio",
      avatar_url: null,
      cover_url: null,
      dark_mode: false,
    };
  }
}


export async function updateUserProfile(userId: string, updates: any) {
  try {
    const allowedFields = ['username', 'name', 'full_name', 'bio', 'avatar_url', 'cover_url', 'dark_mode'];
    
    const validUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    });

    console.log('Updating profile with:', validUpdates);

    const { error } = await supabase
      .from("profiles")
      .update(validUpdates)
      .eq("id", userId);

    if (error) throw error;
    
    console.log('Profile updated successfully');
    return true;
  } catch (err) {
    console.error("updateUserProfile error:", err);
    throw err;
  }
}


export async function createPost(userId: string, postData: { text: string; imageUrl?: string }) {
  try {
    const post = {
      user_id: userId,
      text: postData.text,
      image_url: postData.imageUrl || null,
    };

    console.log('Creating post:', post);

    const { data, error } = await supabase
      .from("posts")
      .insert(post)
      .select();

    if (error) throw error;
    
    console.log('Post created successfully');
    return data;
  } catch (err) {
    console.error("createPost error:", err);
    throw err;
  }
}

export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase connection failed:', error);
      return false;
    }

    console.log('Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
}

export async function getUserPosts(userId: string) {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error("getUserPosts error:", err);
    return [];
  }
}