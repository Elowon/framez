// src/screens/EditProfileScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
  ScrollView,
  StatusBar,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

import { supabase } from "../services/supabase";

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any | null>(null);

  // Convex upload functions
  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const getImageUrl = useMutation(api.upload.getImageUrl);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [currentCover, setCurrentCover] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  // Get user
  useEffect(() => {
    const fetchUser = async () => {
      const res = await supabase.auth.getUser();
      if (res.data?.user) setUser(res.data.user);
    };
    fetchUser();
  }, []);

  // Fetch profile data
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) {
        console.warn("fetch profile error:", error);
        return;
      }
      if (data) {
        setName(data.name || data.full_name || "");
        setBio(data.bio || "");
        setDarkMode(data.dark_mode || false);
        setCurrentPhoto(data.avatar_url || null);
        setCurrentCover(data.cover_url || null);
      }
    };
    loadProfile();
  }, [user]);

  // Pick profile image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setLocalUri(result.assets[0].uri);
    }
  };

  // Pick cover image
  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 1],
    });
    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
    }
  };

  // Convex upload logic (same as in UploadScreen)
  const uploadImageToConvex = async (uri: string): Promise<string | null> => {
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uri);
      const blob = await response.blob();
      const upload = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob.type },
      });
      const { storageId } = await upload.json();
      return await getImageUrl({ storageId });
    } catch (err) {
      console.error("Convex upload error:", err);
      Alert.alert("Error", "Image upload failed");
      return null;
    }
  };

  // Save changes
  const saveChanges = async () => {
    if (!user) {
      Alert.alert("Error", "User not found.");
      return;
    }

    try {
      setUploading(true);
      setProgress(0);

      let avatar_url = currentPhoto;
      let cover_url = currentCover;

      if (localUri) {
        avatar_url = await uploadImageToConvex(localUri);
        if (!avatar_url) throw new Error("Failed to upload avatar");
        setProgress(40);
      }

      if (coverUri) {
        cover_url = await uploadImageToConvex(coverUri);
        if (!cover_url) throw new Error("Failed to upload cover");
        setProgress(70);
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          bio,
          avatar_url,
          cover_url,
          dark_mode: darkMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProgress(100);
      Alert.alert("Success", "Profile updated!");
      navigation.goBack();
    } catch (err: any) {
      console.error("saveChanges error:", err);
      Alert.alert("Error", err.message || "Failed to save changes.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: darkMode ? "#0f0f0f" : "#f8f9fa" },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={saveChanges} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtn}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Cover */}
        <TouchableOpacity onPress={pickCover} style={styles.coverContainer}>
          <Image
            source={{
              uri:
                coverUri ||
                currentCover ||
                "https://images.unsplash.com/photo-1579546929662-711aa81148cf?w=800",
            }}
            style={styles.cover}
          />
          <View style={styles.overlay}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.overlayText}>Change Cover</Text>
          </View>
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage}>
            <Image
              source={{
                uri:
                  localUri ||
                  currentPhoto ||
                  "https://cdn-icons-png.flaticon.com/512/149/149071.png",
              }}
              style={styles.avatar}
            />
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={[styles.label, { color: darkMode ? "#fff" : "#333" }]}>
            Full Name
          </Text>
          <TextInput
            style={[styles.input, { color: darkMode ? "#fff" : "#000" }]}
            value={name}
            onChangeText={setName}
            placeholder="Enter full name"
            placeholderTextColor="#888"
          />

          <Text style={[styles.label, { color: darkMode ? "#fff" : "#333" }]}>
            Bio
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { color: darkMode ? "#fff" : "#000" },
            ]}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#888"
          />

          <View style={styles.darkRow}>
            <Text style={[styles.label, { color: darkMode ? "#fff" : "#333" }]}>
              Dark Mode
            </Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#999", true: "#667eea" }}
              thumbColor="#fff"
            />
          </View>

          {uploading && (
            <View style={styles.progressContainer}>
              <Text style={{ color: darkMode ? "#fff" : "#333" }}>
                Uploading... {progress}%
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveLarge, uploading && styles.disabled]}
            onPress={saveChanges}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveLargeText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#667eea",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  saveBtn: { color: "#fff", fontSize: 16, fontWeight: "600" },
  scroll: { flex: 1 },
  coverContainer: { position: "relative" },
  cover: { width: "100%", height: 150 },
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  overlayText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  avatarSection: { alignItems: "center", marginTop: -50, marginBottom: 20 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#667eea",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  darkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  progressContainer: { marginBottom: 20 },
  progressBar: { height: 6, backgroundColor: "#e0e0e0", borderRadius: 3 },
  progressFill: { height: "100%", backgroundColor: "#667eea" },
  saveLarge: {
    backgroundColor: "#667eea",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveLargeText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
