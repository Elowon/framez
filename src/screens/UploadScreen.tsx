// src/screens/UploadScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export default function UploadScreen() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const getImageUrl = useMutation(api.upload.getImageUrl);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImageToConvex = async (): Promise<string | null> => {
    if (!image) return null;

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();
      
      // Upload the image
      const response = await fetch(image);
      const blob = await response.blob();
      
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob.type },
      });
      
      const { storageId } = await uploadResult.json();
      
      // Get the public URL
      return await getImageUrl({ storageId });

    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload Failed", "Failed to upload image");
      return null;
    }
  };

  const submitPost = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    if (!text.trim() && !image) {
      Alert.alert("Error", "Please add some text or an image to your post.");
      return;
    }

    try {
      setUploading(true);

      let imageUrl = null;
      
      if (image) {
        imageUrl = await uploadImageToConvex();
        if (!imageUrl) return;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        text: text.trim(),
        image_url: imageUrl,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      Alert.alert("Success", "Post published!");
      setText("");
      setImage(null);
      navigation.navigate("Home");
      
    } catch {
      Alert.alert("Error", "Failed to create post");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Post</Text>
      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={500}
      />
      {image && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: image }} style={styles.imagePreview} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
            <Text style={styles.removeImageText}>Remove Image</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.btn} onPress={pickImage}>
        <Text style={styles.btnText1}>Pick Image</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnBlack, uploading && styles.btnDisabled]} onPress={submitPost} disabled={uploading}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{image ? "Post with Image" : "Post Text"}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, marginTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, height: 120, marginBottom: 15, textAlignVertical: "top", fontSize: 16 },
  imageContainer: { marginBottom: 15 },
  imagePreview: { width: "100%", height: 250, borderRadius: 10, marginBottom: 10 },
  removeImageBtn: { backgroundColor: "#ff4444", padding: 8, borderRadius: 6, alignItems: "center" },
  removeImageText: { color: "white", fontWeight: "bold", fontSize: 12 },
  btn: { borderWidth: 1, borderColor: "#000", padding: 12, borderRadius: 10, marginBottom: 10, alignItems: "center" },
  btnBlack: { backgroundColor: "black", padding: 12, borderRadius: 10, alignItems: "center" },
  btnDisabled: { backgroundColor: "#666" },
  btnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  btnText1: { color: "black", fontWeight: "bold", fontSize: 16 },
});